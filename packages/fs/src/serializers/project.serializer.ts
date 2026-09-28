import type { Project } from "@frame/core";
import { stringifyFrontmatter } from "../parsers/frontmatter.parser.js";

export function serializeProject(project: Project): string {
  const data: Record<string, unknown> = {
    id: project.id.toString(),
    title: project.title,
    status: project.status,
    leads: project.leads,
    author: project.author,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };

  return stringifyFrontmatter(data, project.body);
}
