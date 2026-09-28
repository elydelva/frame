# Issue Worktrees Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an agent atomically reserve a Frame issue, create an isolated branch/worktree, and discover or release that local claim safely.

**Architecture:** Keep durable issue changes in the new task worktree and keep temporary claims in a versioned registry under Git's common directory. `@frame/git` owns Git worktree mechanics; the Frame application/CLI coordinates claims, issue start, and claim-aware reads without adding Git paths to core entities.

**Tech Stack:** TypeScript, Bun test runner, Node child processes and filesystem APIs, Git CLI, existing `@frame/core`, `@frame/fs`, and `@frame/git` packages.

**Spec:** [Issue worktrees and Frame format compatibility](../specs/2026-09-28-issue-worktrees-design.md)

## Global Constraints

- The repository remains the durable source of project state; local claims are not committed, synced, or treated as project history.
- Claims coordinate linked worktrees in one local clone and do not expire automatically.
- The default branch is `issue/<issueId>-<slugified-title>` and the default path is `<repository>/.worktrees/<issueId>`.
- The base defaults to the initiating worktree's current `HEAD`; the command does not fetch or silently choose a remote branch.
- The worktree path must be absent and ignored by Git before creation.
- The issue-start mutation targets the new worktree root; cleanup never force-removes a worktree or discards changes.
- Claim protocol version is independent from CLI package version and realm entity format version.

## Review Focus

- Two simultaneous claims for the same issue must have one winner — pin in Task 2.
- Branch/path conflicts and paths with incomplete ignore coverage must fail before filesystem creation — pin in Task 3.
- Issue start must stage only in the new worktree and never disturb the initiating checkout — pin in Task 3.
- Partial failure must preserve dirty work and avoid silent orphan claims — pin in Task 3.
- Stale claims and unsupported registry protocols must fail closed with explicit recovery — pin in Tasks 2 and 4.

---

### Task 1: Git worktree adapter

**Files:**
- Create: `packages/git/src/worktree.adapter.ts`
- Create: `packages/git/src/worktree.adapter.test.ts`
- Modify: `packages/git/src/index.ts`

**Interfaces:**
- Produces: `GitWorktreeAdapter(cwd: string)` with `getCommonDir(): Promise<string>`, `list(): Promise<GitWorktree[]>`, `add({ path, branch, base }: AddWorktreeInput): Promise<void>`, and `remove(path: string): Promise<void>`.
- `GitWorktree` contains `{ path: string; head: string | null; branch: string | null; detached: boolean; locked: boolean; prunable: boolean }`.
- `list()` parses `git worktree list --porcelain`; `add()` runs `git worktree add -b <branch> <path> <base>`; `remove()` uses plain `git worktree remove <path>` with no force option.
- Git process errors retain command, exit code, and stderr; stdout is captured only where needed for parsing.

- [ ] **Step 1: Write adapter tests** using temporary initialized repositories for common-dir discovery, main and linked worktree listing, branch creation, clean removal, and rejection of dirty-worktree removal.
- [ ] **Step 2: Run `bun test packages/git/src/worktree.adapter.test.ts`** and verify the tests fail because the adapter does not exist.
- [ ] **Step 3: Implement `GitWorktreeAdapter`** with argument arrays passed to `spawn` (never shell interpolation) and porcelain parsing that handles detached and locked records.
- [ ] **Step 4: Run the focused adapter test** and verify all cases pass.
- [ ] **Step 5: Commit** `feat: add git worktree adapter`.

### Task 2: Atomic local claim registry

**Files:**
- Create: `packages/frame/src/worktrees/claim-store.ts`
- Create: `packages/frame/src/worktrees/claim-store.test.ts`
- Create: `packages/frame/src/worktrees/types.ts`

**Interfaces:**
- Produces: `WorktreeClaim = { protocolVersion: 1; issueId: string; actor: string; branch: string; path: string; createdAt: string }`.
- Produces: `WorktreeClaimEntry = { issueId: string; path: string; claim: WorktreeClaim | null; error: ClaimStoreErrorInfo | null }`; `list()` preserves malformed and unsupported claim files as error entries so read commands cannot mistake them for free issues.
- Produces: `WorktreeClaimStore(commonDir: string)` with `list(): Promise<WorktreeClaimEntry[]>`, `get(issueId: string): Promise<WorktreeClaim | null>`, `claim(input: Omit<WorktreeClaim, "protocolVersion" | "createdAt">): Promise<WorktreeClaim>`, and `release(issueId: string): Promise<WorktreeClaim>`.
- Store claims at `<commonDir>/frame/claims/<issueId>.json`. Claim creation uses exclusive file creation; duplicate issue claims raise `IssueAlreadyClaimedError` containing the current claim. Malformed or unsupported protocol data raises `ClaimStoreError` and is never overwritten.
- Release only removes a claim file and returns the removed record; lifecycle safety checks are done by CLI orchestration.

- [ ] **Step 1: Write claim-store tests** for create/read/list/release, duplicate contention from concurrent `claim()` calls, malformed and unsupported protocol entries preserved by `list`, malformed/unsupported data rejected by `get` and mutation operations, and unrelated issue claims remaining untouched.
- [ ] **Step 2: Run `bun test packages/frame/src/worktrees/claim-store.test.ts`** and verify it fails before implementation.
- [ ] **Step 3: Implement the file-backed store** with atomic exclusive creation, per-issue filenames, stable JSON shape, and typed errors.
- [ ] **Step 4: Run the focused claim-store tests** and verify exactly one concurrent claimant succeeds.
- [ ] **Step 5: Commit** `feat: add atomic worktree claims`.

### Task 3: Claim, create, and start issue workflow

**Files:**
- Create: `packages/frame/src/commands/issue/worktree.ts`
- Create: `packages/frame/src/commands/issue/worktree.test.ts`
- Modify: `packages/frame/src/container.ts`
- Modify: `packages/frame/src/cli.ts`
- Modify: `packages/frame/src/commands/init.ts`
- Modify: `packages/frame/src/commands/commands.test.ts`

**Interfaces:**
- Consumes: `GitWorktreeAdapter` from Task 1, `WorktreeClaimStore` from Task 2, and `assertRealmCompatible` from the format plan.
- Produces: `runIssueWorktree(container, id, options)` and CLI command `frame issue worktree <issueId> [--assignee] [--branch] [--path] [--base] [--json] [actor options]`.
- Container exposes `worktrees: GitWorktreeAdapter`, `claims: WorktreeClaimStore`, and `repoRoot: string`; keep existing `realmRoot` semantics for `FRAME_ROOT`.
- `runIssueWorktree` constructs a second container rooted at the new worktree path and calls the existing issue-start command/use case with that container; it does not mutate process-wide `FRAME_ROOT`.
- Branch default is `issue/${issueId}-${slugify(issue.title)}`; path default is `<repoRoot>/.worktrees/<issueId>`; assignee default is `resolveActor(opts).actor`; base default is current `HEAD`.
- `frame init` appends `.worktrees/` once to the Git common directory's `info/exclude`, preserving all existing lines and doing nothing outside a Git repository.

- [ ] **Step 1: Write command tests** for successful creation, actor-derived assignee, explicit overrides, current-HEAD base, invalid issue state, branch/path collision, non-ignored path, and initiating-checkout status/index remaining unchanged.
- [ ] **Step 2: Add failure-path tests** proving a clean newly created worktree is removed and its claim released after start failure, while a dirty worktree and claim are preserved with a recovery path.
- [ ] **Step 3: Run `bun test packages/frame/src/commands/issue/worktree.test.ts`** and verify the workflow tests fail before implementation.
- [ ] **Step 4: Wire adapters through `createContainer`** using `repoRoot` resolved from the current repository, independent of an explicit `FRAME_ROOT` realm override.
- [ ] **Step 5: Implement `runIssueWorktree`** in the specified order: compatible-realm check, issue eligibility, atomic claim, branch/path/ignore validation, Git worktree creation, then issue start using the new worktree as `FRAME_ROOT`.
- [ ] **Step 6: Implement conservative compensation**: release the claim and remove only a clean worktree created by this invocation; if safety cannot be established, retain both and report exact recovery paths.
- [ ] **Step 7: Register the CLI command and make `init` add the local exclude rule idempotently**; preserve JSON error output and emit issue/claim/path/branch in JSON success output.
- [ ] **Step 8: Run focused worktree and command tests** and verify a successful command leaves the initiating checkout's tracked files and index unchanged.
- [ ] **Step 9: Commit** `feat: start issues in git worktrees`.

### Task 4: List, release, and stale-claim recovery

**Files:**
- Create: `packages/frame/src/commands/worktree.ts`
- Create: `packages/frame/src/commands/worktree.test.ts`
- Create: `packages/frame/src/commands/issue/release.ts`
- Modify: `packages/frame/src/cli.ts`

**Interfaces:**
- Consumes: `GitWorktreeAdapter` and `WorktreeClaimStore` from Tasks 1–3.
- Produces: `frame worktree list [--json]` and `frame issue release <issueId> [--json] [actor options]`.
- `list` returns `{ claims: Array<WorktreeClaim & { state: "active" | "stale" }>; errors: ClaimStoreErrorInfo[] }`; a valid claim is stale when its path is absent or its branch is no longer registered. Error entries retain the issue ID parsed from the claim filename.
- `release` is an explicit operation that removes the selected local claim only, whether active or stale. It never removes the worktree or changes issue status.

- [ ] **Step 1: Write command tests** for active/stale listing, unsupported protocol reporting, release of active and stale claims, and confirmation that releasing never removes a worktree or changes issue status.
- [ ] **Step 2: Run the focused worktree command tests** and verify they fail before implementation.
- [ ] **Step 3: Implement list state by joining claims with `git worktree list`**; report malformed individual claims without rewriting or deleting them.
- [ ] **Step 4: Implement explicit release** so it removes only the selected claim record; it never removes files or worktrees.
- [ ] **Step 5: Register commands and verify human/JSON output** including enough path and actor information for recovery.
- [ ] **Step 6: Run focused list/release tests** and verify active worktree contents are unchanged after release.
- [ ] **Step 7: Commit** `feat: manage issue worktree claims`.

### Task 5: Make claims visible to issue selection and briefs

**Files:**
- Modify: `packages/core/src/use-cases/get-next/get-next.ts`
- Modify: `packages/core/src/use-cases/get-next/get-next.test.ts`
- Modify: `packages/frame/src/commands/next.ts`
- Modify: `packages/frame/src/commands/brief.ts`
- Modify: `packages/frame/src/commands/issue/list.ts`
- Modify: `packages/frame/src/commands/commands.test.ts`

**Interfaces:**
- Consumes: claim lookup/list from Task 2 and container wiring from Task 3.
- Produces: `GetNextUseCase.execute(options?: { excludedIssueIds?: ReadonlySet<string> }): Promise<NextResult | null>`; core receives only IDs and remains unaware of filesystem claims. Both valid claims and malformed claim filenames are excluded from `next` so an unreadable reservation cannot make an issue appear free.
- `frame next` obtains current-clone claim IDs and passes them as exclusions.
- `frame brief --issue <id>` includes a `claim` object or `null` in JSON and a human-readable actor/path section; default brief focus continues to use the claim-filtered next issue.
- `frame issue list` marks claimed issues with actor and worktree path in human and JSON output while preserving existing filters.

- [ ] **Step 1: Write core tests** asserting excluded IDs are skipped, other ordering is unchanged, and an empty exclusion set preserves existing results.
- [ ] **Step 2: Run `bun test packages/core/src/use-cases/get-next/get-next.test.ts`** and verify the exclusion test fails before implementation.
- [ ] **Step 3: Implement optional ID exclusions in `GetNextUseCase`** after DAG eligibility and before sorting.
- [ ] **Step 4: Write command tests** for claimed-issue omission from `next`, claim disclosure in explicit briefs, and claim columns/JSON properties in issue lists.
- [ ] **Step 5: Wire claim reads into `next`, `brief`, and `issue list`** without adding claim fields to core Issue or Brief domain entities.
- [ ] **Step 6: Run focused core and command tests** and verify existing priority ordering is unchanged for unclaimed issues.
- [ ] **Step 7: Commit** `feat: expose worktree claims to agents`.

### Task 6: Document the workflow and run integration gates

**Files:**
- Modify: `README.md`
- Modify: `packages/frame/README.md`
- Modify: `packages/frame/src/commands/init.ts` (generated `AGENTS.md` workflow text)

**Interfaces:**
- Consumes: the shipped CLI behavior from Tasks 3–5 and format handling from the format compatibility plan.
- Produces: the agent loop documentation with claim, `cd`, brief, completion, and release commands; explain local single-clone claim scope and explicit release semantics.

- [ ] **Step 1: Update the generated agent guide** to use `frame issue worktree`, then `cd`, then `frame brief --issue`; describe when to release.
- [ ] **Step 2: Update package/root README** with one concise example and document that claims are local to one clone.
- [ ] **Step 3: Run `bun run typecheck` and `bun run lint`** and fix issues in touched code.
- [ ] **Step 4: Run focused tests** for the format compatibility plan and `bun test packages/git/src/worktree.adapter.test.ts packages/frame/src/worktrees/claim-store.test.ts packages/frame/src/commands/issue/worktree.test.ts packages/frame/src/commands/worktree.test.ts packages/core/src/use-cases/get-next/get-next.test.ts packages/frame/src/commands/commands.test.ts`; verify all focused suites pass.
- [ ] **Step 5: Run `bun run build`** to verify package exports and dependency wiring.
- [ ] **Step 6: Commit** `docs: describe issue worktree workflow`.
