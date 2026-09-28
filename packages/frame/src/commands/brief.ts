import { type Brief, IssueId, ProjectId } from "@frame/core";
import type { Container } from "../container.js";
import { setJsonMode } from "./json-mode.js";
import { getFormatter } from "./output.js";
import { formatEstimate, serializeBrief } from "./shared.js";

interface BriefOptions {
  issue?: string;
  project?: string;
  json?: boolean;
}

export async function runBrief(container: Container, opts: BriefOptions): Promise<void> {
  setJsonMode(opts.json ?? false);

  const claimEntries = (await container.claims?.list()) ?? [];
  const excludedIssueIds = new Set(claimEntries.map((entry) => entry.issueId));
  const filter: {
    issueId?: IssueId;
    projectId?: ProjectId;
    excludedIssueIds: ReadonlySet<string>;
  } = { excludedIssueIds };
  if (opts.issue) filter.issueId = IssueId.from(opts.issue);
  if (opts.project) filter.projectId = ProjectId.from(opts.project);

  const brief = await container.getBrief.execute({ ...filter, excludedIssueIds });
  const claimId = opts.issue ?? brief.issue?.id.toString();
  const claimEntry = claimId ? claimEntries.find((entry) => entry.issueId === claimId) : undefined;
  const claim = claimEntry?.claim ?? null;
  const claimError =
    claimEntry?.error && claimId ? { issueId: claimId, ...claimEntry.error } : null;

  getFormatter(opts.json ?? false).emit({
    json: { ...serializeBrief(brief), claim, claimError },
    human: () => console.log(renderBrief(container, brief, claim, claimError)),
  });
}

/** Render a Markdown block ready to paste into an agent's system prompt. */
function renderBrief(
  container: Container,
  brief: Brief,
  claim: { actor: string; path: string } | null,
  claimError: { issueId: string; code: string; message: string } | null
): string {
  const lines: string[] = ["# frame brief", ""];

  if (!brief.issue) {
    lines.push("No focus issue (nothing in progress or eligible).");
    if (claimError)
      lines.push(
        `Claim for ${claimError.issueId} could not be read (${claimError.code}): ${claimError.message}`
      );
    if (brief.next) {
      lines.push("", `**Next:** ${nextLine(container, brief)}`);
    }
    return lines.join("\n");
  }

  const { issue, project, milestone } = brief;
  const est = formatEstimate(container.config, issue.estimate);
  const tag = est ? `${issue.priority} · ${est}` : issue.priority;
  lines.push(
    `## ${issue.id.toString()} — ${issue.title}`,
    `Status: ${issue.status} · ${tag}`,
    project ? `Project: ${project.id.toString()} — ${project.title}` : "",
    milestone ? `Milestone: ${milestone.id.toString()} — ${milestone.title}` : ""
  );
  if (claim) lines.push(`Claim: ${claim.actor} · ${claim.path}`);
  if (claimError)
    lines.push(
      `Claim for ${claimError.issueId} could not be read (${claimError.code}): ${claimError.message}`
    );

  if (brief.blockedReason) {
    lines.push("", `> ⚠ Blocked: ${brief.blockedReason}`);
  }

  if (brief.rules.length > 0) {
    lines.push("", "## Rules");
    for (const group of brief.rules) {
      lines.push(`- **${group.trigger}**`);
      for (const instruction of group.instructions) {
        lines.push(`  - [ ] ${instruction}`);
      }
    }
  }

  if (brief.gatesOn.length > 0 || brief.unblocks.length > 0) {
    lines.push("", "## Dependencies");
    for (const gate of brief.gatesOn) {
      lines.push(`- Gates on ${gate.gate} (${gate.status})`);
    }
    if (brief.unblocks.length > 0) {
      lines.push(`- Unblocks: ${brief.unblocks.map((i) => i.id.toString()).join(", ")}`);
    }
  }

  lines.push("", "## Next", brief.next ? nextLine(container, brief) : "Nothing else eligible.");

  if (brief.recentTraces.length > 0) {
    lines.push("", "## Recent");
    for (const t of brief.recentTraces) {
      const at = t.at.toISOString().replace("T", " ").slice(0, 19);
      lines.push(`- ${at}  ${t.event}  ${t.actor}`);
    }
  }

  return lines.filter((l, i) => l !== "" || lines[i - 1] !== "").join("\n");
}

function nextLine(container: Container, brief: Brief): string {
  if (!brief.next) return "Nothing else eligible.";
  const { issue, project, milestone } = brief.next;
  const scope = milestone
    ? `${project.id.toString()} / ${milestone.id.toString()}`
    : project.id.toString();
  const est = formatEstimate(container.config, issue.estimate);
  const tag = est ? `${issue.priority} · ${est}` : issue.priority;
  return `→ ${issue.id.toString()}  ${issue.title}  [${tag}]  (${scope})`;
}
