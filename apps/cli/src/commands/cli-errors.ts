import { RealmFormatError } from "@frame/fs";
import { formatJsonError } from "./json-mode.js";

/** An expected CLI failure with a stable code for machine-readable output. */
export class CliError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "CliError";
  }
}

interface CliErrorDetails {
  code: string;
  message: string;
}

function getCliErrorDetails(error: unknown): CliErrorDetails {
  if (error instanceof RealmFormatError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof CliError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof Error) {
    return { code: error.name, message: error.message };
  }
  return { code: "UnexpectedError", message: "An unexpected error occurred" };
}

/** Render a CLI error once, using the human or JSON stderr contract. */
export function reportCliError(error: unknown, jsonMode: boolean): void {
  const { code, message } = getCliErrorDetails(error);
  console.error(jsonMode ? formatJsonError(code, message) : `Error: ${message}`);
}

/** Terminate the CLI with the requested status code. */
export function exitCli(code: number): never {
  process.exit(code);
}
