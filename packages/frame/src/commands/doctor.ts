import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { RawEntityRecord } from "@frame/core";
import { scanRealmRaw, slugify } from "@frame/fs";
import { LintEngine } from "@frame/lint";
import type { Container } from "../container.js";
import { setJsonMode } from "./json-mode.js";
import { getFormatter } from "./output.js";

interface DoctorOptions {
  fix?: boolean;
  json?: boolean;
}

interface Repair {
  id: string;
  kept: string;
  deleted: string[];
}

/** The filename a record should live at, given its id and current title. */
function canonicalName(rec: RawEntityRecord): string {
  const id = String(rec.data.id ?? "");
  if (rec.kind === "project") return `${id}.md`;
  const title = typeof rec.data.title === "string" ? rec.data.title : "";
  const slug = slugify(title);
  return slug ? `${id}-${slug}.md` : `${id}.md`;
}

/** Group records by id; ids claimed by >1 file are duplicates to repair. */
function duplicateGroups(records: RawEntityRecord[]): Map<string, RawEntityRecord[]> {
  const byId = new Map<string, RawEntityRecord[]>();
  for (const rec of records) {
    const id = String(rec.data.id ?? "");
    if (!id) continue;
    const bucket = byId.get(id);
    if (bucket) bucket.push(rec);
    else byId.set(id, [rec]);
  }
  for (const [id, recs] of byId) {
    if (recs.length < 2) byId.delete(id);
  }
  return byId;
}

export async function runDoctor(container: Container, opts: DoctorOptions): Promise<void> {
  setJsonMode(opts.json ?? false);
  const scan = await scanRealmRaw(container.realmRoot);
  const groups = duplicateGroups(scan.records);
  const repairs: Repair[] = [];

  for (const [id, recs] of groups) {
    // Keep the file whose slug matches the current title; fall back to the first.
    const keeper = recs.find((r) => path.basename(r.file) === canonicalName(r)) ?? recs[0];
    if (!keeper) continue;
    const stale = recs.filter((r) => r !== keeper);
    const repair: Repair = { id, kept: keeper.file, deleted: stale.map((r) => r.file) };
    repairs.push(repair);
    if (opts.fix) {
      for (const r of stale) {
        await fs.rm(path.join(container.realmRoot, r.file), { force: true });
      }
    }
  }

  const report = new LintEngine(container.config).run(scan);

  getFormatter(opts.json ?? false).emit({
    json: { repairs, fixed: opts.fix === true, lint: report },
    human: () => {
      if (repairs.length === 0) {
        console.log("✓ No duplicate-id files found.");
      } else {
        const verb = opts.fix ? "Deleted" : "Would delete (run --fix)";
        for (const r of repairs) {
          console.log(`${r.id}: keep ${r.kept}`);
          for (const d of r.deleted) console.log(`  ${verb}: ${d}`);
        }
      }
      const suffix = opts.fix ? " (after repair: re-run `frame lint` to confirm)" : "";
      console.log(
        `\nLint: ${report.errorCount} error(s), ${report.warningCount} warning(s)${suffix}`
      );
    },
  });
}
