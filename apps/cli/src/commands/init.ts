import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  CONFIG_FILE,
  FRAME_DIR,
  MD_EXT,
  REALM_MANIFEST_FILE,
  STATE_FILE,
  TEMPLATES_DIR,
} from "@frame/fs";
import { GitCommandError, GitWorktreeAdapter } from "@frame/git";
import { Frame } from "@frame/sdk";

const TEMPLATE_NAMES = ["project", "milestone", "issue", "spec"];

const AGENTS_MD = `# Agent guide — frame (\`frame\`)

frame is a local, git-versioned planning layer. Read the brief before you act,
work, then mark progress. State lives in \`.frame/\`; config in \`.frameconfig\`.

## Identify yourself

Set these once so traces attribute you correctly:

\`\`\`sh
export FRAME_ACTOR="agent:claude"
export FRAME_ACTOR_TYPE="agent"
\`\`\`

## Loop

\`\`\`sh
frame next
frame issue worktree ISSUE-XXXX # claims, creates a branch and starts the issue
# Run the printed command: cd <path> && export FRAME_ROOT=<path>
frame brief --issue ISSUE-XXXX  # inspect rules + dependencies inside its worktree
# ...do the work, honouring the rules in the brief...
frame issue complete ISSUE-XXXX --message "..." # only when completion is authorized
frame issue release ISSUE-XXXX # after integration or intentional abandonment
\`\`\`

Claims are local to this Git clone and shared by its linked worktrees. Releasing
removes only the claim; it leaves the worktree and its files in place.
The printed command sets \`FRAME_ROOT\` to the task worktree so later commands
continue reading and writing the task branch even when that variable was set before.

## Completing an issue

Don't assume you should mark the issue completed — finishing the *work* is not the
same as validating the *issue*. Run \`frame issue complete ISSUE-XXXX --message "..."\`
only when you've been asked or authorised to. It mutates \`.frame/\`.

When you do complete, where the \`completed\` state lands depends on context:

- **On \`main\`:** never make a standalone commit just to record completion. Fold the
  \`complete\` mutation into the work commit — run \`complete\` *before* you commit, so
  code and \`.frame/\` state land together.
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
  constraints for YOU to honour — \`frame brief\` surfaces them grouped by trigger.
- **\`frame lint\`** checks realm *structure* (ids, references, gate cycles, config),
  not rule triggers. It runs on pre-commit and blocks the commit on errors.
`;

const PRE_COMMIT_HOOK = `#!/bin/sh
# Installed by 'frame init' — blocks commits that break realm integrity.
frame lint
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
  const configPath = path.join(realmRoot, CONFIG_FILE);
  const configExisted = await exists(configPath);
  await Frame.initialize({ root: realmRoot });
  await addWorktreeExclude(realmRoot);
  if (configExisted) {
    console.log(`✓ ${CONFIG_FILE} already exists, skipping`);
  }

  await writeAgentsGuide(realmRoot);
  await installPreCommitHook(realmRoot);

  console.log(`✓ Initialized ${FRAME_DIR}/`);
  console.log(`  ${FRAME_DIR}/${REALM_MANIFEST_FILE}`);
  console.log(`  ${FRAME_DIR}/${STATE_FILE}`);
  for (const name of TEMPLATE_NAMES) {
    console.log(`  ${FRAME_DIR}/${TEMPLATES_DIR}/${name}${MD_EXT}`);
  }
  console.log(`  ${CONFIG_FILE}`);
  console.log("");
  console.log('Next: frame project new --title "My first project"');
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
 * Install a pre-commit hook running `frame lint`, but only when this is a git
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
    console.log("• pre-commit hook exists — add `frame lint` to enforce realm integrity");
    return;
  }
  await fs.mkdir(hooksDir, { recursive: true });
  await fs.writeFile(hookFile, PRE_COMMIT_HOOK, { mode: 0o755 });
  console.log("  .git/hooks/pre-commit (frame lint)");
}
