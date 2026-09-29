import { IssueId, MilestoneId } from "@frame/core";
import type { Container } from "../../container.js";
import { setJsonMode } from "../json-mode.js";
import { getFormatter } from "../output.js";
import { type ActorOptions, parseList, resolveActor, serializeIssue } from "../shared.js";
import {
  parseProjectId,
  requireOption,
  resolveEstimate,
  resolvePriority,
  validateLabelsAgainstTaxonomy,
} from "../validators.js";

interface IssueAddOptions extends ActorOptions {
  project?: string;
  milestone?: string;
  title?: string;
  priority?: string;
  estimate?: string;
  labels?: string;
  parent?: string;
  gates?: string;
  assignee?: string;
  branch?: string;
  body?: string;
  json?: boolean;
}

export async function runIssueAdd(container: Container, opts: IssueAddOptions): Promise<void> {
  setJsonMode(opts.json ?? false);
  const projectId = parseProjectId(opts.project);
  const title = requireOption(opts.title, "--title");

  const priority = resolvePriority(opts.priority, container.config);
  const estimate = resolveEstimate(opts.estimate, container.config);

  const labels = parseList(opts.labels);
  validateLabelsAgainstTaxonomy(labels, container.config);

  const { actor, actorType, note } = resolveActor(opts);
  const issue = await container.frame.issues.create({
    projectId,
    title,
    author: actor,
    actor,
    actorType,
    ...(note ? { note } : {}),
    priority,
    ...(opts.milestone ? { milestoneId: MilestoneId.from(opts.milestone) } : {}),
    ...(estimate !== undefined ? { estimate } : {}),
    labels,
    ...(opts.parent ? { parentId: IssueId.from(opts.parent) } : {}),
    gates: parseList(opts.gates),
    ...(opts.assignee ? { assignee: opts.assignee } : {}),
    ...(opts.branch ? { branch: opts.branch } : {}),
    body: opts.body ?? "",
  });

  getFormatter(opts.json ?? false).emit({
    json: serializeIssue(issue),
    human: () => {
      console.log(`✓ Created ${issue.id.toString()} — ${issue.title}`);
      console.log(`  Project: ${issue.projectId.toString()}`);
      if (issue.milestoneId) {
        console.log(`  Milestone: ${issue.milestoneId.toString()}`);
      }
    },
  });
}
