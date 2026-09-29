import {
  DAGService,
  DEFAULT_CONFIG,
  GetBriefUseCase,
  GetContextUseCase,
  GetHistoryUseCase,
  GetNextUseCase,
  type IRealmRepository,
  type Issue,
  IssueId,
  type Milestone,
  MilestoneId,
  type Project,
  ProjectId,
  type RealmConfig,
  type Spec,
  SpecId,
  type Trace,
} from "@frame/core";
import type { Brief, BriefFilter, ContextFilter, HistoryFilter, NextResult } from "@frame/core";
import { FsRealmRepository, readRealmConfig, readRealmFormat } from "@frame/fs";
import { type FrameOptions, assertFrameOptions } from "./options.js";

export type IdInput<T> = T | string;

function projectId(value: IdInput<ProjectId>): ProjectId {
  return typeof value === "string" ? ProjectId.from(value) : value;
}
function milestoneId(value: IdInput<MilestoneId>): MilestoneId {
  return typeof value === "string" ? MilestoneId.from(value) : value;
}
function issueId(value: IdInput<IssueId>): IssueId {
  return typeof value === "string" ? IssueId.from(value) : value;
}
function specId(value: IdInput<SpecId>): SpecId {
  return typeof value === "string" ? SpecId.from(value) : value;
}

interface FrameContext {
  repository: IRealmRepository;
  config: RealmConfig;
  getNext: GetNextUseCase;
  getContext: GetContextUseCase;
  getHistory: GetHistoryUseCase;
  getBrief: GetBriefUseCase;
}

export interface ProjectListFilter {
  status?: Project["status"];
}
export interface MilestoneListFilter {
  projectId?: IdInput<ProjectId>;
  status?: Milestone["status"];
}
export interface SpecListFilter {
  projectId?: IdInput<ProjectId>;
  status?: Spec["status"];
}
export interface IssueListFilter {
  projectId?: IdInput<ProjectId>;
  status?: Issue["status"];
  assignee?: string;
  milestoneId?: IdInput<MilestoneId>;
  label?: string;
  branch?: string;
  priority?: Issue["priority"];
}

export interface CreateProjectInput {
  title: string;
  author: string;
  leads?: string[];
  body?: string;
  actor?: string;
  actorType?: "human" | "agent";
  note?: string;
}
export interface CreateMilestoneInput {
  projectId: IdInput<ProjectId>;
  title: string;
  order: number;
  targetDate?: Date | null;
  body?: string;
  author: string;
  actor?: string;
  actorType?: "human" | "agent";
  note?: string;
}
export interface CreateIssueInput {
  projectId: IdInput<ProjectId>;
  milestoneId?: IdInput<MilestoneId> | null;
  title: string;
  author: string;
  priority?: Issue["priority"];
  estimate?: number | null;
  labels?: string[];
  parentId?: IdInput<IssueId> | null;
  gates?: Array<IdInput<IssueId> | string>;
  rules?: Issue["rules"];
  assignee?: string | null;
  branch?: string | null;
  body?: string;
  actor?: string;
  actorType?: "human" | "agent";
  note?: string;
}
export interface CreateSpecInput {
  projectId: IdInput<ProjectId>;
  title: string;
  author: string;
  supersedes?: IdInput<SpecId> | null;
  relatedTo?: Array<IdInput<SpecId>>;
  tags?: string[];
  rules?: Spec["rules"];
  body?: string;
  actor?: string;
  actorType?: "human" | "agent";
  note?: string;
}

export class Frame {
  readonly projects: {
    list(filter?: ProjectListFilter): Promise<Project[]>;
    get(id: IdInput<ProjectId>): Promise<Project | null>;
  };
  readonly milestones: {
    list(filter?: MilestoneListFilter): Promise<Milestone[]>;
    get(id: IdInput<MilestoneId>): Promise<Milestone | null>;
  };
  readonly issues: {
    list(filter?: IssueListFilter): Promise<Issue[]>;
    get(id: IdInput<IssueId>): Promise<Issue | null>;
    isEligibleToStart(id: IdInput<IssueId>): Promise<boolean>;
  };
  readonly specs: {
    list(filter?: SpecListFilter): Promise<Spec[]>;
    get(id: IdInput<SpecId>): Promise<Spec | null>;
  };
  readonly traces: {
    list(filter?: Parameters<IRealmRepository["findTraces"]>[0]): Promise<Trace[]>;
  };
  readonly config: { get(): Promise<RealmConfig> };

  private initialization?: Promise<FrameContext>;

  constructor(private readonly options: FrameOptions) {
    assertFrameOptions(options);
    const ready = () => this.initialize();
    this.projects = {
      list: async (filter = {}) => {
        const { repository } = await ready();
        const rows = await repository.findAllProjects();
        return filter.status ? rows.filter((row) => row.status === filter.status) : rows;
      },
      get: async (id) => (await ready()).repository.findProject(projectId(id)),
    };
    this.milestones = {
      list: async (filter = {}) => {
        const { repository } = await ready();
        const rows = filter.projectId
          ? await repository.findMilestonesForProject(projectId(filter.projectId))
          : await repository.findAllMilestones();
        return filter.status ? rows.filter((row) => row.status === filter.status) : rows;
      },
      get: async (id) => (await ready()).repository.findMilestone(milestoneId(id)),
    };
    this.issues = {
      list: async (filter = {}) => {
        const { repository } = await ready();
        const rows = filter.projectId
          ? await repository.findIssuesForProject(projectId(filter.projectId))
          : await repository.findAllIssues();
        return rows.filter(
          (row) =>
            (!filter.status || row.status === filter.status) &&
            (!filter.assignee || row.assignee === filter.assignee) &&
            (!filter.branch || row.branch === filter.branch) &&
            (!filter.priority || row.priority === filter.priority) &&
            (!filter.milestoneId || row.milestoneId?.equals(milestoneId(filter.milestoneId))) &&
            (!filter.label || row.labels.includes(filter.label))
        );
      },
      get: async (id) => (await ready()).repository.findIssue(issueId(id)),
      isEligibleToStart: async (id) => {
        const { repository } = await ready();
        const [issues, projects, milestones] = await Promise.all([
          repository.findAllIssues(),
          repository.findAllProjects(),
          repository.findAllMilestones(),
        ]);
        const eligible = new DAGService().getEligibleIssues(issues, projects, milestones);
        return eligible.some((issue) => issue.id.equals(issueId(id)));
      },
    };
    this.specs = {
      list: async (filter = {}) => {
        const { repository } = await ready();
        const rows = filter.projectId
          ? await repository.findSpecsForProject(projectId(filter.projectId))
          : await repository.findAllSpecs();
        return filter.status ? rows.filter((row) => row.status === filter.status) : rows;
      },
      get: async (id) => (await ready()).repository.findSpec(specId(id)),
    };
    this.traces = {
      list: async (filter = {}) => (await ready()).repository.findTraces(filter),
    };
    this.config = { get: async () => (await ready()).config };
  }

  async next(options?: Parameters<GetNextUseCase["execute"]>[0]): Promise<NextResult | null> {
    return (await this.initialize()).getNext.execute(options);
  }
  async context(
    filter?: ContextFilter
  ): Promise<Awaited<ReturnType<GetContextUseCase["execute"]>>> {
    return (await this.initialize()).getContext.execute(filter);
  }
  async history(filter?: HistoryFilter): Promise<Trace[]> {
    return (await this.initialize()).getHistory.execute(filter);
  }
  async brief(filter?: BriefFilter): Promise<Brief> {
    return (await this.initialize()).getBrief.execute(filter);
  }
  private initialize(): Promise<FrameContext> {
    this.initialization ??= this.initializeOnce();
    return this.initialization;
  }

  private async initializeOnce(): Promise<FrameContext> {
    if (this.options.root) await readRealmFormat(this.options.root);
    const repository =
      this.options.repository ?? new FsRealmRepository(this.options.root as string);
    const config = this.options.config
      ? structuredClone(this.options.config)
      : this.options.repository || !this.options.root
        ? structuredClone(DEFAULT_CONFIG)
        : await readRealmConfig(this.options.root);
    return {
      repository,
      config,
      getNext: new GetNextUseCase(repository, config),
      getContext: new GetContextUseCase(repository),
      getHistory: new GetHistoryUseCase(repository),
      getBrief: new GetBriefUseCase(repository, config),
    };
  }

  static async initialize(_options: { root: string }): Promise<Frame> {
    throw new Error("Frame.initialize is not available until realm initialization is implemented.");
  }
}
