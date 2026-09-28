import type { Command } from "commander";
import { createContainer } from "../../container.js";
import { runIssueAdd } from "./add.js";
import { runIssueComplete } from "./complete.js";
import { runIssueEdit } from "./edit.js";
import { runIssueGateAdd, runIssueGateRemove } from "./gate.js";
import { runIssueList } from "./list.js";
import { runIssueRelease } from "./release.js";
import { runIssueRemove } from "./rm.js";
import { runIssueShow } from "./show.js";
import { runIssueStart } from "./start.js";
import { runIssueStatus } from "./status.js";
import { runIssueWorktree } from "./worktree.js";

/** Attach the standard actor-attribution and JSON options to a mutation. */
function withActor(command: Command): Command {
  return command
    .option("--json", "Machine-readable output")
    .option("--actor <name>", "Acting actor (overrides env)")
    .option("--actor-type <type>", "Actor type: human|agent")
    .option("--message <text>", "Trace note explaining the change");
}

export function registerIssueCommands(program: Command, getRealmRoot: () => string): void {
  const issue = program.command("issue").description("Manage issues");

  issue
    .command("add")
    .description("Add an issue to a project")
    .requiredOption("--project <id>", "Project id (e.g. PROJ-0001)")
    .option("--milestone <id>", "Milestone id (e.g. MILE-0001)")
    .requiredOption("--title <title>", "Issue title")
    .option("--priority <priority>", "Priority level (see .frameconfig)")
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
      .option("--priority <priority>", "Priority level (see .frameconfig)")
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
}
