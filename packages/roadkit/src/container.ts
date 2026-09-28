import {
  CompleteIssueUseCase,
  CreateIssueUseCase,
  CreateMilestoneUseCase,
  CreateProjectUseCase,
  CreateSpecUseCase,
  DeleteIssueUseCase,
  EditIssueUseCase,
  GetBriefUseCase,
  GetContextUseCase,
  GetHistoryUseCase,
  GetNextUseCase,
  type IRealmRepository,
  type RealmConfig,
  SetIssueStatusUseCase,
  SetMilestoneStatusUseCase,
  SetProjectStatusUseCase,
  SetSpecStatusUseCase,
  StartIssueUseCase,
} from "@roadkit/core";
import { FsRealmRepository, readRealmConfig } from "@roadkit/fs";
import { GitAdapter } from "@roadkit/git";
import { GitWorktreeAdapter } from "@roadkit/git";
import { assertRealmCompatible } from "./format-compatibility.js";
import { WorktreeClaimStore } from "./worktrees/claim-store.js";

export interface Container {
  realmRoot: string;
  repoRoot: string;
  worktrees: GitWorktreeAdapter | null;
  claims: WorktreeClaimStore | null;
  config: RealmConfig;
  repo: IRealmRepository;
  createProject: CreateProjectUseCase;
  createMilestone: CreateMilestoneUseCase;
  createIssue: CreateIssueUseCase;
  startIssue: StartIssueUseCase;
  completeIssue: CompleteIssueUseCase;
  editIssue: EditIssueUseCase;
  setIssueStatus: SetIssueStatusUseCase;
  deleteIssue: DeleteIssueUseCase;
  createSpec: CreateSpecUseCase;
  setSpecStatus: SetSpecStatusUseCase;
  setProjectStatus: SetProjectStatusUseCase;
  setMilestoneStatus: SetMilestoneStatusUseCase;
  getNext: GetNextUseCase;
  getContext: GetContextUseCase;
  getHistory: GetHistoryUseCase;
  getBrief: GetBriefUseCase;
}

export async function createContainer(realmRoot: string): Promise<Container> {
  await assertRealmCompatible(realmRoot);

  // Git runs in the realm root so staging works when ROADKIT_ROOT points
  // outside the current working directory. Staging is performed by the
  // repository (best-effort) using absolute, realm-rooted paths; the use-cases
  // are deliberately git-less to avoid double-staging.
  const git = new GitAdapter(realmRoot);
  const invocationRoot = process.env.ROADKIT_ROOT ? process.cwd() : realmRoot;
  const worktrees = new GitWorktreeAdapter(invocationRoot);
  let repoRoot = invocationRoot;
  let claims: WorktreeClaimStore | null = null;
  try {
    repoRoot = await worktrees.getTopLevel();
    claims = new WorktreeClaimStore(await worktrees.getCommonDir());
  } catch {
    // Roadkit realms may intentionally live outside a Git repository.
  }
  const repo = new FsRealmRepository(realmRoot, git);
  const config = await readRealmConfig(realmRoot);

  return {
    realmRoot,
    repoRoot,
    worktrees: claims ? worktrees : null,
    claims,
    config,
    repo,
    createProject: new CreateProjectUseCase(repo),
    createMilestone: new CreateMilestoneUseCase(repo),
    createIssue: new CreateIssueUseCase(repo),
    startIssue: new StartIssueUseCase(repo),
    completeIssue: new CompleteIssueUseCase(repo),
    editIssue: new EditIssueUseCase(repo),
    setIssueStatus: new SetIssueStatusUseCase(repo),
    deleteIssue: new DeleteIssueUseCase(repo),
    createSpec: new CreateSpecUseCase(repo),
    setSpecStatus: new SetSpecStatusUseCase(repo),
    setProjectStatus: new SetProjectStatusUseCase(repo),
    setMilestoneStatus: new SetMilestoneStatusUseCase(repo),
    getNext: new GetNextUseCase(repo, config),
    getContext: new GetContextUseCase(repo),
    getHistory: new GetHistoryUseCase(repo),
    getBrief: new GetBriefUseCase(repo, config),
  };
}
