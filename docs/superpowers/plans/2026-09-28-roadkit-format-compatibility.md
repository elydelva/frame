# Frame Format Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit, fail-closed compatibility checks for Frame entity data without conflating CLI, config, and entity format versions.

**Architecture:** `@frame/fs` owns the `.frame/manifest.json` format contract and legacy-v1 inference. CLI startup validates the realm before reading config or entities; initialization writes a manifest for new or legacy realms. The first release supports only entity format 1 and defines no automatic migration.

**Tech Stack:** TypeScript, Bun test runner, Node filesystem APIs, existing `@frame/fs` and `@frame/frame` packages.

**Spec:** [Issue worktrees and Frame format compatibility](../specs/2026-09-28-issue-worktrees-design.md)

## Global Constraints

- `.frameconfig`'s existing `version` remains the configuration format version and does not stand in for entity format compatibility.
- Add `.frame/manifest.json` with a required `formatVersion` integer. New realms initialize it at `1`.
- Existing realms without a manifest are interpreted as legacy format `1` without rewriting files during reads.
- Unknown, malformed, too-new, or too-old formats fail with a structured error before entity reads or writes.
- No automatic migration occurs during `init`, reads, or mutations.

## Review Focus

- A malformed or missing manifest must not be confused with a supported format; missing alone maps to legacy v1 — pin in Task 1.
- A too-new format must fail before config fallback or entity parser fallback hides incompatibility — pin in Task 2.
- `frame init` must upgrade legacy realms by adding the manifest idempotently without overwriting existing realm data — pin in Task 1.
- Every CLI route, including `init`, must use the compatibility gate before data access — pin in Task 2.
- Manifest staging must follow existing Frame initialization behavior without changing `.frameconfig` semantics — pin in Task 1.

---

### Task 1: Manifest format contract and initialization

**Files:**
- Create: `packages/fs/src/config/format-version.ts`
- Create: `packages/fs/src/config/format-version.test.ts`
- Modify: `packages/fs/src/constants.ts`
- Modify: `packages/fs/src/index.ts`
- Modify: `packages/frame/src/commands/init.ts`
- Modify: `packages/frame/src/commands/commands.test.ts`

**Interfaces:**
- Produces: `export const CURRENT_REALM_FORMAT = 1` and `export async function readRealmFormat(realmRoot: string): Promise<number>` in `@frame/fs`.
- Produces: `export async function writeRealmFormat(realmRoot: string, formatVersion?: number): Promise<void>`; default version is `CURRENT_REALM_FORMAT` and writes `.frame/manifest.json` as JSON with a trailing newline.
- `readRealmFormat` returns `1` when the manifest is absent; it throws `RealmFormatError` for invalid JSON, a missing/non-integer/non-positive `formatVersion`, or any version other than `1`.
- `RealmFormatError` exposes a stable `code` (`UNSUPPORTED_REALM_FORMAT` or `INVALID_REALM_MANIFEST`), `detectedVersion: number | null`, and a message naming the manifest path and required action.

- [ ] **Step 1: Write manifest reader/writer tests** for `readRealmFormat` missing-file legacy-v1, explicit v1, malformed JSON, missing field, string/float/zero versions, and version 2; assert exact error code and detected version.
- [ ] **Step 2: Run `bun test packages/fs/src/config/format-version.test.ts`** and verify all new cases fail because the manifest API is absent.
- [ ] **Step 3: Implement manifest constants and API** in `format-version.ts`; export the API and error from `packages/fs/src/index.ts`.
- [ ] **Step 4: Write init tests** asserting a fresh init writes format 1, a second init preserves the manifest, and an existing manifest-free realm gets format 1 while existing config and templates remain unchanged.
- [ ] **Step 5: Update `runInit`** to validate any existing manifest before other writes and to write format 1 only when the manifest is absent; preserve existing config/template skip behavior.
- [ ] **Step 6: Run `bun test packages/fs/src/config/format-version.test.ts packages/frame/src/commands/commands.test.ts`** and verify all cases pass.
- [ ] **Step 7: Commit** `feat: add realm format manifest`.

### Task 2: Fail-closed compatibility gate for CLI data access

**Files:**
- Modify: `packages/frame/src/container.ts`
- Modify: `packages/frame/src/cli.ts`
- Modify: `packages/frame/src/index.ts`
- Create: `packages/frame/src/commands/format-compatibility.test.ts`
- Modify: `packages/frame/src/commands/commands.test.ts`

**Interfaces:**
- Consumes: `readRealmFormat` and `RealmFormatError` from Task 1.
- Produces: `export async function assertRealmCompatible(realmRoot: string): Promise<void>` in `packages/frame/src/format-compatibility.ts`; it accepts only format 1 and throws the typed format error for every other manifest state.
- `createContainer(realmRoot)` calls `assertRealmCompatible` before `readRealmConfig` or constructing repository services.
- The top-level CLI error handler serializes `RealmFormatError` to the existing `--json` error envelope with its stable code and nonzero exit status.

- [ ] **Step 1: Add CLI boundary tests** that run representative read and mutation commands against format 2 and malformed manifests; assert no entity/config mutation occurs and JSON mode emits the specific format error.
- [ ] **Step 2: Run the focused tests** and verify they fail because container/CLI startup currently accepts unsupported data.
- [ ] **Step 3: Implement `assertRealmCompatible`** and call it as the first operation in `createContainer`, before `readRealmConfig`.
- [ ] **Step 4: Route format errors through the CLI's structured error handling** without collapsing them into generic validation errors.
- [ ] **Step 5: Extend tests** to cover legacy manifest-free v1 on read and mutation, explicit v1, and every command entry that bypasses `createContainer` (`init` is already guarded by Task 1).
- [ ] **Step 6: Run `bun test packages/frame/src/commands/format-compatibility.test.ts packages/frame/src/commands/commands.test.ts`** and verify all cases pass.
- [ ] **Step 7: Commit** `feat: reject unsupported realm formats`.

### Task 3: Verify package integration and document the contract

**Files:**
- Modify: `packages/frame/README.md`
- Modify: `README.md`
- Modify: `packages/frame/src/commands/commands.test.ts`

**Interfaces:**
- Consumes: manifest and compatibility behavior from Tasks 1–2.
- Produces: user-facing documentation of `.frame/manifest.json`, legacy-v1 behavior, safe failure, and the absence of automatic migration.

- [ ] **Step 1: Add a CLI-level regression test** asserting unsupported format errors name the detected/supported version and do not write files.
- [ ] **Step 2: Document the version axes and compatibility error** in package documentation; avoid promising a migration command before one exists.
- [ ] **Step 3: Run `bun test packages/frame/src/commands/commands.test.ts`** and verify the regression passes.
- [ ] **Step 4: Commit** `docs: explain realm format compatibility`.
