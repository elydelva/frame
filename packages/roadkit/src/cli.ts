import { Command } from "commander";
import { runBrief } from "./commands/brief.js";
import { runConfigGet, runConfigSet } from "./commands/config.js";
import { runContext } from "./commands/context.js";
import { runDoctor } from "./commands/doctor.js";
import { runHistory } from "./commands/history.js";
import { runInit } from "./commands/init.js";
import { runIssueAdd } from "./commands/issue/add.js";
import { runIssueComplete } from "./commands/issue/complete.js";
import { runIssueEdit } from "./commands/issue/edit.js";
import { runIssueGateAdd, runIssueGateRemove } from "./commands/issue/gate.js";
import { runIssueList } from "./commands/issue/list.js";
import { runIssueRelease } from "./commands/issue/release.js";
import { runIssueRemove } from "./commands/issue/rm.js";
import { runIssueShow } from "./commands/issue/show.js";
import { runIssueStart } from "./commands/issue/start.js";
import { runIssueStatus } from "./commands/issue/status.js";
import { runIssueWorktree } from "./commands/issue/worktree.js";
import { setJsonMode } from "./commands/json-mode.js";
import { runLint } from "./commands/lint.js";
import { runMilestoneList } from "./commands/milestone/list.js";
import { runMilestoneNew } from "./commands/milestone/new.js";
import { runMilestoneStart, runMilestoneStatus } from "./commands/milestone/status.js";
import { runNext } from "./commands/next.js";
import { runProjectList } from "./commands/project/list.js";
import { runProjectNew } from "./commands/project/new.js";
import { runProjectStart, runProjectStatus } from "./commands/project/status.js";
import { runSpecList } from "./commands/spec/list.js";
import { runSpecNew } from "./commands/spec/new.js";
import { runSpecShow } from "./commands/spec/show.js";
import { runSpecStatus } from "./commands/spec/status.js";
import { runWorktreeList } from "./commands/worktree.js";
import { createContainer } from "./container.js";

// Kept in sync with package.json "version".
const CLI_VERSION = "0.1.1";

function getRealmRoot(): string {
  return process.env.ROADKIT_ROOT ?? process.cwd();
}

/** Attach the standard actor-attribution + JSON options shared by mutations. */
function withActor(command: Command): Command {
  return command
    .option("--json", "Machine-readable output")
    .option("--actor <name>", "Acting actor (overrides env)")
    .option("--actor-type <type>", "Actor type: human|agent")
    .option("--message <text>", "Trace note explaining the change");
}

export function buildCLI(): Command {
  const program = new Command();

  setJsonMode(false);
  program.hook("preAction", (_thisCommand, actionCommand) => {
    setJsonMode(actionCommand.opts().json === true);
  });

  program
    .name("rkit")
    .description("Decision-first, agent-native project management for git repositories")
    .version(CLI_VERSION);

  program
    .command("init")
    .description("Initialize roadkit in the current repository")
    .action(async () => {
      await runInit(getRealmRoot());
    });

  // --- project ---
  const project = program.command("project").description("Manage projects");

  project
    .command("new")
    .description("Create a new project")
    .requiredOption("--title <title>", "Project title")
    .option("--leads <leads>", "Comma-separated leads")
    .option("--body <body>", "Project body")
    .option("--json", "Machine-readable output")
    .option("--actor <name>", "Acting actor (overrides env)")
    .option("--actor-type <type>", "Actor type: human|agent")
    .option("--message <text>", "Trace note explaining the change")
    .action(async (opts: { title?: string; leads?: string; body?: string; json?: boolean }) => {
      await runProjectNew(await createContainer(getRealmRoot()), opts);
    });

  project
    .command("list")
    .description("List all projects")
    .option("--json", "Machine-readable output")
    .action(async (opts: { json?: boolean }) => {
      await runProjectList(await createContainer(getRealmRoot()), opts);
    });

  project
    .command("status <projectId> <status>")
    .description("Change a project's status (planned|active|paused|completed|cancelled)")
    .option("--json", "Machine-readable output")
    .option("--actor <name>", "Acting actor (overrides env)")
    .option("--actor-type <type>", "Actor type: human|agent")
    .option("--message <text>", "Trace note explaining the change")
    .action(async (projectId: string, status: string, opts: { json?: boolean }) => {
      await runProjectStatus(await createContainer(getRealmRoot()), projectId, status, opts);
    });

  project
    .command("start <projectId>")
    .description("Transition a planned project to active")
    .option("--json", "Machine-readable output")
    .option("--actor <name>", "Acting actor (overrides env)")
    .option("--actor-type <type>", "Actor type: human|agent")
    .option("--message <text>", "Trace note explaining the change")
    .action(async (projectId: string, opts: { json?: boolean }) => {
      await runProjectStart(await createContainer(getRealmRoot()), projectId, opts);
    });

  // --- milestone ---
  const milestone = program.command("milestone").description("Manage milestones");

  milestone
    .command("new")
    .description("Create a new milestone")
    .requiredOption("--project <id>", "Project id (e.g. PROJ-0001)")
    .requiredOption("--title <title>", "Milestone title")
    .requiredOption("--order <n>", "Milestone order")
    .option("--target-date <iso>", "Target date (ISO 8601)")
    .option("--body <body>", "Milestone body")
    .option("--json", "Machine-readable output")
    .option("--actor <name>", "Acting actor (overrides env)")
    .option("--actor-type <type>", "Actor type: human|agent")
    .option("--message <text>", "Trace note explaining the change")
    .action(
      async (opts: {
        project?: string;
        title?: string;
        order?: string;
        targetDate?: string;
        body?: string;
        json?: boolean;
      }) => {
        await runMilestoneNew(await createContainer(getRealmRoot()), opts);
      }
    );

  milestone
    .command("status <milestoneId> <status>")
    .description("Change a milestone's status (pending|active|done)")
    .option("--json", "Machine-readable output")
    .option("--actor <name>", "Acting actor (overrides env)")
    .option("--actor-type <type>", "Actor type: human|agent")
    .option("--message <text>", "Trace note explaining the change")
    .action(async (milestoneId: string, status: string, opts: { json?: boolean }) => {
      await runMilestoneStatus(await createContainer(getRealmRoot()), milestoneId, status, opts);
    });

  milestone
    .command("start <milestoneId>")
    .description("Transition a pending milestone to active")
    .option("--json", "Machine-readable output")
    .option("--actor <name>", "Acting actor (overrides env)")
    .option("--actor-type <type>", "Actor type: human|agent")
    .option("--message <text>", "Trace note explaining the change")
    .action(async (milestoneId: string, opts: { json?: boolean }) => {
      await runMilestoneStart(await createContainer(getRealmRoot()), milestoneId, opts);
    });

  milestone
    .command("list")
    .description("List milestones, ordered")
    .option("--project <id>", "Scope to a project")
    .option("--json", "Machine-readable output")
    .action(async (opts: { project?: string; json?: boolean }) => {
      await runMilestoneList(await createContainer(getRealmRoot()), opts);
    });

  // --- issue ---
  const issue = program.command("issue").description("Manage issues");

  issue
    .command("add")
    .description("Add an issue to a project")
    .requiredOption("--project <id>", "Project id (e.g. PROJ-0001)")
    .option("--milestone <id>", "Milestone id (e.g. MILE-0001)")
    .requiredOption("--title <title>", "Issue title")
    .option("--priority <priority>", "Priority level (see roadfig.yml)")
    .option("--estimate <label|number>", "Estimate (scale label or number)")
    .option("--labels <labels>", "Comma-separated labels")
    .option("--parent <id>", "Parent issue id")
    .option("--gates <ids>", "Comma-separated gate ids")
    .option("--assignee <assignee>", "Assignee")
    .option("--branch <name>", "Git branch where this issue is implemented")
    .option("--body <body>", "Issue body")
    .option("--json", "Machine-readable output")
    .option("--actor <name>", "Acting actor (overrides env)")
    .option("--actor-type <type>", "Actor type: human|agent")
    .option("--message <text>", "Trace note explaining the change")
    .action(
      async (opts: {
        project?: string;
        milestone?: string;
        title?: string;
        priority?: string;
        estimate?: string;
        labels?: string;
        parent?: string;
        gates?: string;
        assignee?: string;
        branch?: string;
        body?: string;
        json?: boolean;
      }) => {
        await runIssueAdd(await createContainer(getRealmRoot()), opts);
      }
    );

  issue
    .command("start <issueId>")
    .description("Mark an issue as in-progress")
    .option("--assignee <assignee>", "Assignee")
    .option("--branch <name>", "Git branch where this issue is implemented")
    .option("--json", "Machine-readable output")
    .option("--actor <name>", "Acting actor (overrides env)")
    .option("--actor-type <type>", "Actor type: human|agent")
    .option("--message <text>", "Trace note explaining the change")
    .action(
      async (issueId: string, opts: { json?: boolean; assignee?: string; branch?: string }) => {
        await runIssueStart(await createContainer(getRealmRoot()), issueId, opts);
      }
    );

  issue
    .command("worktree <issueId>")
    .description("Claim an issue and start it in a new Git worktree")
    .option("--assignee <name>", "Issue assignee (defaults to actor)")
    .option("--branch <name>", "Worktree branch")
    .option("--path <path>", "Worktree path")
    .option("--base <ref>", "Base commit or ref (defaults to current HEAD)")
    .option("--json", "Machine-readable output")
    .option("--actor <name>", "Acting actor (overrides env)")
    .option("--actor-type <type>", "Actor type: human|agent")
    .option("--message <text>", "Trace note explaining the change")
    .action(async (issueId: string, opts: Parameters<typeof runIssueWorktree>[2]) => {
      await runIssueWorktree(await createContainer(getRealmRoot()), issueId, opts);
    });

  issue
    .command("complete <issueId>")
    .description("Mark an issue as completed")
    .option("--assignee <assignee>", "Assignee")
    .option("--branch <name>", "Git branch where this issue is implemented")
    .option("--json", "Machine-readable output")
    .option("--actor <name>", "Acting actor (overrides env)")
    .option("--actor-type <type>", "Actor type: human|agent")
    .option("--message <text>", "Trace note explaining the change")
    .action(
      async (issueId: string, opts: { json?: boolean; assignee?: string; branch?: string }) => {
        await runIssueComplete(await createContainer(getRealmRoot()), issueId, opts);
      }
    );

  withActor(
    issue
      .command("release <issueId>")
      .description("Release a local issue claim without removing its worktree")
  ).action(async (issueId: string, opts: Parameters<typeof runIssueRelease>[2]) => {
    await runIssueRelease(await createContainer(getRealmRoot()), issueId, opts);
  });

  withActor(
    issue
      .command("edit <issueId>")
      .description("Edit issue fields (clear nullable fields with --no-<field>)")
      .option("--title <title>", "New title (renames the file)")
      .option("--priority <priority>", "Priority level (see roadfig.yml)")
      .option("--estimate <label|number>", "Estimate (scale label or number)")
      .option("--no-estimate", "Clear the estimate")
      .option("--milestone <id>", "Milestone id")
      .option("--no-milestone", "Clear the milestone")
      .option("--assignee <assignee>", "Assignee")
      .option("--no-assignee", "Clear the assignee")
      .option("--branch <name>", "Git branch")
      .option("--no-branch", "Clear the branch")
      .option("--parent <id>", "Parent issue id")
      .option("--no-parent", "Clear the parent")
      .option("--labels <labels>", "Comma-separated labels (replaces existing)")
      .option("--gates <ids>", "Comma-separated gate ids (replaces existing)")
  ).action(async (issueId: string, opts: Parameters<typeof runIssueEdit>[2]) => {
    await runIssueEdit(await createContainer(getRealmRoot()), issueId, opts);
  });

  withActor(
    issue
      .command("retitle <issueId>")
      .description("Rename an issue's title (renames the file atomically)")
      .requiredOption("--title <title>", "New title")
  ).action(async (issueId: string, opts: { title?: string }) => {
    await runIssueEdit(await createContainer(getRealmRoot()), issueId, opts);
  });

  withActor(
    issue
      .command("status <issueId> <status>")
      .description("Set issue status (not-started|in-progress|completed|abandoned|blocked|skipped)")
  ).action(async (issueId: string, status: string, opts: { json?: boolean }) => {
    await runIssueStatus(await createContainer(getRealmRoot()), issueId, status, opts);
  });

  withActor(issue.command("rm <issueId>").description("Delete an issue and all its files")).action(
    async (issueId: string, opts: { json?: boolean }) => {
      await runIssueRemove(await createContainer(getRealmRoot()), issueId, opts);
    }
  );

  const gate = issue.command("gate").description("Manage issue gate dependencies");
  withActor(gate.command("add <issueId> <gate>").description("Add a gate dependency")).action(
    async (issueId: string, gateId: string, opts: { json?: boolean }) => {
      await runIssueGateAdd(await createContainer(getRealmRoot()), issueId, gateId, opts);
    }
  );
  withActor(gate.command("rm <issueId> <gate>").description("Remove a gate dependency")).action(
    async (issueId: string, gateId: string, opts: { json?: boolean }) => {
      await runIssueGateRemove(await createContainer(getRealmRoot()), issueId, gateId, opts);
    }
  );

  issue
    .command("show <issueId>")
    .description("Show an issue with its history")
    .option("--json", "Machine-readable output")
    .action(async (issueId: string, opts: { json?: boolean }) => {
      await runIssueShow(await createContainer(getRealmRoot()), issueId, opts);
    });

  issue
    .command("list")
    .description("List issues with optional filters")
    .option("--project <id>", "Scope to a project")
    .option("--status <status>", "Filter by status")
    .option("--assignee <name>", "Filter by assignee")
    .option("--milestone <id>", "Filter by milestone")
    .option("--label <label>", "Filter by label")
    .option("--branch <name>", "Filter by branch")
    .option("--priority <priority>", "Filter by priority")
    .option("--json", "Machine-readable output")
    .action(async (opts: Parameters<typeof runIssueList>[1]) => {
      await runIssueList(await createContainer(getRealmRoot()), opts);
    });

  // --- spec ---
  const spec = program.command("spec").description("Manage specs");

  spec
    .command("new")
    .description("Create a new spec")
    .requiredOption("--project <id>", "Project id (e.g. PROJ-0001)")
    .requiredOption("--title <title>", "Spec title")
    .option("--tags <tags>", "Comma-separated tags")
    .option("--body <body>", "Spec body")
    .option("--json", "Machine-readable output")
    .option("--actor <name>", "Acting actor (overrides env)")
    .option("--actor-type <type>", "Actor type: human|agent")
    .option("--message <text>", "Trace note explaining the change")
    .action(
      async (opts: {
        project?: string;
        title?: string;
        tags?: string;
        body?: string;
        json?: boolean;
      }) => {
        await runSpecNew(await createContainer(getRealmRoot()), opts);
      }
    );

  spec
    .command("status <specId> <status>")
    .description("Change a spec's status")
    .option("--json", "Machine-readable output")
    .option("--actor <name>", "Acting actor (overrides env)")
    .option("--actor-type <type>", "Actor type: human|agent")
    .option("--message <text>", "Trace note explaining the change")
    .action(async (specId: string, status: string, opts: { json?: boolean }) => {
      await runSpecStatus(await createContainer(getRealmRoot()), specId, status, opts);
    });

  spec
    .command("list")
    .description("List specs")
    .option("--project <id>", "Scope to a project")
    .option("--json", "Machine-readable output")
    .action(async (opts: { project?: string; json?: boolean }) => {
      await runSpecList(await createContainer(getRealmRoot()), opts);
    });

  spec
    .command("show <specId>")
    .description("Show a spec with its body")
    .option("--json", "Machine-readable output")
    .action(async (specId: string, opts: { json?: boolean }) => {
      await runSpecShow(await createContainer(getRealmRoot()), specId, opts);
    });

  // --- top-level reads ---
  program
    .command("next")
    .description("Get the next eligible issue to work on")
    .option("--json", "Machine-readable output")
    .action(async (opts: { json?: boolean }) => {
      await runNext(await createContainer(getRealmRoot()), opts);
    });

  program
    .command("worktree")
    .description("Inspect Roadkit managed worktrees")
    .command("list")
    .option("--json", "Machine-readable output")
    .action(async (opts: { json?: boolean }) => {
      await runWorktreeList(await createContainer(getRealmRoot()), opts);
    });

  program
    .command("brief")
    .description("Inject-ready brief: focus issue, rules, dependencies, next")
    .option("--issue <id>", "Focus on a specific issue (e.g. ISSUE-0001)")
    .option("--project <id>", "Scope to a specific project")
    .option("--json", "Machine-readable output")
    .action(async (opts: { issue?: string; project?: string; json?: boolean }) => {
      await runBrief(await createContainer(getRealmRoot()), opts);
    });

  program
    .command("lint")
    .description("Check realm integrity (structure, references, cycles, config)")
    .option("--json", "Machine-readable output")
    .action(async (opts: { json?: boolean }) => {
      await runLint(await createContainer(getRealmRoot()), opts);
    });

  program
    .command("context")
    .description("Dump realm context")
    .option("--project <id>", "Scope to a specific project (e.g. PROJ-0001)")
    .option("--active", "Filter to active projects only")
    .option("--json", "Output as JSON")
    .action(async (opts: { project?: string; active?: boolean; json?: boolean }) => {
      await runContext(await createContainer(getRealmRoot()), opts);
    });

  program
    .command("history")
    .description("Show audit trail of events")
    .option("--project <id>", "Scope to a specific project")
    .option("--issue <id>", "Scope to a specific issue")
    .option("--spec <id>", "Scope to a specific spec")
    .option("--actor <name>", "Filter by actor")
    .option("--event <event>", "Filter by event type")
    .option("--since <date>", "Filter events after this date (ISO 8601)")
    .option("--json", "Machine-readable output")
    .action(
      async (opts: {
        project?: string;
        issue?: string;
        spec?: string;
        actor?: string;
        event?: string;
        since?: string;
        json?: boolean;
      }) => {
        await runHistory(await createContainer(getRealmRoot()), opts);
      }
    );

  program
    .command("doctor")
    .description("Diagnose realm health; --fix repairs duplicate-id files")
    .option("--fix", "Apply repairs (delete stale-slug duplicate files)")
    .option("--json", "Machine-readable output")
    .action(async (opts: { fix?: boolean; json?: boolean }) => {
      await runDoctor(await createContainer(getRealmRoot()), opts);
    });

  const config = program.command("config").description("Inspect or edit roadfig.yml");
  config
    .command("get [key]")
    .description("Print the config, or a dotted key (e.g. priority.default)")
    .option("--json", "Machine-readable output")
    .action(async (key: string | undefined, opts: { json?: boolean }) => {
      await runConfigGet(await createContainer(getRealmRoot()), key, opts);
    });
  config
    .command("set <key> <value>")
    .description("Set priority.default, estimation.scale, or estimation.default")
    .option("--json", "Machine-readable output")
    .action(async (key: string, value: string, opts: { json?: boolean }) => {
      await runConfigSet(await createContainer(getRealmRoot()), key, value, opts);
    });

  return program;
}
