import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { readRealmFormat, writeRealmFormat } from "./format-version.js";

describe("realm format manifest", () => {
  let realmRoot: string;

  beforeEach(async () => {
    realmRoot = await fs.mkdtemp(path.join(os.tmpdir(), "roadkit-format-test-"));
  });

  afterEach(async () => {
    await fs.rm(realmRoot, { recursive: true, force: true });
  });

  it("treats an absent manifest as legacy format 1 without writing one", async () => {
    expect(await readRealmFormat(realmRoot)).toBe(1);
    await expect(fs.access(path.join(realmRoot, ".roadkit", "manifest.json"))).rejects.toThrow();
  });

  it("reads and writes the explicit current format", async () => {
    await writeRealmFormat(realmRoot);

    expect(await readRealmFormat(realmRoot)).toBe(1);
    expect(await fs.readFile(path.join(realmRoot, ".roadkit", "manifest.json"), "utf-8")).toBe(
      '{\n  "formatVersion": 1\n}\n'
    );
  });

  it("rejects malformed JSON with a manifest error", async () => {
    await writeManifest("{");

    await expect(readRealmFormat(realmRoot)).rejects.toMatchObject({
      code: "INVALID_REALM_MANIFEST",
      detectedVersion: null,
    });
  });

  it.each([
    ["missing version", "{}", null],
    ["string version", '{"formatVersion":"1"}', null],
    ["fractional version", '{"formatVersion":1.5}', 1.5],
    ["zero version", '{"formatVersion":0}', 0],
  ])("rejects %s", async (_label, content, detectedVersion) => {
    await writeManifest(content);

    await expect(readRealmFormat(realmRoot)).rejects.toMatchObject({
      code: "INVALID_REALM_MANIFEST",
      detectedVersion,
    });
  });

  it("rejects a newer entity format", async () => {
    await writeManifest('{"formatVersion":2}');

    await expect(readRealmFormat(realmRoot)).rejects.toMatchObject({
      code: "UNSUPPORTED_REALM_FORMAT",
      detectedVersion: 2,
    });
  });

  async function writeManifest(content: string): Promise<void> {
    const dir = path.join(realmRoot, ".roadkit");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "manifest.json"), content, "utf-8");
  }
});
