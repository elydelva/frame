import { spawn } from "node:child_process";
import type { IGitAdapter } from "@frame/core";
import { GitCommandError } from "./errors/index.js";

function run(args: string[], cwd?: string): Promise<{ exitCode: number; stderr: string }> {
  return new Promise((resolve) => {
    const stderrChunks: Buffer[] = [];
    const proc = spawn("git", args, { cwd, stdio: ["ignore", "ignore", "pipe"] });
    proc.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
    proc.on("close", (code) => {
      resolve({ exitCode: code ?? 1, stderr: Buffer.concat(stderrChunks).toString() });
    });
  });
}

export class GitAdapter implements IGitAdapter {
  /**
   * @param cwd Working directory git runs in — the realm root. Without it git
   * resolves the repository from `process.cwd()`, which breaks staging whenever
   * the realm (FRAME_ROOT) lives outside the current working directory.
   */
  constructor(private readonly cwd?: string) {}

  async stage(paths: string[]): Promise<void> {
    if (paths.length === 0) return;

    const { exitCode, stderr } = await run(["add", "--", ...paths], this.cwd);

    if (exitCode !== 0) {
      throw new GitCommandError(`git add -- ${paths.join(" ")}`, exitCode, stderr);
    }
  }

  async isRepo(): Promise<boolean> {
    const { exitCode } = await run(["rev-parse", "--is-inside-work-tree"], this.cwd);
    return exitCode === 0;
  }
}
