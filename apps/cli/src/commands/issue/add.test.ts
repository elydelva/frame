import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { DEFAULT_CONFIG, type RealmConfig } from "@frame/core";
import { FsRealmRepository } from "@frame/fs";
import { Frame } from "@frame/sdk";
import type { Container } from "../../container.js";
import { runProjectNew } from "../project/new.js";
import { runIssueAdd } from "./add.js";

async function mkTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "frame-issue-add-test-"));
}

function makeContainer(realmRoot: string, config: RealmConfig): Container {
  const repo = new FsRealmRepository(realmRoot);
  return {
    realmRoot,
    repoRoot: realmRoot,
    worktrees: null,
    claims: null,
    config,
    frame: new Frame({ root: realmRoot, repository: repo, config }),
  } as unknown as Container;
}

function silenceLog(): () => void {
  const original = console.log;
  console.log = () => {};
  return () => {
    console.log = original;
  };
}

async function withFailStub<T>(fn: () => Promise<T>): Promise<string[]> {
  const originalExit = process.exit;
  const originalError = console.error;
  const errors: string[] = [];
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(" "));
  };
  // @ts-expect-error test stub that throws to short-circuit `never`.
  process.exit = () => {
    throw new Error("exit");
  };
  try {
    await expect(fn()).rejects.toThrow("exit");
    return errors;
  } finally {
    process.exit = originalExit;
    console.error = originalError;
  }
}

describe("runIssueAdd", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkTempDir();
    await fs.mkdir(path.join(tempDir, ".frame"), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, ".frame", ".state"),
      JSON.stringify({ project: 0, milestone: 0, issue: 0, spec: 0 }),
      "utf-8"
    );
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function seedProject(container: Container): Promise<void> {
    const restore = silenceLog();
    await runProjectNew(container, { title: "P" });
    restore();
  }

  it("applies the configured default priority when --priority is omitted", async () => {
    const config: RealmConfig = {
      ...DEFAULT_CONFIG,
      priority: { levels: ["P0", "P1", "P2", "P3"], default: "P2" },
    };
    const container = makeContainer(tempDir, config);
    await seedProject(container);

    const restore = silenceLog();
    await runIssueAdd(container, { project: "PROJ-0001", title: "A" });
    restore();

    const issues = await container.frame.issues.list({ projectId: "PROJ-0001" });
    expect(issues[0]?.priority).toBe("P2");
  });

  it("stores --assignee and --branch on the issue", async () => {
    const container = makeContainer(tempDir, DEFAULT_CONFIG);
    await seedProject(container);

    const restore = silenceLog();
    await runIssueAdd(container, {
      project: "PROJ-0001",
      title: "A",
      assignee: "dave",
      branch: "feat/a",
    });
    restore();

    const issues = await container.frame.issues.list({ projectId: "PROJ-0001" });
    expect(issues[0]?.assignee).toBe("dave");
    expect(issues[0]?.branch).toBe("feat/a");
  });

  it("resolves --estimate label to stored points", async () => {
    const config: RealmConfig = {
      ...DEFAULT_CONFIG,
      estimation: { scale: "tshirt", default: null },
    };
    const container = makeContainer(tempDir, config);
    await seedProject(container);

    const restore = silenceLog();
    await runIssueAdd(container, { project: "PROJ-0001", title: "A", estimate: "M" });
    restore();

    const issues = await container.frame.issues.list({ projectId: "PROJ-0001" });
    expect(issues[0]?.estimate).toBe(3);
  });

  it("fails when --priority is outside the configured levels", async () => {
    const config: RealmConfig = {
      ...DEFAULT_CONFIG,
      priority: { levels: ["P0", "P1"], default: "P1" },
    };
    const container = makeContainer(tempDir, config);
    await seedProject(container);

    const errors = await withFailStub(() =>
      runIssueAdd(container, { project: "PROJ-0001", title: "A", priority: "P9" })
    );
    expect(errors.join("\n")).toContain("Invalid --priority: P9");
    expect(errors.join("\n")).toContain("P0|P1");
  });

  it("fails on an invalid --estimate", async () => {
    const config: RealmConfig = {
      ...DEFAULT_CONFIG,
      estimation: { scale: "tshirt", default: null },
    };
    const container = makeContainer(tempDir, config);
    await seedProject(container);

    const errors = await withFailStub(() =>
      runIssueAdd(container, { project: "PROJ-0001", title: "A", estimate: "XXL" })
    );
    expect(errors.join("\n")).toContain("Invalid --estimate");
  });

  it("fails when --project is missing", async () => {
    const container = makeContainer(tempDir, DEFAULT_CONFIG);
    const errors = await withFailStub(() => runIssueAdd(container, { title: "A" }));
    expect(errors.join("\n")).toContain("--project is required");
  });

  it("fails when --title is missing", async () => {
    const container = makeContainer(tempDir, DEFAULT_CONFIG);
    const errors = await withFailStub(() => runIssueAdd(container, { project: "PROJ-0001" }));
    expect(errors.join("\n")).toContain("--title is required");
  });

  it("accepts labels that are in a non-empty taxonomy", async () => {
    const config: RealmConfig = {
      ...DEFAULT_CONFIG,
      labels: [{ name: "bug" }, { name: "feature" }],
    };
    const container = makeContainer(tempDir, config);
    await seedProject(container);

    const restore = silenceLog();
    await runIssueAdd(container, { project: "PROJ-0001", title: "A", labels: "bug,feature" });
    restore();

    const issues = await container.frame.issues.list({ projectId: "PROJ-0001" });
    expect(issues[0]?.labels).toEqual(["bug", "feature"]);
  });

  it("fails when a label is not in a non-empty taxonomy", async () => {
    const config: RealmConfig = {
      ...DEFAULT_CONFIG,
      labels: [{ name: "bug" }],
    };
    const container = makeContainer(tempDir, config);
    await seedProject(container);

    const errors = await withFailStub(() =>
      runIssueAdd(container, { project: "PROJ-0001", title: "A", labels: "bug,wip" })
    );
    expect(errors.join("\n")).toContain("Invalid --labels: wip");
    expect(errors.join("\n")).toContain("allowed: bug");
  });

  it("allows free-form labels when the taxonomy is empty", async () => {
    const container = makeContainer(tempDir, DEFAULT_CONFIG); // labels: []
    await seedProject(container);

    const restore = silenceLog();
    await runIssueAdd(container, { project: "PROJ-0001", title: "A", labels: "anything,goes" });
    restore();

    const issues = await container.frame.issues.list({ projectId: "PROJ-0001" });
    expect(issues[0]?.labels).toEqual(["anything", "goes"]);
  });
});
