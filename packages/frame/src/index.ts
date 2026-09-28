#!/usr/bin/env node
import { RealmFormatError } from "@frame/fs";
import { buildCLI } from "./cli.js";
import { formatJsonError, isJsonMode } from "./commands/json-mode.js";

const program = buildCLI();

program.parseAsync(process.argv).catch((err: unknown) => {
  const code =
    err instanceof RealmFormatError
      ? err.code
      : err instanceof Error
        ? err.name
        : "UnexpectedError";
  const message = err instanceof Error ? err.message : "An unexpected error occurred";
  if (isJsonMode()) {
    console.error(formatJsonError(code, message));
  } else {
    console.error(`Error: ${message}`);
  }
  process.exit(1);
});
