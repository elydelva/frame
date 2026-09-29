import type { Container } from "../../container.js";
import { setJsonMode } from "../json-mode.js";
import { getFormatter } from "../output.js";
import { type ActorOptions, fail, resolveActor, serializeMilestone } from "../shared.js";
import { parseProjectId, requireOption } from "../validators.js";

interface MilestoneNewOptions extends ActorOptions {
  project?: string;
  title?: string;
  order?: string;
  targetDate?: string;
  body?: string;
  json?: boolean;
}

export async function runMilestoneNew(
  container: Container,
  opts: MilestoneNewOptions
): Promise<void> {
  setJsonMode(opts.json ?? false);
  const projectId = parseProjectId(opts.project);
  const title = requireOption(opts.title, "--title");
  const orderRaw = requireOption(opts.order, "--order");

  const order = Number.parseInt(orderRaw, 10);
  if (Number.isNaN(order)) fail(`Invalid --order: ${orderRaw}`);

  let targetDate: Date | undefined;
  if (opts.targetDate) {
    const d = new Date(opts.targetDate);
    if (Number.isNaN(d.getTime())) fail(`Invalid --target-date: ${opts.targetDate}`);
    targetDate = d;
  }

  const { actor, actorType, note } = resolveActor(opts);
  const milestone = await container.createMilestone.execute({
    projectId,
    title,
    order,
    author: actor,
    actor,
    actorType,
    ...(note ? { note } : {}),
    ...(targetDate ? { targetDate } : {}),
    body: opts.body ?? "",
  });

  getFormatter(opts.json ?? false).emit({
    json: serializeMilestone(milestone),
    human: () => {
      console.log(`✓ Created ${milestone.id.toString()} — ${milestone.title}`);
      console.log(`  Project: ${milestone.projectId.toString()}`);
    },
  });
}
