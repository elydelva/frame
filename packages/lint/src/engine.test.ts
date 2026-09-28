import { describe, expect, it } from "bun:test";
import type { RawEntityRecord, RealmScan } from "@frame/core";
import { LintEngine } from "./engine.js";

function scan(records: RawEntityRecord[], diagnostics: RealmScan["diagnostics"] = []): RealmScan {
  return { records, diagnostics };
}

function project(id = "PROJ-0001", over: Record<string, unknown> = {}): RawEntityRecord {
  return {
    kind: "project",
    file: `.frame/projects/${id}-p/${id}.md`,
    data: { id, status: "active", ...over },
  };
}

function issue(id = "ISSUE-0001", over: Record<string, unknown> = {}): RawEntityRecord {
  return {
    kind: "issue",
    file: `.frame/projects/PROJ-0001-p/issues/${id}-x.md`,
    data: { id, projectId: "PROJ-0001", status: "not-started", ...over },
  };
}

const engine = new LintEngine();

describe("LintEngine", () => {
  it("passes a well-formed realm", () => {
    const report = engine.run(scan([project(), issue()]));
    expect(report.findings).toEqual([]);
    expect(report.errorCount).toBe(0);
  });

  it("reports malformed frontmatter diagnostics as errors", () => {
    const report = engine.run(scan([], [{ file: "x.md", error: "bad yaml" }]));
    expect(report.errorCount).toBe(1);
    expect(report.findings[0]?.code).toBe("frontmatter-valid");
  });

  it("flags a missing or malformed id", () => {
    const report = engine.run(scan([{ kind: "issue", file: "issues/x.md", data: {} }]));
    expect(report.findings.some((f) => f.code === "frontmatter-valid")).toBe(true);
  });

  it("flags an id that does not match the filename", () => {
    const rec = issue("ISSUE-0001");
    rec.file = ".frame/projects/PROJ-0001-p/issues/ISSUE-9999-x.md";
    const report = engine.run(scan([project(), rec]));
    expect(report.findings.some((f) => f.code === "id-matches-filename")).toBe(true);
  });

  it("flags two files claiming the same id", () => {
    const canonical = issue("ISSUE-0005", { status: "in-progress" });
    canonical.file = ".frame/projects/PROJ-0001-p/issues/ISSUE-0005-good-slug.md";
    const stale = issue("ISSUE-0005", { status: "not-started" });
    stale.file = ".frame/projects/PROJ-0001-p/issues/ISSUE-0005-old-slug.md";

    const report = engine.run(scan([project(), canonical, stale]));

    const dups = report.findings.filter((f) => f.code === "unique-ids");
    expect(dups.map((f) => f.file).sort()).toEqual([
      ".frame/projects/PROJ-0001-p/issues/ISSUE-0005-good-slug.md",
      ".frame/projects/PROJ-0001-p/issues/ISSUE-0005-old-slug.md",
    ]);
    expect(dups.every((f) => f.severity === "error")).toBe(true);
  });

  it("does not flag distinct ids as duplicates", () => {
    const report = engine.run(scan([project(), issue("ISSUE-0001"), issue("ISSUE-0002")]));
    expect(report.findings.some((f) => f.code === "unique-ids")).toBe(false);
  });

  it("flags an invalid status", () => {
    const report = engine.run(scan([project(), issue("ISSUE-0001", { status: "wat" })]));
    expect(report.findings.some((f) => f.code === "status-valid")).toBe(true);
  });

  it("flags unknown references and gates", () => {
    const report = engine.run(
      scan([project(), issue("ISSUE-0001", { projectId: "PROJ-9999", gates: ["ISSUE-4242"] })])
    );
    const refs = report.findings.filter((f) => f.code === "references-exist");
    expect(refs.length).toBe(2);
  });

  it("resolves cross-project gates by issue id", () => {
    const report = engine.run(
      scan([
        project(),
        issue("ISSUE-0001"),
        issue("ISSUE-0002", { gates: ["PROJ-0001/ISSUE-0001"] }),
      ])
    );
    expect(report.findings.filter((f) => f.code === "references-exist")).toEqual([]);
  });

  it("detects a gate dependency cycle", () => {
    const report = engine.run(
      scan([
        project(),
        issue("ISSUE-0001", { gates: ["ISSUE-0002"] }),
        issue("ISSUE-0002", { gates: ["ISSUE-0001"] }),
      ])
    );
    const cycle = report.findings.filter((f) => f.code === "no-dag-cycles");
    expect(cycle.map((f) => f.entityId).sort()).toEqual(["ISSUE-0001", "ISSUE-0002"]);
  });

  it("warns on priority outside the configured levels", () => {
    const report = engine.run(scan([project(), issue("ISSUE-0001", { priority: "P9" })]));
    const warn = report.findings.find((f) => f.code === "priority-valid");
    expect(warn?.severity).toBe("warning");
    expect(report.warningCount).toBe(1);
  });

  it("warns on labels outside a non-empty taxonomy", () => {
    const configured = new LintEngine({
      version: 1,
      estimation: { scale: "fibonacci", default: null },
      priority: { levels: ["high", "none"], default: "none" },
      labels: [{ name: "bug" }],
    });
    const report = configured.run(
      scan([project(), issue("ISSUE-0001", { labels: ["bug", "nope"] })])
    );
    const warn = report.findings.filter((f) => f.code === "labels-valid");
    expect(warn.map((f) => f.message)).toEqual(["Label not in taxonomy: nope"]);
  });
});
