import type { Command } from "commander";
import { createContainer } from "../../container.js";
import { runProjectList } from "./list.js";
import { runProjectNew } from "./new.js";
import { runProjectStart, runProjectStatus } from "./status.js";

export function registerProjectCommands(program: Command, getRealmRoot: () => string): void {
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
}
