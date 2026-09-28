import { DEFAULT_CONFIG, type RealmConfig, priorityRank } from "../../config/index.js";
import type { Issue, Milestone, Project } from "../../entities/index.js";
import type { IRealmRepository } from "../../ports/index.js";
import { DAGService } from "../../services/index.js";
import type { UseCase } from "../use-case.js";

export interface NextResult {
  issue: Issue;
  project: Project;
  milestone: Milestone | null;
}

export interface GetNextOptions {
  excludedIssueIds?: ReadonlySet<string>;
}

export class GetNextUseCase implements UseCase<GetNextOptions | undefined, NextResult | null> {
  private readonly dagService = new DAGService();
  private readonly rank: (p: string) => number;

  constructor(
    private readonly repo: IRealmRepository,
    config: RealmConfig = DEFAULT_CONFIG
  ) {
    this.rank = priorityRank(config);
  }

  async execute(options: GetNextOptions = {}): Promise<NextResult | null> {
    const [allIssues, allProjects, allMilestones] = await Promise.all([
      this.repo.findAllIssues(),
      this.repo.findAllProjects(),
      this.repo.findAllMilestones(),
    ]);

    const excluded = options.excludedIssueIds ?? new Set<string>();
    const eligible = this.dagService
      .getEligibleIssues(allIssues, allProjects, allMilestones)
      .filter((issue) => !excluded.has(issue.id.toString()));
    if (eligible.length === 0) return null;

    const projectMap = new Map(allProjects.map((p) => [p.id.toString(), p]));
    const milestoneMap = new Map(allMilestones.map((m) => [m.id.toString(), m]));

    const milestoneFor = (issue: Issue): Milestone | null =>
      issue.milestoneId ? (milestoneMap.get(issue.milestoneId.toString()) ?? null) : null;

    // Sort: priority rank ASC → milestone.order ASC (null milestone last) → issue createdAt ASC
    const sorted = eligible.slice().sort((a, b) => {
      const prioCmp = this.rank(a.priority) - this.rank(b.priority);
      if (prioCmp !== 0) return prioCmp;

      const mA = milestoneFor(a);
      const mB = milestoneFor(b);
      const orderA = mA ? mA.order : Number.POSITIVE_INFINITY;
      const orderB = mB ? mB.order : Number.POSITIVE_INFINITY;
      if (orderA !== orderB) return orderA - orderB;

      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const first = sorted[0];
    if (!first) return null;

    const project = projectMap.get(first.projectId.toString());
    if (!project) return null;

    return { issue: first, project, milestone: milestoneFor(first) };
  }
}
