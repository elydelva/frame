import type { Container } from "../../container.js";
import type { WorktreeClaim } from "../../worktrees/types.js";
import { getFormatter } from "../output.js";
import { type ActorOptions, resolveActor } from "../shared.js";

export async function runIssueRelease(
  container: Container,
  issueId: string,
  opts: ActorOptions & { json?: boolean } = {}
): Promise<{ claim: WorktreeClaim; releasedBy: string }> {
  if (!container.claims) throw new Error("Issue claim release requires a Git working tree");
  const { actor } = resolveActor(opts);
  const snapshot = await container.claims.get(issueId);
  if (!snapshot) throw new Error(`No claim exists for ${issueId}`);
  const claim = await container.claims.release(issueId, snapshot.claimId);
  const result = { claim, releasedBy: actor };
  getFormatter(opts.json ?? false).emit({
    json: result,
    human: () =>
      console.log(
        `✓ Released ${issueId} claim held by ${claim.actor}\n  Worktree remains at ${claim.path}`
      ),
  });
  return result;
}
