import { afterEach, describe, expect, it } from "bun:test";
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
import {
  fail,
  parseList,
  resolveActor,
  resolveAuthor,
  serializeContext,
  serializeIssue,
  serializeMilestone,
  serializeProject,
  serializeSpec,
  serializeTrace,
} from "./shared.js";

describe("shared helpers", () => {
  describe("resolveAuthor", () => {
    const originalAuthor = process.env.GIT_AUTHOR_NAME;
    const originalUser = process.env.USER;

    const unset = (key: string): void => {
      Reflect.deleteProperty(process.env, key);
    };

    afterEach(() => {
      if (originalAuthor === undefined) unset("GIT_AUTHOR_NAME");
      else process.env.GIT_AUTHOR_NAME = originalAuthor;
      if (originalUser === undefined) unset("USER");
      else process.env.USER = originalUser;
    });

    it("prefers GIT_AUTHOR_NAME", () => {
      process.env.GIT_AUTHOR_NAME = "alice";
      process.env.USER = "bob";
      expect(resolveAuthor()).toBe("alice");
    });

    it("falls back to USER", () => {
      unset("GIT_AUTHOR_NAME");
      process.env.USER = "bob";
      expect(resolveAuthor()).toBe("bob");
    });

    it("falls back to 'unknown'", () => {
      unset("GIT_AUTHOR_NAME");
      unset("USER");
      expect(resolveAuthor()).toBe("unknown");
    });
  });

  describe("resolveActor", () => {
    const saved = {
      actor: process.env.FRAME_ACTOR,
      type: process.env.FRAME_ACTOR_TYPE,
      author: process.env.GIT_AUTHOR_NAME,
      user: process.env.USER,
    };
    const unset = (key: string): void => Reflect.deleteProperty(process.env, key);
    const restore = (key: string, val: string | undefined): void => {
      if (val === undefined) unset(key);
      else process.env[key] = val;
    };

    afterEach(() => {
      restore("FRAME_ACTOR", saved.actor);
      restore("FRAME_ACTOR_TYPE", saved.type);
      restore("GIT_AUTHOR_NAME", saved.author);
      restore("USER", saved.user);
    });

    it("prefers the --actor flag over env", () => {
      process.env.FRAME_ACTOR = "env-actor";
      expect(resolveActor({ actor: "flag-actor" }).actor).toBe("flag-actor");
    });

    it("falls back to FRAME_ACTOR then resolveAuthor", () => {
      unset("FRAME_ACTOR");
      process.env.GIT_AUTHOR_NAME = "git-actor";
      expect(resolveActor({}).actor).toBe("git-actor");
      process.env.FRAME_ACTOR = "env-actor";
      expect(resolveActor({}).actor).toBe("env-actor");
    });

    it("marks agents via flag or env, defaulting to human", () => {
      unset("FRAME_ACTOR_TYPE");
      expect(resolveActor({}).actorType).toBe("human");
      expect(resolveActor({ actorType: "agent" }).actorType).toBe("agent");
      process.env.FRAME_ACTOR_TYPE = "agent";
      expect(resolveActor({}).actorType).toBe("agent");
    });

    it("carries --message as the trace note", () => {
      expect(resolveActor({ message: "because" }).note).toBe("because");
      expect(resolveActor({}).note).toBeUndefined();
    });

    it("rejects an invalid --actor-type", () => {
      const originalExit = process.exit;
      const originalError = console.error;
      const errors: string[] = [];
      console.error = (...args: unknown[]) => errors.push(args.map(String).join(" "));
      // @ts-expect-error test stub that throws to short-circuit `never`.
      process.exit = () => {
        throw new Error("exit");
      };
      try {
        expect(() => resolveActor({ actorType: "robot" })).toThrow("exit");
        expect(errors.join("\n")).toContain("Invalid --actor-type");
      } finally {
        process.exit = originalExit;
        console.error = originalError;
      }
    });
  });

  describe("parseList", () => {
    it("returns an empty array for undefined", () => {
      expect(parseList(undefined)).toEqual([]);
    });

    it("returns an empty array for an empty string", () => {
      expect(parseList("")).toEqual([]);
    });

    it("splits, trims, and drops blanks", () => {
      expect(parseList("a, b ,  , c ")).toEqual(["a", "b", "c"]);
    });
  });

  describe("fail", () => {
    const originalExit = process.exit;
    const originalError = console.error;

    afterEach(() => {
      process.exit = originalExit;
      console.error = originalError;
    });

    it("prints to stderr and exits with code 1", () => {
      const errors: string[] = [];
      console.error = (...args: unknown[]) => {
        errors.push(args.map(String).join(" "));
      };
      let exitCode: number | undefined;
      // @ts-expect-error test stub that throws to short-circuit `never`.
      process.exit = (code?: number) => {
        exitCode = code;
        throw new Error("exit");
      };

      expect(() => fail("boom")).toThrow("exit");
      expect(exitCode).toBe(1);
      expect(errors.join("\n")).toContain("Error: boom");
    });
  });

  describe("serializers", () => {
    const project = Project.create({
      id: ProjectId.from("PROJ-0001"),
      title: "Checkout",
      author: "alice",
    });

    it("serializeProject maps VOs and dates", () => {
      const out = serializeProject(project);
      expect(out.id).toBe("PROJ-0001");
      expect(out.title).toBe("Checkout");
      expect(typeof out.createdAt).toBe("string");
      expect(out.createdAt).toBe(project.createdAt.toISOString());
    });

    it("serializeMilestone handles a present targetDate", () => {
      const target = new Date("2030-01-01T00:00:00.000Z");
      const milestone = Milestone.create({
        id: MilestoneId.from("MILE-0001"),
        projectId: ProjectId.from("PROJ-0001"),
        title: "MVP",
        order: 1,
        targetDate: target,
      });
      const out = serializeMilestone(milestone);
      expect(out.id).toBe("MILE-0001");
      expect(out.projectId).toBe("PROJ-0001");
      expect(out.targetDate).toBe(target.toISOString());
      expect(out.order).toBe(1);
    });

    it("serializeMilestone handles a null targetDate", () => {
      const milestone = Milestone.create({
        id: MilestoneId.from("MILE-0002"),
        projectId: ProjectId.from("PROJ-0001"),
        title: "Later",
        order: 2,
      });
      expect(serializeMilestone(milestone).targetDate).toBeNull();
    });

    it("serializeIssue maps optional VOs (present)", () => {
      const issue = Issue.create({
        id: IssueId.from("ISSUE-0001"),
        projectId: ProjectId.from("PROJ-0001"),
        milestoneId: MilestoneId.from("MILE-0001"),
        title: "Fix auth",
        author: "alice",
        priority: "high",
        parentId: IssueId.from("ISSUE-0002"),
        gates: [IssueId.from("ISSUE-0003"), "PROJ-0001/ISSUE-0004"],
        assignee: "bob",
      });
      const out = serializeIssue(issue);
      expect(out.id).toBe("ISSUE-0001");
      expect(out.milestoneId).toBe("MILE-0001");
      expect(out.parentId).toBe("ISSUE-0002");
      expect(out.gates).toEqual(["ISSUE-0003", "PROJ-0001/ISSUE-0004"]);
      expect(out.assignee).toBe("bob");
      expect(out.startedAt).toBeNull();
      expect(out.completedAt).toBeNull();
    });

    it("serializeIssue maps optional VOs (absent)", () => {
      const issue = Issue.create({
        id: IssueId.from("ISSUE-0005"),
        projectId: ProjectId.from("PROJ-0001"),
        title: "Standalone",
        author: "alice",
      });
      const out = serializeIssue(issue);
      expect(out.milestoneId).toBeNull();
      expect(out.parentId).toBeNull();
      expect(out.gates).toEqual([]);
      expect(out.assignee).toBeNull();
    });

    it("serializeSpec maps related/superseding VOs (present)", () => {
      const spec = Spec.create({
        id: SpecId.from("SPEC-0001"),
        projectId: ProjectId.from("PROJ-0001"),
        title: "Auth approach",
        author: "alice",
        supersedes: SpecId.from("SPEC-0002"),
        relatedTo: [SpecId.from("SPEC-0003")],
        tags: ["auth"],
      });
      const out = serializeSpec(spec);
      expect(out.id).toBe("SPEC-0001");
      expect(out.supersedes).toBe("SPEC-0002");
      expect(out.supersededBy).toBeNull();
      expect(out.relatedTo).toEqual(["SPEC-0003"]);
      expect(out.tags).toEqual(["auth"]);
    });

    it("serializeSpec maps related/superseding VOs (absent)", () => {
      const spec = Spec.create({
        id: SpecId.from("SPEC-0004"),
        projectId: ProjectId.from("PROJ-0001"),
        title: "Bare",
        author: "alice",
      });
      const out = serializeSpec(spec);
      expect(out.supersedes).toBeNull();
      expect(out.relatedTo).toEqual([]);
    });

    it("serializeTrace maps optional refs (present)", () => {
      const trace = Trace.create({
        id: TraceId.from("TRACE-20260623T1430-a1b2c3"),
        projectId: ProjectId.from("PROJ-0001"),
        issueId: IssueId.from("ISSUE-0001"),
        specId: SpecId.from("SPEC-0001"),
        actor: "alice",
        actorType: "human",
        event: "issue_started",
        ref: "branch",
        from: "not-started",
        to: "in-progress",
        body: "note",
      });
      const out = serializeTrace(trace);
      expect(out.id).toBe("TRACE-20260623T1430-a1b2c3");
      expect(out.issueId).toBe("ISSUE-0001");
      expect(out.specId).toBe("SPEC-0001");
      expect(out.actorType).toBe("human");
      expect(out.event).toBe("issue_started");
      expect(out.ref).toBe("branch");
      expect(out.from).toBe("not-started");
      expect(out.to).toBe("in-progress");
    });

    it("serializeTrace maps optional refs (absent)", () => {
      const trace = Trace.create({
        id: TraceId.from("TRACE-20260623T1431-d4e5f6"),
        projectId: ProjectId.from("PROJ-0001"),
        actor: "agent",
        actorType: "agent",
        event: "note",
      });
      const out = serializeTrace(trace);
      expect(out.issueId).toBeNull();
      expect(out.specId).toBeNull();
      expect(out.ref).toBeNull();
      expect(out.from).toBeNull();
      expect(out.to).toBeNull();
    });

    it("serializeContext maps every collection", () => {
      const out = serializeContext({
        projects: [project],
        milestones: [],
        issues: [],
        specs: [],
        traces: [],
      });
      expect(out.projects).toHaveLength(1);
      expect(out.milestones).toEqual([]);
      expect(out.issues).toEqual([]);
      expect(out.specs).toEqual([]);
      expect(out.traces).toEqual([]);
    });
  });
});
