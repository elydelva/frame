import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  DEFAULT_CONFIG,
  type IRealmRepository,
  Issue,
  IssueId,
  Milestone,
  MilestoneId,
  Project,
  ProjectId,
  Spec,
  SpecId,
} from "@frame/core";
import { Frame, FrameInputError } from "./index.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "frame-sdk-test-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function inMemoryRepository(): IRealmRepository {
  const projects = new Map<string, Project>();
  const milestones = new Map<string, Milestone>();
  const issues = new Map<string, Issue>();
  const specs = new Map<string, Spec>();
  const traces: import("@frame/core").Trace[] = [];
  const counters = { project: 0, milestone: 0, issue: 0, spec: 0 };
  return {
    findProject: async (id) => projects.get(id.toString()) ?? null,
    findAllProjects: async () => [...projects.values()],
    saveProject: async (value) => {
      projects.set(value.id.toString(), value);
    },
    findMilestone: async (id) => milestones.get(id.toString()) ?? null,
    findMilestonesForProject: async (id) =>
      [...milestones.values()].filter((value) => value.projectId.equals(id)),
    findAllMilestones: async () => [...milestones.values()],
    saveMilestone: async (value) => {
      milestones.set(value.id.toString(), value);
    },
    findIssue: async (id) => issues.get(id.toString()) ?? null,
    findIssuesForProject: async (id) =>
      [...issues.values()].filter((value) => value.projectId.equals(id)),
    findAllIssues: async () => [...issues.values()],
    saveIssue: async (value) => {
      issues.set(value.id.toString(), value);
    },
    deleteIssue: async (id) => {
      issues.delete(id.toString());
    },
    findSpec: async (id) => specs.get(id.toString()) ?? null,
    findSpecsForProject: async (id) =>
      [...specs.values()].filter((value) => value.projectId.equals(id)),
    findAllSpecs: async () => [...specs.values()],
    saveSpec: async (value) => {
      specs.set(value.id.toString(), value);
    },
    appendTrace: async (value) => {
      traces.push(value);
    },
    findTraces: async () => traces,
    getState: async () => ({ counters: { ...counters } }),
    incrementCounter: async (key) => ++counters[key],
  };
}

async function seedRealm(repository: IRealmRepository): Promise<void> {
  const project = {
    ...Project.create({ id: ProjectId.from("PROJ-0001"), title: "Alpha", author: "me" }),
    status: "active" as const,
  };
  await repository.saveProject(project);
  await repository.saveMilestone(
    Milestone.create({
      id: MilestoneId.from("MILE-0001"),
      projectId: project.id,
      title: "First",
      order: 1,
    })
  );
  await repository.saveIssue(
    Issue.create({
      id: IssueId.from("ISSUE-0001"),
      projectId: project.id,
      title: "First issue",
      author: "me",
      labels: ["api"],
      branch: "feature/api",
      priority: "high",
    })
  );
  await repository.saveSpec(
    Spec.create({
      id: SpecId.from("SPEC-0001"),
      projectId: project.id,
      title: "Spec",
      author: "me",
    })
  );
}

describe("Frame construction and read API", () => {
  test("constructsWithoutFilesystemReads", () => {
    expect(() => new Frame({ root })).not.toThrow();
  });

  test("memoizesFirstOperationInitialization", async () => {
    await writeFile(
      path.join(root, ".frameconfig"),
      "priority:\n  default: urgent\n  levels: [urgent, low]\n"
    );
    const frame = new Frame({ root });
    expect((await frame.config.get()).priority.default).toBe("urgent");
    await writeFile(
      path.join(root, ".frameconfig"),
      "priority:\n  default: low\n  levels: [urgent, low]\n"
    );
    expect((await frame.config.get()).priority.default).toBe("urgent");
  });

  test("readsLegacyRealmWithoutManifest", async () => {
    const frame = new Frame({ root });
    await expect(frame.projects.list()).resolves.toEqual([]);
  });

  test("rejectsUnsupportedFormatBeforeRepositoryReads", async () => {
    await mkdir(path.join(root, ".frame"), { recursive: true });
    await writeFile(path.join(root, ".frame", "manifest.json"), '{"formatVersion":99}');
    let reads = 0;
    const repo = {
      ...inMemoryRepository(),
      findAllProjects: async () => {
        reads += 1;
        return [];
      },
    } as IRealmRepository;
    await expect(new Frame({ root, repository: repo }).projects.list()).rejects.toMatchObject({
      code: "UNSUPPORTED_REALM_FORMAT",
    });
    expect(reads).toBe(0);
  });

  test("usesCustomRepositoryWithoutRoot", async () => {
    const repository = inMemoryRepository();
    await seedRealm(repository);
    const frame = new Frame({ repository });
    await expect(frame.projects.list()).resolves.toHaveLength(1);
  });

  test("usesDefaultConfigForCustomRepository", async () => {
    const frame = new Frame({ repository: inMemoryRepository() });
    expect(await frame.config.get()).toEqual(DEFAULT_CONFIG);
  });

  test("usesExplicitConfigForCustomRepository", async () => {
    const config = { ...DEFAULT_CONFIG, priority: { default: "low", levels: ["low"] } };
    const frame = new Frame({ repository: inMemoryRepository(), config });
    expect(await frame.config.get()).toEqual(config);
  });

  test("loadsFilesystemConfigForRoot", async () => {
    await writeFile(
      path.join(root, ".frameconfig"),
      "priority:\n  default: urgent\n  levels: [urgent, low]\n"
    );
    expect((await new Frame({ root }).config.get()).priority.default).toBe("urgent");
  });

  test("listsAndFindsEveryEntityType", async () => {
    const repository = inMemoryRepository();
    await seedRealm(repository);
    const frame = new Frame({ repository });
    expect(await frame.projects.list()).toHaveLength(1);
    expect(await frame.projects.get("PROJ-0001")).toMatchObject({ title: "Alpha" });
    expect(await frame.milestones.list()).toHaveLength(1);
    expect(await frame.milestones.get("MILE-0001")).toMatchObject({ title: "First" });
    expect(await frame.issues.list()).toHaveLength(1);
    expect(await frame.issues.get("ISSUE-0001")).toMatchObject({ title: "First issue" });
    expect(await frame.specs.list()).toHaveLength(1);
    expect(await frame.specs.get("SPEC-0001")).toMatchObject({ title: "Spec" });
    expect(await frame.traces.list()).toEqual([]);
  });

  test("filtersIssueLists", async () => {
    const repository = inMemoryRepository();
    await seedRealm(repository);
    const frame = new Frame({ repository });
    expect(
      await frame.issues.list({ label: "api", branch: "feature/api", priority: "high" })
    ).toHaveLength(1);
    expect(await frame.issues.list({ label: "ui" })).toHaveLength(0);
    expect(await frame.milestones.list({ projectId: "PROJ-0001" })).toHaveLength(1);
    expect(await frame.specs.list({ projectId: "PROJ-0001", status: "draft" })).toHaveLength(1);
  });

  test("requiresRootOrRepository", () => {
    expect(() => new Frame({})).toThrow(
      "Frame requires either a root path or a repository adapter."
    );
  });

  test("delegatesReadQueries", async () => {
    const repository = inMemoryRepository();
    await seedRealm(repository);
    const frame = new Frame({ repository });
    expect(await frame.next()).toMatchObject({ issue: { title: "First issue" } });
    expect(await frame.context()).toMatchObject({ projects: [{ title: "Alpha" }] });
    expect(await frame.history()).toEqual([]);
    expect(await frame.brief()).toMatchObject({ issue: { title: "First issue" } });
  });

  test("reportsIssueEligibilityUsingDagRules", async () => {
    const repository = inMemoryRepository();
    await seedRealm(repository);
    const frame = new Frame({ repository });
    expect(await frame.issues.isEligibleToStart("ISSUE-0001")).toBe(true);
  });

  test("propagatesAdapterErrorsUnchanged", async () => {
    const failure = new Error("adapter failed");
    const repository = {
      findAllProjects: async () => {
        throw failure;
      },
    } as IRealmRepository;
    await expect(new Frame({ repository }).projects.list()).rejects.toBe(failure);
  });

  test("doesNotPrintOrExitOnFailure", async () => {
    const failure = new Error("adapter failed");
    const repository = {
      findAllProjects: async () => {
        throw failure;
      },
    } as IRealmRepository;
    const log = spyOn(console, "error").mockImplementation(() => {});
    const write = spyOn(console, "log").mockImplementation(() => {});
    const exit = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("unexpected process exit");
    });
    await expect(new Frame({ repository }).projects.list()).rejects.toBe(failure);
    expect(log).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
    log.mockRestore();
    write.mockRestore();
    exit.mockRestore();
  });

  test("createsEntitiesAndRecordsTraces", async () => {
    const frame = new Frame({ repository: inMemoryRepository() });
    const project = await frame.projects.create({ title: "Created", author: "me" });
    const milestone = await frame.milestones.create({
      projectId: project.id,
      title: "Phase",
      order: 1,
      author: "me",
    });
    const issue = await frame.issues.create({
      projectId: project.id,
      milestoneId: milestone.id,
      title: "Work",
      author: "me",
    });
    const spec = await frame.specs.create({
      projectId: project.id,
      title: "Decision",
      author: "me",
    });
    expect([
      project.id.toString(),
      milestone.id.toString(),
      issue.id.toString(),
      spec.id.toString(),
    ]).toEqual(["PROJ-0001", "MILE-0001", "ISSUE-0001", "SPEC-0001"]);
    expect(await frame.history()).toHaveLength(4);
  });

  test("editsAndChangesStatuses", async () => {
    const repository = inMemoryRepository();
    await seedRealm(repository);
    const frame = new Frame({ repository });
    expect(await frame.issues.edit("ISSUE-0001", { title: "Updated", actor: "me" })).toMatchObject({
      title: "Updated",
    });
    expect(
      await frame.issues.setStatus("ISSUE-0001", "in-progress", { actor: "me" })
    ).toMatchObject({ status: "in-progress" });
    expect(await frame.projects.setStatus("PROJ-0001", "paused", { actor: "me" })).toMatchObject({
      status: "paused",
    });
    expect(await frame.milestones.setStatus("MILE-0001", "active", { actor: "me" })).toMatchObject({
      status: "active",
    });
    await frame.specs.setStatus("SPEC-0001", "proposed", { actor: "me" });
    expect(await frame.specs.setStatus("SPEC-0001", "accepted", { actor: "me" })).toMatchObject({
      status: "accepted",
    });
  });

  test("deletesIssuesAndRetainsDeletionTrace", async () => {
    const repository = inMemoryRepository();
    await seedRealm(repository);
    const frame = new Frame({ repository });
    await frame.issues.delete("ISSUE-0001", { actor: "me" });
    expect(await frame.issues.get("ISSUE-0001")).toBeNull();
    expect(await frame.history()).toHaveLength(1);
    expect((await frame.history())[0]?.event).toBe("issue_deleted");
  });

  test("startsAndCompletesIssuesWithCoreRules", async () => {
    const repository = inMemoryRepository();
    await seedRealm(repository);
    const frame = new Frame({ repository });
    await frame.issues.start("ISSUE-0001", { actor: "me" });
    await expect(frame.issues.complete("ISSUE-0001", { actor: "me" })).resolves.toMatchObject({
      status: "completed",
    });
  });

  test("addsAndRemovesIssueGates", async () => {
    const repository = inMemoryRepository();
    await seedRealm(repository);
    await repository.saveIssue(
      Issue.create({
        id: IssueId.from("ISSUE-0002"),
        projectId: ProjectId.from("PROJ-0001"),
        title: "Second",
        author: "me",
      })
    );
    const frame = new Frame({ repository });
    await expect(
      frame.issues.addGate("ISSUE-0002", "ISSUE-0001", { actor: "me" })
    ).resolves.toMatchObject({ gates: [IssueId.from("ISSUE-0001")] });
    await expect(
      frame.issues.addGate("ISSUE-0002", "ISSUE-0001", { actor: "me" })
    ).rejects.toMatchObject({ code: "DUPLICATE_GATE" });
    await frame.issues.removeGate("ISSUE-0002", "ISSUE-0001", { actor: "me" });
    await expect(
      frame.issues.removeGate("ISSUE-0002", "ISSUE-0001", { actor: "me" })
    ).rejects.toMatchObject({ code: "GATE_NOT_FOUND" });
  });

  test("readsDefaultsForMissingOrMalformedConfig", async () => {
    expect(await new Frame({ root }).config.get()).toEqual(DEFAULT_CONFIG);
    await writeFile(path.join(root, ".frameconfig"), ": invalid: yaml");
    expect(await new Frame({ root }).config.get()).toEqual(DEFAULT_CONFIG);
  });

  test("persistsSupportedConfigUpdates", async () => {
    const frame = new Frame({ root });
    await frame.config.set("priority.default", "high");
    expect((await frame.config.get()).priority.default).toBe("high");
    expect((await new Frame({ root }).config.get()).priority.default).toBe("high");
  });

  test("rejectsUnsupportedConfigKeys", async () => {
    await expect(new Frame({ root }).config.set("priority.levels", "low")).rejects.toBeInstanceOf(
      FrameInputError
    );
  });

  test("rejectsConfigWritesWithoutRoot", async () => {
    await expect(
      new Frame({ repository: inMemoryRepository() }).config.set("priority.default", "high")
    ).rejects.toMatchObject({ code: "CONFIG_STORAGE_UNAVAILABLE" });
  });

  test("initializesRealmFilesWithoutCliSideEffects", async () => {
    const frame = await Frame.initialize({ root });
    expect(await frame.projects.list()).toEqual([]);
    await expect(readFile(path.join(root, "AGENTS.md"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});
