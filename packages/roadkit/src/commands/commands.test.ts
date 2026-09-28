import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
  CompleteIssueUseCase,
  CreateIssueUseCase,
  CreateMilestoneUseCase,
  CreateProjectUseCase,
  CreateSpecUseCase,
  DEFAULT_CONFIG,
  GetBriefUseCase,
  GetContextUseCase,
  GetHistoryUseCase,
  GetNextUseCase,
  ProjectId,
  SetMilestoneStatusUseCase,
  SetProjectStatusUseCase,
  SetSpecStatusUseCase,
  StartIssueUseCase,
} from "@roadkit/core";
import { FsRealmRepository, REALM_MANIFEST_FILE, ROADKIT_DIR } from "@roadkit/fs";
import type { Container } from "../container.js";
import { createContainer } from "../container.js";
import { runBrief } from "./brief.js";
import { runContext } from "./context.js";
import { runHistory } from "./history.js";
import { runInit } from "./init.js";
import { runIssueAdd } from "./issue/add.js";
import { runIssueComplete } from "./issue/complete.js";
import { runIssueList } from "./issue/list.js";
import { runIssueStart } from "./issue/start.js";
import { setJsonMode } from "./json-mode.js";
import { runLint } from "./lint.js";
import { runMilestoneNew } from "./milestone/new.js";
import { runMilestoneStart, runMilestoneStatus } from "./milestone/status.js";
import { runNext } from "./next.js";
import { runProjectList } from "./project/list.js";
import { runProjectNew } from "./project/new.js";
import { runProjectStart, runProjectStatus } from "./project/status.js";
import { runSpecNew } from "./spec/new.js";
import { runSpecStatus } from "./spec/status.js";

async function mkTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "roadkit-cli-test-"));
}

// Build a git-less container so tests don't try to `git add` outside this repo.
function testContainer(realmRoot: string): Container {
  const repo = new FsRealmRepository(realmRoot);
  return {
    realmRoot,
    repoRoot: realmRoot,
    worktrees: null,
    claims: null,
    config: DEFAULT_CONFIG,
    repo,
    createProject: new CreateProjectUseCase(repo),
    createMilestone: new CreateMilestoneUseCase(repo),
    createIssue: new CreateIssueUseCase(repo),
    startIssue: new StartIssueUseCase(repo),
    completeIssue: new CompleteIssueUseCase(repo),
    createSpec: new CreateSpecUseCase(repo),
    setSpecStatus: new SetSpecStatusUseCase(repo),
    setProjectStatus: new SetProjectStatusUseCase(repo),
    setMilestoneStatus: new SetMilestoneStatusUseCase(repo),
    getNext: new GetNextUseCase(repo),
    getContext: new GetContextUseCase(repo),
    getHistory: new GetHistoryUseCase(repo),
    getBrief: new GetBriefUseCase(repo),
  };
}

function captureError(): { lines: string[]; restore: () => void } {
  const lines: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    lines.push(args.map((a) => (typeof a === "string" ? a : String(a))).join(" "));
  };
  return {
    lines,
    restore: () => {
      console.error = original;
    },
  };
}

function captureLog(): { lines: string[]; restore: () => void } {
  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.map((a) => (typeof a === "string" ? a : String(a))).join(" "));
  };
  return {
    lines,
    restore: () => {
      console.log = original;
    },
  };
}

describe("roadkit CLI commands", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkTempDir();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("init scaffolds the realm", async () => {
    const cap = captureLog();
    await runInit(tempDir);
    cap.restore();

    const state = JSON.parse(await fs.readFile(path.join(tempDir, ROADKIT_DIR, ".state"), "utf-8"));
    expect(state).toEqual({ project: 0, milestone: 0, issue: 0, spec: 0 });
    expect(
      JSON.parse(await fs.readFile(path.join(tempDir, ROADKIT_DIR, REALM_MANIFEST_FILE), "utf-8"))
    ).toEqual({ formatVersion: 1 });

    const templates = await fs.readdir(path.join(tempDir, ROADKIT_DIR, "templates"));
    expect(templates.sort()).toEqual(["issue.md", "milestone.md", "project.md", "spec.md"]);

    const agents = await fs.readFile(path.join(tempDir, "AGENTS.md"), "utf-8");
    expect(agents).toContain("rkit brief");
    expect(agents).toContain("ROADKIT_ACTOR");
  });

  it("adds the worktree path to the repository-local exclude file once", async () => {
    const runGit = (...args: string[]) => {
      const result = spawnSync("git", args, { cwd: tempDir, encoding: "utf8" });
      if (result.status !== 0) throw new Error(result.stderr);
    };
    runGit("init", "-q");
    await fs.mkdir(path.join(tempDir, ".git", "info"), { recursive: true });
    await fs.writeFile(path.join(tempDir, ".git", "info", "exclude"), "# existing\ncustom/\n");
    await runInit(tempDir);
    await runInit(tempDir);
    const exclude = await fs.readFile(path.join(tempDir, ".git", "info", "exclude"), "utf8");
    expect(exclude).toContain("# existing\ncustom/");
    expect(exclude.match(/^\.worktrees\/$/gm)).toHaveLength(1);
  });

  it("init adds a format manifest to a legacy realm without replacing existing files", async () => {
    const configPath = path.join(tempDir, "roadfig.yml");
    await fs.writeFile(configPath, "version: 1\ncustom: preserve\n", "utf-8");
    const templatesDir = path.join(tempDir, ROADKIT_DIR, "templates");
    await fs.mkdir(templatesDir, { recursive: true });
    const templatePath = path.join(templatesDir, "issue.md");
    await fs.writeFile(templatePath, "custom template\n", "utf-8");

    const cap = captureLog();
    await runInit(tempDir);
    await runInit(tempDir);
    cap.restore();

    expect(
      JSON.parse(await fs.readFile(path.join(tempDir, ROADKIT_DIR, REALM_MANIFEST_FILE), "utf-8"))
    ).toEqual({ formatVersion: 1 });
    expect(await fs.readFile(configPath, "utf-8")).toBe("version: 1\ncustom: preserve\n");
    expect(await fs.readFile(templatePath, "utf-8")).toBe("custom template\n");
  });

  it("init rejects an unsupported realm format before creating other files", async () => {
    const roadkitDir = path.join(tempDir, ROADKIT_DIR);
    await fs.mkdir(roadkitDir, { recursive: true });
    await fs.writeFile(
      path.join(roadkitDir, REALM_MANIFEST_FILE),
      '{"formatVersion":2}\n',
      "utf-8"
    );

    await expect(runInit(tempDir)).rejects.toMatchObject({
      code: "UNSUPPORTED_REALM_FORMAT",
      detectedVersion: 2,
    });
    expect(await fs.readdir(roadkitDir)).toEqual([REALM_MANIFEST_FILE]);
    await expect(fs.access(path.join(tempDir, "roadfig.yml"))).rejects.toThrow();
  });

  it("installs a pre-commit hook in a git repo without clobbering an existing one", async () => {
    // Fresh git repo: hook is installed.
    const initialized = spawnSync("git", ["init", "-q"], { cwd: tempDir });
    if (initialized.status !== 0) throw new Error("git init failed");
    let cap = captureLog();
    await runInit(tempDir);
    cap.restore();
    const hook = await fs.readFile(path.join(tempDir, ".git", "hooks", "pre-commit"), "utf-8");
    expect(hook).toContain("rkit lint");

    // Existing hook is preserved; AGENTS.md is not regenerated.
    await fs.writeFile(path.join(tempDir, ".git", "hooks", "pre-commit"), "#!/bin/sh\necho mine\n");
    cap = captureLog();
    await runInit(tempDir);
    cap.restore();
    expect(cap.lines.join("\n")).toContain("AGENTS.md already exists");
    const preserved = await fs.readFile(path.join(tempDir, ".git", "hooks", "pre-commit"), "utf-8");
    expect(preserved).toContain("echo mine");
  });

  it("runs the full project lifecycle end to end", async () => {
    await runInit(tempDir);
    const container = testContainer(tempDir);

    const cap = captureLog();
    await runProjectNew(container, { title: "Checkout revamp" });
    expect(cap.lines.join("\n")).toContain("PROJ-0001");
    cap.restore();

    await runMilestoneNew(container, { project: "PROJ-0001", title: "MVP", order: "1" });
    await runIssueAdd(container, {
      project: "PROJ-0001",
      milestone: "MILE-0001",
      title: "Fix auth redirect",
      priority: "high",
    });
    await runIssueStart(container, "ISSUE-0001");
    await runIssueComplete(container, "ISSUE-0001");

    // Project files landed under the project-rooted layout.
    const projectsDir = path.join(tempDir, ROADKIT_DIR, "projects");
    const projDirs = await fs.readdir(projectsDir);
    expect(projDirs.some((d) => d.startsWith("PROJ-0001"))).toBe(true);

    const issueFiles = await fs.readdir(path.join(projectsDir, projDirs[0] as string, "issues"));
    expect(issueFiles.some((f) => f.startsWith("ISSUE-0001"))).toBe(true);

    const traceFiles = await fs.readdir(path.join(projectsDir, projDirs[0] as string, "traces"));
    expect(traceFiles.length).toBeGreaterThan(0);
    expect(traceFiles.every((f) => /^TRACE-.+\.md$/.test(f))).toBe(true);
  });

  it("hides claims from next and discloses them in explicit briefs and issue lists", async () => {
    const initialized = spawnSync("git", ["init", "-q"], { cwd: tempDir });
    if (initialized.status !== 0) throw new Error("git init failed");
    await runInit(tempDir);
    const container = await createContainer(tempDir);
    const project = await container.createProject.execute({
      title: "Claims",
      author: "test",
      actor: "test",
      leads: [],
      body: "",
    });
    await container.setProjectStatus.execute({ id: project.id, to: "active", actor: "test" });
    const first = await container.createIssue.execute({
      projectId: project.id,
      title: "Claimed first",
      author: "test",
      actor: "test",
      priority: "urgent",
      labels: [],
      gates: [],
      body: "",
    });
    await container.createIssue.execute({
      projectId: project.id,
      title: "Available second",
      author: "test",
      actor: "test",
      priority: "normal",
      labels: [],
      gates: [],
      body: "",
    });
    await container.claims?.claim({
      issueId: first.id.toString(),
      actor: "agent:worker",
      branch: "issue/claimed-first",
      path: path.join(container.repoRoot, ".worktrees", "claimed"),
    });

    const nextCapture = captureLog();
    await runNext(container, { json: true });
    const next = JSON.parse(nextCapture.lines.join(" ")) as { issue: { id: string } };
    nextCapture.restore();
    expect(next.issue.id).toBe("ISSUE-0002");

    const briefCapture = captureLog();
    await runBrief(container, { issue: first.id.toString(), json: true });
    const brief = JSON.parse(briefCapture.lines.join(" ")) as {
      claim: { actor: string; path: string };
    };
    briefCapture.restore();
    expect(brief.claim.actor).toBe("agent:worker");
    expect(brief.claim.path).toContain(".worktrees/claimed");
    const humanBrief = captureLog();
    await runBrief(container, { issue: first.id.toString() });
    expect(humanBrief.lines.join("\n")).toContain(`Claim: agent:worker · ${brief.claim.path}`);
    humanBrief.restore();

    const listCapture = captureLog();
    await runIssueList(container, { json: true });
    const rows = JSON.parse(listCapture.lines.join(" ")) as Array<{
      id: string;
      claim: { actor: string } | null;
    }>;
    listCapture.restore();
    expect(rows.find((row) => row.id === first.id.toString())?.claim?.actor).toBe("agent:worker");
    const humanList = captureLog();
    await runIssueList(container, {});
    expect(humanList.lines.join("\n")).toContain(`claimed by agent:worker · ${brief.claim.path}`);
    humanList.restore();
  });

  it("emits machine-readable context and history", async () => {
    await runInit(tempDir);
    const container = testContainer(tempDir);
    await runProjectNew(container, { title: "Checkout revamp" });
    await runSpecNew(container, { project: "PROJ-0001", title: "Auth approach", tags: "auth,api" });
    await runSpecStatus(container, "SPEC-0001", "proposed");

    const ctxCap = captureLog();
    await runContext(container, { json: true });
    ctxCap.restore();
    const ctx = JSON.parse(ctxCap.lines.join("\n"));
    expect(ctx.projects).toHaveLength(1);
    expect(ctx.specs).toHaveLength(1);
    expect(ctx.specs[0].status).toBe("proposed");

    const histCap = captureLog();
    await runHistory(container, { json: true });
    histCap.restore();
    const traces = JSON.parse(histCap.lines.join("\n"));
    const events = traces.map((t: { event: string }) => t.event);
    expect(events).toContain("project_created");
    expect(events).toContain("spec_status_changed");

    const listCap = captureLog();
    await runProjectList(container, { json: true });
    listCap.restore();
    expect(JSON.parse(listCap.lines.join("\n"))).toHaveLength(1);
  });

  it("next reports the eligible issue", async () => {
    await runInit(tempDir);
    const container = testContainer(tempDir);
    await runProjectNew(container, { title: "Checkout revamp" });
    await runIssueAdd(container, {
      project: "PROJ-0001",
      title: "Fix auth redirect",
      priority: "high",
    });

    // `next` only surfaces issues under active projects.
    const project = await container.repo.findProject(ProjectId.from("PROJ-0001"));
    if (!project) throw new Error("project missing");
    await container.repo.saveProject({ ...project, status: "active" });

    const cap = captureLog();
    await runNext(container, {});
    cap.restore();
    expect(cap.lines.join("\n")).toContain("ISSUE-0001");
  });

  it("context prints a human-readable summary with filters", async () => {
    await runInit(tempDir);
    const container = testContainer(tempDir);
    await runProjectNew(container, { title: "Checkout revamp" });
    await runMilestoneNew(container, { project: "PROJ-0001", title: "MVP", order: "1" });
    await runIssueAdd(container, {
      project: "PROJ-0001",
      milestone: "MILE-0001",
      title: "Fix auth redirect",
      priority: "high",
    });
    await runSpecNew(container, { project: "PROJ-0001", title: "Auth approach", tags: "auth" });

    const cap = captureLog();
    await runContext(container, {});
    cap.restore();
    const out = cap.lines.join("\n");
    expect(out).toContain("Projects: 1");
    expect(out).toContain("PROJ-0001");
    expect(out).toContain("MILE-0001");
    expect(out).toContain("ISSUE-0001");
    expect(out).toContain("SPEC-0001");
    expect(out).toContain("(high)");

    // --project filter exercises the ContextFilter.projectId branch.
    const projectCap = captureLog();
    await runContext(container, { project: "PROJ-0001" });
    projectCap.restore();
    expect(projectCap.lines.join("\n")).toContain("PROJ-0001");

    // --active filter exercises the ContextFilter.activeOnly branch (project is
    // still pending, so no project body is rendered — just the summary line).
    const activeCap = captureLog();
    await runContext(container, { active: true });
    activeCap.restore();
    expect(activeCap.lines.join("\n")).toContain("Projects: 0");
  });

  it("context handles an empty realm", async () => {
    await runInit(tempDir);
    const container = testContainer(tempDir);

    const cap = captureLog();
    await runContext(container, {});
    cap.restore();
    expect(cap.lines.join("\n")).toContain("Projects: 0");
  });

  it("history prints human-readable rows and honours filters", async () => {
    await runInit(tempDir);
    const container = testContainer(tempDir);
    await runProjectNew(container, { title: "Checkout revamp" });
    await runIssueAdd(container, {
      project: "PROJ-0001",
      title: "Fix auth redirect",
      priority: "high",
    });
    await runIssueStart(container, "ISSUE-0001");

    const cap = captureLog();
    await runHistory(container, {});
    cap.restore();
    const out = cap.lines.join("\n");
    expect(out).toContain("project_created");
    expect(out).toContain("issue_started");
    // formatTrace renders the from → to transition for status changes.
    expect(out).toContain("→");

    const filteredCap = captureLog();
    await runHistory(container, {
      project: "PROJ-0001",
      issue: "ISSUE-0001",
      event: "issue_started",
      since: "2000-01-01",
    });
    filteredCap.restore();
    expect(filteredCap.lines.join("\n")).toContain("issue_started");

    const actorCap = captureLog();
    await runHistory(container, { actor: "no-such-actor" });
    actorCap.restore();
    expect(actorCap.lines.join("\n")).toBe("No history found.");
  });

  it("history rejects an invalid --since", async () => {
    await runInit(tempDir);
    const container = testContainer(tempDir);

    const originalExit = process.exit;
    const originalError = console.error;
    const errors: string[] = [];
    console.error = (...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    };
    // @ts-expect-error test stub that throws to short-circuit `never`.
    process.exit = () => {
      throw new Error("exit");
    };
    try {
      await expect(runHistory(container, { since: "not-a-date" })).rejects.toThrow("exit");
      expect(errors.join("\n")).toContain("Invalid --since");
    } finally {
      process.exit = originalExit;
      console.error = originalError;
    }
  });

  it("next reports no eligible issue and emits JSON", async () => {
    await runInit(tempDir);
    const container = testContainer(tempDir);

    const cap = captureLog();
    await runNext(container, {});
    cap.restore();
    expect(cap.lines.join("\n")).toBe("No eligible issue.");

    const jsonCap = captureLog();
    await runNext(container, { json: true });
    jsonCap.restore();
    expect(JSON.parse(jsonCap.lines.join("\n"))).toBeNull();
  });

  it("next emits JSON for an eligible issue", async () => {
    await runInit(tempDir);
    const container = testContainer(tempDir);
    await runProjectNew(container, { title: "Checkout revamp" });
    await runMilestoneNew(container, { project: "PROJ-0001", title: "MVP", order: "1" });
    await runIssueAdd(container, {
      project: "PROJ-0001",
      milestone: "MILE-0001",
      title: "Fix auth redirect",
      priority: "high",
    });
    const project = await container.repo.findProject(ProjectId.from("PROJ-0001"));
    if (!project) throw new Error("project missing");
    await container.repo.saveProject({ ...project, status: "active" });

    const cap = captureLog();
    await runNext(container, { json: true });
    cap.restore();
    const result = JSON.parse(cap.lines.join("\n"));
    expect(result.issue.id).toBe("ISSUE-0001");
    expect(result.project.id).toBe("PROJ-0001");
    expect(result.milestone.id).toBe("MILE-0001");
  });

  it("project list prints projects and the empty case", async () => {
    await runInit(tempDir);
    const container = testContainer(tempDir);

    const emptyCap = captureLog();
    await runProjectList(container, {});
    emptyCap.restore();
    expect(emptyCap.lines.join("\n")).toBe("No projects.");

    await runProjectNew(container, { title: "Checkout revamp" });

    const cap = captureLog();
    await runProjectList(container, {});
    cap.restore();
    const out = cap.lines.join("\n");
    expect(out).toContain("PROJ-0001");
    expect(out).toContain("Checkout revamp");
  });

  it("mutations emit the created/updated entity as JSON", async () => {
    await runInit(tempDir);
    const container = testContainer(tempDir);

    const projCap = captureLog();
    await runProjectNew(container, { title: "Checkout revamp", json: true });
    projCap.restore();
    const proj = JSON.parse(projCap.lines.join("\n"));
    expect(proj.id).toBe("PROJ-0001");
    expect(proj.status).toBe("planned");

    const statusCap = captureLog();
    await runProjectStart(container, "PROJ-0001", { json: true });
    statusCap.restore();
    expect(JSON.parse(statusCap.lines.join("\n")).status).toBe("active");

    // Explicit status path (planned→paused→active) covers runProjectStatus directly.
    const pauseCap = captureLog();
    await runProjectStatus(container, "PROJ-0001", "paused", { json: true });
    pauseCap.restore();
    expect(JSON.parse(pauseCap.lines.join("\n")).status).toBe("paused");
    await runProjectStatus(container, "PROJ-0001", "active");

    const mileCap = captureLog();
    await runMilestoneNew(container, {
      project: "PROJ-0001",
      title: "MVP",
      order: "1",
      json: true,
    });
    mileCap.restore();
    expect(JSON.parse(mileCap.lines.join("\n")).id).toBe("MILE-0001");

    const mileStatusCap = captureLog();
    await runMilestoneStart(container, "MILE-0001", { json: true });
    mileStatusCap.restore();
    expect(JSON.parse(mileStatusCap.lines.join("\n")).status).toBe("active");

    const issueCap = captureLog();
    await runIssueAdd(container, {
      project: "PROJ-0001",
      milestone: "MILE-0001",
      title: "Fix auth redirect",
      priority: "high",
      json: true,
    });
    issueCap.restore();
    const issue = JSON.parse(issueCap.lines.join("\n"));
    expect(issue.id).toBe("ISSUE-0001");
    expect(issue.priority).toBe("high");

    const startCap = captureLog();
    await runIssueStart(container, "ISSUE-0001", { json: true });
    startCap.restore();
    expect(JSON.parse(startCap.lines.join("\n")).status).toBe("in-progress");

    const completeCap = captureLog();
    await runIssueComplete(container, "ISSUE-0001", { json: true });
    completeCap.restore();
    expect(JSON.parse(completeCap.lines.join("\n")).status).toBe("completed");

    const specCap = captureLog();
    await runSpecNew(container, { project: "PROJ-0001", title: "Auth approach", json: true });
    specCap.restore();
    expect(JSON.parse(specCap.lines.join("\n")).id).toBe("SPEC-0001");

    const specStatusCap = captureLog();
    await runSpecStatus(container, "SPEC-0001", "proposed", { json: true });
    specStatusCap.restore();
    expect(JSON.parse(specStatusCap.lines.join("\n")).status).toBe("proposed");
  });

  it("brief renders an injectable block and JSON with rules and blockers", async () => {
    await runInit(tempDir);
    const container = testContainer(tempDir);
    await runProjectNew(container, { title: "Checkout revamp" });
    await runProjectStart(container, "PROJ-0001");
    await runIssueAdd(container, {
      project: "PROJ-0001",
      title: "Blocker",
      priority: "high",
    });
    await runIssueAdd(container, {
      project: "PROJ-0001",
      title: "Dependent",
      priority: "high",
      gates: "ISSUE-0001",
    });

    const jsonCap = captureLog();
    await runBrief(container, { issue: "ISSUE-0002", json: true });
    jsonCap.restore();
    const brief = JSON.parse(jsonCap.lines.join("\n"));
    expect(brief.issue.id).toBe("ISSUE-0002");
    expect(brief.gatesOn).toEqual([{ gate: "ISSUE-0001", status: "not-started" }]);
    expect(brief.blockedReason).toContain("ISSUE-0001");

    const humanCap = captureLog();
    await runBrief(container, { issue: "ISSUE-0001" });
    humanCap.restore();
    const out = humanCap.lines.join("\n");
    expect(out).toContain("ISSUE-0001");
    expect(out).toContain("Unblocks: ISSUE-0002");

    // Missing focus id, but an eligible issue exists → "no focus" + Next line.
    const missCap = captureLog();
    await runBrief(container, { issue: "ISSUE-9999" });
    missCap.restore();
    const miss = missCap.lines.join("\n");
    expect(miss).toContain("No focus issue");
    expect(miss).toContain("Next:");
  });

  it("records rules_acknowledged when starting an issue that has rules", async () => {
    await runInit(tempDir);
    const container = testContainer(tempDir);
    await runProjectNew(container, { title: "Checkout revamp" });
    // Issue with a rule, created via the use case directly to attach rules.
    await container.createIssue.execute({
      projectId: ProjectId.from("PROJ-0001"),
      title: "Guarded",
      author: "a",
      rules: [{ trigger: "before_complete", instruction: "run tests" }],
    });
    await runIssueStart(container, "ISSUE-0001");

    const cap = captureLog();
    await runHistory(container, { json: true });
    cap.restore();
    const events = JSON.parse(cap.lines.join("\n")).map((t: { event: string }) => t.event);
    expect(events).toContain("rules_acknowledged");
  });

  it("attributes agent actor, type, and message to traces", async () => {
    await runInit(tempDir);
    const container = testContainer(tempDir);
    await runProjectNew(container, { title: "Checkout revamp" });
    await runIssueAdd(container, {
      project: "PROJ-0001",
      title: "Fix auth redirect",
      priority: "high",
    });
    await runIssueStart(container, "ISSUE-0001");
    await runIssueComplete(container, "ISSUE-0001", {
      actor: "agent:claude",
      actorType: "agent",
      message: "rotation implemented",
    });

    const cap = captureLog();
    await runHistory(container, { json: true });
    cap.restore();
    const traces = JSON.parse(cap.lines.join("\n"));
    const completed = traces.find((t: { event: string }) => t.event === "issue_completed");
    expect(completed.actor).toBe("agent:claude");
    expect(completed.actorType).toBe("agent");
    expect(completed.body).toBe("rotation implemented");
  });

  it("lint passes a clean realm and fails on a dangling gate", async () => {
    await runInit(tempDir);
    const container = testContainer(tempDir);
    await runProjectNew(container, { title: "Checkout revamp" });
    await runIssueAdd(container, { project: "PROJ-0001", title: "Fine", priority: "high" });

    const okCap = captureLog();
    await runLint(container, {});
    okCap.restore();
    expect(okCap.lines.join("\n")).toContain("No issues");

    // Dangling gate → references-exist error → exit 1.
    await runIssueAdd(container, {
      project: "PROJ-0001",
      title: "Broken",
      priority: "high",
      gates: "ISSUE-9999",
    });

    const originalExit = process.exit;
    let exitCode: number | undefined;
    // @ts-expect-error test stub that throws to short-circuit `never`.
    process.exit = (code?: number) => {
      exitCode = code;
      throw new Error("exit");
    };
    try {
      const jsonCap = captureLog();
      await expect(runLint(container, { json: true })).rejects.toThrow("exit");
      jsonCap.restore();
      const report = JSON.parse(jsonCap.lines.join("\n"));
      expect(report.errorCount).toBeGreaterThan(0);
      expect(report.findings.some((f: { code: string }) => f.code === "references-exist")).toBe(
        true
      );
      expect(exitCode).toBe(1);

      // Human path renders findings and a summary line.
      const humanCap = captureLog();
      await expect(runLint(container, {})).rejects.toThrow("exit");
      humanCap.restore();
      const out = humanCap.lines.join("\n");
      expect(out).toContain("references-exist");
      expect(out).toContain("error(s)");
    } finally {
      process.exit = originalExit;
      setJsonMode(false);
    }
  });

  it("emits a structured error envelope under --json and exits non-zero", async () => {
    await runInit(tempDir);
    const container = testContainer(tempDir);
    await runProjectNew(container, { title: "Checkout revamp" });

    const originalExit = process.exit;
    const errCap = captureError();
    // @ts-expect-error test stub that throws to short-circuit `never`.
    process.exit = () => {
      throw new Error("exit");
    };
    try {
      await expect(
        runIssueAdd(container, {
          project: "PROJ-0001",
          title: "Bad",
          priority: "NOPE",
          json: true,
        })
      ).rejects.toThrow("exit");
      const payload = JSON.parse(errCap.lines.join("\n"));
      expect(payload.error.code).toBe("ValidationError");
      expect(payload.error.message).toContain("Invalid --priority");
    } finally {
      process.exit = originalExit;
      errCap.restore();
      setJsonMode(false);
    }
  });
});
