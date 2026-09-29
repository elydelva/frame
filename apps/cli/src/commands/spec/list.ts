import type { Container } from "../../container.js";
import { setJsonMode } from "../json-mode.js";
import { getFormatter } from "../output.js";
import { serializeSpec } from "../shared.js";

interface SpecListOptions {
  project?: string;
  json?: boolean;
}

export async function runSpecList(container: Container, opts: SpecListOptions): Promise<void> {
  setJsonMode(opts.json ?? false);
  const specs = await container.frame.specs.list(opts.project ? { projectId: opts.project } : {});

  getFormatter(opts.json ?? false).emit({
    json: specs.map(serializeSpec),
    human: () => {
      if (specs.length === 0) {
        console.log("No specs.");
        return;
      }
      for (const s of specs) {
        console.log(`${s.id.toString()}  [${s.status}]  ${s.title}`);
      }
    },
  });
}
