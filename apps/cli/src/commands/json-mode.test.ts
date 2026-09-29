import { afterEach, describe, expect, it } from "bun:test";
import { formatJsonError, isJsonMode, setJsonMode } from "./json-mode.js";

describe("json-mode", () => {
  afterEach(() => setJsonMode(false));

  it("toggles the process-wide flag", () => {
    expect(isJsonMode()).toBe(false);
    setJsonMode(true);
    expect(isJsonMode()).toBe(true);
    setJsonMode(false);
    expect(isJsonMode()).toBe(false);
  });

  it("formats a structured error envelope", () => {
    const out = JSON.parse(formatJsonError("InvalidIdError", 'Invalid IssueId format: "x"'));
    expect(out).toEqual({
      error: { code: "InvalidIdError", message: 'Invalid IssueId format: "x"' },
    });
  });
});
