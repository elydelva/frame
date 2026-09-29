import * as fs from "node:fs/promises";
import * as path from "node:path";
import { DEFAULT_CONFIG } from "@frame/core";
import { readRealmFormat, writeRealmFormat } from "./config/format-version.js";
import { writeRealmConfig } from "./config/realm-config.reader.js";
import {
  CONFIG_FILE,
  FRAME_DIR,
  MD_EXT,
  REALM_MANIFEST_FILE,
  STATE_FILE,
  TEMPLATES_DIR,
} from "./constants.js";

const TEMPLATES: Array<[string, string]> = [
  [
    "project",
    `---\nid: "{{id}}"\ntitle: "{{title}}"\nstatus: planned\nleads: []\nauthor: "{{author}}"\n---\n\n# {{title}}\n\n## Overview\n\n<!-- What is this project about? -->\n`,
  ],
  [
    "milestone",
    `---\nid: "{{id}}"\nprojectId: "{{projectId}}"\ntitle: "{{title}}"\nstatus: pending\norder: 0\ntargetDate: ~\n---\n\n# {{title}}\n\n<!-- Milestone scope and exit criteria -->\n`,
  ],
  [
    "issue",
    `---\nid: "{{id}}"\nprojectId: "{{projectId}}"\nmilestoneId: ~\ntitle: "{{title}}"\nstatus: not-started\npriority: none\nestimate: ~\nlabels: []\nparentId: ~\ngates: []\nrules: []\nassignee: ~\nbranch: ~\nauthor: "{{author}}"\n---\n\n<!-- Issue description -->\n`,
  ],
  [
    "spec",
    `---\nid: "{{id}}"\nprojectId: "{{projectId}}"\ntitle: "{{title}}"\nstatus: draft\ntags: []\nrules: []\nauthor: "{{author}}"\n---\n\n# {{title}}\n\n## Context\n\n<!-- Why does this decision need to be made? -->\n\n## Decision\n\n<!-- What was decided? -->\n\n## Consequences\n\n<!-- What are the trade-offs? -->\n`,
  ],
];

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

/** Create the filesystem-owned Frame realm files, preserving every existing file. */
export async function initializeRealm(root: string): Promise<void> {
  await readRealmFormat(root);
  const frameDir = path.join(root, FRAME_DIR);
  const templatesDir = path.join(frameDir, TEMPLATES_DIR);
  await fs.mkdir(templatesDir, { recursive: true });

  const manifest = path.join(frameDir, REALM_MANIFEST_FILE);
  if (!(await exists(manifest))) await writeRealmFormat(root);

  const stateFile = path.join(frameDir, STATE_FILE);
  if (!(await exists(stateFile))) {
    await fs.writeFile(
      stateFile,
      `${JSON.stringify({ project: 0, milestone: 0, issue: 0, spec: 0 }, null, 2)}\n`,
      "utf8"
    );
  }

  for (const [name, body] of TEMPLATES) {
    const template = path.join(templatesDir, `${name}${MD_EXT}`);
    if (!(await exists(template))) await fs.writeFile(template, body, "utf8");
  }

  const config = path.join(root, CONFIG_FILE);
  if (!(await exists(config))) await writeRealmConfig(root, DEFAULT_CONFIG);
}
