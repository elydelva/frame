import { type Issue, type IssueStatus, ProjectId } from "@roadkit/core";
import type { Container } from "../../container.js";
import { setJsonMode } from "../json-mode.js";
import { getFormatter } from "../output.js";
import { formatEstimate, serializeIssue } from "../shared.js";

interface IssueListOptions {
  project?: string;
  status?: string;
  assignee?: string;
  milestone?: string;
  label?: string;
  branch?: string;
  priority?: string;
  json?: boolean;
}

function matches(issue: Issue, opts: IssueListOptions): boolean {
  if (opts.status && issue.status !== (opts.status as IssueStatus)) return false;
  if (opts.assignee && issue.assignee !== opts.assignee) return false;
  if (opts.branch && issue.branch !== opts.branch) return false;
  if (opts.priority && issue.priority !== opts.priority) return false;
  if (opts.milestone && issue.milestoneId?.toString() !== opts.milestone) return false;
  if (opts.label && !issue.labels.includes(opts.label)) return false;
  return true;
}

export async function runIssueList(container: Container, opts: IssueListOptions): Promise<void> {
  setJsonMode(opts.json ?? false);
  const all = opts.project
    ? await container.repo.findIssuesForProject(ProjectId.from(opts.project))
    : await container.repo.findAllIssues();
  const issues = all.filter((i) => matches(i, opts));
  const claimEntries = (await container.claims?.list()) ?? [];
  const claims = new Map(claimEntries.map((entry) => [entry.issueId, entry]));

  getFormatter(opts.json ?? false).emit({
    json: issues.map((issue) => {
      const entry = claims.get(issue.id.toString());
      return {
        ...serializeIssue(issue),
        claim: entry?.claim
          ? { actor: entry.claim.actor, branch: entry.claim.branch, path: entry.claim.path }
          : null,
        claimError: entry?.error ?? null,
      };
    }),
    human: () => {
      if (issues.length === 0) {
        console.log("No issues.");
        return;
      }
      for (const i of issues) {
        const est = formatEstimate(container.config, i.estimate);
        const tag = est ? `${i.priority} · ${est}` : i.priority;
        const who = i.assignee ? `  @${i.assignee}` : "";
        const claim = claims.get(i.id.toString());
        const claimInfo = claim?.claim
          ? `  claimed by ${claim.claim.actor} · ${claim.claim.path}`
          : claim?.error
            ? `  claim unavailable (${claim.error.code})`
            : "";
        console.log(`${i.id.toString()}  [${i.status}]  ${i.title}  (${tag})${who}${claimInfo}`);
      }
    },
  });
}
