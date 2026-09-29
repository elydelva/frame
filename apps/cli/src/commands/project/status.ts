import { ProjectId, type ProjectStatus } from "@frame/core";
import type { Container } from "../../container.js";
import { setJsonMode } from "../json-mode.js";
import { getFormatter } from "../output.js";
import { type ActorOptions, fail, resolveActor, serializeProject } from "../shared.js";

const PROJECT_STATUSES: ReadonlySet<string> = new Set([
  "planned",
  "active",
  "paused",
  "completed",
  "cancelled",
]);

interface StatusOptions extends ActorOptions {
  json?: boolean;
}

export async function runProjectStatus(
  container: Container,
  idRaw: string,
  statusRaw: string,
  opts: StatusOptions = {}
): Promise<void> {
  setJsonMode(opts.json ?? false);
  if (!PROJECT_STATUSES.has(statusRaw)) {
    fail(`Invalid status: ${statusRaw} (expected planned|active|paused|completed|cancelled)`);
  }

  const { actor, actorType, note } = resolveActor(opts);
  const project = await container.frame.projects.setStatus(
    ProjectId.from(idRaw),
    statusRaw as ProjectStatus,
    {
      actor,
      actorType,
      ...(note ? { note } : {}),
    }
  );

  getFormatter(opts.json ?? false).emit({
    json: serializeProject(project),
    human: () => console.log(`✓ ${project.id.toString()} → ${project.status}`),
  });
}

export async function runProjectStart(
  container: Container,
  idRaw: string,
  opts: StatusOptions = {}
): Promise<void> {
  await runProjectStatus(container, idRaw, "active", opts);
}
