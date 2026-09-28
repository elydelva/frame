/**
 * Output strategy: read commands build a JSON view-model and a human-print
 * closure, then hand both to a formatter chosen by the `--json` flag. The
 * formatter decides which half to emit, keeping the branch out of every command.
 */
export interface OutputPayload {
  json: unknown;
  human: () => void;
}

export interface OutputFormatter {
  emit(payload: OutputPayload): void;
}

/** Emits the pretty-printed JSON view-model. */
export const JsonFormatter: OutputFormatter = {
  emit(payload: OutputPayload): void {
    console.log(JSON.stringify(payload.json, null, 2));
  },
};

/** Runs the human-print closure. */
export const HumanFormatter: OutputFormatter = {
  emit(payload: OutputPayload): void {
    payload.human();
  },
};

/** Select the formatter for the given `--json` flag. */
export function getFormatter(json: boolean): OutputFormatter {
  return json ? JsonFormatter : HumanFormatter;
}
