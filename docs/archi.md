# Frame architecture

This guide describes the code currently in the repository and the two product
entry points: the `@frame/sdk` TypeScript API and the `frame` CLI.

## Workspace

The monorepo uses Bun workspaces for `packages/*` and `apps/*`.

| Location | Responsibility | Workspace dependencies |
| --- | --- | --- |
| `packages/core` | Domain entities, IDs, configuration types, state transitions, query and mutation use cases, repository ports, and domain errors | none |
| `packages/fs` | Filesystem repository, `.frameconfig`, realm format and state, templates, codecs, parsers, serializers, and raw realm scans | `@frame/core` |
| `packages/git` | Git staging and worktree adapters | `@frame/core` |
| `packages/lint` | Structural validation of raw realm scans | `@frame/core` |
| `packages/sdk` | Public `Frame` class, typed data API, lazy initialization, and default filesystem composition | `@frame/core`, `@frame/fs` |
| `apps/cli` | `frame` executable, command registration, terminal output and exit behavior, lint/doctor, Git and worktree coordination | `@frame/sdk`, `@frame/fs`, `@frame/git`, `@frame/lint` |

```mermaid
flowchart TB
  SDK[@frame/sdk] --> Core[@frame/core]
  SDK --> FS[@frame/fs]
  CLI[apps/cli: frame] --> SDK
  CLI --> FS
  CLI --> Git[@frame/git]
  CLI --> Lint[@frame/lint]
  FS --> Core
  Git --> Core
  Lint --> Core
```

`@frame/core` and `@frame/fs` are installable support dependencies for the
SDK. Integrations should build on `@frame/sdk`; the CLI is the other documented
product entry point. The CLI bundles its internal workspace implementation in
its Node-compatible executable artifact.

## SDK boundary

The normal integration opens a repository by path:

```ts
import { Frame } from "@frame/sdk";

const frame = new Frame({ root: "/path/to/repository" });
const issues = await frame.issues.list({ projectId: "PROJ-0001" });
```

The constructor is synchronous and has no filesystem side effects. On first
operation, the SDK checks the realm format, reads `.frameconfig`, and composes
`FsRealmRepository`. Consumers can instead pass an `IRealmRepository`; in that
case they can omit `root` and optionally inject configuration. SDK operations
are asynchronous and return domain entities or query results. Errors propagate
as exceptions; SDK methods never print or exit the process.

The API exposes project, milestone, issue, spec and trace reads and mutations,
plus `next`, `context`, `history`, `brief`, config access and explicit
`Frame.initialize({ root })`. Git worktree lifecycle and raw realm linting are
outside the SDK. `frame lint` and `frame doctor` use `scanRealmRaw` and
`LintEngine` in the CLI; `doctor --fix` also stays there.

## Domain and application flow

The domain is project-rooted: a `Project` owns `Milestone`s, `Issue`s and
`Spec`s. Mutations produce `Trace` records. A gate records an issue dependency;
`DAGService` determines eligibility and ordering. `StateMachineService` checks
valid status transitions.

Use cases in `@frame/core` coordinate domain rules through `IRealmRepository`.
The filesystem adapter implements that repository and stores entities beneath
`.frame/projects/` as Markdown with YAML frontmatter. `GitAdapter` stages
repository changes when the CLI composes it into `FsRealmRepository`. The SDK
uses the plain filesystem adapter by default; this keeps ordinary integrations
independent of Git staging.

## Raw validation seam

Normal entity parsers are intentionally defensive and can coerce or drop
malformed values. `scanRealmRaw` in `@frame/fs` returns raw frontmatter and
parse diagnostics. The `RealmScan` contract is in `@frame/core`; `LintEngine`
in `@frame/lint` checks IDs and filenames, statuses, references, duplicate IDs,
dependency cycles, priority and labels. `frame lint` and `frame doctor` compose
these packages locally. The SDK has no lint dependency or validation API.

## Git worktrees

`GitWorktreeAdapter` wraps Git worktree operations. The CLI coordinates it with
the private `WorktreeClaimStore`, which stores claims in Git's common directory
so linked worktrees in the same clone can coordinate. Claims are local
execution state; project records and traces remain in the versioned `.frame`
realm. Releasing a claim does not delete a worktree or change issue status.

## Persistent data and compatibility

- `.frameconfig` stores configurable estimation, priority and label settings.
- `.frame/manifest.json` declares the realm entity format version.
- `.frame/.state` stores ID counters.
- `.frame/projects/<project-id>-<slug>/` contains the project, issues,
  milestones, specs and traces.

The SDK checks the manifest before loading configuration or entities. The CLI
also checks compatibility during command composition. Missing manifests mean
the supported legacy format; unsupported formats fail closed. Frame does not
migrate formats automatically.

## Source entry points

- `packages/sdk/src/index.ts` exports `Frame` and public SDK types.
- `packages/core/src/index.ts` exports domain, ports and use cases for support
  package implementations.
- `packages/fs/src/index.ts` exports filesystem persistence and raw scanning.
- `packages/git/src/index.ts` exports Git adapters.
- `packages/lint/src/index.ts` exports `LintEngine` and its report types.
- `apps/cli/src/cli.ts` registers commands; `container.ts` composes the SDK,
  Git-aware filesystem repository, config and CLI worktree metadata.

Add a workspace package only for a concrete responsibility with an interface
used by the product. Future sync or TUI work should enter with its implementation
rather than as an empty placeholder.
