# Architecture

frame is a hexagonal architecture TypeScript monorepo (Bun workspaces). The published binary is `frame`.

## Package dependency rules

`@frame/core` has **zero** monorepo dependencies. All adapter packages depend only on core. The `frame` package (binary `frame`) is the **only** package allowed to import multiple packages — it is the sole DI wiring point.

```
packages/
├── core/     @frame/core   — domain entities, ports, services, use cases
├── fs/       @frame/fs     — IRealmRepository impl (YAML frontmatter via gray-matter)
├── git/      @frame/git    — IGitAdapter impl (git staging via Bun.spawn)
├── lint/     @frame/lint   — realm integrity engine (LintEngine, core-only, pure)
├── tui/      @frame/tui    — terminal UI via React/Ink (stub in v0.1)
├── sync/     @frame/sync   — Linear/GitHub adapters (stub in v0.1)
└── frame/  frame         — CLI entry point `frame` + dependency injection
```

## Core domain

The domain is **project-rooted**: a `Project` owns `Milestone`s, `Issue`s and `Spec`s. A `Spec` is the former ADR — now a decision document attached to a project rather than the root entity.

**Entities** (`packages/core/src/entities/`): `Project`, `Milestone`, `Issue`, `Spec`, `Trace`, `Rule` — created via factory functions (not classes).

**Value objects** (`packages/core/src/value-objects/`):
- IDs: `ProjectId` (PROJ-0001), `MilestoneId` (MILE-0001), `IssueId` (ISSUE-0001), `SpecId` (SPEC-0001), `TraceId` (TRACE-0001).
- Statuses: `ProjectStatus` (planned · active · paused · completed · cancelled), `MilestoneStatus` (pending · active · done), `IssueStatus` (not-started · in-progress · completed · abandoned · blocked · skipped), `SpecStatus` (draft · proposed · accepted · superseded · deferred · abandoned).
- `Priority` (`string`) — on issues. Levels are **fully customizable** via `.frameconfig` (`priority.levels`); the default set is urgent · high · medium · low · none.

**Config** (`packages/core/src/config/`): `RealmConfig` — the extensible realm configuration read from `.frameconfig`. Holds `estimation` (scale + default + optional `values` override), `priority` (custom `levels` + `default`), and a `labels` taxonomy. Pure helpers — `expandScale`, `resolveEstimate`, `formatEstimate`, `priorityRank`, `validatePriority` — live here with `DEFAULT_CONFIG`. All I/O stays in `@frame/fs` (`readRealmConfig` / `writeRealmConfig`).

**Services** (`packages/core/src/services/`):
- `StateMachineService` — enforces valid status transitions.
- `DAGService` — dependency graph, cycle detection, `next` sort ordering.

**Use cases** (`packages/core/src/use-cases/`): `CreateProjectUseCase`, `CreateMilestoneUseCase`, `CreateIssueUseCase`, `CreateSpecUseCase`, `StartIssueUseCase`, `CompleteIssueUseCase`, `SetProjectStatusUseCase`, `SetMilestoneStatusUseCase`, `SetSpecStatusUseCase`, `GetNextUseCase`, `GetContextUseCase`, `GetHistoryUseCase`, `GetBriefUseCase`.

**Ports** (`packages/core/src/ports/`):
- `IRealmRepository` — project/milestone/issue/spec CRUD (`saveProject`, `findMilestonesForProject`, `saveMilestone`, `findIssuesForProject`, `saveIssue`, `deleteIssue`, `findSpecsForProject`, `saveSpec`), trace append (`appendTrace`), plus ID counters. Saves are slug-stable: a title change renames the entity file and removes any stale-slug sibling claiming the same id (so duplicate-id files can't accumulate).
- `IGitAdapter` — `stage`, `isRepo`.

## File layout on disk

```
.frameconfig                                                # RealmConfig at repo root (estimation · priority · labels)
.frame/.state                                            # persistent counters
.frame/templates/                                        # entity templates
.frame/projects/PROJ-XXXX-slug/specs/SPEC-XXXX.md        # spec (YAML frontmatter + Markdown body)
.frame/projects/PROJ-XXXX-slug/milestones/MILE-XXXX.md
.frame/projects/PROJ-XXXX-slug/issues/ISSUE-XXXX.md
.frame/projects/PROJ-XXXX-slug/traces/TRACE-XXXX.md
```

## CLI surface

```
frame init
frame project new | list | status <id> <status> | start <id>
frame milestone new | list | status <id> <status> | start <id>
frame issue add | start <id> | complete <id> | status <id> <status>
frame issue edit <id> | retitle <id> | show <id> | list | rm <id>
frame issue gate add <id> <gate> | gate rm <id> <gate>
frame spec new | list | show <id> | status <id> <status>
frame next
frame context
frame history
frame brief    | --issue <id> · --project <id> · --json
frame lint     | --json (exit 1 on any error)
frame doctor   | --fix (repair duplicate-id files)
frame config get [key] | set <key> <value>
```

`issue edit` patches fields (`--title` renames the file, `--priority`, `--estimate`, `--milestone`, `--assignee`, `--branch`, `--parent`, `--labels`, `--gates`); clear a nullable field with `--no-<field>` (e.g. `--no-assignee`). `issue status` is the generic transition (block/skip/abandon/unblock); → `completed` still enforces gates. `issue list` filters by `--project/--status/--assignee/--milestone/--label/--branch/--priority`. `config set` is limited to `priority.default`, `estimation.scale`, `estimation.default`.

All mutation commands accept `--json` (returns the created/updated entity), plus `--actor` / `--actor-type <human|agent>` / `--message` for trace attribution (env: `FRAME_ACTOR`, `FRAME_ACTOR_TYPE`). Under `--json`, errors print `{"error":{"code","message"}}` on stderr and exit non-zero. `@frame/fs` exposes `scanRealmRaw` (strict frontmatter scan + diagnostics) consumed by `@frame/lint`; the `frame` CLI wires the two. The lint scan contract (`RealmScan`, `RawEntityRecord`) lives in `@frame/core`.

## Key domain concepts

- **Gates** — issue dependency; Issue A gates on Issue B means B must complete first. Cross-project syntax: `PROJ-0001/ISSUE-0003`.
- **Rules** — inline YAML frontmatter constraints (`before_edit`, `after_complete`, etc.) injected into agent system prompts.
- **Milestones / Priority** — used by `frame next` to prioritize work order. Priority ordering follows `priority.levels` in `.frameconfig` (index 0 = highest).
- **Estimation** — `.frameconfig` `estimation.scale` (none · linear · fibonacci · tshirt · exponential · hours) drives `--estimate <label|number>` resolution; estimates are stored as points and displayed as scale labels (e.g. `M`).
- **Labels** — shared taxonomy declared under `.frameconfig` `labels`.
- **Assignee / Branch** — optional free-form strings on an issue. `assignee` names the responsible person; `branch` names the git branch where the issue is implemented. Both settable via `--assignee` / `--branch` on `issue add | start | complete` (start/complete only overwrite when the flag is passed). Not validated by lint; multiple issues may share a branch.
- **Specs** — decision records attached to a project (the former ADR).
- **Traces** — immutable audit log entries, one file per mutation.
