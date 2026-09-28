import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { RawEntityKind, RawEntityRecord, RealmScan, ScanDiagnostic } from "@frame/core";
import {
  FRAME_DIR,
  ISSUES_DIR,
  MD_EXT,
  MILESTONES_DIR,
  PROJECTS_DIR,
  SPECS_DIR,
} from "../constants.js";
import { parseFrontmatter } from "../parsers/frontmatter.parser.js";

async function readdirSafe(dir: string): Promise<string[]> {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

interface ChildSpec {
  subdir: string;
  prefix: string;
  kind: RawEntityKind;
}

const CHILD_SPECS: ChildSpec[] = [
  { subdir: MILESTONES_DIR, prefix: "MILE-", kind: "milestone" },
  { subdir: ISSUES_DIR, prefix: "ISSUE-", kind: "issue" },
  { subdir: SPECS_DIR, prefix: "SPEC-", kind: "spec" },
];

/**
 * Read every entity file under `.frame/projects/` and parse its frontmatter
 * strictly, capturing malformed files as diagnostics rather than swallowing
 * them. Traces are excluded — they are append-only machine records, not linted.
 * Records carry raw frontmatter for the lint engine to validate.
 */
export async function scanRealmRaw(realmRoot: string): Promise<RealmScan> {
  const records: RawEntityRecord[] = [];
  const diagnostics: ScanDiagnostic[] = [];
  const projectsRoot = path.join(realmRoot, FRAME_DIR, PROJECTS_DIR);

  const read = async (absPath: string, kind: RawEntityKind): Promise<void> => {
    const rel = path.relative(realmRoot, absPath);
    try {
      const { data } = parseFrontmatter(await fs.readFile(absPath, "utf-8"));
      records.push({ kind, file: rel, data });
    } catch (err) {
      diagnostics.push({ file: rel, error: err instanceof Error ? err.message : String(err) });
    }
  };

  for (const entry of await readdirSafe(projectsRoot)) {
    if (!entry.startsWith("PROJ-")) continue;
    const projectDir = path.join(projectsRoot, entry);

    // Project file is named after the id (no slug): the first two dash-segments.
    const idPart = entry.split("-").slice(0, 2).join("-");
    const projectFile = path.join(projectDir, `${idPart}${MD_EXT}`);
    if (await fileExists(projectFile)) await read(projectFile, "project");

    for (const spec of CHILD_SPECS) {
      const dir = path.join(projectDir, spec.subdir);
      for (const file of await readdirSafe(dir)) {
        if (!file.endsWith(MD_EXT) || !file.startsWith(spec.prefix)) continue;
        await read(path.join(dir, file), spec.kind);
      }
    }
  }

  return { records, diagnostics };
}
