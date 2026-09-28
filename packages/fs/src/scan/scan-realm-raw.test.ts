import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { scanRealmRaw } from "./scan-realm-raw.js";

async function write(root: string, rel: string, content: string): Promise<void> {
  const abs = path.join(root, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, "utf-8");
}

describe("scanRealmRaw", () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "frame-scan-"));
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("returns an empty scan for a realm with no projects", async () => {
    const result = await scanRealmRaw(root);
    expect(result).toEqual({ records: [], diagnostics: [] });
  });

  it("collects project, issue, and spec records with raw frontmatter", async () => {
    const dir = ".frame/projects/PROJ-0001-checkout";
    await write(root, `${dir}/PROJ-0001.md`, "---\nid: PROJ-0001\nstatus: active\n---\n");
    await write(
      root,
      `${dir}/issues/ISSUE-0001-x.md`,
      "---\nid: ISSUE-0001\nprojectId: PROJ-0001\nstatus: not-started\n---\n"
    );
    await write(
      root,
      `${dir}/specs/SPEC-0001-y.md`,
      "---\nid: SPEC-0001\nprojectId: PROJ-0001\nstatus: draft\n---\n"
    );
    // Traces are not scanned.
    await write(root, `${dir}/traces/TRACE-1.md`, "---\nid: TRACE-1\n---\n");

    const result = await scanRealmRaw(root);
    const byKind = result.records.map((r) => r.kind).sort();
    expect(byKind).toEqual(["issue", "project", "spec"]);
    const issue = result.records.find((r) => r.kind === "issue");
    expect(issue?.data.id).toBe("ISSUE-0001");
    expect(result.diagnostics).toEqual([]);
  });

  it("captures malformed frontmatter as a diagnostic", async () => {
    const dir = ".frame/projects/PROJ-0001-x";
    await write(root, `${dir}/PROJ-0001.md`, "---\nid: PROJ-0001\nstatus: active\n---\n");
    await write(
      root,
      `${dir}/issues/ISSUE-0001-x.md`,
      "---\nid: ISSUE-0001\n  bad:\n - : :\nstatus: [unterminated\n---\n"
    );

    const result = await scanRealmRaw(root);
    expect(result.diagnostics.length).toBe(1);
    expect(result.diagnostics[0]?.file).toContain("ISSUE-0001");
  });
});
