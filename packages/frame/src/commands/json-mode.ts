/**
 * Process-wide flag toggled by commands invoked with `--json`. When set, error
 * reporting (`fail` and the top-level catch) emits a structured
 * `{"error":{"code","message"}}` envelope on stderr instead of a human string,
 * so an agent can classify failures without parsing prose.
 */
let jsonMode = false;

export function setJsonMode(on: boolean): void {
  jsonMode = on;
}

export function isJsonMode(): boolean {
  return jsonMode;
}

/** Serialize an error as the structured stderr envelope. */
export function formatJsonError(code: string, message: string): string {
  return JSON.stringify({ error: { code, message } });
}
