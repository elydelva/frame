# ADRKit — Founding Paper

**v0.1** — Initial Vision Document
**v0.2** — File format revised: 2-file model
**v0.3** — File format revised: tasks/ + traces/ subdirs, rules inline in frontmatter, realm-scoped IDs
**v0.4** — .adrconfig introduced: user-defined types, templates as schema + scaffold, linter/formatter config
**v0.5** — Implementation stack decided, `.adrconfig` split, ID collision strategy, git hooks native, `adframe next` algorithm, rules enforcement model clarified

> *"Git tracks what changed. ADRKit tracks why."*

---

## Table of Contents

1. Vision
2. Core Concepts & Vocabulary
3. ADR Structure
4. Task System
5. Dependency & Hierarchy Model
6. Status Model
7. Versioning & History
8. Rules Engine (AI Rules)
9. Git Hooks
10. User Experience (UX)
11. Agent Experience (AX & AA)
12. TUI — Live Graph & Supervision
13. Sync Adapters
14. CLI Reference
15. File Format Spec
16. Project Bootstrap — This Paper as ADR-0000

Appendix A — Design Decisions & Non-goals
Appendix B — Naming
Appendix C — Implementation Stack

---

## 1. Vision

ADRKit is a decision-first, agent-native project management system that lives entirely inside a git repository.

Where git captures code history, ADRKit captures decision history — the reasoning, dependencies, status, and progression of every architectural choice made on a project. Where Linear or GitHub Projects live outside the codebase, ADRKit lives inside it, co-versioned with the code it describes.

The design premise: in an AI-assisted development world, agents need a structured, machine-readable, diff-friendly way to understand not just what the code does, but why it was built that way, what decisions are in progress, and what rules to follow before touching anything.

ADRKit is not a note-taking tool. It is a project state machine expressed as files.

It is to feature development what git is to code history.

---

## 2. Core Concepts & Vocabulary

ADRKit introduces its own vocabulary — inspired by ADR tradition but modernized.

| ADRKit Term | Classic Equivalent | Description |
|---|---|---|
| ADR | Epic / Decision Record | A bounded decision unit with full lifecycle |
| Task | Task / Step | An atomic unit of progress inside an ADR |
| Trace | Commit / Audit log | Time-stamped event on any entity |
| Ruleset | Runbook / AI instructions | Machine-readable constraints per ADR or global |
| Adapter | Integration | External sync bridge (Linear, GitHub, etc.) |
| Realm | Project / Workspace | The ADRKit root in a repository |
| Lineage | Dependency graph | The full ancestor/descendant tree of an ADR |
| Gate | Blocking condition | A task or ADR that must complete before another starts |

---

## 3. ADR Structure

Each ADR is a directory with a fixed layout: one root file, two optional subdirectories.

```
.adframe/
  ADR-0001-use-drizzle-as-orm/
    ADR-0001-use-drizzle-as-orm.md   # required — machine frontmatter + human body
    tasks/
      TASK-0001-evaluate-alternatives.md
      TASK-0002-write-schema-layer.md
      TASK-0003-migration-strategy.md
    traces/
      TRACE-0001-adr-created.md
      TRACE-0002-status-changed-to-in-progress.md
      TRACE-0003-agent-started-task-0002.md
```

The naming convention is explicit and global — IDs are realm-scoped, not ADR-scoped. `TASK-0024` means the 24th task across the entire realm, not the 24th task of this ADR. Same for traces. This makes cross-references unambiguous anywhere in the codebase.

**The rule for what goes where:**

- **Frontmatter** → anything a machine needs to read explicitly: IDs, dates, statuses, tags, relationships, sync state. Structured, typed, parseable.
- **Markdown body** → anything a human writes: rationale, options, decisions, notes, context. Freeform, no enforced structure, linted for formatting only.
- **Rules** → inline in the frontmatter of the ADR or of a specific task. Not a separate file.

### ADR-XXXX.md — frontmatter spec

```markdown
---
id: ADR-0001
title: Use Drizzle as ORM
status: in-progress
created_at: 2025-03-20T14:00:00Z
updated_at: 2025-03-21T09:10:00Z
author: ely
tags: [tech, database, backend]
phase: foundations

depends_on: [ADR-0000]
related_to: [ADR-0004]
conflicts_with: []
supersedes: ~
superseded_by: ~

adapters:
  linear:
    issue_id: LA-42
    synced_at: 2025-03-21T09:05:00Z
  github:
    issue_number: 17
    synced_at: 2025-03-21T09:05:00Z

rules:
  - trigger: before_edit
    instruction: >
      Read this ADR and all in-progress task rules before touching
      any file in scope. Do not proceed if a hard gate task is not completed.
  - trigger: before_complete
    instruction: >
      Verify all tasks are completed or explicitly skipped before
      marking this ADR as completed.
---

## Context

Why Drizzle? We need a type-safe ORM that works well with our Postgres setup,
doesn't abstract away SQL semantics, and integrates cleanly with our
`defineMappedTable` pattern already in use in `@justwant/db`.

## Options Considered

- **Prisma** — too opinionated, generated client is a black box
- **Kysely** — excellent query builder but no schema-level abstraction
- **Drizzle** — thin layer, full TypeScript inference, schema-as-code ✓

## Decision

Use Drizzle ORM with `drizzle-kit` for migrations.

## Consequences

- All table definitions live in `src/db/schema/`
- Migrations are committed alongside schema changes
- No raw SQL in application code
```

Rules live in the `rules:` array in the frontmatter — no separate file, no separate format. An ADR with no AI constraints simply omits the `rules:` key.

---

## 4. Task System

Tasks are the atomic units of progress inside an ADR. Each task is its own Markdown file inside the `tasks/` subdirectory of the ADR. Task IDs are realm-scoped and globally unique — `TASK-0024` is the 24th task ever created in the realm, regardless of which ADR it belongs to.

### TASK-XXXX.md — frontmatter spec

```markdown
---
id: TASK-0002
adr: ADR-0001
title: Write schema layer
status: in-progress
created_at: 2025-03-20T14:05:00Z
started_at: 2025-03-21T08:30:00Z
completed_at: ~
author: ely
assignee: ely
estimated_hours: 3

gates: []                    # TASK ids or ADR-XXXX/TASK-XXXX for cross-ADR gates

adapters:
  linear:
    issue_id: LA-43
    synced_at: 2025-03-21T09:05:00Z

rules:
  - trigger: before_edit
    instruction: >
      Use `defineMappedTable` from `@justwant/db`. Column names must be
      camelCase in TypeScript and snake_case in the database. No exceptions.
  - trigger: before_edit
    instruction: >
      Every table must have `createdAt` and `updatedAt` columns via Drizzle's
      built-in timestamp helpers. Do not hand-roll these.
  - trigger: before_complete
    instruction: >
      Verify the schema passes `drizzle-kit check` before marking this task done.
---

Notes, context, implementation details, links — all go here, in whatever
structure makes sense for this task. No enforced sections.
The linter will check formatting, not content.
```

Tasks have their own `rules:` array, scoped tightly to the work of that specific task. An agent working on `TASK-0002` loads the ADR-level rules first, then the task-level rules — they compose.

### Task statuses

| Status | Meaning |
|---|---|
| `not-started` | Defined but not yet begun |
| `in-progress` | Actively being worked on |
| `completed` | Done, verifiable |
| `abandoned` | Dropped — a trace must document why |
| `blocked` | Waiting on a gate to clear |
| `skipped` | Intentionally bypassed — requires justification in body |

---

## 5. Dependency & Hierarchy Model

ADRKit supports three levels of relationship between entities.

### Between ADRs

```
depends_on     →  hard gate. Downstream ADR cannot start until upstream is completed.
related_to     →  soft link. Informational. No blocking behavior.
conflicts_with →  signals mutual exclusion. ADRKit warns if both are in-progress simultaneously.
supersedes     →  marks an ADR as replacing another. Sets upstream status to superseded.
```

### Between Tasks (within an ADR)

```
gates: [TASK-0001, TASK-0002]  →  sequential gate. This task is blocked until all listed tasks are completed.
```

### Between Tasks (cross-ADR)

A task can gate on a task in another ADR:

```yaml
gates:
  - ADR-0001/TASK-0003
```

This enables fine-grained cross-ADR blocking without requiring the entire parent ADR to be complete.

### Lineage Graph

ADRKit builds a directed acyclic graph (DAG) from all dependency declarations. This graph is the backbone of the TUI visualization and all progress computation.

Cycles are a hard error — `adframe lint` catches them before they corrupt the graph.

---

## 6. Status Model

### ADR statuses

| Status | Meaning |
|---|---|
| `draft` | Being written, not yet actionable |
| `proposed` | Ready for review / acceptance |
| `accepted` | Approved, work can begin |
| `in-progress` | At least one task is in-progress |
| `completed` | All tasks completed |
| `abandoned` | Dropped mid-flight — reason required |
| `superseded` | Replaced by another ADR |
| `deferred` | Paused, to be revisited |

### Status transition rules

ADRKit enforces valid transitions. Invalid moves are blocked by the rules engine:

```
draft        → proposed | abandoned
proposed     → accepted | abandoned | draft (revision)
accepted     → in-progress | deferred | abandoned
in-progress  → completed | abandoned | deferred
completed    → superseded  (only via a new ADR declaring supersedes)
deferred     → accepted | abandoned
```

---

## 7. Versioning & History

### Trace system

Every state change on any entity (ADR or task) creates a new file in the `traces/` directory of the parent ADR. One event, one file. Traces are never modified after creation — they are the append-only audit log of the realm.

Trace IDs are realm-scoped and globally unique. `TRACE-0055` is the 55th trace ever emitted in the realm.

```markdown
---
id: TRACE-0003
adr: ADR-0001
task: TASK-0002
at: 2025-03-21T09:10:00Z
actor: agent:claude-sonnet-4-6
actor_type: agent
event: task_started
ref: TASK-0002
from: ~
to: in-progress
---

Starting Drizzle schema definitions for the `users`, `sessions`, and `campaigns`
tables. Following `defineMappedTable` pattern as specified in task rules.
```

The frontmatter carries the machine-readable event data. The body is optional free text — context, notes, reasoning. An agent logging a trace can write nothing in the body, or write a detailed explanation. Both are valid.

**Trace integrity:** ADRKit's linter verifies that trace files are never modified after creation, via hash comparison against git history. Any modification to an existing trace is a hard lint error.

### Event types

| Event | Triggered by |
|---|---|
| `adr_created` | `adframe new` |
| `adr_status_changed` | `adframe status set` |
| `task_created` | `adframe task add` |
| `task_started` | `adframe task start` |
| `task_completed` | `adframe task complete` |
| `task_abandoned` | `adframe task abandon` |
| `rules_acknowledged` | `adframe rules ack` |
| `note` | `adframe trace emit` (manual) |
| `synced` | any `adframe sync` call |

### Git integration

ADRKit is git-native. Every `adframe` command that mutates state auto-stages the affected files. The user commits at their own cadence — ADRKit never commits for you.

```bash
adframe task complete TASK-0002
# → updates status + completed_at in TASK-0002.md frontmatter
# → creates TRACE-XXXX.md in ADR-0001/traces/
# → git add .adframe/ADR-0001/ (auto-staged, not committed)
```

### Timeline query

```bash
adframe history ADR-0001              # all traces for this ADR
adframe history --since 2025-03-20   # traces since a date
adframe history --actor agent:claude  # all agent-generated changes
adframe history --global              # full project timeline (across all ADRs)
```

---

## 8. Rules Engine (AI Rules)

Rules are the primary feature for agent workflows. They live as a `rules:` array directly in the frontmatter of the entity they govern — an ADR, a task, or the global `.adrconfig`. No separate file, no separate format. Rules are part of the data.

### Global rules — `.adrconfig`

```yaml
rules:
  - id: RULE-G001
    trigger: before_edit
    instruction: >
      Before modifying any file in scope of an ADR, read that ADR's frontmatter
      and all in-progress task rules. Do not proceed if any hard gate task
      is not completed.

  - id: RULE-G002
    trigger: after_edit
    instruction: >
      After any file change in scope of an ADR, emit a trace via
      `adframe trace emit` identifying yourself as actor.

  - id: RULE-G003
    trigger: before_edit
    instruction: >
      Never touch files in scope of a status=abandoned ADR without
      explicit human confirmation via a superseding ADR.
```

### ADR-level rules — in `ADR-XXXX.md` frontmatter

```yaml
rules:
  - trigger: before_complete
    instruction: >
      All tasks must be completed or skipped before this ADR can be marked complete.
      Skipped tasks require a justification in their body.
```

### Task-level rules — in `TASK-XXXX.md` frontmatter

```yaml
rules:
  - trigger: before_edit
    instruction: >
      Use `defineMappedTable`. camelCase in TypeScript, snake_case in DB.
  - trigger: before_complete
    instruction: >
      Schema must pass `drizzle-kit check` before this task is marked complete.
```

### Rule composition

When an agent operates on a task, the applicable rules are loaded in order: global → ADR-level → task-level. They compose, they don't override each other.

```bash
adframe context --task TASK-0002
# → returns all applicable rules in order, ready to inject into agent context
```

### Rule format principles

- `trigger` is one of: `before_edit`, `after_edit`, `before_complete`, `after_complete`, `on_conflict`
- `instruction` is natural language prose — written for an agent to read, not execute
- `id` is optional at ADR/task level — required at global level for traceability
- Rules are versioned with their entity — they live in git alongside the decision they govern

### Enforcement model

Rules are **soft enforcement by design**. This is an explicit philosophical choice: an agent that bypasses the CLI and edits files directly cannot be stopped at the CLI level regardless of any hardcoded gate. The real enforcement layer is git hooks (see section 9).

The optional `adframe rules ack` command allows disciplined agents to emit a `rules_acknowledged` trace before acting, creating an auditable record that rules were consulted:

```bash
adframe rules ack \
  --task TASK-0002 \
  --trigger before_edit \
  --actor "agent:claude-sonnet-4-6"
# → emits TRACE with event: rules_acknowledged
# → non-blocking if absent, warning from linter on critical actions
```

This is not required. It is a signal — for agents that want to produce a clean audit trail, and for teams that want to query which agents acknowledged which rules before acting.

---

## 9. Git Hooks

ADRKit installs native git hooks into `.git/hooks/` when `adframe init` is run. No external dependency (no Husky, no Node runtime required at hook time). The hooks call `adframe` commands, which must be available in `PATH`.

This is the real enforcement layer of the rules engine. A hook cannot be bypassed by an agent editing files directly — it blocks the commit or push regardless of how the files were modified.

### Installed hooks

`adframe init` generates the following hooks:

**`pre-commit`** — runs before every commit that touches `.adframe/` files.

```bash
#!/bin/sh
# generated by adframe init — do not edit manually

# Run linter on staged .adframe/ changes
if git diff --cached --name-only | grep -q "^\.adframe/"; then
  adframe lint --staged
  if [ $? -ne 0 ]; then
    echo "[adframe] Commit blocked: realm integrity check failed."
    echo "         Run 'adframe lint' for details."
    exit 1
  fi
fi
```

What `adframe lint --staged` checks at pre-commit time:
- All modified frontmatter fields are valid (types, statuses, references)
- No existing trace file has been modified (L030)
- Status transitions are valid (L020)
- No dependency cycles introduced (L012)
- No ADR in `abandoned` status was modified without a `--human-confirmed` trace

**`commit-msg`** — checks that any commit touching `.adframe/` references a valid ADR ID.

```bash
#!/bin/sh
# generated by adframe init — do not edit manually

if git diff --cached --name-only | grep -q "^\.adframe/"; then
  if ! grep -qE "ADR-[0-9]{4}" "$1"; then
    echo "[adframe] Commit message must reference an ADR ID (e.g. ADR-0001)"
    echo "         when committing changes to .adframe/"
    exit 1
  fi
fi
```

**`pre-push`** — detects ID collisions before they reach the remote.

```bash
#!/bin/sh
# generated by adframe init — do not edit manually

adframe lint --check-collisions --remote origin
if [ $? -ne 0 ]; then
  echo "[adframe] Push blocked: ADR/TASK/TRACE ID collision detected."
  echo "         Run 'adframe renumber' to resolve, then re-commit."
  exit 1
fi
```

If `adframe renumber` is needed, it reassigns conflicting IDs sequentially (taking the max of local and remote counters) and updates all internal references atomically.

### Hook configuration

Hooks can be individually disabled or configured in `.adrconfig`:

```yaml
hooks:
  pre_commit:
    enabled: true
    lint_level: error        # error | warning | off
  commit_msg:
    enabled: true
    require_adr_ref: true
  pre_push:
    enabled: true
    check_collisions: true
```

### Reinstalling hooks

```bash
adframe hooks install     # (re)install all hooks
adframe hooks uninstall   # remove all adframe hooks
adframe hooks status      # show which hooks are installed and their config
```

---

## 10. User Experience (UX)

The human-facing experience of ADRKit is designed around three modes: write, navigate, and supervise.

### Write mode — CLI

Fast, opinionated, never asks twice.

```bash
# Initialize a realm
adframe init

# Create a new ADR interactively
adframe new
# → prompts: title, tags, phase, template
# → creates ADR-XXXX-slug/ directory with ADR-XXXX.md scaffold

# Create with flags (non-interactive, agent-friendly)
adframe new --title "Use Redis for session cache" --tags tech,infra --phase mvp

# Add a task
adframe task add ADR-0001 --title "Evaluate Redis vs Memcached" --est 2h

# Update status
adframe status set ADR-0001 in-progress
adframe task complete TASK-0024

# Declare a dependency
adframe link ADR-0002 --depends-on ADR-0001
adframe link ADR-0002 --related-to ADR-0003

# Open the ADR body in $EDITOR (frontmatter is CLI-managed)
adframe edit ADR-0001

# Lint the whole realm
adframe lint
```

### Navigate mode — CLI

Query and explore without a TUI.

```bash
adframe list                        # all ADRs with status
adframe list --status in-progress   # filter by status
adframe list --tag tech             # filter by tag
adframe show ADR-0001               # full ADR detail
adframe graph --text                # ASCII dependency graph
adframe progress                    # overall realm progress summary
adframe next                        # what to work on next (respects gates + priority)
```

### `adframe next` — algorithm

A task is **eligible** if all three conditions are met:
1. Its parent ADR status is `accepted` or `in-progress`
2. All entries in its `gates` list are `completed`
3. Its own status is `not-started` or `blocked`

Among eligible tasks, priority is determined by three successive criteria:

1. **Phase of the parent ADR** — in the order declared in `.adrconfig` (`foundations` before `mvp` before `beta` before `scale`). Work finishes phases before starting the next.
2. **DAG descendants count** — the number of other ADRs that transitively depend on the parent ADR. Tasks that unblock the most downstream work come first.
3. **Age** — `created_at` of the parent ADR, then `created_at` of the task. FIFO as a tiebreaker.

In plain terms: *work on what unblocks the most things, in the most urgent phase, in order of arrival.*

```bash
adframe next                        # top candidate
adframe next --count 5              # top 5 candidates with scores
adframe next --json                 # machine-readable output for agents
```

### Supervise mode — TUI

`adframe tui` launches a full-screen terminal interface (described in section 12).

### Templates

Types and templates are declared in `.adrconfig`. `adframe new` picks the right template automatically from the type — or the user overrides it.

```bash
adframe new --type feature          # uses adr/feature template
adframe new --type tech-choice      # uses adr/tech-choice template
adframe new                         # interactive: prompts for type, title, phase

adframe task add ADR-0001 --type research   # uses task/research template
adframe task add ADR-0001                   # interactive

adframe template list               # list all declared types + their templates
adframe template edit adr/feature   # open template in $EDITOR
```

Types are user-defined in `.adrconfig` — there are no hardcoded types in ADRKit. The built-in templates ship as defaults that `adframe init` copies into `.adframe/templates/`. Users modify or delete them freely.

---

## 11. Agent Experience (AX & AA)

ADRKit is built from the ground up to be operated by AI agents. The Agent Experience (AX) is the design of how an agent reads and interprets an ADR realm. The Agent Actions (AA) are the set of commands an agent is permitted to call.

### AX — How agents read a realm

Agents receive a structured context payload when entering an ADR realm. ADRKit provides this via:

```bash
adframe context                     # JSON dump of full realm state
adframe context --adr ADR-0001      # context scoped to one ADR
adframe context --active            # only in-progress ADRs + their rules
```

The context payload includes:

```json
{
  "realm": "kaampus",
  "current_adr": "ADR-0001",
  "status": "in-progress",
  "active_tasks": ["TASK-0002"],
  "blocked_tasks": ["TASK-0003"],
  "applicable_rules": ["RULE-G001", "RULE-G002"],
  "gates_pending": [],
  "next_recommended": "TASK-0002",
  "lineage": {
    "depends_on": ["ADR-0000"],
    "dependents": ["ADR-0003", "ADR-0005"]
  }
}
```

This payload is designed to be injected directly into an agent system prompt or tool call context.

### AA — Agent-permitted actions

Agents call ADRKit commands the same way humans do — via the CLI. There is no separate "agent API". The CLI is the API.

ADRKit distinguishes agent traces from human traces via the `--actor` flag:

```bash
adframe task complete TASK-0002 --actor "agent:claude-sonnet-4-6" --message "Schema layer written"
adframe trace emit --adr ADR-0001 --event code_written --actor "agent:claude" --message "Wrote 3 Drizzle schemas"
adframe status set ADR-0001 completed --actor "agent:claude"
adframe rules ack --task TASK-0002 --trigger before_edit --actor "agent:claude"
```

The audit log always distinguishes who (or what) made a change.

### AA — Agent safety model

Some actions require a `--human-confirmed` flag to proceed. This prevents runaway agents from making structural changes without explicit human approval:

```bash
# These require --human-confirmed:
adframe status set ADR-0001 abandoned --human-confirmed
adframe link ADR-0002 --conflicts-with ADR-0001 --human-confirmed
adframe new --human-confirmed   # agents can propose, humans confirm creation
```

Without `--human-confirmed`, the command dry-runs and prints what it would do, returning a non-zero exit code. This is the default safe mode for agents.

The second enforcement layer — below the CLI — is the git hooks (section 9). Even an agent that edits `.adframe/` files directly without going through the CLI will be blocked at commit time by `pre-commit`, which runs `adframe lint --staged` regardless of how the files were modified.

### AA — Agent workflow pattern

A well-behaved agent operating in an ADRKit realm follows this loop:

```
1. adframe context --active             # load current state + rules
2. Read applicable_rules               # inject into system prompt
3. adframe rules ack --trigger before_edit --actor agent:X  # optional but recommended
4. adframe next                         # determine what to work on
5. Do the work (edit files, etc.)
6. adframe trace emit [...]             # log what was done
7. adframe task complete [...] --actor agent:X   # advance state if done
8. adframe lint                         # verify realm integrity
9. git add .adframe/ && git status      # surface changes to human
```

---

## 12. TUI — Live Graph & Supervision

`adframe tui` launches a full-screen terminal UI built with **Ink** (React for the terminal, Node.js). Ink was chosen as the v1 foundation because it is proven at scale — Claude Code was originally built on Ink before migrating to a custom renderer, and the component model it establishes (React/JSX, declarative state) is the right architectural foundation regardless of the rendering backend.

If ADRKit's TUI evolves toward long-running interactive sessions with continuous streaming updates, a custom renderer (following the Claude Code or OpenTUI/Zig pattern) can replace the Ink renderer without changing the component model. This is explicitly a v2 concern.

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ ADRKit — kaampus                          [q] quit  [?] help    │
├──────────────────────────┬──────────────────────────────────────┤
│ REALM PROGRESS           │ DEPENDENCY GRAPH                     │
│                          │                                      │
│ ████████░░░░░░ 57%       │  ADR-0000 ──✓──→ ADR-0001           │
│                          │                    │                  │
│ Foundations  ████ 80%    │                    ├──→ ADR-0003     │
│ MVP          ██░░ 30%    │                    └──→ ADR-0005     │
│ Beta         ░░░░  0%    │                                      │
│                          │  ADR-0002 ────────→ ADR-0004        │
│ ACTIVE ADRs (3)          │                                      │
│ ● ADR-0001  in-progress  │ [live — updates on file change]      │
│ ● ADR-0002  in-progress  │                                      │
│ ● ADR-0007  blocked      ├──────────────────────────────────────┤
│                          │ SELECTED: ADR-0001                   │
│ RECENT TRACES            │ Use Drizzle as ORM                   │
│ 09:10 agent: TASK-0002   │                                      │
│ 09:05 sync: linear LA-42 │ TASK-0001 ✓ Evaluate alternatives   │
│ 08:30 ely: TASK-0002 start│ TASK-0002 ● Writing schema layer   │
│                          │ TASK-0003 ○ Migration strategy [GATE]│
└──────────────────────────┴──────────────────────────────────────┘
```

### TUI features

- **Live file watch** — updates in real time as `.md` files change on disk
- **Dependency graph** — ASCII DAG, navigable with arrow keys, nodes colored by status
- **Progress bars** — per-phase and per-tag breakdowns
- **Trace feed** — live stream of recent events (human + agent, color-coded)
- **ADR detail pane** — shows selected ADR's tasks, status, and rules summary
- **Keyboard shortcuts** — `n` new ADR, `e` edit selected, `s` set status, `l` run lint, `a` show adapter sync status, `?` help overlay

---

## 13. Sync Adapters

ADRKit syncs with external tools via adapters. Adapters are thin bridges that delegate authentication entirely to the target tool's own CLI — ADRKit never touches credentials.

**Design principle:** If the user has `gh auth login` done, the GitHub adapter works. If `linear` CLI is authenticated, the Linear adapter works. ADRKit is a passenger, not a driver.

### Adapter configuration

```yaml
# .adrconfig
adapters:
  linear:
    enabled: true
    team: LA
    default_project: "Kaampus Roadmap"
    sync_direction: bidirectional   # push | pull | bidirectional
    field_map:
      adr_status:
        draft: "Backlog"
        proposed: "Todo"
        in-progress: "In Progress"
        completed: "Done"
        abandoned: "Cancelled"
      task_status:
        not-started: "Todo"
        in-progress: "In Progress"
        completed: "Done"
        blocked: "Blocked"

  github:
    enabled: true
    repo: elydelva/kaampus
    sync_direction: push
    use: issues        # issues | projects | both
    label_prefix: "adr:"
    field_map:
      adr_status:
        in-progress: "in progress"
        completed: "closed"
```

### Linear adapter

```bash
adframe sync linear                          # sync all
adframe sync linear --adr ADR-0001           # sync one ADR
adframe sync linear --pull                   # pull status changes from Linear → ADRKit
adframe sync linear --push                   # push ADRKit state → Linear
```

**What syncs:**

| ADRKit entity | Linear entity |
|---|---|
| ADR | Issue |
| ADR title | Issue title |
| ADR status | Issue status (via field_map) |
| ADR tags | Issue labels |
| ADR phase | Issue project/cycle |
| Task | Sub-issue or checklist item |
| Trace | Issue comment (agent traces auto-tagged) |

**Conflict resolution:** Linear is never the source of truth for ADR content — only for status and assignment. If a status changes in Linear, the pull sync updates the ADR's frontmatter and emits a trace with `source: linear`.

### GitHub adapter

```bash
adframe sync github
adframe sync github --adr ADR-0001
adframe sync github --use projects
```

**What syncs:**

| ADRKit entity | GitHub entity |
|---|---|
| ADR | Issue |
| ADR title | Issue title |
| ADR status | Issue state + label |
| ADR tags | Labels |
| Task | Checklist item in issue body |
| Trace | Issue comment |

### Adapter CLI pattern

All adapters follow the same CLI pattern:

```bash
adframe sync <adapter>                   # sync everything
adframe sync <adapter> --adr <id>        # sync one
adframe sync <adapter> --dry-run         # preview changes
adframe sync <adapter> --pull            # pull only
adframe sync <adapter> --push            # push only
adframe sync <adapter> --status          # show last sync state per ADR
```

### Future adapters (not v1)

| Adapter | Delegate CLI |
|---|---|
| Jira | `jira` CLI |
| Notion | `notion` CLI / API |
| AFFiNE | AFFiNE MCP |
| Slack | `slack` CLI |

---

## 14. CLI Reference

### Top-level commands

```
adframe init                        Initialize a new realm in current directory
adframe new                         Create a new ADR (interactive or flags)
adframe edit <id>                   Open ADR body in $EDITOR
adframe show <id>                   Display ADR detail
adframe list                        List all ADRs
adframe status set <id> <status>    Update ADR status
adframe link <id> [--depends-on|--related-to|--conflicts-with] <id2>
adframe lint                        Validate realm integrity
adframe context                     Export agent context as JSON
adframe next                        Show what to work on next
adframe history [id]                Show trace history
adframe graph                       Print ASCII dependency graph
adframe progress                    Print progress summary
adframe tui                         Launch TUI
adframe renumber                    Resolve ID collisions after a conflicting merge

adframe task add <adr>              Add a task to an ADR
adframe task start <task>           Mark task as in-progress
adframe task complete <task>        Mark task as completed
adframe task abandon <task>         Mark task as abandoned
adframe task show <task>            Show task detail

adframe trace emit                  Emit a manual trace event
adframe rules ack                   Emit a rules_acknowledged trace (agent use)

adframe template list               List templates
adframe template add <name>         Create a new template

adframe hooks install               Install git hooks into .git/hooks/
adframe hooks uninstall             Remove adframe git hooks
adframe hooks status                Show hook installation state

adframe sync <adapter>              Sync with external adapter
adframe sync --status               Show all adapter sync states

adframe version                     Print version
adframe help                        Help
```

### Global flags

```
--actor <id>           Identify the actor (default: git user)
--human-confirmed      Confirm a human-restricted action (agent safety)
--dry-run              Preview without mutating
--json                 Output as JSON (agent-friendly)
--quiet                No output except errors
--realm <path>         Point to a non-cwd realm
--staged               Lint only staged files (used by pre-commit hook)
```

---

## 15. File Format Spec

### Repository layout

```
my-project/
  .adrconfig                            # workspace config — linter, formatter, types, templates, adapters, hooks
  .gitattributes                        # merge driver declaration for .adframe/.state (generated by adframe init)
  .adframe/
    .state                              # counters — committed, managed by CLI, custom merge driver
    ADR-0001-use-drizzle-as-orm/
      ADR-0001-use-drizzle-as-orm.md
      tasks/
        TASK-0024-write-schema-layer.md
      traces/
        TRACE-0055-adr-created.md
    ADR-0002-setup-ci-pipeline/
      ...
    templates/
      adr/
        feature.md
        tech-choice.md
        ...
      task/
        implementation.md
        research.md
        ...
```

`.adrconfig` lives at the repository root alongside `package.json`, `biome.json` — it is a workspace-level config file. `.adframe/` is the data directory.

**ID scoping:** All IDs (`ADR-`, `TASK-`, `TRACE-`) are realm-scoped and globally sequential. Counters live in `.adframe/.state` and are incremented by the CLI on every create operation.

### `.adframe/.state` — counter file

The counter file is **committed to git** but uses a custom merge driver declared in `.gitattributes` (generated by `adframe init`). On merge conflict, the driver takes the `max()` of each counter from both sides — the result is always safe and never requires manual resolution.

```yaml
# .adframe/.state
# managed by adframe — do not edit manually
adr: 7
task: 31
trace: 88
```

```
# .gitattributes (generated by adframe init)
.adframe/.state merge=adframe-state
```

```
# .git/config (generated by adframe init — local only, not committed)
[merge "adframe-state"]
    name = ADRKit state merger
    driver = adframe merge-state %O %A %B
```

### `.adrconfig` — full spec

`.adrconfig` is a YAML file at the repository root. It is the single source of truth for static configuration: types, templates, linter, formatter, global AI rules, adapter config, and hook config. It does **not** contain counters (those are in `.adframe/.state`).

```yaml
# .adrconfig
version: 1
realm: kaampus

# --- ID format ---
id_format:
  adr: "ADR-%04d"
  task: "TASK-%04d"
  trace: "TRACE-%04d"

# --- Defaults ---
defaults:
  author: ely
  adr_type: feature
  task_type: implementation

# --- ADR types ---
adr_types:
  feature:
    label: Feature
    description: Shipping a new product capability
    template: adr/feature
    default_phase: mvp
    default_tags: [tech, gtm]
  tech-choice:
    label: Tech Choice
    description: Selecting a technology, library or tool
    template: adr/tech-choice
    default_phase: foundations
    default_tags: [tech]
  migration:
    label: Migration
    description: Migrating from one system or approach to another
    template: adr/migration
    default_tags: [tech, infra]
  bug:
    label: Bug
    description: Documenting a significant bug resolution decision
    template: adr/bug
    default_tags: [tech]
  infra:
    label: Infrastructure
    description: Infrastructure, DevOps, deployment decisions
    template: adr/infra
    default_tags: [infra]
  security:
    label: Security
    description: Security, auth, compliance decisions
    template: adr/security
    default_tags: [tech, exec]
  exec:
    label: Executive
    description: Business, legal, or organisational decisions
    template: adr/exec
    default_tags: [exec]

# --- Task types ---
task_types:
  implementation:
    label: Implementation
    template: task/implementation
  research:
    label: Research
    description: Investigation or spike before committing to a direction
    template: task/research
  review:
    label: Review
    template: task/review
  test:
    label: Test
    template: task/test
  bug-fix:
    label: Bug Fix
    template: task/bug-fix
  doc:
    label: Documentation
    template: task/doc

# --- Phases (user-defined, ordered) ---
phases:
  - foundations
  - mvp
  - beta
  - scale

# --- Tags (user-defined) ---
tags: [tech, gtm, exec, legal, infra, ux]

# --- Formatter ---
fmt:
  frontmatter_field_order:
    adr: [id, type, title, status, phase, tags, author, created_at, updated_at,
          depends_on, related_to, conflicts_with, supersedes, superseded_by,
          adapters, rules]
    task: [id, type, adr, title, status, author, assignee, created_at,
           started_at, completed_at, estimated_hours, gates, adapters, rules]
    trace: [id, adr, task, at, actor, actor_type, event, ref, from, to]
  trailing_newline: true
  max_blank_lines: 1

# --- Linter ---
lint:
  rules:
    - id: L001
      name: required-fields
      level: error
      description: All required frontmatter fields for the entity type must be present

    - id: L002
      name: valid-status
      level: error
      description: Status must be a valid value for the entity type

    - id: L003
      name: valid-type
      level: error
      description: Type must be declared in adr_types or task_types

    - id: L004
      name: valid-phase
      level: warning
      description: Phase must be declared in phases list

    - id: L005
      name: valid-tags
      level: warning
      description: Tags must be declared in tags list

    - id: L010
      name: valid-depends-on
      level: error
      description: All ADR ids in depends_on must exist in the realm

    - id: L011
      name: valid-gates
      level: error
      description: All task ids in gates must exist in the realm

    - id: L012
      name: no-dependency-cycles
      level: error
      description: Dependency graph must be a DAG — no cycles allowed

    - id: L013
      name: no-conflict-with-completed
      level: warning
      description: conflicts_with targeting a completed ADR is informational noise

    - id: L020
      name: valid-transition
      level: error
      description: Status changes must follow the declared transition model

    - id: L021
      name: abandoned-requires-trace
      level: error
      description: Any entity set to abandoned must have a trace with event=abandoned

    - id: L030
      name: trace-immutable
      level: error
      description: Existing trace files must not be modified (checked against git history)

    - id: L031
      name: trace-valid-event
      level: error
      description: event must be a known event type

    - id: L040
      name: rule-valid-trigger
      level: error
      description: trigger must be one of the known trigger values

    - id: L050
      name: required-body-sections
      level: warning
      description: Body must contain all sections declared as required in the entity's template

    - id: L051
      name: heading-hierarchy
      level: warning
      description: Body headings must follow a valid hierarchy (no h4 without h3, etc.)

# --- Git hooks ---
hooks:
  pre_commit:
    enabled: true
    lint_level: error
  commit_msg:
    enabled: true
    require_adr_ref: true
  pre_push:
    enabled: true
    check_collisions: true

# --- Adapters ---
adapters:
  linear:
    enabled: false
  github:
    enabled: false

# --- Global AI rules ---
rules:
  - id: RULE-G001
    trigger: before_edit
    instruction: >
      Before modifying any file in scope of an ADR, read that ADR's frontmatter
      and all in-progress task rules. Do not proceed if any hard gate task
      is not completed.
  - id: RULE-G002
    trigger: after_edit
    instruction: >
      After any file change in scope of an ADR, emit a trace via
      `adframe trace emit` identifying yourself as actor.
  - id: RULE-G003
    trigger: before_edit
    instruction: >
      Never touch files in scope of a status=abandoned ADR without
      explicit human confirmation via a superseding ADR.
```

### Templates

Templates live in `.adframe/templates/` and are referenced by name from `.adrconfig`. Each template is a Markdown file whose frontmatter declares the schema for that type, and whose body is the scaffold inserted by `adframe new`.

```markdown
---
# .adframe/templates/adr/tech-choice.md
schema:
  required: [id, type, title, status, phase, tags, author, created_at]
  optional: [depends_on, related_to, conflicts_with, supersedes, adapters, rules]
  defaults:
    status: draft
    phase: foundations

body_sections:
  required: [Context, Options Considered, Decision, Consequences]
  optional: [Background, References]
---

## Context

<!-- Why does this decision need to be made? What forces are at play? -->

## Options Considered

<!-- List evaluated alternatives with their tradeoffs. -->

## Decision

<!-- What was chosen and why. -->

## Consequences

<!-- Known tradeoffs, follow-up actions, things to monitor. -->
```

```markdown
---
# .adframe/templates/task/research.md
schema:
  required: [id, type, adr, title, status, author, created_at]
  optional: [assignee, estimated_hours, gates, rules]
  defaults:
    status: not-started

body_sections:
  required: [Goal, Findings]
  optional: [References]
---

## Goal

<!-- What question does this research task answer? -->

## Findings

<!-- Fill in as the investigation progresses. -->
```

### Frontmatter field reference

**ADR system fields** (always present, managed by CLI): `id`, `type`, `title`, `status`, `created_at`, `updated_at`

**ADR user fields** (present based on template schema): `phase`, `tags`, `author`, `depends_on`, `related_to`, `conflicts_with`, `supersedes`, `superseded_by`, `adapters`, `rules`

**TASK system fields**: `id`, `type`, `adr`, `title`, `status`, `created_at`

**TASK user fields**: `assignee`, `started_at`, `completed_at`, `estimated_hours`, `gates`, `adapters`, `rules`

**TRACE system fields** (all managed by CLI, never edited manually): `id`, `adr`, `task`, `at`, `actor`, `actor_type`, `event`, `ref`, `from`, `to`

---

## 16. Project Bootstrap — This Paper as ADR-0000

This founding paper is, itself, the first ADR of the ADRKit project. Once the tool exists, it will be bootstrapped as:

```yaml
# .adframe/ADR-0000-adframe-founding-vision/ADR-0000-adframe-founding-vision.md
id: ADR-0000
title: ADRKit — Founding Vision
status: accepted
author: ely
created_at: 2025-03-25T00:00:00Z
tags: [exec, vision]
phase: foundations
```

With tasks:

| ID | Title | Status |
|---|---|---|
| TASK-0001 | Write founding paper | completed |
| TASK-0002 | Define file format v0.5 | completed |
| TASK-0003 | Implement core CLI (init, new, list, show) | not-started |
| TASK-0004 | Implement task system | not-started |
| TASK-0005 | Implement trace system | not-started |
| TASK-0006 | Implement rules engine (lint + context) | not-started |
| TASK-0007 | Implement git hooks (pre-commit, commit-msg, pre-push) | not-started |
| TASK-0008 | Implement TUI (Ink) | not-started |
| TASK-0009 | Implement Linear adapter | not-started |
| TASK-0010 | Implement GitHub adapter | not-started |
| TASK-0011 | Public release | not-started |

---

## Appendix A — Design Decisions & Non-goals

### What ADRKit is NOT

- Not a documentation generator (no static site output in v1)
- Not a code analyzer (it doesn't read your source)
- Not a task manager for humans (use Linear for that)
- Not opinionated about what decisions you record
- Not a replacement for git — it runs alongside it

### Why this file structure?

Flat-file ADRs (single `.md` per decision) break down when you need structured machine-readable frontmatter, task tracking, append-only traces, and per-entity rules — all without polluting the body prose. But the solution isn't to explode into 10+ files per ADR: that cognitive overhead is the exact problem this design avoids.

The directory-per-ADR model keeps each decision fully self-contained and independently diffable. Tasks and traces get their own files because they have independent lifecycles. Traces are append-only events that must never be co-located with mutable state.

Rules live in frontmatter rather than a separate file because they are data about the entity, not a separate document. An ADR without rules simply omits the key — no empty file left behind.

### Why `.adrconfig` and `.adframe/.state` are separate files

`.adrconfig` is modified rarely — when someone adds a new type, edits a linter rule, or changes a template. It changes in PRs, by humans, intentionally. `.adframe/.state` is modified on every `adframe new` — it is high-frequency, automated, and structurally trivial (three integers). Co-locating them in a single file would cause git conflicts on counters every time two branches create any entity, regardless of whether the actual configuration changed. The split eliminates the noise entirely.

### Why a custom git merge driver for `.state`

A lockfile analogy applies: `bun.lock` is committed and occasionally has conflicts when two branches add dependencies simultaneously. `.adframe/.state` would have conflicts constantly if left to standard git merge — every feature branch creating an ADR would collide. The custom merge driver (`adframe merge-state`) resolves this by taking the `max()` of each counter from both sides. The result is always correct, always safe, and requires zero human intervention. This driver is configured by `adframe init` and declared in `.gitattributes`.

### Why YAML, not JSON?

Human-writable. Comments are valid. Multiline strings are readable. The agent also reads YAML fine. JSON is for output (`--json` flag).

### Why no database?

ADRKit's state is the files. A SQLite cache may be introduced later for query performance on large realms, but it is always derived from files and can be regenerated with `adframe rebuild-index`. The files are the truth.

### Why git hooks instead of Husky or a Node-specific solution?

ADRKit is not a Node project — it is a tool that installs into any git repository, regardless of the project's language or ecosystem. Native git hooks in `.git/hooks/` work everywhere git does: Go projects, Python projects, monorepos, bare repositories. Husky is an excellent tool for Node projects that want to manage hooks declaratively in `package.json`, but it introduces a Node runtime dependency that ADRKit cannot assume. `adframe init` generates shell scripts — the only dependency is `adframe` itself being in `PATH`.

### Why soft enforcement for rules?

Rules are natural language prose intended for agents to read and reason about. Hard enforcement at the CLI level only protects against agents that go through the CLI — which are precisely the well-integrated agents least likely to misbehave. An agent that edits `.adframe/` files directly bypasses any CLI gate. The `pre-commit` hook, which runs `adframe lint --staged` regardless of how files were modified, is the actual enforcement layer. The CLI's soft model is therefore not a weakness — it is the right division of responsibility: CLI for ergonomics, hooks for enforcement.

### Why delegate auth to target CLIs?

ADRKit has no business storing credentials. The target tools already have battle-tested auth flows. If `gh` works, the GitHub adapter works. Full stop.

---

## Appendix B — Naming

The name ADRKit is intentional:

- **ADR** — roots it in the established Architecture Decision Records tradition
- **Kit** — signals tooling, not dogma. A kit is pragmatic, composable, yours to use how you need.

The command is `adframe` (lowercase, one word). Files live in `.adframe/`. There is no abbreviation.

---

## Appendix C — Implementation Stack

These are binding decisions, not preferences. They are documented here with the same rigor as any ADR because they constrain the entire implementation.

### CLI & TUI — TypeScript + Bun + Ink

**Why TypeScript over Go or Rust:** ADRKit's primary author comes from the Node ecosystem. With AI-assisted development as a first-class workflow, the bottleneck is not knowing library APIs from memory — it is reading, debugging, and maintaining the code. TypeScript is the right tradeoff: strong typing, familiar ecosystem, and zero context-switch cost.

**Why Bun over Node.js:** Bun operates at every level of the stack — runtime, package manager, test runner, bundler, and binary compiler. `bun build --compile` produces a standalone executable with no runtime dependency on the target machine, recovering the distribution advantage of Go without leaving the TypeScript ecosystem. Bun's Node.js compatibility layer means the entire npm ecosystem (including Ink) works without modification.

**Why Ink for the TUI:** Ink (React for the terminal) is the proven foundation for TypeScript-based CLI tools. Claude Code was originally built on Ink before migrating to a custom renderer for streaming performance requirements. OpenCode evaluated the same path and built OpenTUI (Zig + TypeScript bindings) for 60fps rendering. The component model Ink establishes — React/JSX, declarative state, composable components — is the right architecture regardless of the rendering backend.

ADRKit's TUI is a supervision tool, not a long-running streaming agent interface. File watching + DAG display + trace feed does not push Ink's limits. If it ever does, the migration path is documented: swap the rendering backend (as Claude Code did) while keeping the component model intact. This is explicitly a v2 concern.

**Distribution:** `npm install -g adframe` — or standalone binary via `bun build --compile`.

### Linter — TypeScript in v1, Rust path in v2

In v1, the linter (`@adframe/lint`) is implemented in TypeScript and integrated into the monorepo as a standard package. It implements the `ILinterAdapter` port defined in `@adframe/core`.

The linter is computationally distinct from the CLI — it parses N YAML files, constructs a DAG, detects cycles, verifies hash integrity against git history, and resolves cross-references. On large realms this workload can become significant. The `ILinterAdapter` interface is designed to allow a Rust subprocess (`adframe-lint`) to replace the TypeScript implementation in v2 without touching any other layer. This follows the established pattern of Biome, dprint, and oxc.

The v2 Rust path: `adframe-lint` published to crates.io, called via `Bun.spawn`, output consumed as JSON. The interface contract is identical — only the implementation changes.

### Summary

| Component | Language | v1 | v2 path |
|---|---|---|---|
| CLI | TypeScript + Bun | `npm install -g adframe` | — |
| TUI | Ink (React/TSX) | bundled with CLI | custom renderer if needed |
| Linter | TypeScript → Rust | `@adframe/lint` package | `adframe-lint` Rust subprocess |
| Git hooks | Shell scripts | generated by `adframe init` | — |

---

*ADRKit Founding Paper — v0.5*
*Author: ely*
*Status: accepted*
*This document supersedes v0.4. It is the current origin.*