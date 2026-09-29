import type { RealmConfig } from "@frame/core";
import { FsRealmRepository, readRealmConfig } from "@frame/fs";
import { GitAdapter } from "@frame/git";
import { GitWorktreeAdapter } from "@frame/git";
import { Frame } from "@frame/sdk";
import { assertRealmCompatible } from "./format-compatibility.js";
import { WorktreeClaimStore } from "./worktrees/claim-store.js";

export interface Container {
  realmRoot: string;
  repoRoot: string;
  worktrees: GitWorktreeAdapter | null;
  claims: WorktreeClaimStore | null;
  config: RealmConfig;
  frame: Frame;
}

export async function createContainer(realmRoot: string): Promise<Container> {
  await assertRealmCompatible(realmRoot);

  // Git runs in the realm root so staging works when FRAME_ROOT points
  // outside the current working directory. Staging is performed by the
  // repository (best-effort) using absolute, realm-rooted paths; the use-cases
  // are staged best-effort by the adapter exactly once.
  const git = new GitAdapter(realmRoot);
  const invocationRoot = process.env.FRAME_ROOT ? process.cwd() : realmRoot;
  const worktrees = new GitWorktreeAdapter(invocationRoot);
  let repoRoot = invocationRoot;
  let claims: WorktreeClaimStore | null = null;
  try {
    repoRoot = await worktrees.getTopLevel();
    claims = new WorktreeClaimStore(await worktrees.getCommonDir());
  } catch {
    // Frame realms may intentionally live outside a Git repository.
  }
  const repo = new FsRealmRepository(realmRoot, git);
  const config = await readRealmConfig(realmRoot);

  return {
    realmRoot,
    repoRoot,
    worktrees: claims ? worktrees : null,
    claims,
    config,
    frame: new Frame({ root: realmRoot, repository: repo, config }),
  };
}
