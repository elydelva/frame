import type { Container } from "../../container.js";
import { setJsonMode } from "../json-mode.js";
import { getFormatter } from "../output.js";
import { serializeMilestone } from "../shared.js";

interface MilestoneListOptions {
  project?: string;
  json?: boolean;
}

export async function runMilestoneList(
  container: Container,
  opts: MilestoneListOptions
): Promise<void> {
  setJsonMode(opts.json ?? false);
  const milestones = await container.frame.milestones.list(
    opts.project ? { projectId: opts.project } : {}
  );
  const sorted = [...milestones].sort((a, b) => a.order - b.order);

  getFormatter(opts.json ?? false).emit({
    json: sorted.map(serializeMilestone),
    human: () => {
      if (sorted.length === 0) {
        console.log("No milestones.");
        return;
      }
      for (const m of sorted) {
        console.log(`${m.id.toString()}  [${m.status}]  #${m.order}  ${m.title}`);
      }
    },
  });
}
