import { SpecId, type SpecStatus } from "@frame/core";
import type { Container } from "../../container.js";
import { setJsonMode } from "../json-mode.js";
import { getFormatter } from "../output.js";
import { type ActorOptions, fail, resolveActor, serializeSpec } from "../shared.js";

const SPEC_STATUSES: ReadonlySet<string> = new Set([
  "draft",
  "proposed",
  "accepted",
  "superseded",
  "deferred",
  "abandoned",
]);

interface StatusOptions extends ActorOptions {
  json?: boolean;
}

export async function runSpecStatus(
  container: Container,
  idRaw: string,
  statusRaw: string,
  opts: StatusOptions = {}
): Promise<void> {
  setJsonMode(opts.json ?? false);
  if (!SPEC_STATUSES.has(statusRaw)) {
    fail(
      `Invalid status: ${statusRaw} (expected draft|proposed|accepted|superseded|deferred|abandoned)`
    );
  }

  const { actor, actorType, note } = resolveActor(opts);
  const spec = await container.setSpecStatus.execute({
    id: SpecId.from(idRaw),
    to: statusRaw as SpecStatus,
    actor,
    actorType,
    ...(note ? { note } : {}),
  });

  getFormatter(opts.json ?? false).emit({
    json: serializeSpec(spec),
    human: () => console.log(`✓ ${spec.id.toString()} → ${spec.status}`),
  });
}
