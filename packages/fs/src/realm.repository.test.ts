import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
  Issue,
  IssueId,
  Milestone,
  MilestoneId,
  Project,
  ProjectId,
  Spec,
  SpecId,
  Trace,
  TraceId,
} from "@frame/core";
import { FRAME_DIR } from "./constants.js";
import { FsRealmRepository } from "./realm.repository.js";

async function mkTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "frame-test-"));
}

function makeProject(id = "PROJ-0001", title = "My Project"): Project {
  return Project.create({ id: ProjectId.from(id), title, author: "alice" });
}

describe("FsRealmRepository", () => {
  let tempDir: string;
  let repo: FsRealmRepository;

  beforeEach(async () => {
    tempDir = await mkTempDir();
    repo = new FsRealmRepository(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("Project CRUD", () => {
    it("returns null for a non-existent project", async () => {
      expect(await repo.findProject(ProjectId.from("PROJ-0001"))).toBeNull();
    });

    it("saves and retrieves a project", async () => {
      const project = makeProject();
      await repo.saveProject(project);
      const found = await repo.findProject(project.id);
      expect(found?.id.toString()).toBe("PROJ-0001");
      expect(found?.title).toBe("My Project");
    });

    it("writes the project file with a slugged dir but un-slugged filename", async () => {
      await repo.saveProject(makeProject("PROJ-0001", "Hello World!"));
      const projectsRoot = path.join(tempDir, FRAME_DIR, "projects");
      const dirs = await fs.readdir(projectsRoot);
      expect(dirs).toContain("PROJ-0001-hello-world");
      const files = await fs.readdir(path.join(projectsRoot, "PROJ-0001-hello-world"));
      expect(files).toContain("PROJ-0001.md");
    });

    it("identity comes from frontmatter, not filename", async () => {
      const project = makeProject("PROJ-0042", "Rename Me");
      await repo.saveProject(project);
      // Rename the dir to a different slug — id still resolves.
      const projectsRoot = path.join(tempDir, FRAME_DIR, "projects");
      await fs.rename(
        path.join(projectsRoot, "PROJ-0042-rename-me"),
        path.join(projectsRoot, "PROJ-0042-something-else")
      );
      const found = await repo.findProject(ProjectId.from("PROJ-0042"));
      expect(found?.title).toBe("Rename Me");
    });

    it("re-saving reuses the existing directory", async () => {
      await repo.saveProject(makeProject("PROJ-0001", "Original Title"));
      await repo.saveProject({ ...makeProject("PROJ-0001", "Original Title"), title: "Updated" });
      const projectsRoot = path.join(tempDir, FRAME_DIR, "projects");
      const dirs = await fs.readdir(projectsRoot);
      expect(dirs).toEqual(["PROJ-0001-original-title"]);
      const found = await repo.findProject(ProjectId.from("PROJ-0001"));
      expect(found?.title).toBe("Updated");
    });

    it("findAllProjects returns every project", async () => {
      await repo.saveProject(makeProject("PROJ-0001", "One"));
      await repo.saveProject(makeProject("PROJ-0002", "Two"));
      const all = await repo.findAllProjects();
      expect(all.map((p) => p.id.toString()).sort()).toEqual(["PROJ-0001", "PROJ-0002"]);
    });
  });

  describe("Milestone CRUD", () => {
    beforeEach(async () => {
      await repo.saveProject(makeProject());
    });

    it("saves and finds a milestone", async () => {
      const m = Milestone.create({
        id: MilestoneId.from("MILE-0001"),
        projectId: ProjectId.from("PROJ-0001"),
        title: "Phase One",
        order: 1,
      });
      await repo.saveMilestone(m);
      const found = await repo.findMilestone(m.id);
      expect(found?.title).toBe("Phase One");
      expect(await repo.findMilestonesForProject(ProjectId.from("PROJ-0001"))).toHaveLength(1);
      expect(await repo.findAllMilestones()).toHaveLength(1);
    });
  });

  describe("Issue CRUD", () => {
    beforeEach(async () => {
      await repo.saveProject(makeProject("PROJ-0001", "One"));
      await repo.saveProject(makeProject("PROJ-0002", "Two"));
    });

    it("stores issues flat with milestoneId as a field", async () => {
      const issue = Issue.create({
        id: IssueId.from("ISSUE-0001"),
        projectId: ProjectId.from("PROJ-0001"),
        milestoneId: MilestoneId.from("MILE-0001"),
        title: "Build it",
        author: "carol",
      });
      await repo.saveIssue(issue);
      const issuesDir = path.join(tempDir, FRAME_DIR, "projects", "PROJ-0001-one", "issues");
      const files = await fs.readdir(issuesDir);
      expect(files).toEqual(["ISSUE-0001-build-it.md"]);
      const found = await repo.findIssue(issue.id);
      expect(found?.milestoneId?.toString()).toBe("MILE-0001");
    });

    it("findIssue scans all projects when no hint is given", async () => {
      await repo.saveIssue(
        Issue.create({
          id: IssueId.from("ISSUE-0005"),
          projectId: ProjectId.from("PROJ-0002"),
          title: "In project two",
          author: "carol",
        })
      );
      const found = await repo.findIssue(IssueId.from("ISSUE-0005"));
      expect(found?.projectId.toString()).toBe("PROJ-0002");
    });

    it("findIssuesForProject scopes to one project", async () => {
      await repo.saveIssue(
        Issue.create({
          id: IssueId.from("ISSUE-0001"),
          projectId: ProjectId.from("PROJ-0001"),
          title: "A",
          author: "carol",
        })
      );
      await repo.saveIssue(
        Issue.create({
          id: IssueId.from("ISSUE-0002"),
          projectId: ProjectId.from("PROJ-0002"),
          title: "B",
          author: "carol",
        })
      );
      expect(await repo.findIssuesForProject(ProjectId.from("PROJ-0001"))).toHaveLength(1);
      expect(await repo.findAllIssues()).toHaveLength(2);
    });

    it("round-trips assignee and branch through frontmatter", async () => {
      const issue = Issue.create({
        id: IssueId.from("ISSUE-0001"),
        projectId: ProjectId.from("PROJ-0001"),
        title: "Build it",
        author: "carol",
        assignee: "dave",
        branch: "feat/build-it",
      });
      await repo.saveIssue(issue);
      const found = await repo.findIssue(issue.id);
      expect(found?.assignee).toBe("dave");
      expect(found?.branch).toBe("feat/build-it");
    });

    it("defaults assignee and branch to null when absent", async () => {
      const issue = Issue.create({
        id: IssueId.from("ISSUE-0002"),
        projectId: ProjectId.from("PROJ-0001"),
        title: "No meta",
        author: "carol",
      });
      await repo.saveIssue(issue);
      const found = await repo.findIssue(issue.id);
      expect(found?.assignee).toBeNull();
      expect(found?.branch).toBeNull();
    });

    it("renames the file when the title changes, leaving no stale duplicate", async () => {
      const issue = Issue.create({
        id: IssueId.from("ISSUE-0001"),
        projectId: ProjectId.from("PROJ-0001"),
        title: "Old title",
        author: "carol",
      });
      await repo.saveIssue(issue);
      await repo.saveIssue({ ...issue, title: "New title" });

      const issuesDir = path.join(tempDir, FRAME_DIR, "projects", "PROJ-0001-one", "issues");
      const files = await fs.readdir(issuesDir);
      expect(files).toEqual(["ISSUE-0001-new-title.md"]);
      expect((await repo.findIssue(issue.id))?.title).toBe("New title");
    });

    it("deleteIssue removes every file claiming the id", async () => {
      const issue = Issue.create({
        id: IssueId.from("ISSUE-0001"),
        projectId: ProjectId.from("PROJ-0001"),
        title: "Doomed",
        author: "carol",
      });
      await repo.saveIssue(issue);
      await repo.deleteIssue(issue.id);

      const issuesDir = path.join(tempDir, FRAME_DIR, "projects", "PROJ-0001-one", "issues");
      expect(await fs.readdir(issuesDir)).toEqual([]);
      expect(await repo.findIssue(issue.id)).toBeNull();
    });
  });

  describe("Spec CRUD", () => {
    beforeEach(async () => {
      await repo.saveProject(makeProject());
    });

    it("saves and finds a spec", async () => {
      const spec = Spec.create({
        id: SpecId.from("SPEC-0001"),
        projectId: ProjectId.from("PROJ-0001"),
        title: "A Decision",
        author: "erin",
      });
      await repo.saveSpec(spec);
      const found = await repo.findSpec(spec.id);
      expect(found?.title).toBe("A Decision");
      expect(await repo.findSpecsForProject(ProjectId.from("PROJ-0001"))).toHaveLength(1);
      expect(await repo.findAllSpecs()).toHaveLength(1);
    });
  });

  describe("State counters", () => {
    it("starts at zero for all entities", async () => {
      const state = await repo.getState();
      expect(state.counters).toEqual({ project: 0, milestone: 0, issue: 0, spec: 0 });
    });

    it("increments counters independently", async () => {
      expect(await repo.incrementCounter("project")).toBe(1);
      expect(await repo.incrementCounter("project")).toBe(2);
      expect(await repo.incrementCounter("issue")).toBe(1);
      const state = await repo.getState();
      expect(state.counters.project).toBe(2);
      expect(state.counters.issue).toBe(1);
      expect(state.counters.milestone).toBe(0);
    });
  });

  describe("Traces", () => {
    beforeEach(async () => {
      await repo.saveProject(makeProject("PROJ-0001", "One"));
      await repo.saveProject(makeProject("PROJ-0002", "Two"));
    });

    function trace(overrides: Partial<Parameters<typeof Trace.create>[0]> = {}): Trace {
      return Trace.create({
        id: TraceId.generate(),
        projectId: ProjectId.from("PROJ-0001"),
        actor: "alice",
        actorType: "human",
        event: "note",
        ...overrides,
      });
    }

    it("two distinct traces never collide on disk", async () => {
      const a = trace();
      const b = trace();
      expect(a.id.toString()).not.toBe(b.id.toString());
      await repo.appendTrace(a);
      await repo.appendTrace(b);
      const tracesDir = path.join(tempDir, FRAME_DIR, "projects", "PROJ-0001-one", "traces");
      const files = await fs.readdir(tracesDir);
      expect(files).toHaveLength(2);
    });

    it("filters by projectId", async () => {
      await repo.appendTrace(trace({ projectId: ProjectId.from("PROJ-0001") }));
      await repo.appendTrace(trace({ projectId: ProjectId.from("PROJ-0002") }));
      const found = await repo.findTraces({ projectId: ProjectId.from("PROJ-0001") });
      expect(found).toHaveLength(1);
      expect(found[0]?.projectId.toString()).toBe("PROJ-0001");
    });

    it("filters by issueId", async () => {
      await repo.appendTrace(
        trace({ issueId: IssueId.from("ISSUE-0001"), event: "issue_started" })
      );
      await repo.appendTrace(trace({ issueId: IssueId.from("ISSUE-0002") }));
      const found = await repo.findTraces({ issueId: IssueId.from("ISSUE-0001") });
      expect(found).toHaveLength(1);
      expect(found[0]?.event).toBe("issue_started");
    });

    it("filters by specId", async () => {
      await repo.appendTrace(
        trace({ specId: SpecId.from("SPEC-0001"), event: "spec_status_changed" })
      );
      await repo.appendTrace(trace({ specId: SpecId.from("SPEC-0002") }));
      const found = await repo.findTraces({ specId: SpecId.from("SPEC-0001") });
      expect(found).toHaveLength(1);
      expect(found[0]?.specId?.toString()).toBe("SPEC-0001");
    });

    it("filters by actor and event", async () => {
      await repo.appendTrace(trace({ actor: "bob", event: "issue_completed" }));
      await repo.appendTrace(trace({ actor: "alice", event: "note" }));
      expect(await repo.findTraces({ actor: "bob" })).toHaveLength(1);
      expect(await repo.findTraces({ event: "issue_completed" })).toHaveLength(1);
    });

    it("returns all traces across projects with no filter", async () => {
      await repo.appendTrace(trace({ projectId: ProjectId.from("PROJ-0001") }));
      await repo.appendTrace(trace({ projectId: ProjectId.from("PROJ-0002") }));
      expect(await repo.findTraces({})).toHaveLength(2);
    });
  });

  describe("best-effort git staging", () => {
    it("persists writes even when the git adapter throws", async () => {
      let stageCalls = 0;
      const failingGit = {
        stage: async () => {
          stageCalls++;
          throw new Error("git boom");
        },
        isRepo: async () => true,
      };
      const gitRepo = new FsRealmRepository(tempDir, failingGit);

      // A staging failure must NOT abort the mutation or lose the trace.
      await gitRepo.saveProject(makeProject("PROJ-0001", "One"));
      const t = Trace.create({
        id: TraceId.generate(),
        projectId: ProjectId.from("PROJ-0001"),
        actor: "alice",
        actorType: "human",
        event: "project_created",
      });
      await gitRepo.appendTrace(t);

      expect(stageCalls).toBeGreaterThan(0);
      expect(await gitRepo.findProject(ProjectId.from("PROJ-0001"))).not.toBeNull();
      expect(await gitRepo.findTraces({})).toHaveLength(1);
    });
  });
});
