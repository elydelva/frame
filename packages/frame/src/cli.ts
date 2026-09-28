import { Command } from "commander";
import { runBrief } from "./commands/brief.js";
import { runConfigGet, runConfigSet } from "./commands/config.js";
import { runContext } from "./commands/context.js";
import { runDoctor } from "./commands/doctor.js";
import { runHistory } from "./commands/history.js";
import { runInit } from "./commands/init.js";
import { registerIssueCommands } from "./commands/issue/register.js";
import { setJsonMode } from "./commands/json-mode.js";
import { runLint } from "./commands/lint.js";
import { registerMilestoneCommands } from "./commands/milestone/register.js";
import { runNext } from "./commands/next.js";
import { registerProjectCommands } from "./commands/project/register.js";
import { registerSpecCommands } from "./commands/spec/register.js";
import { runWorktreeList } from "./commands/worktree.js";
import { createContainer } from "./container.js";

// Kept in sync with package.json "version".
const CLI_VERSION = "0.1.1";

function getRealmRoot(): string {
  return process.env.FRAME_ROOT ?? process.cwd();
}

export function buildCLI(): Command {
  const program = new Command();

  setJsonMode(false);
  program.hook("preAction", (_thisCommand, actionCommand) => {
    setJsonMode(actionCommand.opts().json === true);
  });

  program
    .name("frame")
    .description("Decision-first, agent-native project management for git repositories")
    .version(CLI_VERSION);

  program
    .command("init")
    .description("Initialize frame in the current repository")
    .action(async () => {
      await runInit(getRealmRoot());
    });

  registerProjectCommands(program, getRealmRoot);

  registerMilestoneCommands(program, getRealmRoot);

  registerIssueCommands(program, getRealmRoot);

  registerSpecCommands(program, getRealmRoot);

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
    .description("Inspect Frame managed worktrees")
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

  const config = program.command("config").description("Inspect or edit .frameconfig");
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
