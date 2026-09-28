# Central CLI error handling

**Status:** Ready for implementation
**Date:** 2026-09-28

## Problem Statement

CLI errors are currently formatted in both `commands/shared.ts` and the executable entry point, and `process.exit(1)` is called from validation helpers, the lint command, and the entry point. This spreads one CLI-wide responsibility across command code and makes command behavior depend on immediate process termination.

## Solution

Create one CLI error module that maps errors to the existing `{code, message}` contract, renders human or JSON errors to stderr, and owns process exit. Validation helpers and the executable entry point use it. Lint continues to emit its report to stdout and requests exit code 1 through the same exit helper when errors are present.

## User Stories

1. As a CLI user, I want human errors on stderr and JSON errors in the existing envelope, so that current scripts keep working.
2. As a CLI user running `frame lint --json`, I want the lint report to remain the JSON stdout payload and a failing lint to retain exit code 1.
3. As a command maintainer, I want error formatting, error-code mapping and exit policy in one module, so that changes stay local.
4. As a command caller, I want command modules to delegate CLI reporting and process termination rather than implement separate output paths.

## Implementation Decisions

- Add a `CliError` carrying a stable code and message for validation failures.
- Add a shared error-details mapper preserving `RealmFormatError.code`, `Error.name`, and the `UnexpectedError` fallback.
- Add a shared stderr reporter preserving the human `Error: <message>` form and JSON `{"error":{"code","message"}}` envelope.
- Add a single exit helper that calls `process.exit(code)`; do not change immediate-exit semantics in this refactor.
- Keep lint findings/report on stdout; only its failing status flows through the exit helper.
- Do not change JSON-mode selection, CLI-visible messages, error codes, streams or exit codes.

## Testing Decisions

- The user requested execution without test runs; no tests will be added or run in this pass.
- Use build, typecheck, lint/format and static searches for direct process exits and duplicated error formatting.
- Existing tests assert error output and process exit behavior; they remain unchanged and should continue to pass when run separately.

## Out of Scope

- Replacing process termination with thrown errors, `process.exitCode`, or Commander-specific error handling.
- Changing the lint report format or routing it through the generic stderr error reporter.
- Changing JSON-mode lifecycle or public command behavior.

## Further Notes

One exit helper preserves current shutdown behavior while creating a single seam for exit policy. Central reporting must retain the distinct lint behavior because lint's report is its useful result, not a generic CLI error.
