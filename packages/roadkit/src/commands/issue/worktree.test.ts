import { afterEach, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { createContainer } from "../../container.js";
import { runIssueWorktree } from "./worktree.js";

const roots: string[] = [];

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "roadkit-worktree-command-"));
  roots.push(root);
  git(root, "init", "-q");
  git(root, "config", "user.name", "Test Agent");
  git(root, "config", "user.email", "test@example.com");
  await fs.mkdir(path.join(root, ".worktrees"), { recursive: true });
  await fs.writeFile(path.join(root, ".git", "info", "exclude"), ".worktrees/\n");
  const container = await createContainer(root);
  const project = await container.createProject.execute({
    title: "Roadkit",
    author: "test",
    actor: "test",
    leads: [],
    body: "",
  });
  await container.setProjectStatus.execute({ id: project.id, to: "active", actor: "test" });
  const issue = await container.createIssue.execute({
    projectId: project.id,
    title: "Add Worktree Workflow",
    author: "test",
    actor: "test",
    priority: "medium",
    labels: [],
    gates: [],
    body: "",
  });
  git(root, "add", ".");
  git(root, "commit", "-qm", "fixture");
  return { root, container, issue };
}

async function forceStartFailure(
  container: Awaited<ReturnType<typeof createContainer>>,
  issueId: string,
  dirty: boolean
) {
  const adapter = container.worktrees;
  if (!adapter) throw new Error("expected Git adapter");
  const add = adapter.add.bind(adapter);
  adapter.add = async (input) => {
    await add(input);
    const projectDir = path.join(input.path, ".roadkit", "projects");
    const project = (await fs.readdir(projectDir))[0];
    if (!project) throw new Error("expected a project directory");
    const issuesDir = path.join(projectDir, project, "issues");
    const filename = (await fs.readdir(issuesDir)).find((name) => name.startsWith(issueId));
    if (!filename) throw new Error("expected an issue file");
    const file = path.join(issuesDir, filename);
    await fs.writeFile(
      file,
      (await fs.readFile(file, "utf8")).replace("status: not-started", "status: in-progress")
    );
    git(input.path, "add", ".");
    git(input.path, "commit", "-qm", "invalid-start-state");
    if (dirty) await fs.writeFile(path.join(input.path, "recovery-marker"), "preserve");
  };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("runIssueWorktree", () => {
  it("creates a claimed branch, starts the issue there, and leaves the caller checkout untouched", async () => {
    const { root, container, issue } = await fixture();
    const initialHead = git(root, "rev-parse", "HEAD");
    const result = await runIssueWorktree(container, issue.id.toString(), {
      actor: "agent:test",
      actorType: "agent",
    });

    expect(result.path).toBe(path.join(container.repoRoot, ".worktrees", issue.id.toString()));
    expect(result.branch).toBe("issue/ISSUE-0001-add-worktree-workflow");
    expect(result.claim.actor).toBe("agent:test");
    expect(git(root, "rev-parse", "HEAD")).toBe(initialHead);
    expect(git(root, "status", "--porcelain")).toBe("");
    const started = await createContainer(result.path);
    const updated = await started.repo.findIssue(issue.id);
    expect(updated?.status).toBe("in-progress");
    expect(updated?.assignee).toBe("agent:test");
    expect(updated?.branch).toBe(result.branch);
    expect(git(root, "-C", result.path, "diff", "--cached", "--name-only")).toContain("/issues/");
  });

  it("rejects an issue that is already in progress before creating a claim", async () => {
    const { root, container, issue } = await fixture();
    await container.startIssue.execute({ id: issue.id, actor: "test" });
    await expect(
      runIssueWorktree(container, issue.id.toString(), { actor: "agent:test" })
    ).rejects.toThrow("not eligible");
    expect(await container.claims?.get(issue.id.toString())).toBeNull();
    expect(
      await fs.access(path.join(root, ".worktrees", issue.id.toString())).then(
        () => true,
        () => false
      )
    ).toBe(false);
  });

  it("honors branch, path, assignee, and base overrides", async () => {
    const { root, container, issue } = await fixture();
    const base = git(root, "rev-parse", "HEAD");
    const customPath = path.join(container.repoRoot, ".worktrees", "custom-task");
    const result = await runIssueWorktree(container, issue.id.toString(), {
      actor: "agent:test",
      assignee: "ely",
      branch: "task/custom-task",
      path: customPath,
      base,
    });
    expect(result.branch).toBe("task/custom-task");
    expect(result.path).toBe(customPath);
    expect(git(root, "-C", customPath, "rev-parse", "HEAD")).toBe(base);
    const started = await createContainer(customPath);
    expect((await started.repo.findIssue(issue.id))?.assignee).toBe("ely");
  });

  it("rejects an explicit worktree path that is not ignored", async () => {
    const { container, issue } = await fixture();
    await expect(
      runIssueWorktree(container, issue.id.toString(), {
        actor: "agent:test",
        path: path.join(container.repoRoot, "visible-worktree"),
      })
    ).rejects.toThrow("must be ignored");
    expect(await container.claims?.get(issue.id.toString())).toBeNull();
  });

  it("releases the claim and removes a clean worktree when starting fails", async () => {
    const { root, container, issue } = await fixture();
    await forceStartFailure(container, issue.id.toString(), false);
    await expect(
      runIssueWorktree(container, issue.id.toString(), { actor: "agent:test" })
    ).rejects.toThrow("Invalid transition");
    expect(await container.claims?.get(issue.id.toString())).toBeNull();
    expect(
      await fs.access(path.join(container.repoRoot, ".worktrees", issue.id.toString())).then(
        () => true,
        () => false
      )
    ).toBe(false);
  });

  it("preserves a dirty worktree and claim when starting fails", async () => {
    const { root, container, issue } = await fixture();
    await forceStartFailure(container, issue.id.toString(), true);
    await expect(
      runIssueWorktree(container, issue.id.toString(), { actor: "agent:test" })
    ).rejects.toThrow("recovery required");
    const claim = await container.claims?.get(issue.id.toString());
    if (!claim) throw new Error("expected claim to be preserved");
    expect(claim?.path).toBe(path.join(container.repoRoot, ".worktrees", issue.id.toString()));
    expect(await fs.readFile(path.join(claim.path, "recovery-marker"), "utf8")).toContain(
      "preserve"
    );
  });
});
