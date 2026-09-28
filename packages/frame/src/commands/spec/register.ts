import type { Command } from "commander";
import { createContainer } from "../../container.js";
import { runSpecList } from "./list.js";
import { runSpecNew } from "./new.js";
import { runSpecShow } from "./show.js";
import { runSpecStatus } from "./status.js";

export function registerSpecCommands(program: Command, getRealmRoot: () => string): void {
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
}
