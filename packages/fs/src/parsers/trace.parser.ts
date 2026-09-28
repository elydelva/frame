import type { Trace, TraceEvent } from "@frame/core";
import { IssueId, ProjectId, SpecId, TraceId } from "@frame/core";
import { toDate, toEnumValue, toIdOrNull, toStringOrNull } from "./coercers.js";
import { parseFrontmatter } from "./frontmatter.parser.js";

const TRACE_EVENTS: readonly TraceEvent[] = [
  "project_created",
  "milestone_created",
  "issue_created",
  "issue_started",
  "issue_completed",
  "issue_abandoned",
  "spec_created",
  "spec_status_changed",
  "project_status_changed",
  "milestone_status_changed",
  "rules_acknowledged",
  "note",
  "synced",
];

const ACTOR_TYPES: readonly ("human" | "agent")[] = ["human", "agent"];

export function parseTrace(content: string): Trace {
  const { data, body } = parseFrontmatter(content);

  return {
    id: TraceId.from(String(data.id ?? "")),
    projectId: ProjectId.from(String(data.projectId ?? "")),
    issueId: toIdOrNull(data.issueId, IssueId.from),
    specId: toIdOrNull(data.specId, SpecId.from),
    at: toDate(data.at),
    actor: typeof data.actor === "string" ? data.actor : "unknown",
    actorType: toEnumValue(data.actorType, ACTOR_TYPES, "human"),
    event: toEnumValue(data.event, TRACE_EVENTS, "note"),
    ref: toStringOrNull(data.ref),
    from: toStringOrNull(data.from),
    to: toStringOrNull(data.to),
    body,
  };
}
