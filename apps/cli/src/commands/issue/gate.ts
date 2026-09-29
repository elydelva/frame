import { IssueId } from "@frame/core";
import { FrameInputError } from "@frame/sdk";
import type { Container } from "../../container.js";
import { setJsonMode } from "../json-mode.js";
import { getFormatter } from "../output.js";
import { type ActorOptions, fail, resolveActor, serializeIssue } from "../shared.js";

/** A gate is "ISSUE-0003" (local) or "PROJ-0001/ISSUE-0003" (cross-project). */
function toGate(raw: string): IssueId | string {
  return raw.includes("/") ? raw : IssueId.from(raw);
}

function emitIssue(
  issue: import("@frame/core").Issue,
  opts: ActorOptions & { json?: boolean }
): void {
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
  const issue = await container.frame.issues.get(IssueId.from(idRaw));
  if (!issue) fail(`Issue not found: "${idRaw}"`);
  const current = issue.gates.map(String);
  if (current.includes(gateRaw)) fail(`Gate already present: ${gateRaw}`);
  const { actor, actorType, note } = resolveActor(opts);
  try {
    const updated = await container.frame.issues.addGate(issue.id, toGate(gateRaw), {
      actor,
      actorType,
      ...(note ? { note } : {}),
    });
    emitIssue(updated, opts);
  } catch (error) {
    if (error instanceof FrameInputError && error.code === "GATE_NOT_FOUND") fail(error.message);
    throw error;
  }
}

export async function runIssueGateRemove(
  container: Container,
  idRaw: string,
  gateRaw: string,
  opts: ActorOptions & { json?: boolean }
): Promise<void> {
  setJsonMode(opts.json ?? false);
  const issue = await container.frame.issues.get(IssueId.from(idRaw));
  if (!issue) fail(`Issue not found: "${idRaw}"`);
  const { actor, actorType, note } = resolveActor(opts);
  try {
    const updated = await container.frame.issues.removeGate(issue.id, toGate(gateRaw), {
      actor,
      actorType,
      ...(note ? { note } : {}),
    });
    emitIssue(updated, opts);
  } catch (error) {
    if (error instanceof FrameInputError && error.code === "GATE_NOT_FOUND")
      fail(`Gate not present: ${gateRaw}`);
    throw error;
  }
}
