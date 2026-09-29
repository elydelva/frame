import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { initializeRealm } from "./realm.initializer.js";

let root: string;
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "frame-initialize-test-"));
});
afterEach(async () => rm(root, { recursive: true, force: true }));

describe("initializeRealm", () => {
  test("createsAllFormatFiles", async () => {
    await initializeRealm(root);
    const manifest = JSON.parse(await readFile(path.join(root, ".frame", "manifest.json"), "utf8"));
    const state = JSON.parse(await readFile(path.join(root, ".frame", ".state"), "utf8"));
    expect(manifest).toEqual({ formatVersion: 1 });
    expect(state).toEqual({ project: 0, milestone: 0, issue: 0, spec: 0 });
    for (const name of ["project", "milestone", "issue", "spec"]) {
      expect(
        await readFile(path.join(root, ".frame", "templates", `${name}.md`), "utf8")
      ).toContain("---");
    }
    expect(await readFile(path.join(root, ".frameconfig"), "utf8")).toContain("priority:");
  });

  test("doesNotOverwriteExistingConfigManifestOrTemplates", async () => {
    const frameDir = path.join(root, ".frame");
    const templateDir = path.join(frameDir, "templates");
    await mkdir(templateDir, { recursive: true });
    await writeFile(path.join(frameDir, "manifest.json"), '{"formatVersion":1}\n');
    await writeFile(path.join(templateDir, "issue.md"), "custom issue template\n");
    await writeFile(path.join(root, ".frameconfig"), "custom: true\n");
    await initializeRealm(root);
    expect(await readFile(path.join(root, ".frameconfig"), "utf8")).toBe("custom: true\n");
    expect(await readFile(path.join(frameDir, "manifest.json"), "utf8")).toBe(
      '{"formatVersion":1}\n'
    );
    expect(await readFile(path.join(templateDir, "issue.md"), "utf8")).toBe(
      "custom issue template\n"
    );
  });
});
