import { spawn } from "node:child_process";
import * as path from "node:path";
import { GitCommandError } from "./errors/index.js";

export interface GitWorktree {
  path: string;
  head: string | null;
  branch: string | null;
  detached: boolean;
  locked: boolean;
  prunable: boolean;
}

export interface AddWorktreeInput {
  path: string;
  branch: string;
  base: string;
}

interface GitResult {
  stdout: string;
  stderr: string;
}

function runGit(args: string[], cwd: string): Promise<GitResult> {
  return new Promise((resolve, reject) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const proc = spawn("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    proc.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
    proc.on("error", (error) => {
      reject(new GitCommandError(`git ${args.join(" ")}`, 127, error.message));
    });
    proc.on("close", (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString("utf-8");
      const stderr = Buffer.concat(stderrChunks).toString("utf-8");
      if (code !== 0) {
        reject(new GitCommandError(`git ${args.join(" ")}`, code ?? 1, stderr));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function parseWorktrees(porcelain: string): GitWorktree[] {
  const result: GitWorktree[] = [];
  let current: GitWorktree | null = null;

  for (const field of porcelain.split("\0")) {
    if (!field) continue;
    if (field.startsWith("worktree ")) {
      if (current) result.push(current);
      current = {
        path: field.slice("worktree ".length),
        head: null,
        branch: null,
        detached: false,
        locked: false,
        prunable: false,
      };
    } else if (current) {
      if (field.startsWith("HEAD ")) current.head = field.slice("HEAD ".length);
      else if (field.startsWith("branch refs/heads/")) {
        current.branch = field.slice("branch refs/heads/".length);
      } else if (field === "detached") current.detached = true;
      else if (field === "locked" || field.startsWith("locked ")) current.locked = true;
      else if (field === "prunable" || field.startsWith("prunable ")) current.prunable = true;
    }
  }

  if (current) result.push(current);
  return result;
}

export class GitWorktreeAdapter {
  constructor(private readonly cwd: string) {}

  async getCommonDir(): Promise<string> {
    const { stdout } = await runGit(["rev-parse", "--git-common-dir"], this.cwd);
    return path.resolve(this.cwd, stdout.trim());
  }

  async getTopLevel(): Promise<string> {
    const { stdout } = await runGit(["rev-parse", "--show-toplevel"], this.cwd);
    return path.resolve(this.cwd, stdout.trim());
  }

  async getHead(): Promise<string> {
    const { stdout } = await runGit(["rev-parse", "HEAD"], this.cwd);
    return stdout.trim();
  }

  async branchExists(branch: string): Promise<boolean> {
    const { stdout } = await runGit(
      ["branch", "--list", "--format=%(refname:short)", branch],
      this.cwd
    );
    return stdout.split("\n").some((line) => line === branch);
  }

  async isIgnored(targetPath: string): Promise<boolean> {
    try {
      await runGit(["check-ignore", "-q", "--", targetPath], this.cwd);
      return true;
    } catch (error) {
      if (error instanceof GitCommandError && error.exitCode === 1) return false;
      throw error;
    }
  }

  async isClean(worktreePath: string): Promise<boolean> {
    const { stdout } = await runGit(
      ["status", "--porcelain", "--untracked-files=all"],
      worktreePath
    );
    return stdout.length === 0;
  }

  async list(): Promise<GitWorktree[]> {
    const { stdout } = await runGit(["worktree", "list", "--porcelain", "-z"], this.cwd);
    return parseWorktrees(stdout);
  }

  async add(input: AddWorktreeInput): Promise<void> {
    await runGit(["worktree", "add", "-b", input.branch, input.path, input.base], this.cwd);
  }

  async remove(worktreePath: string): Promise<void> {
    await runGit(["worktree", "remove", worktreePath], this.cwd);
  }
}
