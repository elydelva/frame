import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { GitCommandError } from "./errors/index.js";
import { GitWorktreeAdapter } from "./worktree.adapter.js";

describe("GitWorktreeAdapter", () => {
  let tempRoot: string;
  let repoRoot: string;
  let adapter: GitWorktreeAdapter;

  beforeEach(async () => {
    tempRoot = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "frame worktree test ")));
    repoRoot = path.join(tempRoot, "repo");
    await fs.mkdir(repoRoot);
    runGit(repoRoot, ["init", "--initial-branch=main"]);
    runGit(repoRoot, ["config", "user.name", "Frame Test"]);
    runGit(repoRoot, ["config", "user.email", "frame@example.test"]);
    await fs.writeFile(path.join(repoRoot, "README.md"), "baseline\n", "utf-8");
    runGit(repoRoot, ["add", "README.md"]);
    runGit(repoRoot, ["commit", "-m", "initial"]);
    adapter = new GitWorktreeAdapter(repoRoot);
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it("returns the absolute common Git directory", async () => {
    expect(await adapter.getCommonDir()).toBe(path.join(repoRoot, ".git"));
  });

  it("lists main and linked worktrees including branches", async () => {
    const worktreePath = path.join(tempRoot, "worktree with spaces");
    await adapter.add({ path: worktreePath, branch: "feature/spaces", base: "HEAD" });

    const worktrees = await adapter.list();

    expect(worktrees).toContainEqual({
      path: repoRoot,
      head: expect.any(String),
      branch: "main",
      detached: false,
      locked: false,
      prunable: false,
    });
    expect(worktrees).toContainEqual({
      path: worktreePath,
      head: expect.any(String),
      branch: "feature/spaces",
      detached: false,
      locked: false,
      prunable: false,
    });
  });

  it("reports detached and locked worktrees", async () => {
    const detachedPath = path.join(tempRoot, "detached");
    runGit(repoRoot, ["worktree", "add", "--detach", detachedPath, "HEAD"]);
    runGit(repoRoot, ["worktree", "lock", "--reason", "test lock", detachedPath]);

    const worktree = (await adapter.list()).find((entry) => entry.path === detachedPath);

    expect(worktree).toMatchObject({
      head: expect.any(String),
      branch: null,
      detached: true,
      locked: true,
      prunable: false,
    });
  });

  it("removes a clean linked worktree without force", async () => {
    const worktreePath = path.join(tempRoot, "clean-worktree");
    await adapter.add({ path: worktreePath, branch: "feature/clean", base: "HEAD" });

    await adapter.remove(worktreePath);

    await expect(fs.access(worktreePath)).rejects.toThrow();
    expect((await adapter.list()).some((entry) => entry.path === worktreePath)).toBe(false);
  });

  it("preserves a dirty worktree when removal fails", async () => {
    const worktreePath = path.join(tempRoot, "dirty-worktree");
    await adapter.add({ path: worktreePath, branch: "feature/dirty", base: "HEAD" });
    await fs.writeFile(path.join(worktreePath, "README.md"), "changed\n", "utf-8");

    await expect(adapter.remove(worktreePath)).rejects.toBeInstanceOf(GitCommandError);
    expect(await fs.readFile(path.join(worktreePath, "README.md"), "utf-8")).toBe("changed\n");
  });

  function runGit(cwd: string, args: string[]): void {
    const result = spawnSync("git", args, { cwd, encoding: "utf-8" });
    if (result.status !== 0) {
      throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
    }
  }
});
