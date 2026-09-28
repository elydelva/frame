# Package Scope Cleanup Implementation Plan

> **For agentic workers:** execute tasks in order. Keep each task as a separate focused commit.

**Goal:** Make the workspace and its documentation describe only implemented Frame packages and capabilities.

**Architecture:** Keep the real package seams (`core`, `fs`, `git`, `lint`, `frame`). Remove the unimplemented `sync` and `tui` stubs and their graph references. Update the product and contributor docs first, then rewrite the stale architecture map in its own documentation fix.

**Tech Stack:** Bun workspaces, TypeScript, Knip, Markdown.

**Spec:** `docs/superpowers/specs/2026-09-28-package-scope-cleanup.md`

## Global Constraints

- Keep `@frame/lint` as a distinct package.
- Do not change CLI behavior or persisted data formats.
- Do not publish or push.
- Make one focused commit per fix.

## Review Focus

- Workspace graph: no references remain to the removed workspace packages.
- Dependency catalog and lockfile: no packages remain solely for removed stubs.
- User-facing docs: do not claim sync or TUI commands ship today.
- Architecture guide: names and package responsibilities match actual source.

---

### Task 1: Remove empty sync and TUI packages

**Files:**
- Delete: `packages/sync/`
- Delete: `packages/tui/`
- Modify: root `package.json`
- Modify: `packages/frame/package.json`
- Modify: `tsconfig.base.json`
- Modify: `knip.json`
- Modify: `bun.lock` through Bun's lockfile updater
- Modify: `README.md`, `CONTRIBUTING.md`, and `docs/v0.1.md`

**Interface:** no runtime interface changes. The workspace contains only implemented packages; future integrations remain documented as future scope.

- [x] Remove package references from root scripts, CLI dependencies, TS paths, Knip configuration, release-please configuration, and dependency catalogs.
- [x] Remove the two empty package directories and refresh the lockfile.
- [x] Update README/contributor/scope docs so current capability claims match the CLI and workspace.
- [x] Verify with `bun run build`, `bun run typecheck`, `bun run lint`, `bunx biome format .`, `bunx knip --reporter compact`, and `rg` for stale package references.
- [x] Commit as `refactor(workspace): remove empty sync and tui packages`.

### Task 2: Replace the stale architecture map

**Files:**
- Modify: `docs/archi.md`
- Modify: `.claude/rules/architecture.md`
- Modify: `README.md` (point the design-history link at current architecture guidance)

**Interface:** documentation only; use actual exports and current package manifests as the source of truth.

- [x] Replace old ADRKit/adframe names, nonexistent ports/entities/commands, and speculative implementations with the current Frame package map and dependency flow.
- [x] Mark future integrations as future scope and link to current architecture guidance.
- [x] Verify package names and documented behavior against source/manifests, then run `git diff --check`.
- [x] Commit as `docs: align architecture guide with current source`.

## Execution Notes

The implementation host forbids running or adding tests unless the user asks. This plan therefore uses build, typecheck, lint, formatting, Knip, source searches, and document review as the verification gates; it does not claim runtime test proof.
