import * as fs from "node:fs/promises";
import * as path from "node:path";
import { DAGService, IssueId } from "@roadkit/core";
import type { Container } from "../../container.js";
import { assertRealmCompatible } from "../../format-compatibility.js";
import type { WorktreeClaim } from "../../worktrees/types.js";
import { getFormatter } from "../output.js";
import { type ActorOptions, resolveActor, serializeIssue } from "../shared.js";

export interface IssueWorktreeOptions extends ActorOptions {
  assignee?: string;
  branch?: string;
  path?: string;
  base?: string;
  json?: boolean;
}

export interface IssueWorktreeResult {
  issue: Record<string, unknown>;
  claim: WorktreeClaim;
  branch: string;
  path: string;
  actor: string;
}

export async function runIssueWorktree(
  container: Container,
  idRaw: string,
  opts: IssueWorktreeOptions = {}
): Promise<IssueWorktreeResult> {
  if (!container.worktrees || !container.claims) {
    throw new Error("Issue worktrees require a Git working tree");
  }
  await assertRealmCompatible(container.realmRoot);
  const id = IssueId.from(idRaw);
  const issue = await container.repo.findIssue(id);
  if (!issue) throw new Error(`Issue ${idRaw} was not found`);
  const [issues, projects, milestones] = await Promise.all([
    container.repo.findAllIssues(),
    container.repo.findAllProjects(),
    container.repo.findAllMilestones(),
  ]);
  if (
    !new DAGService()
      .getEligibleIssues(issues, projects, milestones)
      .some((item) => item.id.equals(id))
  ) {
    throw new Error(`Issue ${idRaw} is not eligible to start`);
  }

  const { actor, actorType, note } = resolveActor(opts);
  const branch = opts.branch ?? `issue/${idRaw}-${slugify(issue.title)}`;
  const targetPath = path.resolve(container.repoRoot, opts.path ?? path.join(".worktrees", idRaw));
  const base = opts.base ?? (await container.worktrees.getHead());
  const claim = await container.claims.claim({ issueId: idRaw, actor, branch, path: targetPath });
  let created = false;
  try {
    if (await exists(targetPath)) throw new Error(`Worktree path already exists: ${targetPath}`);
    if (await container.worktrees.branchExists(branch))
      throw new Error(`Branch already exists: ${branch}`);
    if (!(await container.worktrees.isIgnored(targetPath))) {
      throw new Error(`Worktree path must be ignored by Git: ${targetPath}`);
    }
    await container.worktrees.add({ path: targetPath, branch, base });
    created = true;
    const startedContainer = await createContainerAt(targetPath);
    const started = await startedContainer.startIssue.execute({
      id,
      actor,
      actorType,
      assignee: opts.assignee ?? actor,
      branch,
      ...(note ? { note } : {}),
    });
    const result: IssueWorktreeResult = {
      issue: serializeIssue(started),
      claim,
      branch,
      path: targetPath,
      actor,
    };
    getFormatter(opts.json ?? false).emit({
      json: result,
      human: () => {
        console.log(`✓ Started ${idRaw} in ${branch}`);
        console.log(`  ${targetPath}`);
        console.log(`  Next: cd ${targetPath}`);
      },
    });
    return result;
  } catch (error) {
    if (created) {
      try {
        if (await container.worktrees.isClean(targetPath)) {
          await container.worktrees.remove(targetPath);
          await container.claims.release(idRaw);
        } else {
          throw new Error("worktree contains changes");
        }
      } catch (cleanupError) {
        throw new Error(
          `${message(error)}; recovery required: claim ${idRaw} and worktree ${targetPath} were preserved (${message(cleanupError)})`
        );
      }
    } else {
      await container.claims.release(idRaw);
    }
    throw error;
  }
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function createContainerAt(root: string): Promise<Container> {
  // Imported lazily to keep worktree orchestration at the command boundary.
  const { createContainer } = await import("../../container.js");
  return createContainer(root);
}
