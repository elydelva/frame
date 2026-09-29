import { type ContextFilter, ProjectId } from "@frame/core";
import type { Container } from "../container.js";
import { setJsonMode } from "./json-mode.js";
import { getFormatter } from "./output.js";
import { formatEstimate, serializeContext } from "./shared.js";

interface ContextOptions {
  project?: string;
  active?: boolean;
  json?: boolean;
}

export async function runContext(container: Container, opts: ContextOptions): Promise<void> {
  setJsonMode(opts.json ?? false);
  const filter: ContextFilter = {};
  if (opts.project) filter.projectId = ProjectId.from(opts.project);
  if (opts.active) filter.activeOnly = true;

  const ctx = await container.getContext.execute(filter);

  getFormatter(opts.json ?? false).emit({
    json: serializeContext(ctx),
    human: () => {
      console.log(
        `Projects: ${ctx.projects.length}  Milestones: ${ctx.milestones.length}  ` +
          `Issues: ${ctx.issues.length}  Specs: ${ctx.specs.length}  Traces: ${ctx.traces.length}`
      );

      for (const p of ctx.projects) {
        console.log("");
        console.log(`${p.id.toString()}  ${p.title}  [${p.status}]`);

        const milestones = ctx.milestones.filter((m) => m.projectId.equals(p.id));
        for (const m of milestones) {
          console.log(`  ${m.id.toString()}  ${m.title}  [${m.status}]`);
        }

        const issues = ctx.issues.filter((i) => i.projectId.equals(p.id));
        for (const i of issues) {
          const est = formatEstimate(container.config, i.estimate);
          const tag = est ? `${i.priority} · ${est}` : i.priority;
          console.log(`  ${i.id.toString()}  ${i.title}  [${i.status}] (${tag})`);
        }

        const specs = ctx.specs.filter((s) => s.projectId.equals(p.id));
        for (const s of specs) {
          console.log(`  ${s.id.toString()}  ${s.title}  [${s.status}]`);
        }
      }
    },
  });
}
