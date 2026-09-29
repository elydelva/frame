import { type EditIssuePatch, IssueId, MilestoneId } from "@frame/core";
import type { Container } from "../../container.js";
import { setJsonMode } from "../json-mode.js";
import { getFormatter } from "../output.js";
import { type ActorOptions, parseList, resolveActor, serializeIssue } from "../shared.js";
import { resolveEstimate, resolvePriority, validateLabelsAgainstTaxonomy } from "../validators.js";

/**
 * `--assignee X` sets, `--no-assignee` clears (commander passes `false`); same
 * for branch/milestone/parent/estimate. A flag left off leaves the field as-is.
 */
type Nullable<T> = T | false;

interface IssueEditOptions extends ActorOptions {
  title?: string;
  priority?: string;
  estimate?: Nullable<string>;
  milestone?: Nullable<string>;
  assignee?: Nullable<string>;
  branch?: Nullable<string>;
  labels?: string;
  parent?: Nullable<string>;
  gates?: string;
  json?: boolean;
}

/** Build the field patch from CLI options, applying validation and clears. */
function buildPatch(container: Container, opts: IssueEditOptions): EditIssuePatch {
  const patch: EditIssuePatch = {};
  if (opts.title !== undefined) patch.title = opts.title;
  if (opts.priority !== undefined)
    patch.priority = resolvePriority(opts.priority, container.config);

  if (opts.estimate === false) patch.estimate = null;
  else if (opts.estimate !== undefined) {
    const points = resolveEstimate(opts.estimate, container.config);
    if (points !== undefined) patch.estimate = points;
  }

  if (opts.milestone === false) patch.milestoneId = null;
  else if (opts.milestone !== undefined) patch.milestoneId = MilestoneId.from(opts.milestone);

  if (opts.assignee === false) patch.assignee = null;
  else if (opts.assignee !== undefined) patch.assignee = opts.assignee;

  if (opts.branch === false) patch.branch = null;
  else if (opts.branch !== undefined) patch.branch = opts.branch;

  if (opts.parent === false) patch.parentId = null;
  else if (opts.parent !== undefined) patch.parentId = IssueId.from(opts.parent);

  if (opts.labels !== undefined) {
    const labels = parseList(opts.labels);
    validateLabelsAgainstTaxonomy(labels, container.config);
    patch.labels = labels;
  }

  if (opts.gates !== undefined) {
    patch.gates = parseList(opts.gates).map((g) => (g.includes("/") ? g : IssueId.from(g)));
  }

  return patch;
}

export async function runIssueEdit(
  container: Container,
  idRaw: string,
  opts: IssueEditOptions
): Promise<void> {
  setJsonMode(opts.json ?? false);
  const { actor, actorType, note } = resolveActor(opts);
  const patch = buildPatch(container, opts);

  const issue = await container.frame.issues.edit(IssueId.from(idRaw), {
    actor,
    actorType,
    ...(note ? { note } : {}),
    ...patch,
  });

  getFormatter(opts.json ?? false).emit({
    json: serializeIssue(issue),
    human: () => console.log(`✓ Updated ${issue.id.toString()} — ${issue.title}`),
  });
}
