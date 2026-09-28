# Package scope cleanup

**Status:** Ready for implementation
**Date:** 2026-09-28

## Problem Statement

The workspace contains `@frame/sync` and `@frame/tui`, but both currently export only an empty module. The CLI depends on them, the root build compiles them, and TypeScript/Knip configuration treats them as active packages. This makes the package graph and contributor documentation claim capabilities that users cannot run. The user also asked whether `@frame/lint` should be folded into another package because there may be too many packages.

## Solution

Remove the two empty packages and references that exist only to keep their stubs in the workspace. Keep `@frame/lint`: it provides a substantive validation engine consumed by `frame lint` and `frame doctor`, and its raw scan seam catches malformed file data before entity parsing can normalize it. Describe future TUI/sync work as future scope rather than shipped capability.

## User Stories

1. As a contributor, I want the workspace list to contain only implemented packages, so that the build graph reflects the current product.
2. As a CLI user, I want documentation to promise only commands that exist, so that examples are runnable.
3. As a contributor, I want the architecture guide to distinguish current modules from future ideas, so that I can find the actual implementation.
4. As a maintainer, I want `@frame/lint` to remain independently understandable and testable, so that raw-realm validation stays separate from entity parsing and application commands.

## Implementation Decisions

- Treat package manifests and source exports as evidence of package capability; an empty export is not an implemented adapter.
- Remove empty `sync` and `tui` workspace packages until they have a real interface and implementation.
- Remove their workspace build references, CLI dependencies, TypeScript path aliases, Knip ignore entries, and dependency catalog entries that become unused.
- Retain `core`, `fs`, `git`, `lint`, and `frame`; each has implemented responsibilities and current callers.
- Update contributor and product docs to describe the actual package set and clearly mark future capabilities.
- Rewrite the stale architecture guide in a separate documentation fix after package removal, using the current source as its authority.
- Work linearly, with one focused commit per fix. Do not publish or push.

## Testing Decisions

- No new tests are required for removing empty packages and updating declarative documentation.
- Verify each implementation fix with the applicable static project gates: build, typecheck, lint/format, Knip, and direct reference searches. The full test suite is not part of this documentation/configuration-only cleanup.
- Keep existing lint-engine tests and behavior untouched; they document the reason `@frame/lint` remains a real package.

## Out of Scope

- Merging `@frame/lint` into `core` or `frame` without evidence that its seam causes material friction.
- Implementing Linear/GitHub sync or an Ink TUI.
- Refactoring the CLI registration module based only on its size.
- Changing runtime behavior, persisted formats, or the public CLI.
- Publishing a package or pushing commits.

## Further Notes

Evidence: `packages/sync/src/index.ts` and `packages/tui/src/index.ts` contain only `export {}` and have no consumers. `packages/lint/src/engine.ts` implements structural validation and is used by the lint and doctor commands. `docs/v0.1.md` explicitly calls TUI and sync out of scope, while `README.md` currently advertises sync commands and `docs/archi.md` describes the old ADRKit/adframe design.
