import type { Spec, SpecStatus } from "@frame/core";
import { ProjectId, SpecId } from "@frame/core";
import {
  toDate,
  toEnumValue,
  toIdArray,
  toIdOrNull,
  toRuleArray,
  toStringArray,
} from "./coercers.js";
import { parseFrontmatter } from "./frontmatter.parser.js";

const SPEC_STATUSES: readonly SpecStatus[] = [
  "draft",
  "proposed",
  "accepted",
  "superseded",
  "deferred",
  "abandoned",
];

export function parseSpec(content: string): Spec {
  const { data, body } = parseFrontmatter(content);

  return {
    id: SpecId.from(String(data.id ?? "")),
    projectId: ProjectId.from(String(data.projectId ?? "")),
    title: typeof data.title === "string" ? data.title : "",
    status: toEnumValue(data.status, SPEC_STATUSES, "draft"),
    supersedes: toIdOrNull(data.supersedes, SpecId.from),
    supersededBy: toIdOrNull(data.supersededBy, SpecId.from),
    relatedTo: toIdArray(data.relatedTo, SpecId.from),
    tags: toStringArray(data.tags),
    rules: toRuleArray(data.rules),
    author: typeof data.author === "string" ? data.author : "",
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    body,
  };
}
