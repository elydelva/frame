#!/usr/bin/env node
import { buildCLI } from "./cli.js";
import { exitCli, reportCliError } from "./commands/cli-errors.js";
import { isJsonMode } from "./commands/json-mode.js";

const program = buildCLI();

program.parseAsync(process.argv).catch((err: unknown) => {
  reportCliError(err, isJsonMode());
  exitCli(1);
});
