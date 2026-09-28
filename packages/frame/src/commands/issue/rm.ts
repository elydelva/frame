import { IssueId } from "@frame/core";
import type { Container } from "../../container.js";
import { setJsonMode } from "../json-mode.js";
import { getFormatter } from "../output.js";
import { type ActorOptions, resolveActor, serializeIssue } from "../shared.js";

export async function runIssueRemove(
  container: Container,
  idRaw: string,
  opts: ActorOptions & { json?: boolean }
): Promise<void> {
  setJsonMode(opts.json ?? false);
  const { actor, actorType, note } = resolveActor(opts);
  const issue = await container.deleteIssue.execute({
    id: IssueId.from(idRaw),
    actor,
    actorType,
    ...(note ? { note } : {}),
  });
  getFormatter(opts.json ?? false).emit({
    json: serializeIssue(issue),
    human: () => console.log(`✓ Deleted ${issue.id.toString()} — ${issue.title}`),
  });
}
