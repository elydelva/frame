import type {
  Brief,
  Issue,
  Milestone,
  NextResult,
  Project,
  RealmContext,
  Spec,
  Trace,
} from "@frame/core";
import { CliError, exitCli, reportCliError } from "./cli-errors.js";
import { isJsonMode } from "./json-mode.js";

export { formatEstimate } from "@frame/core";

/** Resolve the acting author/actor from the environment. */
export function resolveAuthor(): string {
  return process.env.FRAME_ACTOR ?? process.env.GIT_AUTHOR_NAME ?? process.env.USER ?? "unknown";
}

export interface ActorOptions {
  actor?: string;
  actorType?: string;
  message?: string;
}

export interface ResolvedActor {
  actor: string;
  actorType: "human" | "agent";
  note?: string;
}

/**
 * Resolve who is acting and how to attribute it, for any mutation. Precedence is
 * flag > env > fallback. `--actor-type` (or FRAME_ACTOR_TYPE) marks an agent so
 * traces record `actorType:"agent"`; `--message` becomes the trace body (the why).
 */
export function resolveActor(opts: ActorOptions): ResolvedActor {
  const actor = opts.actor ?? resolveAuthor();
  const rawType = opts.actorType ?? process.env.FRAME_ACTOR_TYPE;
  if (rawType !== undefined && rawType !== "human" && rawType !== "agent") {
    fail(`Invalid --actor-type: ${rawType} (expected human|agent)`);
  }
  const actorType: "human" | "agent" = rawType === "agent" ? "agent" : "human";
  return {
    actor,
    actorType,
    ...(opts.message ? { note: opts.message } : {}),
  };
}

/** Parse a comma-separated list into a trimmed, non-empty string array. */
export function parseList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Report a validation error through the CLI's common error path. */
export function fail(message: string): never {
  reportCliError(new CliError("ValidationError", message), isJsonMode());
  exitCli(1);
}

export function serializeProject(p: Project): Record<string, unknown> {
  return {
    id: p.id.toString(),
    title: p.title,
    status: p.status,
    leads: p.leads,
    author: p.author,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    body: p.body,
  };
}

export function serializeMilestone(m: Milestone): Record<string, unknown> {
  return {
    id: m.id.toString(),
    projectId: m.projectId.toString(),
    title: m.title,
    status: m.status,
    order: m.order,
    targetDate: m.targetDate ? m.targetDate.toISOString() : null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    body: m.body,
  };
}

export function serializeIssue(i: Issue): Record<string, unknown> {
  return {
    id: i.id.toString(),
    projectId: i.projectId.toString(),
    milestoneId: i.milestoneId ? i.milestoneId.toString() : null,
    title: i.title,
    status: i.status,
    priority: i.priority,
    estimate: i.estimate,
    labels: i.labels,
    parentId: i.parentId ? i.parentId.toString() : null,
    gates: i.gates.map((g) => (typeof g === "string" ? g : g.toString())),
    rules: i.rules,
    assignee: i.assignee,
    branch: i.branch,
    author: i.author,
    startedAt: i.startedAt ? i.startedAt.toISOString() : null,
    completedAt: i.completedAt ? i.completedAt.toISOString() : null,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
    body: i.body,
  };
}

export function serializeSpec(s: Spec): Record<string, unknown> {
  return {
    id: s.id.toString(),
    projectId: s.projectId.toString(),
    title: s.title,
    status: s.status,
    supersedes: s.supersedes ? s.supersedes.toString() : null,
    supersededBy: s.supersededBy ? s.supersededBy.toString() : null,
    relatedTo: s.relatedTo.map((r) => r.toString()),
    tags: s.tags,
    rules: s.rules,
    author: s.author,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    body: s.body,
  };
}

export function serializeTrace(t: Trace): Record<string, unknown> {
  return {
    id: t.id.toString(),
    projectId: t.projectId.toString(),
    issueId: t.issueId ? t.issueId.toString() : null,
    specId: t.specId ? t.specId.toString() : null,
    at: t.at.toISOString(),
    actor: t.actor,
    actorType: t.actorType,
    event: t.event,
    ref: t.ref,
    from: t.from,
    to: t.to,
    body: t.body,
  };
}

export function serializeContext(ctx: RealmContext): Record<string, unknown> {
  return {
    projects: ctx.projects.map(serializeProject),
    milestones: ctx.milestones.map(serializeMilestone),
    issues: ctx.issues.map(serializeIssue),
    specs: ctx.specs.map(serializeSpec),
    traces: ctx.traces.map(serializeTrace),
  };
}

function serializeNext(next: NextResult): Record<string, unknown> {
  return {
    issue: serializeIssue(next.issue),
    project: serializeProject(next.project),
    milestone: next.milestone ? serializeMilestone(next.milestone) : null,
  };
}

export function serializeBrief(brief: Brief): Record<string, unknown> {
  return {
    issue: brief.issue ? serializeIssue(brief.issue) : null,
    project: brief.project ? serializeProject(brief.project) : null,
    milestone: brief.milestone ? serializeMilestone(brief.milestone) : null,
    rules: brief.rules,
    gatesOn: brief.gatesOn,
    unblocks: brief.unblocks.map((i) => i.id.toString()),
    blockedReason: brief.blockedReason,
    next: brief.next ? serializeNext(brief.next) : null,
    recentTraces: brief.recentTraces.map(serializeTrace),
  };
}
