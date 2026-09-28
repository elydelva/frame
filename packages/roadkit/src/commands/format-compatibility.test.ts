import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

const CLI_ENTRY = path.resolve(import.meta.dir, "../index.ts");

describe("CLI realm format compatibility", () => {
  let realmRoot: string;

  beforeEach(async () => {
    realmRoot = await fs.mkdtemp(path.join(os.tmpdir(), "roadkit-cli-format-test-"));
    await fs.mkdir(path.join(realmRoot, ".roadkit"), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(realmRoot, { recursive: true, force: true });
  });

  it.each([
    ["format 2", '{"formatVersion":2}', "UNSUPPORTED_REALM_FORMAT", "format 2"],
    ["malformed manifest", "{", "INVALID_REALM_MANIFEST", "not valid JSON"],
  ])(
    "rejects %s before read or mutation and emits JSON errors",
    async (_label, manifest, code, diagnostic) => {
      const config = "version: 1\npriority:\n  default: low\n";
      await fs.writeFile(path.join(realmRoot, "roadfig.yml"), config, "utf-8");
      await fs.writeFile(path.join(realmRoot, ".roadkit", "manifest.json"), manifest, "utf-8");

      for (const args of [
        ["next", "--json"],
        ["project", "new", "--title", "Must not be written", "--json"],
      ]) {
        const result = runCLI(args);
        expect(result.status).toBe(1);
        expect(result.stdout).toBe("");
        const error = JSON.parse(result.stderr).error;
        expect(error.code).toBe(code);
        expect(error.message).toContain(diagnostic);
        expect(error.message).toContain("Supported realm format: 1");
        expect(await fs.readFile(path.join(realmRoot, "roadfig.yml"), "utf-8")).toBe(config);
        expect(await fs.readdir(path.join(realmRoot, ".roadkit"))).toEqual(["manifest.json"]);
      }
    }
  );

  it("allows a legacy manifest-free realm to read and mutate as format 1", async () => {
    const result = runCLI(["project", "new", "--title", "Legacy project", "--json"]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).id).toBe("PROJ-0001");
    await expect(fs.access(path.join(realmRoot, ".roadkit", "manifest.json"))).rejects.toThrow();
  });

  it("allows explicit format 1 for reads and mutations", async () => {
    await fs.writeFile(
      path.join(realmRoot, ".roadkit", "manifest.json"),
      '{"formatVersion":1}\n',
      "utf-8"
    );

    const read = runCLI(["next", "--json"]);
    const mutation = runCLI(["project", "new", "--title", "Current project", "--json"]);

    expect(read.status).toBe(0);
    expect(JSON.parse(read.stdout)).toBeNull();
    expect(mutation.status).toBe(0);
    expect(JSON.parse(mutation.stdout).id).toBe("PROJ-0001");
  });

  function runCLI(args: string[]) {
    return spawnSync(process.execPath, [CLI_ENTRY, ...args], {
      cwd: realmRoot,
      encoding: "utf-8",
      env: { ...process.env, ROADKIT_ROOT: realmRoot },
    });
  }
});
