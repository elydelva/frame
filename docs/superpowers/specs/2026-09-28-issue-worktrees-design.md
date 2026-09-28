# Issue worktrees and Frame format compatibility

**Status:** Design frozen for implementation planning
**Date:** 2026-09-28
**Scope:** Local, single-clone coordination of Frame issues with Git worktrees, plus explicit compatibility checks for Frame data formats.

## Intent

An agent should be able to claim an eligible Frame issue, receive an isolated Git worktree and branch, and continue from an issue brief without coordinating Git and issue state by hand. Multiple agents using linked worktrees in the same clone must not accidentally claim the same issue. Frame must also refuse to reinterpret project data when a CLI version does not understand its format.

The repository remains the durable source of project state: issue and trace files are versioned in Git. Work allocation is local execution state shared by linked worktrees, not a second versioned project database.

## Current constraints

- `frame issue start` updates the issue and its trace through the repository rooted at `FRAME_ROOT` or the current directory. The filesystem repository stages its mutations.
- `frame next` and the default focus in `frame brief` currently select issues from the versioned realm only.
- Issue records already have `assignee` and `branch` fields.
- `.frame/state.json` contains ID counters. `.frameconfig` has a configuration `version`, but no manifest declares the Markdown entity format version.
- The Git adapter currently supports staging and repository detection, not worktree lifecycle operations.

These constraints mean that marking an issue started in the initiating checkout would write its state to the wrong branch. The start mutation must target the newly created worktree.

## Chosen model

### Durable issue state and local claims

Frame has two related but distinct records:

1. **Durable issue state** remains in `.frame/` on the task branch. Starting the issue records its assignee, branch, status, and trace in that branch. Completion is recorded on that branch as part of the work's normal commit flow.
2. **Local claim state** lives under the Git common directory, outside all branch checkouts. It coordinates multiple linked worktrees in one clone. It is not committed, synced, or treated as project history.

A claim record contains a protocol version, issue ID, actor, branch, absolute worktree path, and creation time. Creating a claim must be atomic so concurrent agents cannot both acquire the same issue. Claims do not expire automatically: an idle agent cannot be distinguished safely from a slow one. Frame reports claims whose worktree or branch is missing as stale and requires an explicit release/recovery action.

This coordination is intentionally limited to linked worktrees in one local clone. Separate clones do not share claims; remote/team-wide distributed claiming is out of scope.

### Claim visibility

The claim registry supplements, but does not replace, branch-local issue data:

- `frame next` skips issues claimed in the current clone.
- `frame brief --issue <id>` identifies an existing claim and its worktree path so an agent can resume the right workspace.
- `frame issue list` exposes claim/assignee/worktree information when a claim exists.
- `frame worktree list` reports Frame claims alongside Git worktree state, including stale claims.

The core domain model stays independent of Git worktree paths and the local claim store. The CLI/application layer combines the repository's issue data with local claims for these reads.

## CLI contract

### Claim and create

```text
frame issue worktree <issueId>
  [--assignee <name>]
  [--branch <name>]
  [--path <path>]
  [--base <ref>]
  [--json]
  [--actor <name>] [--actor-type human|agent] [--message <text>]
```

- The default assignee is the resolved actor (`--actor`, then `FRAME_ACTOR`, then existing actor fallback).
- The default branch is `issue/<issueId>-<slugified-title>`.
- The default path is `<repository>/.worktrees/<issueId>`.
- `--base` defaults to the current `HEAD` of the initiating worktree. The command does not fetch or silently choose a remote branch.
- The path must be absent and must be ignored by Git. `frame init` adds `.worktrees/` idempotently to the repository's local `.git/info/exclude`; it does not edit a tracked `.gitignore` file. An explicit `--path` is also checked for ignore coverage.
- The command creates a new branch and worktree. Reusing an existing branch or worktree is an error; resuming an existing claim is done by inspecting its recorded path, not by creating another one.
- After creation, it runs the issue-start mutation with the selected assignee and branch using the new worktree as `FRAME_ROOT`. Thus the updated issue and trace are staged in the task worktree, never in the initiating checkout.
- Human output includes the absolute path and the next command (`cd <path>`). JSON output includes the issue, branch, path, actor, and claim data. The command cannot change its parent shell's directory.

### List and release

```text
frame worktree list [--json]
frame issue release <issueId> [--json] [--actor ...] [--message ...]
```

- Listing shows Frame-managed claims and their associated Git worktree status. It does not claim ownership of arbitrary worktrees created outside Frame.
- Releasing removes the local claim only. It does not delete a worktree, discard changes, change issue status, or rewrite issue history.
- A future explicit `frame worktree remove <issueId>` may combine safe Git removal and claim release. It is not part of this first implementation; users can remove a clean worktree with Git and then release its claim.
- A claim whose worktree is missing is reported as stale and can be released explicitly. A claim with an existing worktree is not silently released.

### Agent flow

```text
frame next
frame issue worktree ISSUE-0041
cd <path printed by frame>
frame brief --issue ISSUE-0041
# implement, validate, and commit on the task branch
frame issue complete ISSUE-0041 --message "..."
frame issue release ISSUE-0041
```

Completion and claim release are separate operations in v1. The agent or operator releases after the task's branch has been integrated or intentionally abandoned. Frame does not infer merge completion from a local branch name.

## Worktree operation guarantees

The operation follows this sequence:

1. Resolve the repository root and Git common directory; detect whether the caller is already in a linked worktree.
2. Validate the issue and format compatibility, then atomically reserve the issue.
3. Validate that the branch and target path are unused and the target path is ignored.
4. Create the worktree and branch from the selected base.
5. Start the issue against the new worktree root and stage the issue/trace changes there.
6. Return the worktree path and claim details.

If a step fails, Frame releases the claim and removes a newly created, clean worktree where safe. If mutation has made a worktree dirty or cleanup cannot be proven safe, Frame preserves the worktree and claim and prints its recovery path. It never force-removes a worktree or discards user changes.

Calling the command from inside a linked worktree is supported only when creating a distinct issue worktree from the same repository. The current worktree is never reused or moved implicitly.

## Frame format compatibility

### Separate tool and data versions

The CLI package version and the on-disk data format are different version axes. `.frameconfig`'s existing `version` remains the configuration format version and does not stand in for entity format compatibility.

Add `.frame/manifest.json` with a required `formatVersion` integer. New realms initialize it at `1`. Existing realms without a manifest are interpreted as legacy format `1` without rewriting files during reads. The manifest is branch-local and therefore describes the checked-out worktree's data.

Each CLI declares the range of entity `formatVersion` values it can read and write. Before any command reads or mutates realm data, it checks the manifest. Unknown, malformed, too-new, or too-old formats fail with a structured error that names the detected format, supported range, and required next action. Frame must never silently fall back to defaults or rewrite data after a compatibility failure.

The local claim registry has its own protocol version, independent of both CLI package version and realm format version. A CLI with an unsupported claim protocol fails closed for claim mutations and reports the incompatibility; it must not overwrite the registry.

### Migration policy

Format changes require an explicit `frame migrate` command in the release that introduces the new format. A migration:

- displays the source and target formats before writing;
- only runs when the current CLI has a defined migration path;
- updates the manifest after entity conversion succeeds;
- is idempotent or detects a completed migration;
- leaves a clear error and recoverable files if conversion fails.

No automatic migration occurs during `init`, `next`, `brief`, or mutations. The first worktree feature only introduces format detection and the format-1 manifest; it does not invent a migration for a future format.

### Different CLI binaries in different worktrees

The executable found on `PATH` is the CLI that runs. Frame validates the checked-out worktree's manifest against that executable's declared support. This makes an older binary fail safely on newer data and lets compatible CLI releases operate on the same format. The command does not install, build, or switch binaries automatically. Pinning a project-specific executable is a separate distribution concern.

## Errors and user-visible recovery

Errors must distinguish at least:

- issue missing, not eligible, or already claimed (including claimant and path);
- caller outside a Git worktree;
- branch already checked out or branch name already exists;
- target path exists or is not ignored;
- Git worktree creation/removal failure;
- issue mutation failure after creation;
- stale claim and unsupported claim protocol;
- missing, malformed, or unsupported realm format manifest.

Mutations support `--json` and preserve the existing nonzero exit/error JSON contract. No operation force-deletes user data.

## Acceptance criteria

- Two concurrent claim attempts for one issue produce exactly one successful claim.
- A successful claim creates one branch/worktree, records assignee and branch in the worktree's issue file, stages that mutation there, and leaves the initiating checkout's index and worktree untouched.
- A second `frame next` in the same clone does not recommend a claimed issue; an explicit brief shows how to resume it.
- Releasing an active claim does not remove the worktree or discard changes. Stale claims have an explicit recovery path.
- Default and explicit worktree paths are checked against Git ignore rules before creation.
- New repositories receive a format-1 manifest. Existing manifest-free repositories remain readable as format 1 without read-time writes.
- Unsupported format versions fail before reading or writing entity files; compatible format-1 operations continue to work.
- The claim protocol version is validated independently from realm format and CLI package version.
- Git failures and partial failures leave no silently orphaned claim, and cleanup never forces away dirty work.

## Out of scope

- Claims shared across clones or remote machines.
- Automatic binary installation or per-worktree toolchain switching.
- Automatic format migration.
- Automatic branch merge, push, pull request creation, or issue completion on merge.
- Force cleanup, deleting non-Frame worktrees, or deleting a worktree as a side effect of releasing a claim.
- Moving the issue domain model or use cases into Git-specific worktree concerns.

## Implementation boundary

The implementation should add a Git worktree adapter for Git operations, a local claim-store adapter rooted at Git's common directory, and CLI orchestration for claim → create → issue start. Domain use cases remain Git-agnostic. Read commands combine claim information at the application boundary. Manifest parsing and compatibility checking belongs in the filesystem/config boundary and must run before entity parsing.

The implementation plan should split the work into independently reviewable slices: format manifest/compatibility, Git worktree and claim primitives, CLI lifecycle, and read-command visibility. Each slice must include focused tests for its observable contract.
