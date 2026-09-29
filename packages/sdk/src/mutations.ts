import {
  CompleteIssueUseCase,
  CreateIssueUseCase,
  CreateMilestoneUseCase,
  CreateProjectUseCase,
  CreateSpecUseCase,
  DeleteIssueUseCase,
  EditIssueUseCase,
  type IRealmRepository,
  type Issue,
  IssueId,
  IssueNotFoundError,
  type Milestone,
  MilestoneId,
  type Project,
  ProjectId,
  SetIssueStatusUseCase,
  SetMilestoneStatusUseCase,
  SetProjectStatusUseCase,
  SetSpecStatusUseCase,
  type Spec,
  SpecId,
  StartIssueUseCase,
} from "@frame/core";
import { FrameInputError } from "./errors.js";
import type {
  CreateIssueInput,
  CreateMilestoneInput,
  CreateProjectInput,
  CreateSpecInput,
  IdInput,
} from "./frame.js";

export interface MutationOptions {
  actor: string;
  actorType?: "human" | "agent";
  note?: string;
}

function parseId<T>(value: T | string, parse: (raw: string) => T): T {
  return typeof value === "string" ? parse(value) : value;
}
function parseGate(value: IdInput<IssueId> | string): IssueId | string {
  if (typeof value !== "string") return value;
  return value.startsWith("ISSUE-") ? IssueId.from(value) : value;
}
function sameGate(left: IssueId | string, right: IssueId | string): boolean {
  return typeof left === "string" || typeof right === "string"
    ? left === right
    : left.equals(right);
}

export class MutationApi {
  readonly projects;
  readonly milestones;
  readonly issues;
  readonly specs;

  constructor(private readonly getRepository: () => Promise<{ repository: IRealmRepository }>) {
    this.projects = {
      create: async (input: CreateProjectInput) => {
        const { repository } = await this.getRepository();
        return new CreateProjectUseCase(repository).execute(input);
      },
      setStatus: async (
        id: IdInput<ProjectId>,
        status: Project["status"],
        options: MutationOptions
      ) => {
        const { repository } = await this.getRepository();
        return new SetProjectStatusUseCase(repository).execute({
          id: parseId(id, ProjectId.from),
          to: status,
          ...options,
        });
      },
    };
    this.milestones = {
      create: async (input: CreateMilestoneInput) => {
        const { repository } = await this.getRepository();
        return new CreateMilestoneUseCase(repository).execute({
          ...input,
          projectId: parseId(input.projectId, ProjectId.from),
        });
      },
      setStatus: async (
        id: IdInput<MilestoneId>,
        status: Milestone["status"],
        options: MutationOptions
      ) => {
        const { repository } = await this.getRepository();
        return new SetMilestoneStatusUseCase(repository).execute({
          id: parseId(id, MilestoneId.from),
          to: status,
          ...options,
        });
      },
    };
    this.issues = {
      create: async (input: CreateIssueInput) => {
        const { repository } = await this.getRepository();
        const {
          projectId: rawProjectId,
          milestoneId: rawMilestoneId,
          parentId: rawParentId,
          gates,
          ...rest
        } = input;
        return new CreateIssueUseCase(repository).execute({
          ...rest,
          projectId: parseId(rawProjectId, ProjectId.from),
          ...(rawMilestoneId !== undefined
            ? {
                milestoneId:
                  rawMilestoneId === null ? null : parseId(rawMilestoneId, MilestoneId.from),
              }
            : {}),
          ...(rawParentId !== undefined
            ? { parentId: rawParentId === null ? null : parseId(rawParentId, IssueId.from) }
            : {}),
          ...(gates ? { gates: gates.map(parseGate) } : {}),
        });
      },
      edit: async (
        id: IdInput<IssueId>,
        patch: import("@frame/core").EditIssuePatch & MutationOptions
      ) => {
        const { repository } = await this.getRepository();
        const { milestoneId: rawMilestoneId, parentId: rawParentId, gates, ...rest } = patch;
        return new EditIssueUseCase(repository).execute({
          ...rest,
          id: parseId(id, IssueId.from),
          ...(rawMilestoneId !== undefined
            ? {
                milestoneId:
                  rawMilestoneId === null ? null : parseId(rawMilestoneId, MilestoneId.from),
              }
            : {}),
          ...(rawParentId !== undefined
            ? { parentId: rawParentId === null ? null : parseId(rawParentId, IssueId.from) }
            : {}),
          ...(gates ? { gates: gates.map(parseGate) } : {}),
        });
      },
      delete: async (id: IdInput<IssueId>, options: MutationOptions) => {
        const { repository } = await this.getRepository();
        return new DeleteIssueUseCase(repository).execute({
          id: parseId(id, IssueId.from),
          ...options,
        });
      },
      start: async (
        id: IdInput<IssueId>,
        options: MutationOptions & { assignee?: string; branch?: string }
      ) => {
        const { repository } = await this.getRepository();
        return new StartIssueUseCase(repository).execute({
          id: parseId(id, IssueId.from),
          ...options,
        });
      },
      complete: async (
        id: IdInput<IssueId>,
        options: MutationOptions & { assignee?: string; branch?: string }
      ) => {
        const { repository } = await this.getRepository();
        return new CompleteIssueUseCase(repository).execute({
          id: parseId(id, IssueId.from),
          ...options,
        });
      },
      setStatus: async (
        id: IdInput<IssueId>,
        status: Issue["status"],
        options: MutationOptions
      ) => {
        const { repository } = await this.getRepository();
        return new SetIssueStatusUseCase(repository).execute({
          id: parseId(id, IssueId.from),
          to: status,
          ...options,
        });
      },
      addGate: async (
        id: IdInput<IssueId>,
        gate: IdInput<IssueId> | string,
        options: MutationOptions
      ) => {
        const { repository } = await this.getRepository();
        const targetId = parseId(id, IssueId.from);
        const issue = await repository.findIssue(targetId);
        if (!issue) throw new IssueNotFoundError(targetId.toString());
        const parsedGate = parseGate(gate);
        if (issue.gates.some((existing) => sameGate(existing, parsedGate))) {
          throw new FrameInputError(
            "DUPLICATE_GATE",
            `Gate ${String(parsedGate)} already exists on ${targetId}.`
          );
        }
        if (parsedGate instanceof IssueId && !(await repository.findIssue(parsedGate))) {
          throw new FrameInputError("GATE_NOT_FOUND", `Issue gate ${parsedGate} does not exist.`);
        }
        return new EditIssueUseCase(repository).execute({
          id: targetId,
          gates: [...issue.gates, parsedGate],
          ...options,
        });
      },
      removeGate: async (
        id: IdInput<IssueId>,
        gate: IdInput<IssueId> | string,
        options: MutationOptions
      ) => {
        const { repository } = await this.getRepository();
        const targetId = parseId(id, IssueId.from);
        const issue = await repository.findIssue(targetId);
        if (!issue) throw new IssueNotFoundError(targetId.toString());
        const parsedGate = parseGate(gate);
        if (!issue.gates.some((existing) => sameGate(existing, parsedGate))) {
          throw new FrameInputError(
            "GATE_NOT_FOUND",
            `Gate ${String(parsedGate)} does not exist on ${targetId}.`
          );
        }
        const gates = issue.gates.filter((existing) => !sameGate(existing, parsedGate));
        return new EditIssueUseCase(repository).execute({ id: targetId, gates, ...options });
      },
    };
    this.specs = {
      create: async (input: CreateSpecInput) => {
        const { repository } = await this.getRepository();
        const { projectId: rawProjectId, supersedes: rawSupersedes, relatedTo, ...rest } = input;
        return new CreateSpecUseCase(repository).execute({
          ...rest,
          projectId: parseId(rawProjectId, ProjectId.from),
          ...(rawSupersedes !== undefined
            ? { supersedes: rawSupersedes === null ? null : parseId(rawSupersedes, SpecId.from) }
            : {}),
          ...(relatedTo ? { relatedTo: relatedTo.map((id) => parseId(id, SpecId.from)) } : {}),
        });
      },
      setStatus: async (id: IdInput<SpecId>, status: Spec["status"], options: MutationOptions) => {
        const { repository } = await this.getRepository();
        return new SetSpecStatusUseCase(repository).execute({
          id: parseId(id, SpecId.from),
          to: status,
          ...options,
        });
      },
    };
  }
}
