import { IssueId } from "@frame/core";
import type { Container } from "../../container.js";
import { setJsonMode } from "../json-mode.js";
import { getFormatter } from "../output.js";
import { fail, formatEstimate, serializeIssue, serializeTrace } from "../shared.js";

interface IssueShowOptions {
  json?: boolean;
}

export async function runIssueShow(
  container: Container,
  idRaw: string,
  opts: IssueShowOptions
): Promise<void> {
  setJsonMode(opts.json ?? false);
  const id = IssueId.from(idRaw);
  const issue = await container.frame.issues.get(id);
  if (!issue) fail(`Issue not found: "${idRaw}"`);
  const traces = await container.frame.traces.list({ issueId: id });

  getFormatter(opts.json ?? false).emit({
    json: { ...serializeIssue(issue), traces: traces.map(serializeTrace) },
    human: () => {
      const est = formatEstimate(container.config, issue.estimate);
      console.log(`${issue.id.toString()}  ${issue.title}`);
      console.log(`  Status:    ${issue.status}`);
      console.log(`  Priority:  ${issue.priority}${est ? ` · ${est}` : ""}`);
      console.log(`  Project:   ${issue.projectId.toString()}`);
      if (issue.milestoneId) console.log(`  Milestone: ${issue.milestoneId.toString()}`);
      if (issue.assignee) console.log(`  Assignee:  ${issue.assignee}`);
      if (issue.branch) console.log(`  Branch:    ${issue.branch}`);
      if (issue.labels.length) console.log(`  Labels:    ${issue.labels.join(", ")}`);
      if (issue.gates.length) console.log(`  Gates:     ${issue.gates.map(String).join(", ")}`);
      if (issue.body.trim()) console.log(`\n${issue.body.trim()}`);
      if (traces.length) {
        console.log(`\nHistory (${traces.length}):`);
        for (const t of traces) {
          console.log(`  ${t.at.toISOString()}  ${t.event}  (${t.actor})`);
        }
      }
    },
  });
}
