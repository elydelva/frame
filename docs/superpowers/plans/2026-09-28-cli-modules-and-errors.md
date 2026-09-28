# CLI Modules and Error Handling Implementation Plan

> **For agentic workers:** execute tasks in order. Each task lands as a focused commit.

**Goal:** Make CLI command registration local to its domain and route error rendering and exit through one implementation.

**Architecture:** Keep `buildCLI()` as the command-tree composition root. Domain registration modules add their existing commands to the root program. A separate CLI error module owns error mapping, stderr formatting and exit, while lint keeps its report on stdout.

**Tech Stack:** Bun, TypeScript, Commander, Biome.

**Specs:**
- `docs/superpowers/specs/2026-09-28-cli-registration-modules.md`
- `docs/superpowers/specs/2026-09-28-cli-error-handling.md`

## Global Constraints

- Preserve the public `buildCLI(): Command` interface and the current command tree.
- Preserve command order, descriptions, positional arguments, options and action-time `FRAME_ROOT` lookup.
- Preserve human/JSON stderr behavior, error codes and immediate process exit behavior.
- Preserve lint output on stdout and its nonzero exit status on errors.
- Do not add or run tests in this pass.

## Review Focus

- Root and nested help order remains the same after registration moves.
- `FRAME_ROOT` is read when the action runs, not when the command tree is built.
- JSON mode remains set by the root `preAction` hook before action handlers.
- Lint errors remain a report on stdout, not a generic error envelope on stderr.
- Realm format errors retain their specific error code.

---

### Task 1: Split domain command registration

**Files:**
- Create: `packages/frame/src/commands/project/register.ts`
- Create: `packages/frame/src/commands/milestone/register.ts`
- Create: `packages/frame/src/commands/issue/register.ts`
- Create: `packages/frame/src/commands/spec/register.ts`
- Modify: `packages/frame/src/cli.ts`

**Interface:** each registration module exports `registerProjectCommands(program: Command, getRealmRoot: () => string): void`, `registerMilestoneCommands(program: Command, getRealmRoot: () => string): void`, `registerIssueCommands(program: Command, getRealmRoot: () => string): void`, or `registerSpecCommands(program: Command, getRealmRoot: () => string): void`. The functions append the same group and descendants to the provided program and use the getter when an action runs.

- [x] Move one domain's existing registrations verbatim into its registration function, preserving order and options.
- [x] Repeat for the remaining three domains; keep all top-level commands and root JSON behavior in `cli.ts`.
- [x] Update `buildCLI()` to invoke the four registration functions in the existing order.
- [x] Verify with package build/typecheck, Biome lint/format, and source-level comparison of every command/option/action.
- [x] Commit as `refactor(cli): group command registration by domain`.

### Task 2: Centralize CLI errors and exits

**Files:**
- Create: `packages/frame/src/commands/cli-errors.ts`
- Modify: `packages/frame/src/commands/shared.ts`
- Modify: `packages/frame/src/commands/lint.ts`
- Modify: `packages/frame/src/index.ts`

**Interface:** the shared module exports a coded `CliError`, `reportCliError(error, jsonMode)`, and `exitCli(code): never`.

- [x] Implement common error-code/message mapping and stderr rendering, preserving current human and JSON output.
- [x] Route `fail()` and the entry-point rejection handler through that reporter and exit helper.
- [x] Route lint's nonzero status through the exit helper only, preserving its stdout report.
- [x] Verify with package build/typecheck, Biome lint/format, and source search showing `process.exit` only in the shared helper.
- [x] Commit as `refactor(cli): centralize error reporting and exit`.
