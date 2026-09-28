import type { Trace } from "@frame/core";
import { stringifyFrontmatter } from "../parsers/frontmatter.parser.js";

export function serializeTrace(trace: Trace): string {
  const data: Record<string, unknown> = {
    id: trace.id.toString(),
    projectId: trace.projectId.toString(),
    issueId: trace.issueId?.toString() ?? null,
    specId: trace.specId?.toString() ?? null,
    at: trace.at.toISOString(),
    actor: trace.actor,
    actorType: trace.actorType,
    event: trace.event,
    ref: trace.ref,
    from: trace.from,
    to: trace.to,
  };

  return stringifyFrontmatter(data, trace.body);
}
