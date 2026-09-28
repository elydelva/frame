import { describe, expect, it } from "bun:test";
import { DEFAULT_CONFIG, type RealmConfig } from "@frame/core";
import {
  parseProjectId,
  requireOption,
  resolveEstimate,
  resolvePriority,
  validateLabelsAgainstTaxonomy,
} from "./validators.js";

/** Capture the message passed to `fail` (which calls process.exit). */
async function captureFail(fn: () => void): Promise<string> {
  const originalExit = process.exit;
  const originalError = console.error;
  const errors: string[] = [];
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(" "));
  };
  // @ts-expect-error test stub that throws to short-circuit `never`.
  process.exit = () => {
    throw new Error("exit");
  };
  try {
    expect(() => fn()).toThrow("exit");
    return errors.join("\n");
  } finally {
    process.exit = originalExit;
    console.error = originalError;
  }
}

describe("requireOption", () => {
  it("returns the value when present", () => {
    expect(requireOption("x", "--foo")).toBe("x");
  });

  it("fails with `<name> is required` when missing", async () => {
    const msg = await captureFail(() => requireOption(undefined, "--foo"));
    expect(msg).toContain("--foo is required");
  });
});

describe("parseProjectId", () => {
  it("builds a ProjectId from a valid option", () => {
    expect(parseProjectId("PROJ-0001").toString()).toBe("PROJ-0001");
  });

  it("fails when --project is missing", async () => {
    const msg = await captureFail(() => parseProjectId(undefined));
    expect(msg).toContain("--project is required");
  });
});

describe("resolvePriority", () => {
  const config: RealmConfig = {
    ...DEFAULT_CONFIG,
    priority: { levels: ["P0", "P1"], default: "P1" },
  };

  it("returns the configured default when omitted", () => {
    expect(resolvePriority(undefined, config)).toBe("P1");
  });

  it("returns a valid level", () => {
    expect(resolvePriority("P0", config)).toBe("P0");
  });

  it("fails for an out-of-range level", async () => {
    const msg = await captureFail(() => resolvePriority("P9", config));
    expect(msg).toContain("Invalid --priority: P9");
    expect(msg).toContain("P0|P1");
  });
});

describe("resolveEstimate", () => {
  const config: RealmConfig = {
    ...DEFAULT_CONFIG,
    estimation: { scale: "tshirt", default: null },
  };

  it("returns undefined when omitted", () => {
    expect(resolveEstimate(undefined, config)).toBeUndefined();
  });

  it("resolves a label to points", () => {
    expect(resolveEstimate("M", config)).toBe(3);
  });

  it("fails on an invalid estimate", async () => {
    const msg = await captureFail(() => resolveEstimate("XXL", config));
    expect(msg).toContain("Invalid --estimate");
  });
});

describe("validateLabelsAgainstTaxonomy", () => {
  it("allows any label when taxonomy is empty", () => {
    expect(() => validateLabelsAgainstTaxonomy(["anything"], DEFAULT_CONFIG)).not.toThrow();
  });

  it("accepts known labels", () => {
    const config: RealmConfig = { ...DEFAULT_CONFIG, labels: [{ name: "bug" }] };
    expect(() => validateLabelsAgainstTaxonomy(["bug"], config)).not.toThrow();
  });

  it("fails for unknown labels", async () => {
    const config: RealmConfig = { ...DEFAULT_CONFIG, labels: [{ name: "bug" }] };
    const msg = await captureFail(() => validateLabelsAgainstTaxonomy(["bug", "wip"], config));
    expect(msg).toContain("Invalid --labels: wip");
    expect(msg).toContain("allowed: bug");
  });
});
