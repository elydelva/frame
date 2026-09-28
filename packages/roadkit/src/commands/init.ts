import * as fs from "node:fs/promises";
import * as path from "node:path";
import { DEFAULT_CONFIG } from "@roadkit/core";
import {
  CONFIG_FILE,
  MD_EXT,
  REALM_MANIFEST_FILE,
  ROADKIT_DIR,
  STATE_FILE,
  TEMPLATES_DIR,
  readRealmFormat,
  writeRealmConfig,
  writeRealmFormat,
} from "@roadkit/fs";
import { GitCommandError, GitWorktreeAdapter } from "@roadkit/git";

const PROJECT_TEMPLATE = `---
id: "{{id}}"
title: "{{title}}"
status: planned
leads: []
author: "{{author}}"
---

# {{title}}

## Overview

<!-- What is this project about? -->
`;

const MILESTONE_TEMPLATE = `---
id: "{{id}}"
projectId: "{{projectId}}"
title: "{{title}}"
status: pending
order: 0
targetDate: ~
---

# {{title}}

<!-- Milestone scope and exit criteria -->
`;

const ISSUE_TEMPLATE = `---
id: "{{id}}"
projectId: "{{projectId}}"
milestoneId: ~
title: "{{title}}"
status: not-started
priority: none
estimate: ~
labels: []
parentId: ~
gates: []
rules: []
assignee: ~
branch: ~
author: "{{author}}"
---

<!-- Issue description -->
`;

const SPEC_TEMPLATE = `---
id: "{{id}}"
projectId: "{{projectId}}"
title: "{{title}}"
status: draft
tags: []
rules: []
author: "{{author}}"
---

# {{title}}

## Context

<!-- Why does this decision need to be made? -->

## Decision

<!-- What was decided? -->

## Consequences

<!-- What are the trade-offs? -->
`;

const TEMPLATES: Array<[string, string]> = [
  ["project", PROJECT_TEMPLATE],
  ["milestone", MILESTONE_TEMPLATE],
  ["issue", ISSUE_TEMPLATE],
  ["spec", SPEC_TEMPLATE],
];

const AGENTS_MD = `# Agent guide — roadkit (\`rkit\`)

roadkit is a local, git-versioned planning layer. Read the brief before you act,
work, then mark progress. State lives in \`.roadkit/\`; config in \`roadfig.yml\`.

## Identify yourself

Set these once so traces attribute you correctly:

\`\`\`sh
export ROADKIT_ACTOR="agent:claude"
export ROADKIT_ACTOR_TYPE="agent"
\`\`\`

## Loop

\`\`\`sh
rkit brief --json              # focus issue + rules + dependencies + next
rkit issue start ISSUE-XXXX    # rules are recorded as acknowledged
# ...do the work, honouring the rules in the brief...
\`\`\`

## Completing an issue

Don't assume you should mark the issue completed — finishing the *work* is not the
same as validating the *issue*. Run \`rkit issue complete ISSUE-XXXX --message "..."\`
only when you've been asked or authorised to. It mutates \`.roadkit/\`.

When you do complete, where the \`completed\` state lands depends on context:

- **On \`main\`:** never make a standalone commit just to record completion. Fold the
  \`complete\` mutation into the work commit — run \`complete\` *before* you commit, so
  code and \`.roadkit/\` state land together.
- **On a branch / PR:** no strong opinion. Either fold \`completed\` into the final
  commit, or add a separate completion commit — both are fine, as long as the issue
  reaches \`completed\` within the same PR that ships its code.

## Machine output

Every mutation accepts \`--json\` and returns the created/updated entity, so you
can chain calls. Reads (\`brief\`, \`next\`, \`context\`, \`history\`, \`project list\`)
accept \`--json\` too. On failure, \`--json\` prints \`{"error":{"code","message"}}\`
on stderr and exits non-zero.

## Rules vs lint

- **Rules** (frontmatter \`rules:\` with triggers like \`before_edit\`) are
  constraints for YOU to honour — \`rkit brief\` surfaces them grouped by trigger.
- **\`rkit lint\`** checks realm *structure* (ids, references, gate cycles, config),
  not rule triggers. It runs on pre-commit and blocks the commit on errors.
`;

const PRE_COMMIT_HOOK = `#!/bin/sh
# Installed by 'rkit init' — blocks commits that break realm integrity.
rkit lint
`;

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function runInit(realmRoot: string): Promise<void> {
  // Validate before creating or updating any realm files. A missing manifest is
  // legacy format 1 and is materialized below; an incompatible one fails closed.
  await readRealmFormat(realmRoot);
  await addWorktreeExclude(realmRoot);

  const roadkitDir = path.join(realmRoot, ROADKIT_DIR);
  const templatesDir = path.join(roadkitDir, TEMPLATES_DIR);

  await fs.mkdir(roadkitDir, { recursive: true });
  await fs.mkdir(templatesDir, { recursive: true });

  const manifestPath = path.join(roadkitDir, REALM_MANIFEST_FILE);
  if (!(await exists(manifestPath))) {
    await writeRealmFormat(realmRoot);
  }

  const stateFile = path.join(roadkitDir, STATE_FILE);
  if (!(await exists(stateFile))) {
    await fs.writeFile(
      stateFile,
      JSON.stringify({ project: 0, milestone: 0, issue: 0, spec: 0 }, null, 2),
      "utf-8"
    );
  }

  for (const [name, body] of TEMPLATES) {
    const file = path.join(templatesDir, `${name}${MD_EXT}`);
    if (!(await exists(file))) {
      await fs.writeFile(file, body, "utf-8");
    }
  }

  const configPath = path.join(realmRoot, CONFIG_FILE);
  if (await exists(configPath)) {
    console.log(`✓ ${CONFIG_FILE} already exists, skipping`);
  } else {
    await writeRealmConfig(realmRoot, DEFAULT_CONFIG);
  }

  await writeAgentsGuide(realmRoot);
  await installPreCommitHook(realmRoot);

  console.log(`✓ Initialized ${ROADKIT_DIR}/`);
  console.log(`  ${ROADKIT_DIR}/${REALM_MANIFEST_FILE}`);
  console.log(`  ${ROADKIT_DIR}/${STATE_FILE}`);
  for (const [name] of TEMPLATES) {
    console.log(`  ${ROADKIT_DIR}/${TEMPLATES_DIR}/${name}${MD_EXT}`);
  }
  console.log(`  ${CONFIG_FILE}`);
  console.log("");
  console.log('Next: rkit project new --title "My first project"');
}

async function addWorktreeExclude(realmRoot: string): Promise<void> {
  try {
    const commonDir = await new GitWorktreeAdapter(realmRoot).getCommonDir();
    const infoDir = path.join(commonDir, "info");
    const excludeFile = path.join(infoDir, "exclude");
    await fs.mkdir(infoDir, { recursive: true });
    const contents = await fs
      .readFile(excludeFile, "utf-8")
      .catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return "";
        throw error;
      });
    if (contents.split(/\r?\n/).some((line) => line.trim() === ".worktrees/")) return;
    await fs.writeFile(
      excludeFile,
      `${contents}${contents && !contents.endsWith("\n") ? "\n" : ""}.worktrees/\n`
    );
  } catch (error) {
    if (error instanceof GitCommandError) return;
    throw error;
  }
}

/** Scaffold the agent guide at the realm root, never overwriting an existing one. */
async function writeAgentsGuide(realmRoot: string): Promise<void> {
  const file = path.join(realmRoot, "AGENTS.md");
  if (await exists(file)) {
    console.log("✓ AGENTS.md already exists, skipping");
    return;
  }
  await fs.writeFile(file, AGENTS_MD, "utf-8");
  console.log("  AGENTS.md");
}

/**
 * Install a pre-commit hook running `rkit lint`, but only when this is a git
 * repo with no existing hook — never clobber a hook the user already wrote.
 */
async function installPreCommitHook(realmRoot: string): Promise<void> {
  let hooksDir: string;
  try {
    hooksDir = path.join(await new GitWorktreeAdapter(realmRoot).getCommonDir(), "hooks");
  } catch (error) {
    if (error instanceof GitCommandError) return;
    throw error;
  }

  const hookFile = path.join(hooksDir, "pre-commit");
  if (await exists(hookFile)) {
    console.log("• pre-commit hook exists — add `rkit lint` to enforce realm integrity");
    return;
  }
  await fs.mkdir(hooksDir, { recursive: true });
  await fs.writeFile(hookFile, PRE_COMMIT_HOOK, { mode: 0o755 });
  console.log("  .git/hooks/pre-commit (rkit lint)");
}
