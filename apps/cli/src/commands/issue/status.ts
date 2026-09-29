import { IssueId, type IssueStatus } from "@frame/core";
import type { Container } from "../../container.js";
import { setJsonMode } from "../json-mode.js";
import { getFormatter } from "../output.js";
import { type ActorOptions, fail, resolveActor, serializeIssue } from "../shared.js";

const ISSUE_STATUSES: readonly IssueStatus[] = [
  "not-started",
  "in-progress",
  "completed",
  "abandoned",
  "blocked",
  "skipped",
];

function parseIssueStatus(raw: string): IssueStatus {
  if (!(ISSUE_STATUSES as readonly string[]).includes(raw)) {
    fail(`Invalid status: ${raw} (expected ${ISSUE_STATUSES.join("|")})`);
  }
  return raw as IssueStatus;
}

export async function runIssueStatus(
  container: Container,
  idRaw: string,
  statusRaw: string,
  opts: ActorOptions & { json?: boolean }
): Promise<void> {
  setJsonMode(opts.json ?? false);
  const { actor, actorType, note } = resolveActor(opts);
  const issue = await container.frame.issues.setStatus(
    IssueId.from(idRaw),
    parseIssueStatus(statusRaw),
    {
      actor,
      actorType,
      ...(note ? { note } : {}),
    }
  );
  getFormatter(opts.json ?? false).emit({
    json: serializeIssue(issue),
    human: () => console.log(`✓ ${issue.id.toString()} → ${issue.status}`),
  });
}
