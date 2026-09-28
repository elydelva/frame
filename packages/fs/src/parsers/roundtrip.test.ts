import { describe, expect, it } from "bun:test";
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
import { serializeIssue } from "../serializers/issue.serializer.js";
import { serializeMilestone } from "../serializers/milestone.serializer.js";
import { serializeProject } from "../serializers/project.serializer.js";
import { serializeSpec } from "../serializers/spec.serializer.js";
import { serializeTrace } from "../serializers/trace.serializer.js";
import { parseIssue } from "./issue.parser.js";
import { parseMilestone } from "./milestone.parser.js";
import { parseProject } from "./project.parser.js";
import { parseSpec } from "./spec.parser.js";
import { parseTrace } from "./trace.parser.js";

describe("project round-trip", () => {
  it("preserves all fields", () => {
    const project = Project.create({
      id: ProjectId.from("PROJ-0001"),
      title: "My Project",
      author: "alice",
      leads: ["alice", "bob"],
      body: "# Body\n\nDetails.",
    });
    const parsed = parseProject(serializeProject(project));
    expect(parsed.id.toString()).toBe("PROJ-0001");
    expect(parsed.title).toBe("My Project");
    expect(parsed.status).toBe("planned");
    expect(parsed.leads).toEqual(["alice", "bob"]);
    expect(parsed.author).toBe("alice");
    expect(parsed.createdAt.toISOString()).toBe(project.createdAt.toISOString());
    expect(parsed.body).toBe("# Body\n\nDetails.");
  });
});

describe("milestone round-trip", () => {
  it("preserves fields including null targetDate", () => {
    const m = Milestone.create({
      id: MilestoneId.from("MILE-0002"),
      projectId: ProjectId.from("PROJ-0001"),
      title: "Phase One",
      order: 3,
    });
    const parsed = parseMilestone(serializeMilestone(m));
    expect(parsed.id.toString()).toBe("MILE-0002");
    expect(parsed.projectId.toString()).toBe("PROJ-0001");
    expect(parsed.order).toBe(3);
    expect(parsed.targetDate).toBeNull();
    expect(parsed.status).toBe("pending");
  });

  it("preserves a targetDate", () => {
    const target = new Date("2026-12-31T00:00:00.000Z");
    const m = Milestone.create({
      id: MilestoneId.from("MILE-0001"),
      projectId: ProjectId.from("PROJ-0001"),
      title: "Ship",
      order: 1,
      targetDate: target,
    });
    const parsed = parseMilestone(serializeMilestone(m));
    expect(parsed.targetDate?.toISOString()).toBe(target.toISOString());
  });
});

describe("issue round-trip", () => {
  it("preserves fields, gates (id + cross-project string), rules, nulls", () => {
    const issue = Issue.create({
      id: IssueId.from("ISSUE-0007"),
      projectId: ProjectId.from("PROJ-0001"),
      milestoneId: MilestoneId.from("MILE-0002"),
      title: "Do the thing",
      author: "carol",
      priority: "high",
      estimate: 5,
      labels: ["backend", "urgent"],
      parentId: IssueId.from("ISSUE-0001"),
      gates: [IssueId.from("ISSUE-0003"), "PROJ-0002/ISSUE-0005"],
      rules: [{ trigger: "before_complete", instruction: "run tests" }],
      assignee: "dave",
      body: "Issue body",
    });
    const parsed = parseIssue(serializeIssue(issue));
    expect(parsed.id.toString()).toBe("ISSUE-0007");
    expect(parsed.milestoneId?.toString()).toBe("MILE-0002");
    expect(parsed.priority).toBe("high");
    expect(parsed.estimate).toBe(5);
    expect(parsed.labels).toEqual(["backend", "urgent"]);
    expect(parsed.parentId?.toString()).toBe("ISSUE-0001");
    expect(parsed.gates.map((g) => g.toString())).toEqual(["ISSUE-0003", "PROJ-0002/ISSUE-0005"]);
    expect(parsed.gates[0]).toBeInstanceOf(IssueId);
    expect(typeof parsed.gates[1]).toBe("string");
    expect(parsed.rules).toEqual([{ trigger: "before_complete", instruction: "run tests" }]);
    expect(parsed.assignee).toBe("dave");
    expect(parsed.body).toBe("Issue body");
  });

  it("preserves null milestoneId / estimate / assignee", () => {
    const issue = Issue.create({
      id: IssueId.from("ISSUE-0009"),
      projectId: ProjectId.from("PROJ-0001"),
      title: "Minimal",
      author: "carol",
    });
    const parsed = parseIssue(serializeIssue(issue));
    expect(parsed.milestoneId).toBeNull();
    expect(parsed.estimate).toBeNull();
    expect(parsed.assignee).toBeNull();
    expect(parsed.parentId).toBeNull();
    expect(parsed.startedAt).toBeNull();
    expect(parsed.completedAt).toBeNull();
  });
});

describe("spec round-trip", () => {
  it("preserves relatedTo, tags, supersedes", () => {
    const spec = Spec.create({
      id: SpecId.from("SPEC-0001"),
      projectId: ProjectId.from("PROJ-0001"),
      title: "Decision",
      author: "erin",
      supersedes: SpecId.from("SPEC-0000"),
      relatedTo: [SpecId.from("SPEC-0002"), SpecId.from("SPEC-0003")],
      tags: ["arch"],
      rules: [{ trigger: "on_conflict", instruction: "escalate" }],
      body: "Spec body",
    });
    const parsed = parseSpec(serializeSpec(spec));
    expect(parsed.id.toString()).toBe("SPEC-0001");
    expect(parsed.supersedes?.toString()).toBe("SPEC-0000");
    expect(parsed.supersededBy).toBeNull();
    expect(parsed.relatedTo.map((s) => s.toString())).toEqual(["SPEC-0002", "SPEC-0003"]);
    expect(parsed.tags).toEqual(["arch"]);
    expect(parsed.status).toBe("draft");
    expect(parsed.body).toBe("Spec body");
  });
});

describe("trace round-trip", () => {
  it("preserves projectId, issueId, specId and event", () => {
    const trace = Trace.create({
      id: TraceId.generate(),
      projectId: ProjectId.from("PROJ-0001"),
      issueId: IssueId.from("ISSUE-0007"),
      actor: "agent-1",
      actorType: "agent",
      event: "issue_started",
      ref: "abc123",
      from: "not-started",
      to: "in-progress",
      body: "started work",
    });
    const parsed = parseTrace(serializeTrace(trace));
    expect(parsed.id.toString()).toBe(trace.id.toString());
    expect(parsed.projectId.toString()).toBe("PROJ-0001");
    expect(parsed.issueId?.toString()).toBe("ISSUE-0007");
    expect(parsed.specId).toBeNull();
    expect(parsed.actorType).toBe("agent");
    expect(parsed.event).toBe("issue_started");
    expect(parsed.from).toBe("not-started");
    expect(parsed.to).toBe("in-progress");
    expect(parsed.body).toBe("started work");
  });

  it("preserves a spec-scoped trace", () => {
    const trace = Trace.create({
      id: TraceId.generate(),
      projectId: ProjectId.from("PROJ-0001"),
      specId: SpecId.from("SPEC-0001"),
      actor: "alice",
      actorType: "human",
      event: "spec_status_changed",
    });
    const parsed = parseTrace(serializeTrace(trace));
    expect(parsed.specId?.toString()).toBe("SPEC-0001");
    expect(parsed.issueId).toBeNull();
  });

  it("preserves a project_status_changed trace", () => {
    const trace = Trace.create({
      id: TraceId.generate(),
      projectId: ProjectId.from("PROJ-0001"),
      actor: "alice",
      actorType: "human",
      event: "project_status_changed",
      from: "planned",
      to: "active",
    });
    const parsed = parseTrace(serializeTrace(trace));
    expect(parsed.event).toBe("project_status_changed");
    expect(parsed.from).toBe("planned");
    expect(parsed.to).toBe("active");
  });
});
