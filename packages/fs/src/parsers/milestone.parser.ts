import type { Milestone, MilestoneStatus } from "@frame/core";
import { MilestoneId, ProjectId } from "@frame/core";
import { toDate, toDateOrNull, toEnumValue, toNumber } from "./coercers.js";
import { parseFrontmatter } from "./frontmatter.parser.js";

const MILESTONE_STATUSES: readonly MilestoneStatus[] = ["pending", "active", "done"];

export function parseMilestone(content: string): Milestone {
  const { data, body } = parseFrontmatter(content);

  return {
    id: MilestoneId.from(String(data.id ?? "")),
    projectId: ProjectId.from(String(data.projectId ?? "")),
    title: typeof data.title === "string" ? data.title : "",
    status: toEnumValue(data.status, MILESTONE_STATUSES, "pending"),
    targetDate: toDateOrNull(data.targetDate),
    order: toNumber(data.order),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    body,
  };
}
