import { beforeEach, describe, expect, it } from "bun:test";
import type { RealmConfig } from "../../config/index.js";
import { DEFAULT_CONFIG } from "../../config/index.js";
import { Issue, Milestone, Project } from "../../entities/index.js";
import type { IRealmRepository } from "../../ports/index.js";
import { IssueId, MilestoneId, ProjectId } from "../../value-objects/index.js";
import { makeInMemoryRepo } from "../in-memory-repo.test-helper.js";
import { GetNextUseCase } from "./get-next.js";

describe("GetNextUseCase", () => {
  let repo: IRealmRepository;
  let useCase: GetNextUseCase;
  const projectId = ProjectId.generate(1);

  beforeEach(async () => {
    repo = makeInMemoryRepo();
    useCase = new GetNextUseCase(repo);
    await repo.saveProject({
      ...Project.create({ id: projectId, title: "P", author: "a" }),
      status: "active",
    });
  });

  it("returns null when no eligible issues", async () => {
    expect(await useCase.execute()).toBeNull();
  });

  it("accepts an empty exclusion set without changing the existing result", async () => {
    const issue = Issue.create({ id: IssueId.generate(1), projectId, title: "I", author: "a" });
    await repo.saveIssue(issue);
    expect((await useCase.execute({ excludedIssueIds: new Set() }))?.issue.id.toString()).toBe(
      "ISSUE-0001"
    );
  });

  it("returns the eligible issue with its project", async () => {
    const issue = Issue.create({ id: IssueId.generate(1), projectId, title: "I", author: "a" });
    await repo.saveIssue(issue);
    const result = await useCase.execute();
    expect(result?.issue.id.toString()).toBe("ISSUE-0001");
    expect(result?.project.id.equals(projectId)).toBe(true);
    expect(result?.milestone).toBeNull();
  });

  it("skips excluded issue IDs without changing priority order for remaining issues", async () => {
    await repo.saveIssue({
      ...Issue.create({ id: IssueId.generate(1), projectId, title: "urgent claimed", author: "a" }),
      priority: "urgent",
    });
    await repo.saveIssue({
      ...Issue.create({ id: IssueId.generate(2), projectId, title: "normal", author: "a" }),
      priority: "normal",
    });
    expect(
      (await useCase.execute({ excludedIssueIds: new Set(["ISSUE-0001"]) }))?.issue.id.toString()
    ).toBe("ISSUE-0002");
    expect((await useCase.execute({ excludedIssueIds: new Set() }))?.issue.id.toString()).toBe(
      "ISSUE-0001"
    );
  });

  it("prefers higher priority", async () => {
    await repo.saveIssue({
      ...Issue.create({ id: IssueId.generate(1), projectId, title: "low", author: "a" }),
      priority: "low",
    });
    await repo.saveIssue({
      ...Issue.create({ id: IssueId.generate(2), projectId, title: "urgent", author: "a" }),
      priority: "urgent",
    });
    const result = await useCase.execute();
    expect(result?.issue.id.toString()).toBe("ISSUE-0002");
  });

  it("orders by milestone order before null-milestone issues", async () => {
    const milestoneId = MilestoneId.generate(1);
    await repo.saveMilestone(
      Milestone.create({ id: milestoneId, projectId, title: "M", order: 1 })
    );
    await repo.saveIssue(
      Issue.create({ id: IssueId.generate(1), projectId, title: "noMile", author: "a" })
    );
    await repo.saveIssue(
      Issue.create({
        id: IssueId.generate(2),
        projectId,
        milestoneId,
        title: "withMile",
        author: "a",
      })
    );
    const result = await useCase.execute();
    expect(result?.issue.id.toString()).toBe("ISSUE-0002");
    expect(result?.milestone?.id.equals(milestoneId)).toBe(true);
  });

  it("orders by custom priority levels from config", async () => {
    const config: RealmConfig = {
      ...DEFAULT_CONFIG,
      priority: { levels: ["P0", "P1", "P2", "P3"], default: "P2" },
    };
    const customUseCase = new GetNextUseCase(repo, config);
    await repo.saveIssue({
      ...Issue.create({ id: IssueId.generate(1), projectId, title: "low", author: "a" }),
      priority: "P3",
    });
    await repo.saveIssue({
      ...Issue.create({ id: IssueId.generate(2), projectId, title: "top", author: "a" }),
      priority: "P0",
    });
    const result = await customUseCase.execute();
    expect(result?.issue.id.toString()).toBe("ISSUE-0002");
  });
});
