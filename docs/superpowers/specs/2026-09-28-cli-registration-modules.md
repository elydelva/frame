# CLI registration modules

**Status:** Ready for implementation
**Date:** 2026-09-28

## Problem Statement

The command tree and all 29 command handlers are imported and registered in one roughly 500-line `cli.ts`. The file mixes root startup behavior with project, milestone, issue, spec and top-level command definitions. A command change therefore requires navigating a large central implementation, and unrelated command domains share the same registration module.

## Solution

Keep `buildCLI()` as the composition root for program metadata and the global JSON hook. Move each existing project, milestone, issue and spec command group into a registration module beside that domain's handlers. The modules register the same Commander commands on the supplied root program.

## User Stories

1. As a contributor changing an issue command, I want issue registration beside issue handlers, so that its flags and action wiring are local.
2. As a contributor changing project, milestone or spec commands, I want to find that domain's registration without scanning unrelated CLI commands.
3. As a CLI user, I want command names, help text, option behavior, output and ordering to remain unchanged.
4. As a maintainer, I want one root composition point to retain program metadata and global JSON-mode setup.

## Implementation Decisions

- Keep the public `buildCLI(): Command` interface.
- Add one `register*Commands(program: Command, getRealmRoot: () => string): void` function for each project, milestone, issue and spec group. Passing the getter preserves action-time resolution of `FRAME_ROOT` without a new shared runtime module.
- Keep top-level commands in `cli.ts` in this change to constrain the refactor's blast radius.
- Preserve command insertion order, descriptions, positional arguments, required/optional flags, flag descriptions and the action-time `FRAME_ROOT` lookup.
- Move the issue-only `withActor` helper with the issue registrations; do not consolidate or rename flags while moving registrations.
- Do not create a new package or change command behavior.

## Testing Decisions

- The user requested execution without test runs; no tests will be added or run in this pass.
- Use TypeScript build/typecheck, Biome lint/format and static source comparison as gates.
- Existing CLI and command tests remain unchanged and can be run separately by the user.

## Out of Scope

- Splitting top-level commands, changing actor/JSON option policy, or changing the public CLI.
- Reworking error reporting or process exit behavior; that has its own spec.

## Further Notes

The domain registration functions are small interfaces over command-tree wiring. Their purpose is locality and leverage for maintainers, not a new extension/plugin system.
