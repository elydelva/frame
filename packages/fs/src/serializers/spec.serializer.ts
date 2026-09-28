import type { Spec } from "@frame/core";
import { stringifyFrontmatter } from "../parsers/frontmatter.parser.js";

export function serializeSpec(spec: Spec): string {
  const data: Record<string, unknown> = {
    id: spec.id.toString(),
    projectId: spec.projectId.toString(),
    title: spec.title,
    status: spec.status,
    supersedes: spec.supersedes?.toString() ?? null,
    supersededBy: spec.supersededBy?.toString() ?? null,
    relatedTo: spec.relatedTo.map((id) => id.toString()),
    tags: spec.tags,
    rules: spec.rules,
    author: spec.author,
    createdAt: spec.createdAt.toISOString(),
    updatedAt: spec.updatedAt.toISOString(),
  };

  return stringifyFrontmatter(data, spec.body);
}
