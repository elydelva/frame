import type { Milestone } from "@frame/core";
import { stringifyFrontmatter } from "../parsers/frontmatter.parser.js";

export function serializeMilestone(milestone: Milestone): string {
  const data: Record<string, unknown> = {
    id: milestone.id.toString(),
    projectId: milestone.projectId.toString(),
    title: milestone.title,
    status: milestone.status,
    targetDate: milestone.targetDate?.toISOString() ?? null,
    order: milestone.order,
    createdAt: milestone.createdAt.toISOString(),
    updatedAt: milestone.updatedAt.toISOString(),
  };

  return stringifyFrontmatter(data, milestone.body);
}
