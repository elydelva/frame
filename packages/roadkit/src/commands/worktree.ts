import * as fs from "node:fs/promises";
import type { Container } from "../container.js";
import type { ClaimStoreErrorInfo, WorktreeClaim } from "../worktrees/types.js";
import { getFormatter } from "./output.js";

export interface WorktreeListResult {
  claims: Array<WorktreeClaim & { state: "active" | "stale" }>;
  errors: Array<ClaimStoreErrorInfo & { issueId: string }>;
}

export async function runWorktreeList(
  container: Container,
  opts: { json?: boolean } = {}
): Promise<WorktreeListResult> {
  if (!container.worktrees || !container.claims)
    throw new Error("Worktree claims require a Git working tree");
  const [entries, worktrees] = await Promise.all([
    container.claims.list(),
    container.worktrees.list(),
  ]);
  const claims: WorktreeListResult["claims"] = [];
  const errors: WorktreeListResult["errors"] = [];
  for (const entry of entries) {
    if (entry.error) {
      errors.push({ ...entry.error, issueId: entry.issueId });
      continue;
    }
    const claim = entry.claim;
    if (!claim) continue;
    const pathExists = await fs.access(claim.path).then(
      () => true,
      () => false
    );
    const registered = worktrees.some(
      (tree) => tree.path === claim.path && tree.branch === claim.branch
    );
    claims.push({ ...claim, state: pathExists && registered ? "active" : "stale" });
  }
  const result = { claims, errors };
  getFormatter(opts.json ?? false).emit({
    json: result,
    human: () => {
      for (const claim of claims)
        console.log(
          `${claim.state} ${claim.issueId} — ${claim.actor} — ${claim.branch}\n  ${claim.path}`
        );
      for (const error of errors)
        console.log(`error ${error.issueId} — ${error.code}: ${error.message}`);
      if (claims.length === 0 && errors.length === 0) console.log("No Roadkit worktree claims.");
    },
  });
  return result;
}
