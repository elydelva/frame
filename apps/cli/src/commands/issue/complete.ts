import { IssueId } from "@frame/core";
import type { Container } from "../../container.js";
import { setJsonMode } from "../json-mode.js";
import { getFormatter } from "../output.js";
import { type ActorOptions, resolveActor, serializeIssue } from "../shared.js";

interface IssueCompleteOptions extends ActorOptions {
  json?: boolean;
  assignee?: string;
  branch?: string;
}

export async function runIssueComplete(
  container: Container,
  idRaw: string,
  opts: IssueCompleteOptions = {}
): Promise<void> {
  setJsonMode(opts.json ?? false);
  const { actor, actorType, note } = resolveActor(opts);
  const issue = await container.frame.issues.complete(IssueId.from(idRaw), {
    actor,
    actorType,
    ...(note ? { note } : {}),
    ...(opts.assignee ? { assignee: opts.assignee } : {}),
    ...(opts.branch ? { branch: opts.branch } : {}),
  });
  getFormatter(opts.json ?? false).emit({
    json: serializeIssue(issue),
    human: () => console.log(`✓ Completed ${issue.id.toString()} — ${issue.title}`),
  });
}
