import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { CONFIG_FILE } from "../constants.js";
import { readRealmConfig, writeRealmConfig } from "./realm-config.reader.js";

async function mkTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "frame-config-test-"));
}

async function writeConfig(dir: string, body: string): Promise<void> {
  await fs.writeFile(path.join(dir, CONFIG_FILE), body, "utf-8");
}

describe("readRealmConfig", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkTempDir();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("returns defaults when the config file is absent", async () => {
    const config = await readRealmConfig(tempDir);
    expect(config.version).toBe(1);
    expect(config.estimation.scale).toBe("fibonacci");
    expect(config.estimation.default).toBeNull();
    expect(config.priority.levels).toEqual(["urgent", "high", "medium", "low", "none"]);
    expect(config.priority.default).toBe("none");
    expect(config.labels).toEqual([]);
  });

  it("reads a valid config", async () => {
    await writeConfig(
      tempDir,
      [
        "version: 1",
        "estimation:",
        "  scale: tshirt",
        "  default: 3",
        "priority:",
        "  levels: [P0, P1, P2, P3]",
        "  default: P2",
        "labels:",
        "  - { name: bug, color: red }",
        "  - { name: feature, color: blue, group: kind }",
        "",
      ].join("\n")
    );
    const config = await readRealmConfig(tempDir);
    expect(config.estimation).toEqual({ scale: "tshirt", default: 3 });
    expect(config.priority).toEqual({ levels: ["P0", "P1", "P2", "P3"], default: "P2" });
    expect(config.labels).toEqual([
      { name: "bug", color: "red" },
      { name: "feature", color: "blue", group: "kind" },
    ]);
  });

  it("falls back per-section for a partial config", async () => {
    await writeConfig(tempDir, "priority:\n  levels: [a, b]\n  default: a\n");
    const config = await readRealmConfig(tempDir);
    expect(config.priority).toEqual({ levels: ["a", "b"], default: "a" });
    expect(config.estimation.scale).toBe("fibonacci");
    expect(config.labels).toEqual([]);
  });

  it("falls back to the first level when default is not in levels", async () => {
    await writeConfig(tempDir, "priority:\n  levels: [P0, P1]\n  default: P9\n");
    const config = await readRealmConfig(tempDir);
    expect(config.priority).toEqual({ levels: ["P0", "P1"], default: "P0" });
  });

  it("falls back to defaults when priority.levels is empty or non-string", async () => {
    await writeConfig(tempDir, "priority:\n  levels: []\n  default: x\n");
    expect((await readRealmConfig(tempDir)).priority.default).toBe("none");

    await writeConfig(tempDir, "priority:\n  levels: [1, 2]\n");
    expect((await readRealmConfig(tempDir)).priority.levels).toEqual([
      "urgent",
      "high",
      "medium",
      "low",
      "none",
    ]);
  });

  it("falls back to fibonacci for an unknown scale", async () => {
    await writeConfig(tempDir, "estimation:\n  scale: bogus\n");
    expect((await readRealmConfig(tempDir)).estimation.scale).toBe("fibonacci");
  });

  it("reads an estimation values override", async () => {
    await writeConfig(
      tempDir,
      "estimation:\n  scale: none\n  default: null\n  values:\n    - { label: Z, points: 9 }\n"
    );
    const config = await readRealmConfig(tempDir);
    expect(config.estimation.values).toEqual([{ label: "Z", points: 9 }]);
  });

  it("preserves an explicit version number", async () => {
    await writeConfig(tempDir, "version: 7\n");
    expect((await readRealmConfig(tempDir)).version).toBe(7);
  });

  it("ignores malformed labels and keeps valid ones", async () => {
    await writeConfig(tempDir, "labels:\n  - { name: ok }\n  - notAnObject\n  - { color: red }\n");
    expect((await readRealmConfig(tempDir)).labels).toEqual([{ name: "ok" }]);
  });

  it("returns defaults for a scalar (non-object) YAML document", async () => {
    await writeConfig(tempDir, "just a string\n");
    expect((await readRealmConfig(tempDir)).estimation.scale).toBe("fibonacci");
  });

  it("returns defaults for malformed YAML", async () => {
    await writeConfig(tempDir, "estimation: [unterminated\n");
    expect((await readRealmConfig(tempDir)).version).toBe(1);
  });

  it("loads defaults for a legacy ADRKit config, ignoring its keys", async () => {
    await writeConfig(
      tempDir,
      "idFormat: PROJ-XXXX\ntypes:\n  - project\n  - issue\ntemplates: {}\n"
    );
    const config = await readRealmConfig(tempDir);
    expect(config.version).toBe(1);
    expect(config.estimation.scale).toBe("fibonacci");
    expect(config.priority.levels).toEqual(["urgent", "high", "medium", "low", "none"]);
    expect(config.labels).toEqual([]);
  });

  it("round-trips through writeRealmConfig", async () => {
    await writeRealmConfig(tempDir, {
      version: 1,
      estimation: { scale: "tshirt", default: 3, values: [{ label: "M", points: 3 }] },
      priority: { levels: ["P0", "P1"], default: "P1" },
      labels: [{ name: "bug", color: "red" }],
    });
    const config = await readRealmConfig(tempDir);
    expect(config.estimation).toEqual({
      scale: "tshirt",
      default: 3,
      values: [{ label: "M", points: 3 }],
    });
    expect(config.priority).toEqual({ levels: ["P0", "P1"], default: "P1" });
    expect(config.labels).toEqual([{ name: "bug", color: "red" }]);
  });
});
