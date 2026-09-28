import type { Issue } from "@frame/core";
import { stringifyFrontmatter } from "../parsers/frontmatter.parser.js";

export function serializeIssue(issue: Issue): string {
  const data: Record<string, unknown> = {
    id: issue.id.toString(),
    projectId: issue.projectId.toString(),
    milestoneId: issue.milestoneId?.toString() ?? null,
    title: issue.title,
    status: issue.status,
    priority: issue.priority,
    estimate: issue.estimate,
    labels: issue.labels,
    parentId: issue.parentId?.toString() ?? null,
    gates: issue.gates.map((g) => g.toString()),
    rules: issue.rules,
    assignee: issue.assignee,
    branch: issue.branch,
    author: issue.author,
    startedAt: issue.startedAt?.toISOString() ?? null,
    completedAt: issue.completedAt?.toISOString() ?? null,
    createdAt: issue.createdAt.toISOString(),
    updatedAt: issue.updatedAt.toISOString(),
  };

  return stringifyFrontmatter(data, issue.body);
}
