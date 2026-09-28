import type { Issue, Milestone, Project, Spec, Trace } from "@frame/core";
import { parseIssue } from "../parsers/issue.parser.js";
import { parseMilestone } from "../parsers/milestone.parser.js";
import { parseProject } from "../parsers/project.parser.js";
import { parseSpec } from "../parsers/spec.parser.js";
import { parseTrace } from "../parsers/trace.parser.js";
import { serializeIssue } from "../serializers/issue.serializer.js";
import { serializeMilestone } from "../serializers/milestone.serializer.js";
import { serializeProject } from "../serializers/project.serializer.js";
import { serializeSpec } from "../serializers/spec.serializer.js";
import { serializeTrace } from "../serializers/trace.serializer.js";

/**
 * Strategy: a codec pairs the parse/serialize halves for one entity behind a
 * uniform interface so callers can treat any entity's file <-> domain mapping
 * the same way.
 */
export interface EntityCodec<T> {
  parse(content: string): T;
  serialize(value: T): string;
}

const project: EntityCodec<Project> = { parse: parseProject, serialize: serializeProject };
const milestone: EntityCodec<Milestone> = {
  parse: parseMilestone,
  serialize: serializeMilestone,
};
const issue: EntityCodec<Issue> = { parse: parseIssue, serialize: serializeIssue };
const spec: EntityCodec<Spec> = { parse: parseSpec, serialize: serializeSpec };
const trace: EntityCodec<Trace> = { parse: parseTrace, serialize: serializeTrace };

/** Registry of entity codecs, keyed by entity name. */
export const codecs = { project, milestone, issue, spec, trace } as const;
