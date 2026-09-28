import type { Container } from "../container.js";
import { setJsonMode } from "./json-mode.js";
import { getFormatter } from "./output.js";
import { formatEstimate, serializeIssue, serializeMilestone, serializeProject } from "./shared.js";

interface NextOptions {
  json?: boolean;
}

export async function runNext(container: Container, opts: NextOptions): Promise<void> {
  setJsonMode(opts.json ?? false);
  const claimEntries = (await container.claims?.list()) ?? [];
  const result = await container.getNext.execute({
    excludedIssueIds: new Set(claimEntries.map((entry) => entry.issueId)),
  });

  getFormatter(opts.json ?? false).emit({
    json: result
      ? {
          issue: serializeIssue(result.issue),
          project: serializeProject(result.project),
          milestone: result.milestone ? serializeMilestone(result.milestone) : null,
        }
      : null,
    human: () => {
      if (!result) {
        console.log("No eligible issue.");
        return;
      }
      const { issue, project, milestone } = result;
      const scope = milestone
        ? `${project.id.toString()} / ${milestone.id.toString()}`
        : project.id.toString();
      const est = formatEstimate(container.config, issue.estimate);
      const tag = est ? `${issue.priority} · ${est}` : issue.priority;
      console.log(`→ ${issue.id.toString()}  ${issue.title}  [${tag}]  (${scope})`);
    },
  });
}
