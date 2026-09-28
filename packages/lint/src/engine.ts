import {
  DEFAULT_CONFIG,
  type RawEntityKind,
  type RawEntityRecord,
  type RealmConfig,
  type RealmScan,
} from "@frame/core";
import type { LintFinding, LintReport } from "./types.js";

const ID_PATTERN: Record<RawEntityKind, RegExp> = {
  project: /^PROJ-\d{4}$/,
  milestone: /^MILE-\d{4}$/,
  issue: /^ISSUE-\d{4}$/,
  spec: /^SPEC-\d{4}$/,
};

const STATUSES: Record<RawEntityKind, ReadonlySet<string>> = {
  project: new Set(["planned", "active", "paused", "completed", "cancelled"]),
  milestone: new Set(["pending", "active", "done"]),
  issue: new Set(["not-started", "in-progress", "completed", "abandoned", "blocked", "skipped"]),
  spec: new Set(["draft", "proposed", "accepted", "superseded", "deferred", "abandoned"]),
};

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/** A gate may be "ISSUE-0003" or cross-project "PROJ-0001/ISSUE-0003". */
function gateIssueId(gate: string): string {
  const slash = gate.lastIndexOf("/");
  return slash === -1 ? gate : gate.slice(slash + 1);
}

/**
 * Validates realm structural integrity from a raw scan: well-formed frontmatter,
 * ids matching filenames, unique ids (no two files claiming one id), valid
 * statuses, resolvable references, no dependency cycles, and config-conformant
 * priority/labels. It does NOT enforce rule
 * triggers (before_edit, …) — those are agent-prompt constraints surfaced by
 * `frame brief`, not file-validatable here.
 */
export class LintEngine {
  private readonly config: RealmConfig;

  constructor(config: RealmConfig = DEFAULT_CONFIG) {
    this.config = config;
  }

  run(scan: RealmScan): LintReport {
    const findings: LintFinding[] = [];

    for (const diag of scan.diagnostics) {
      findings.push({
        severity: "error",
        code: "frontmatter-valid",
        file: diag.file,
        entityId: null,
        message: `Malformed frontmatter: ${diag.error}`,
      });
    }

    const knownIds = new Set<string>();
    for (const record of scan.records) {
      const id = asString(record.data.id);
      if (id) knownIds.add(id);
    }

    for (const record of scan.records) {
      this.checkRecord(record, knownIds, findings);
    }

    this.checkDuplicateIds(scan.records, findings);
    this.checkCycles(scan.records, findings);

    const errorCount = findings.filter((f) => f.severity === "error").length;
    return { findings, errorCount, warningCount: findings.length - errorCount };
  }

  private checkRecord(
    record: RawEntityRecord,
    knownIds: Set<string>,
    findings: LintFinding[]
  ): void {
    const { kind, file, data } = record;
    const id = asString(data.id);
    const add = (severity: "error" | "warning", code: string, message: string): void => {
      findings.push({ severity, code, file, entityId: id, message });
    };

    // id present and well-formed
    if (!id || !ID_PATTERN[kind].test(id)) {
      add("error", "frontmatter-valid", `Missing or invalid ${kind} id: ${id ?? "(none)"}`);
      return;
    }

    // id matches filename
    const base = file.split("/").pop() ?? file;
    if (!base.startsWith(id)) {
      add("error", "id-matches-filename", `Id ${id} does not match filename ${base}`);
    }

    // status valid
    const status = asString(data.status);
    if (!status || !STATUSES[kind].has(status)) {
      add("error", "status-valid", `Invalid ${kind} status: ${status ?? "(none)"}`);
    }

    // references
    if (kind !== "project") {
      const projectId = asString(data.projectId);
      if (!projectId || !knownIds.has(projectId)) {
        add("error", "references-exist", `Unknown projectId: ${projectId ?? "(none)"}`);
      }
    }
    if (kind === "issue") {
      this.checkRef(data.milestoneId, knownIds, add);
      this.checkRef(data.parentId, knownIds, add);
      for (const gate of asStringArray(data.gates)) {
        if (!knownIds.has(gateIssueId(gate))) {
          add("error", "references-exist", `Unknown gate: ${gate}`);
        }
      }
      this.checkPriority(data.priority, add);
      this.checkLabels(data.labels, add);
    }
    if (kind === "spec") {
      this.checkRef(data.supersedes, knownIds, add);
      this.checkRef(data.supersededBy, knownIds, add);
    }
  }

  private checkRef(
    value: unknown,
    knownIds: Set<string>,
    add: (s: "error" | "warning", c: string, m: string) => void
  ): void {
    const ref = asString(value);
    if (ref && !knownIds.has(ref)) {
      add("error", "references-exist", `Unknown reference: ${ref}`);
    }
  }

  private checkPriority(
    value: unknown,
    add: (s: "error" | "warning", c: string, m: string) => void
  ): void {
    const priority = asString(value);
    if (priority && !this.config.priority.levels.includes(priority)) {
      add("warning", "priority-valid", `Priority not in .frameconfig levels: ${priority}`);
    }
  }

  private checkLabels(
    value: unknown,
    add: (s: "error" | "warning", c: string, m: string) => void
  ): void {
    if (this.config.labels.length === 0) return;
    const allowed = new Set(this.config.labels.map((l) => l.name));
    for (const label of asStringArray(value)) {
      if (!allowed.has(label)) {
        add("warning", "labels-valid", `Label not in taxonomy: ${label}`);
      }
    }
  }

  /**
   * Flag any id claimed by more than one file. This catches stale duplicates
   * left behind when a title is renamed by copying to a new slug instead of
   * renaming the file: two `.md` files share one `id:`, the loader resolves
   * non-deterministically, and a transition run against the stale copy fails
   * with a confusing "invalid transition" error. Every file involved is
   * reported so the operator can delete the stale one.
   */
  private checkDuplicateIds(records: RawEntityRecord[], findings: LintFinding[]): void {
    const filesById = new Map<string, string[]>();
    for (const record of records) {
      const id = asString(record.data.id);
      if (!id) continue;
      const files = filesById.get(id);
      if (files) files.push(record.file);
      else filesById.set(id, [record.file]);
    }

    for (const [id, files] of filesById) {
      if (files.length < 2) continue;
      const others = files.join(", ");
      for (const file of files) {
        findings.push({
          severity: "error",
          code: "unique-ids",
          file,
          entityId: id,
          message: `Id ${id} is claimed by ${files.length} files: ${others}`,
        });
      }
    }
  }

  /** Detect cycles in the issue gate graph and flag every issue involved. */
  private checkCycles(records: RawEntityRecord[], findings: LintFinding[]): void {
    const edges = new Map<string, string[]>();
    const fileOf = new Map<string, string>();
    for (const record of records) {
      if (record.kind !== "issue") continue;
      const id = asString(record.data.id);
      if (!id) continue;
      fileOf.set(id, record.file);
      edges.set(id, asStringArray(record.data.gates).map(gateIssueId));
    }

    const WHITE = 0;
    const GRAY = 1;
    const BLACK = 2;
    const color = new Map<string, number>();
    const inCycle = new Set<string>();

    const visit = (node: string, stack: string[]): void => {
      color.set(node, GRAY);
      stack.push(node);
      for (const next of edges.get(node) ?? []) {
        if (!edges.has(next)) continue; // external/unknown handled by references-exist
        if (color.get(next) === GRAY) {
          // Back-edge: everything from `next` to the top of the stack is a cycle.
          const start = stack.indexOf(next);
          for (const n of stack.slice(start)) inCycle.add(n);
        } else if ((color.get(next) ?? WHITE) === WHITE) {
          visit(next, stack);
        }
      }
      stack.pop();
      color.set(node, BLACK);
    };

    for (const node of edges.keys()) {
      if ((color.get(node) ?? WHITE) === WHITE) visit(node, []);
    }

    for (const id of inCycle) {
      findings.push({
        severity: "error",
        code: "no-dag-cycles",
        file: fileOf.get(id) ?? "",
        entityId: id,
        message: `Issue ${id} is part of a gate dependency cycle`,
      });
    }
  }
}
