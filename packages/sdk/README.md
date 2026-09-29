# `@frame/sdk`

The Frame SDK lets TypeScript applications read and update Frame realm data.
Linting remains a CLI capability provided by the `frame lint` command.

## Open a realm

```ts
import { Frame } from "@frame/sdk";

const frame = new Frame({ root: "/path/to/repository" });
const issues = await frame.issues.list({ projectId: "PROJ-0001", status: "not-started" });
```

Construction is synchronous and performs no filesystem access. The SDK checks
realm compatibility and reads `.frameconfig` asynchronously on first operation.
It uses the filesystem adapter by default and returns domain entities. Errors
are rejected as exceptions; the SDK does not print output or exit the process.

## Use a custom repository

```ts
import { Frame, type IRealmRepository } from "@frame/sdk";

declare const repository: IRealmRepository;
const frame = new Frame({ repository });
const project = await frame.projects.get("PROJ-0001");
```

An injected repository works without a filesystem root. Pass `config` to
override `DEFAULT_CONFIG`; without it, the SDK uses defaults. Config writes
require a `root` so the updated `.frameconfig` can be persisted.

## Data API

- `projects`, `milestones`, `issues`, `specs`, and `traces` expose typed list
  and detail reads.
- Entity namespaces expose create and status operations. Issues also support
  edit, delete, start, complete, status changes, gate changes, and
  `isEligibleToStart`.
- `next()`, `context()`, `history()`, and `brief()` expose existing Frame
  queries.
- `config.get()` reads settings; `config.set()` supports `priority.default`,
  `estimation.scale`, and `estimation.default`.
- `Frame.initialize({ root })` explicitly creates missing realm files and
  templates without installing Git hooks or writing an agent guide.

All operations are asynchronous. The SDK does not include realm linting,
terminal formatting, Git worktree coordination, or process exit behavior.
