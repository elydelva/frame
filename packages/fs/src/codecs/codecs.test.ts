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
import { codecs } from "./codecs.js";

describe("codecs registry", () => {
  it("exposes a codec per entity", () => {
    expect(Object.keys(codecs).sort()).toEqual(["issue", "milestone", "project", "spec", "trace"]);
  });

  it("round-trips a project", () => {
    const project = Project.create({
      id: ProjectId.from("PROJ-0001"),
      title: "Demo",
      author: "ely",
    });
    const restored = codecs.project.parse(codecs.project.serialize(project));
    expect(restored.id.toString()).toBe("PROJ-0001");
    expect(restored.title).toBe("Demo");
    expect(restored.status).toBe("planned");
  });

  it("round-trips a milestone", () => {
    const milestone = Milestone.create({
      id: MilestoneId.from("MILE-0001"),
      projectId: ProjectId.from("PROJ-0001"),
      title: "M1",
      order: 1,
    });
    const restored = codecs.milestone.parse(codecs.milestone.serialize(milestone));
    expect(restored.id.toString()).toBe("MILE-0001");
    expect(restored.order).toBe(1);
  });

  it("round-trips an issue", () => {
    const issue = Issue.create({
      id: IssueId.from("ISSUE-0001"),
      projectId: ProjectId.from("PROJ-0001"),
      title: "Do the thing",
      author: "ely",
    });
    const restored = codecs.issue.parse(codecs.issue.serialize(issue));
    expect(restored.id.toString()).toBe("ISSUE-0001");
    expect(restored.title).toBe("Do the thing");
  });

  it("round-trips a spec", () => {
    const spec = Spec.create({
      id: SpecId.from("SPEC-0001"),
      projectId: ProjectId.from("PROJ-0001"),
      title: "A decision",
      author: "ely",
    });
    const restored = codecs.spec.parse(codecs.spec.serialize(spec));
    expect(restored.id.toString()).toBe("SPEC-0001");
  });

  it("round-trips a trace", () => {
    const trace = Trace.create({
      id: TraceId.generate(),
      projectId: ProjectId.from("PROJ-0001"),
      actor: "ely",
      actorType: "human",
      event: "project_created",
    });
    const restored = codecs.trace.parse(codecs.trace.serialize(trace));
    expect(restored.id.toString()).toBe(trace.id.toString());
    expect(restored.event).toBe("project_created");
  });
});
