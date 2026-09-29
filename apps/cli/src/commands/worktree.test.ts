import { afterEach, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { createContainer } from "../container.js";
import { runIssueRelease } from "./issue/release.js";
import { runWorktreeList } from "./worktree.js";

const roots: string[] = [];

function git(cwd: string, ...args: string[]) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "frame-worktree-list-"));
  roots.push(root);
  git(root, "init", "-q");
  git(root, "config", "user.name", "Test Agent");
  git(root, "config", "user.email", "test@example.com");
  const container = await createContainer(root);
  const project = await container.frame.projects.create({
    title: "Project",
    author: "test",
    actor: "test",
    leads: [],
    body: "",
  });
  await container.frame.projects.setStatus(project.id, "active", { actor: "test" });
  const issue = await container.frame.issues.create({
    projectId: project.id,
    title: "Task",
    author: "test",
    actor: "test",
    priority: "medium",
    labels: [],
    gates: [],
    body: "",
  });
  git(root, "add", ".");
  git(root, "commit", "-qm", "fixture");
  if (!container.worktrees || !container.claims) throw new Error("expected Git capabilities");
  return { root, container, issue, worktrees: container.worktrees, claims: container.claims };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("worktree list and issue release", () => {
  it("lists an active claim with worktree metadata and marks missing paths stale", async () => {
    const { root, container, issue, worktrees, claims } = await fixture();
    const activePath = path.join(container.repoRoot, "active");
    await worktrees.add({
      path: activePath,
      branch: "task/active",
      base: await worktrees.getHead(),
    });
    await claims.claim({
      issueId: issue.id.toString(),
      actor: "agent:one",
      branch: "task/active",
      path: activePath,
    });
    await claims.claim({
      issueId: "ISSUE-0099",
      actor: "agent:two",
      branch: "task/missing",
      path: path.join(root, "missing"),
    });

    const result = await runWorktreeList(container, { json: true });
    expect(result.claims.map(({ issueId, state }) => [issueId, state])).toEqual([
      [issue.id.toString(), "active"],
      ["ISSUE-0099", "stale"],
    ]);
  });

  it("reports unsupported claim protocol without rewriting the record", async () => {
    const { root, container, worktrees } = await fixture();
    const commonDir = await worktrees.getCommonDir();
    const claimPath = path.join(commonDir, "frame", "claims", "ISSUE-0009.json");
    await fs.mkdir(path.dirname(claimPath), { recursive: true });
    await fs.writeFile(claimPath, '{"protocolVersion":2}\n');
    const result = await runWorktreeList(container, { json: true });
    expect(result.errors[0]?.code).toBe("UNSUPPORTED_CLAIM_PROTOCOL");
    expect(result.errors[0]?.issueId).toBe("ISSUE-0009");
    expect(await fs.readFile(claimPath, "utf8")).toBe('{"protocolVersion":2}\n');
  });

  it("releases an active claim without removing its worktree or changing issue status", async () => {
    const { container, issue, worktrees, claims } = await fixture();
    const targetPath = path.join(container.repoRoot, "active");
    await worktrees.add({
      path: targetPath,
      branch: "task/active",
      base: await worktrees.getHead(),
    });
    await claims.claim({
      issueId: issue.id.toString(),
      actor: "agent:one",
      branch: "task/active",
      path: targetPath,
    });
    await runIssueRelease(container, issue.id.toString(), { json: true });
    expect(await claims.get(issue.id.toString())).toBeNull();
    expect((await worktrees.list()).some((tree) => tree.path === targetPath)).toBe(true);
    expect((await container.frame.issues.get(issue.id))?.status).toBe("not-started");
  });

  it("releases a stale claim while preserving its missing-worktree location for reporting", async () => {
    const { container, issue, worktrees, claims } = await fixture();
    const stalePath = path.join(container.repoRoot, "gone");
    await claims.claim({
      issueId: issue.id.toString(),
      actor: "agent:one",
      branch: "task/gone",
      path: stalePath,
    });
    await runIssueRelease(container, issue.id.toString(), { json: true });
    expect(await claims.get(issue.id.toString())).toBeNull();
    expect(
      await fs.access(stalePath).then(
        () => true,
        () => false
      )
    ).toBe(false);
  });
});
