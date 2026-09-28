import type { Issue, IssueStatus } from "@frame/core";
import { IssueId, MilestoneId, ProjectId } from "@frame/core";
import {
  toDate,
  toDateOrNull,
  toEnumValue,
  toIdOrNull,
  toNumberOrNull,
  toRuleArray,
  toStringArray,
  toStringOrNull,
} from "./coercers.js";
import { parseFrontmatter } from "./frontmatter.parser.js";

const ISSUE_STATUSES: readonly IssueStatus[] = [
  "not-started",
  "in-progress",
  "completed",
  "abandoned",
  "blocked",
  "skipped",
];

function toPriority(val: unknown): string {
  return typeof val === "string" && val.length > 0 ? val : "none";
}

/**
 * Gates can reference a same-project IssueId or a cross-project string like
 * `PROJ-0001/ISSUE-0003`. Local issue ids round-trip as IssueId; anything else
 * is preserved verbatim as a string.
 */
function toGatesArray(val: unknown): Array<IssueId | string> {
  if (!Array.isArray(val)) return [];
  const result: Array<IssueId | string> = [];
  for (const v of val) {
    if (typeof v !== "string" || v.length === 0) continue;
    const id = toIdOrNull(v, IssueId.from);
    result.push(id ?? v);
  }
  return result;
}

export function parseIssue(content: string): Issue {
  const { data, body } = parseFrontmatter(content);

  return {
    id: IssueId.from(String(data.id ?? "")),
    projectId: ProjectId.from(String(data.projectId ?? "")),
    milestoneId: toIdOrNull(data.milestoneId, MilestoneId.from),
    title: typeof data.title === "string" ? data.title : "",
    status: toEnumValue(data.status, ISSUE_STATUSES, "not-started"),
    priority: toPriority(data.priority),
    estimate: toNumberOrNull(data.estimate),
    labels: toStringArray(data.labels),
    parentId: toIdOrNull(data.parentId, IssueId.from),
    gates: toGatesArray(data.gates),
    rules: toRuleArray(data.rules),
    assignee: toStringOrNull(data.assignee),
    branch: toStringOrNull(data.branch),
    author: typeof data.author === "string" ? data.author : "",
    startedAt: toDateOrNull(data.startedAt),
    completedAt: toDateOrNull(data.completedAt),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    body,
  };
}
