import { DEFAULT_CONFIG, type RealmConfig } from "../../config/index.js";
import type { Issue, Milestone, Project, Rule, Spec, Trace } from "../../entities/index.js";
import type { IRealmRepository } from "../../ports/index.js";
import { DAGService } from "../../services/index.js";
import type { IssueId, ProjectId } from "../../value-objects/index.js";
import type { IssueStatus } from "../../value-objects/index.js";
import { GetNextUseCase, type NextResult } from "../get-next/get-next.js";
import type { UseCase } from "../use-case.js";

export interface BriefFilter {
  issueId?: IssueId;
  projectId?: ProjectId;
  excludedIssueIds?: ReadonlySet<string>;
}

export interface BriefDependency {
  gate: string;
  status: IssueStatus | "missing" | "external";
}

export interface BriefRuleGroup {
  trigger: Rule["trigger"];
  instructions: string[];
}

/**
 * Everything an agent should read before acting, assembled into one structure:
 * the focus issue (explicit `--issue` or whatever `next` surfaces), its project
 * and milestone, applicable rules grouped by trigger, dependency state with a
 * blocked reason, the next eligible issue, and recent traces for context.
 */
export interface Brief {
  issue: Issue | null;
  project: Project | null;
  milestone: Milestone | null;
  rules: BriefRuleGroup[];
  gatesOn: BriefDependency[];
  unblocks: Issue[];
  blockedReason: string | null;
  next: NextResult | null;
  recentTraces: Trace[];
}

const RECENT_TRACE_LIMIT = 5;

export class GetBriefUseCase implements UseCase<BriefFilter, Brief> {
  private readonly dag = new DAGService();
  private readonly getNext: GetNextUseCase;

  constructor(
    private readonly repo: IRealmRepository,
    config: RealmConfig = DEFAULT_CONFIG
  ) {
    this.getNext = new GetNextUseCase(repo, config);
  }

  async execute(filter: BriefFilter = {}): Promise<Brief> {
    const [allIssues, allProjects, allMilestones, allSpecs] = await Promise.all([
      this.repo.findAllIssues(),
      this.repo.findAllProjects(),
      this.repo.findAllMilestones(),
      this.repo.findAllSpecs(),
    ]);

    const next = await this.getNext.execute(
      filter.excludedIssueIds ? { excludedIssueIds: filter.excludedIssueIds } : {}
    );

    // Focus: explicit --issue, else whatever `next` surfaces.
    const issue = filter.issueId
      ? (allIssues.find((i) => i.id.equals(filter.issueId as IssueId)) ?? null)
      : (next?.issue ?? null);

    const project = issue
      ? (allProjects.find((p) => p.id.equals(issue.projectId)) ?? null)
      : filter.projectId
        ? (allProjects.find((p) => p.id.equals(filter.projectId as ProjectId)) ?? null)
        : null;

    const milestone =
      issue?.milestoneId != null
        ? (allMilestones.find((m) => issue.milestoneId && m.id.equals(issue.milestoneId)) ?? null)
        : null;

    const rules = issue ? this.collectRules(issue, allIssues, allSpecs) : [];

    const gatesOn: BriefDependency[] = issue ? this.resolveGates(issue, allIssues) : [];

    const unblocks: Issue[] = issue
      ? allIssues.filter((i) => i.gates.some((g) => typeof g !== "string" && g.equals(issue.id)))
      : [];

    const blockedReason = issue ? this.blockedReason(issue, allIssues) : null;

    const recentTraces = await this.recentTraces(project?.id, issue?.id);

    return {
      issue,
      project,
      milestone,
      rules,
      gatesOn,
      unblocks,
      blockedReason,
      next,
      recentTraces,
    };
  }

  /** Rules from the issue, its parent chain, and the specs of its project. */
  private collectRules(issue: Issue, allIssues: Issue[], allSpecs: Spec[]): BriefRuleGroup[] {
    const collected: Rule[] = [...issue.rules];

    // Walk the parent chain.
    let parentId = issue.parentId;
    const seen = new Set<string>([issue.id.toString()]);
    while (parentId && !seen.has(parentId.toString())) {
      seen.add(parentId.toString());
      const parent = allIssues.find((i) => i.id.equals(parentId as IssueId));
      if (!parent) break;
      collected.push(...parent.rules);
      parentId = parent.parentId;
    }

    // Specs attached to the same project.
    for (const spec of allSpecs) {
      if (spec.projectId.equals(issue.projectId)) collected.push(...spec.rules);
    }

    return this.groupRules(collected);
  }

  /** Group rules by trigger, de-duplicating identical instructions. */
  private groupRules(rules: Rule[]): BriefRuleGroup[] {
    const byTrigger = new Map<Rule["trigger"], string[]>();
    for (const rule of rules) {
      const list = byTrigger.get(rule.trigger) ?? [];
      if (!list.includes(rule.instruction)) list.push(rule.instruction);
      byTrigger.set(rule.trigger, list);
    }
    return [...byTrigger.entries()].map(([trigger, instructions]) => ({ trigger, instructions }));
  }

  private resolveGates(issue: Issue, allIssues: Issue[]): BriefDependency[] {
    return issue.gates.map((gate) => {
      if (typeof gate === "string") return { gate, status: "external" as const };
      const dep = allIssues.find((i) => i.id.equals(gate));
      return { gate: gate.toString(), status: dep ? dep.status : "missing" };
    });
  }

  private blockedReason(issue: Issue, allIssues: Issue[]): string | null {
    const unmet = this.dag.getUnmetGates(issue, allIssues);
    if (unmet.length === 0) {
      return issue.status === "blocked" ? "Marked blocked." : null;
    }
    const parts = unmet.map((u) => `${u.gate} (${u.status})`);
    return `Waiting on ${parts.join(", ")}.`;
  }

  private async recentTraces(
    projectId: ProjectId | undefined,
    issueId: IssueId | undefined
  ): Promise<Trace[]> {
    const traces = await this.repo.findTraces(
      issueId ? { issueId } : projectId ? { projectId } : {}
    );
    return traces
      .slice()
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, RECENT_TRACE_LIMIT);
  }
}
