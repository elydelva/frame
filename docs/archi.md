# Frame architecture

This guide describes the code currently in the repository. The earlier ADRKit
design documents are historical; they are not contracts for the current CLI.

## Workspace

Frame is a Bun and TypeScript monorepo. Five packages contain implementation:

| Package | Responsibility | Workspace dependencies |
| --- | --- | --- |
| `@frame/core` | Project, milestone, issue, spec and trace domain types; IDs, configuration types, state transitions, dependency ordering, repository ports, and use cases | none |
| `@frame/fs` | Markdown/frontmatter persistence, configuration and format manifests, state counters, codecs, and raw realm scanning | `@frame/core` |
| `@frame/git` | Git staging and Git worktree operations | `@frame/core` |
| `@frame/lint` | Structural validation of raw realm scans | `@frame/core` |
| `frame` | Published CLI, command handlers, dependency assembly, realm compatibility checks, and local worktree claims | `@frame/core`, `@frame/fs`, `@frame/git`, `@frame/lint` |

```mermaid
flowchart TB
  CLI[frame CLI] --> Core[@frame/core]
  CLI --> FS[@frame/fs]
  CLI --> Git[@frame/git]
  CLI --> Lint[@frame/lint]
  FS --> Core
  Git --> Core
  Lint --> Core
```

`core` has no workspace dependencies. The filesystem, Git, and lint packages
depend on its types and contracts. `frame` assembles the concrete modules and
coordinates CLI behavior. The workspace does not currently contain a TUI or
external synchronization package.

## Domain and application flow

The domain is project-rooted: a `Project` owns `Milestone`s, `Issue`s and
`Spec`s. Mutations produce `Trace` records. A gate records an issue dependency;
`DAGService` determines eligibility and ordering. `StateMachineService` checks
valid status transitions.

Use cases in `@frame/core` coordinate domain rules through
`IRealmRepository`. The filesystem adapter implements that repository and
persists entities beneath `.frame/projects/` as Markdown with YAML frontmatter.
`GitAdapter` stages repository changes where configured. The use cases remain
independent of the filesystem representation.

For example, `frame issue complete ISSUE-0001` is registered in the CLI,
assembled with the core use case and filesystem repository, validates gates
and status, writes the updated issue and trace, and stages those files. The
command layer formats human or JSON output.

## Raw validation seam

The normal entity parsers are intentionally defensive and can coerce or drop
malformed values. `scanRealmRaw` in `@frame/fs` instead returns frontmatter as
raw records plus parse diagnostics. The `RealmScan` contract is defined in
`@frame/core` and consumed by `LintEngine` in `@frame/lint`. That engine checks
IDs and filenames, statuses, references, duplicate IDs, dependency cycles,
priority, and labels. `frame lint` and `frame doctor` call it.

Keeping this scan separate from entity parsing lets validation report corrupt
source data instead of silently validating a normalized entity. The linter is
a real package with callers and a substantial implementation; its existence
is not just a workspace placeholder.

## Git worktrees

`GitWorktreeAdapter` wraps Git worktree operations. `frame` coordinates it with
the private `WorktreeClaimStore`, which stores claims in Git's common directory
so linked worktrees in the same clone can coordinate. Claims are local
execution state; project records and traces remain in the versioned `.frame`
realm. Releasing a claim does not delete a worktree or change issue status.

## Persistent data and compatibility

- `.frameconfig` stores configurable estimation, priority, and label settings.
- `.frame/manifest.json` declares the realm entity format version.
- `.frame/.state` stores ID counters.
- `.frame/projects/<project-id>-<slug>/` contains the project, issues,
  milestones, specs, and traces.

`frame` checks the manifest before loading configuration or entities. Missing
manifests are treated as the supported legacy format; unsupported formats fail
closed. Frame does not migrate formats automatically.

## Package and source entry points

- `packages/core/src/index.ts` is the public domain, port and use-case entry
  point.
- `packages/fs/src/index.ts` exports the filesystem repository, parsing,
  serialization, configuration, format and scan functions.
- `packages/git/src/index.ts` exports the Git adapters and command error.
- `packages/lint/src/index.ts` exports `LintEngine` and finding/report types.
- `apps/cli/src/cli.ts` registers commands; `container.ts` assembles
  dependencies; command handlers live under `commands/`.

Add a new workspace package only when it has a concrete responsibility and a
real interface used by the product. Future sync or TUI work should enter the
workspace with its implementation rather than an empty placeholder.
