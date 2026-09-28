import { describe, expect, it } from "bun:test";
import { HumanFormatter, JsonFormatter, getFormatter } from "./output.js";

function captureLog(): { lines: string[]; restore: () => void } {
  const original = console.log;
  const lines: string[] = [];
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  return {
    lines,
    restore: () => {
      console.log = original;
    },
  };
}

describe("getFormatter", () => {
  it("returns the JsonFormatter when json is true", () => {
    expect(getFormatter(true)).toBe(JsonFormatter);
  });

  it("returns the HumanFormatter when json is false", () => {
    expect(getFormatter(false)).toBe(HumanFormatter);
  });
});

describe("JsonFormatter", () => {
  it("prints the pretty-printed json and ignores human", () => {
    const cap = captureLog();
    let humanCalled = false;
    JsonFormatter.emit({
      json: { a: 1 },
      human: () => {
        humanCalled = true;
      },
    });
    cap.restore();
    expect(humanCalled).toBe(false);
    expect(cap.lines.join("\n")).toBe(JSON.stringify({ a: 1 }, null, 2));
  });
});

describe("HumanFormatter", () => {
  it("runs the human closure and emits no json", () => {
    const cap = captureLog();
    let humanCalled = false;
    HumanFormatter.emit({
      json: { a: 1 },
      human: () => {
        humanCalled = true;
        console.log("human line");
      },
    });
    cap.restore();
    expect(humanCalled).toBe(true);
    expect(cap.lines).toEqual(["human line"]);
  });
});
