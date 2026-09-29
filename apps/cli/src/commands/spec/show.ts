import { SpecId } from "@frame/core";
import type { Container } from "../../container.js";
import { setJsonMode } from "../json-mode.js";
import { getFormatter } from "../output.js";
import { fail, serializeSpec, serializeTrace } from "../shared.js";

interface SpecShowOptions {
  json?: boolean;
}

export async function runSpecShow(
  container: Container,
  idRaw: string,
  opts: SpecShowOptions
): Promise<void> {
  setJsonMode(opts.json ?? false);
  const id = SpecId.from(idRaw);
  const spec = await container.frame.specs.get(id);
  if (!spec) fail(`Spec not found: "${idRaw}"`);
  const traces = await container.frame.traces.list({ specId: id });

  getFormatter(opts.json ?? false).emit({
    json: { ...serializeSpec(spec), traces: traces.map(serializeTrace) },
    human: () => {
      console.log(`${spec.id.toString()}  ${spec.title}`);
      console.log(`  Status:  ${spec.status}`);
      console.log(`  Project: ${spec.projectId.toString()}`);
      if (spec.tags.length) console.log(`  Tags:    ${spec.tags.join(", ")}`);
      if (spec.supersededBy) console.log(`  Superseded by: ${spec.supersededBy.toString()}`);
      if (spec.body.trim()) console.log(`\n${spec.body.trim()}`);
    },
  });
}
