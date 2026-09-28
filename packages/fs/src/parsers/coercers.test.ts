import { describe, expect, it } from "bun:test";
import { IssueId } from "@frame/core";
import {
  toDate,
  toDateOrNull,
  toEnumValue,
  toIdArray,
  toIdOrNull,
  toNumber,
  toNumberOrNull,
  toRuleArray,
  toStringArray,
  toStringOrNull,
} from "./coercers.js";

describe("toDate", () => {
  it("passes through Date instances", () => {
    const d = new Date("2026-01-01T00:00:00.000Z");
    expect(toDate(d)).toBe(d);
  });

  it("parses string and number inputs", () => {
    expect(toDate("2026-01-01T00:00:00.000Z").toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(toDate(0).getTime()).toBe(0);
  });

  it("falls back to a fresh Date for invalid input", () => {
    expect(toDate("not-a-date")).toBeInstanceOf(Date);
    expect(toDate(null)).toBeInstanceOf(Date);
  });
});

describe("toDateOrNull", () => {
  it("returns null for invalid input", () => {
    expect(toDateOrNull("nope")).toBeNull();
    expect(toDateOrNull(undefined)).toBeNull();
  });

  it("parses valid input", () => {
    expect(toDateOrNull("2026-01-01").toISOString()).toContain("2026-01-01");
  });
});

describe("toNumber", () => {
  it("coerces numbers and numeric strings", () => {
    expect(toNumber(5)).toBe(5);
    expect(toNumber("7")).toBe(7);
  });

  it("defaults to 0 for non-numeric input", () => {
    expect(toNumber("x")).toBe(0);
    expect(toNumber(null)).toBe(0);
  });
});

describe("toNumberOrNull", () => {
  it("returns numbers or null", () => {
    expect(toNumberOrNull(3)).toBe(3);
    expect(toNumberOrNull("4")).toBe(4);
    expect(toNumberOrNull("")).toBeNull();
    expect(toNumberOrNull("x")).toBeNull();
  });
});

describe("toStringArray", () => {
  it("keeps only strings", () => {
    expect(toStringArray(["a", 1, "b", null])).toEqual(["a", "b"]);
  });

  it("returns empty for non-arrays", () => {
    expect(toStringArray("a")).toEqual([]);
  });
});

describe("toStringOrNull", () => {
  it("returns non-empty strings or null", () => {
    expect(toStringOrNull("x")).toBe("x");
    expect(toStringOrNull("")).toBeNull();
    expect(toStringOrNull(5)).toBeNull();
  });
});

describe("toEnumValue", () => {
  const valid = ["a", "b", "c"] as const;

  it("returns the value when valid", () => {
    expect(toEnumValue("b", valid, "a")).toBe("b");
  });

  it("returns the default when invalid", () => {
    expect(toEnumValue("z", valid, "a")).toBe("a");
    expect(toEnumValue(42, valid, "c")).toBe("c");
  });
});

describe("toIdOrNull", () => {
  it("builds an id from a valid string", () => {
    expect(toIdOrNull("ISSUE-0001", IssueId.from)?.toString()).toBe("ISSUE-0001");
  });

  it("returns null for empty or invalid input", () => {
    expect(toIdOrNull("", IssueId.from)).toBeNull();
    expect(toIdOrNull("bad", IssueId.from)).toBeNull();
    expect(toIdOrNull(5, IssueId.from)).toBeNull();
  });
});

describe("toIdArray", () => {
  it("builds ids and drops failures", () => {
    const ids = toIdArray(["ISSUE-0001", "bad", "ISSUE-0002"], IssueId.from);
    expect(ids.map((i) => i.toString())).toEqual(["ISSUE-0001", "ISSUE-0002"]);
  });

  it("returns empty for non-arrays", () => {
    expect(toIdArray("ISSUE-0001", IssueId.from)).toEqual([]);
  });
});

describe("toRuleArray", () => {
  it("keeps well-formed rules", () => {
    const rules = toRuleArray([
      { trigger: "before_edit", instruction: "do x" },
      { trigger: "bad" },
      "nope",
    ]);
    expect(rules).toEqual([{ trigger: "before_edit", instruction: "do x" }]);
  });

  it("returns empty for non-arrays", () => {
    expect(toRuleArray(null)).toEqual([]);
  });
});
