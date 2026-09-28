import type { Project, ProjectStatus } from "@frame/core";
import { ProjectId } from "@frame/core";
import { toDate, toEnumValue, toStringArray } from "./coercers.js";
import { parseFrontmatter } from "./frontmatter.parser.js";

const PROJECT_STATUSES: readonly ProjectStatus[] = [
  "planned",
  "active",
  "paused",
  "completed",
  "cancelled",
];

export function parseProject(content: string): Project {
  const { data, body } = parseFrontmatter(content);

  return {
    id: ProjectId.from(String(data.id ?? "")),
    title: typeof data.title === "string" ? data.title : "",
    status: toEnumValue(data.status, PROJECT_STATUSES, "planned"),
    leads: toStringArray(data.leads),
    author: typeof data.author === "string" ? data.author : "",
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    body,
  };
}
