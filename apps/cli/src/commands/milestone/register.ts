import type { Command } from "commander";
import { createContainer } from "../../container.js";
import { runMilestoneList } from "./list.js";
import { runMilestoneNew } from "./new.js";
import { runMilestoneStart, runMilestoneStatus } from "./status.js";

export function registerMilestoneCommands(program: Command, getRealmRoot: () => string): void {
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
}
