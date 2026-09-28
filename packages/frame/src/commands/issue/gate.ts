import { IssueId } from "@frame/core";
import type { Container } from "../../container.js";
import { setJsonMode } from "../json-mode.js";
import { getFormatter } from "../output.js";
import { type ActorOptions, fail, resolveActor, serializeIssue } from "../shared.js";

/** A gate is "ISSUE-0003" (local) or "PROJ-0001/ISSUE-0003" (cross-project). */
function toGate(raw: string): IssueId | string {
  return raw.includes("/") ? raw : IssueId.from(raw);
}

async function applyGates(
  container: Container,
  idRaw: string,
  gates: Array<IssueId | string>,
  opts: ActorOptions & { json?: boolean }
): Promise<void> {
  const { actor, actorType, note } = resolveActor(opts);
  const issue = await container.editIssue.execute({
    id: IssueId.from(idRaw),
    actor,
    actorType,
    ...(note ? { note } : {}),
    gates,
  });
  getFormatter(opts.json ?? false).emit({
    json: serializeIssue(issue),
    human: () =>
      console.log(`✓ ${issue.id.toString()} gates: [${issue.gates.map(String).join(", ")}]`),
  });
}

export async function runIssueGateAdd(
  container: Container,
  idRaw: string,
  gateRaw: string,
  opts: ActorOptions & { json?: boolean }
): Promise<void> {
  setJsonMode(opts.json ?? false);
  const issue = await container.repo.findIssue(IssueId.from(idRaw));
  if (!issue) fail(`Issue not found: "${idRaw}"`);
  const current = issue.gates.map(String);
  if (current.includes(gateRaw)) fail(`Gate already present: ${gateRaw}`);
  await applyGates(container, idRaw, [...issue.gates, toGate(gateRaw)], opts);
}

export async function runIssueGateRemove(
  container: Container,
  idRaw: string,
  gateRaw: string,
  opts: ActorOptions & { json?: boolean }
): Promise<void> {
  setJsonMode(opts.json ?? false);
  const issue = await container.repo.findIssue(IssueId.from(idRaw));
  if (!issue) fail(`Issue not found: "${idRaw}"`);
  const kept = issue.gates.filter((g) => String(g) !== gateRaw);
  if (kept.length === issue.gates.length) fail(`Gate not present: ${gateRaw}`);
  await applyGates(container, idRaw, kept, opts);
}
