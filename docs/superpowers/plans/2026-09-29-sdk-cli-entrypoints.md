# SDK and CLI Entry Points Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver `@frame/sdk` as the typed programmatic API and move the existing `frame` CLI to `apps/cli`, with installable packages and preserved CLI behavior.

**Architecture:** `packages/sdk` composes `@frame/core` and the default `@frame/fs` adapter behind a `Frame` class, while supporting an injected `IRealmRepository`. The CLI becomes a separate application that uses the SDK for Frame data and retains terminal, lint, Git/worktree, and repair behavior.

**Tech Stack:** Bun 1.3.11 workspaces, TypeScript 5.7+, Bun test, Commander 13, Biome, `bun build`.

**Spec:** [docs/superpowers/specs/2026-09-29-sdk-cli-entrypoints-design.md](../specs/2026-09-29-sdk-cli-entrypoints-design.md)

## Global Constraints

- “Existing on-disk `.frame` and `.frameconfig` formats remain unchanged.”
- “Existing CLI invocation behavior is preserved; `FRAME_ROOT` continues to be resolved by the CLI and passed as a root path to the SDK.”
- “Move CLI-owned code to `apps/cli` and preserve the `frame` command's public behavior.”
- “The SDK is published as `@frame/sdk`; its support dependencies are released in a compatible version set.”
- “SDK operations are asynchronous and return domain values or structured reports. They never print output or terminate the process.”
- “Initialization is explicit. Constructing `Frame` does not write realm files or install Git hooks.”
- “Git exclude changes, hook installation, and writing the `AGENTS.md` guide remain CLI concerns.”
- Keep lint outside the SDK; the CLI uses `@frame/fs` and `@frame/lint` for `lint` and `doctor`.
- Do not publish to a registry or push commits during implementation.

## Review Focus

- A realm with an absent manifest uses the existing legacy format behavior; pin it in the SDK lifecycle test (Task 2).
- An unsupported realm format fails before config or entity reads; pin error and ordering in the SDK lifecycle test (Task 2).
- A custom repository works without a filesystem root, with injected config and default config; pin both paths in the custom-adapter test (Task 2).
- Missing/malformed `.frameconfig` falls back to `DEFAULT_CONFIG`, while valid safe updates persist; pin both in the config API test (Task 3).
- Malformed entity frontmatter remains visible to `frame lint` as a raw-scan diagnostic; pin it in the CLI lint test (Task 5).

---

### Task 1: Add the SDK workspace package and publishable support packages

**Files:**
- Create: `packages/sdk/package.json`
- Create: `packages/sdk/tsconfig.json`
- Create: `packages/sdk/src/index.ts`
- Modify: `package.json`
- Modify: `tsconfig.base.json`
- Modify: `packages/core/package.json`
- Modify: `packages/fs/package.json`

**Interfaces:**
- Produces: workspace package `@frame/sdk`, depending on `@frame/core` and `@frame/fs` only.
- Produces: installable support packages `@frame/core` and `@frame/fs` at version `0.1.1`; SDK package version `0.1.1` to match the current CLI release train.

- [ ] **Step 1: Add workspace and package metadata**

Add `apps/*` to the root `workspaces` glob for the later CLI move. Add `@frame/sdk` to TypeScript aliases and root build/typecheck/clean filters. Set `@frame/core` and `@frame/fs` to version `0.1.1`, remove their `private: true`, and add package metadata needed for npm installation. Change `@frame/fs`'s `@frame/core` dependency from `workspace:*` to `0.1.1`. Give `@frame/sdk` version `0.1.1`, ESM exports, declaration paths, and dependencies on `@frame/core@0.1.1` and `@frame/fs@0.1.1`. Do not add `@frame/lint` as an SDK dependency or alias.

- [ ] **Step 2: Build and inspect workspace resolution**

Run: `bun install --no-save`
Expected: workspace lock resolution succeeds and local `@frame/core`/`@frame/fs` packages resolve from the workspace.

Run: `bun run build`
Expected: existing packages and the SDK package compile; no TypeScript path crosses a package `rootDir` boundary.

- [ ] **Step 3: Commit the package boundary**

```bash
git add package.json bun.lock tsconfig.base.json packages/core/package.json packages/fs/package.json packages/sdk
git commit -m "feat(sdk): add public workspace package"
```

### Task 2: Implement Frame construction, lifecycle, and typed read APIs

**Files:**
- Create: `packages/sdk/src/frame.ts`
- Create: `packages/sdk/src/frame.test.ts`
- Create: `packages/sdk/src/options.ts`
- Create: `packages/sdk/src/entities/projects.ts`
- Create: `packages/sdk/src/entities/milestones.ts`
- Create: `packages/sdk/src/entities/issues.ts`
- Create: `packages/sdk/src/entities/specs.ts`
- Create: `packages/sdk/src/entities/traces.ts`
- Create: `packages/sdk/src/queries.ts`
- Modify: `packages/sdk/src/index.ts`

**Interfaces:**
- Consumes: `IRealmRepository`, `RealmConfig`, `ProjectId`, `MilestoneId`, `IssueId`, `SpecId`, entities and query use cases from `@frame/core`; `FsRealmRepository`, `readRealmConfig`, and `readRealmFormat` from `@frame/fs`.
- Produces: `FrameOptions` with optional `root`, `repository`, and `config`; construction is valid when `root` or `repository` is present. An injected repository overrides the default FS adapter. Config precedence is explicit `config`, then `DEFAULT_CONFIG` for an injected repository, otherwise `.frameconfig` in root mode.
- Produces: `Frame` namespaces `projects`, `milestones`, `issues`, `specs`, and `traces`, plus `next`, `context`, `history`, and `brief`. IDs use existing ID value-object types; reads return domain entities instead of CLI-serialized output.
- Produces: `projects.list/get/create/setStatus`, `milestones.list/get/create/setStatus`, `issues.list/get/create/edit/delete/start/complete/setStatus/addGate/removeGate/isEligibleToStart`, `specs.list/get/create/setStatus`, and `traces.list`.
- Produces: typed list filters: project scope for milestones/specs; project, status, assignee, milestone, label, branch, and priority filters for issues, matching existing CLI behavior.

- [ ] **Step 1: Write lifecycle and read API tests**

In `packages/sdk/src/frame.test.ts`, add named tests `constructsWithoutFilesystemReads`, `memoizesFirstOperationInitialization`, `readsLegacyRealmWithoutManifest`, `rejectsUnsupportedFormatBeforeRepositoryReads`, `usesCustomRepositoryWithoutRoot`, `usesDefaultConfigForCustomRepository`, `usesExplicitConfigForCustomRepository`, `loadsFilesystemConfigForRoot`, `listsAndFindsEveryEntityType`, `filtersIssueLists`, `delegatesReadQueries`, and `reportsIssueEligibilityUsingDagRules`. Assert typed domain results and that unsupported format performs zero repository reads. Also add `propagatesAdapterErrorsUnchanged` and assert the original injected adapter error is the rejection value, plus `doesNotPrintOrExitOnFailure` and assert an SDK rejection produces no console output or process exit.

- [ ] **Step 2: Run SDK tests to verify the missing API fails**

Run: `bun test packages/sdk/src/frame.test.ts`
Expected: FAIL because `Frame` and its namespaces are not exported yet.

- [ ] **Step 3: Implement options, lazy composition, and read namespaces**

In `options.ts`, export `FrameOptions` and validate the root/repository requirement. In `frame.ts`, construct synchronously and memoize one asynchronous initialization promise. If root exists, check realm format before config or repository access. Use an injected repository when supplied, otherwise create `FsRealmRepository`. Use explicit config first; with an injected repository and no config use `DEFAULT_CONFIG`; with the default FS repository read `.frameconfig`. Instantiate query use cases once after config is resolved. Implement list/get reads against the repository and query methods by delegating to existing use cases. Implement `issues.isEligibleToStart(id)` using `DAGService.getEligibleIssues` over repository issue/project/milestone data.

- [ ] **Step 4: Run lifecycle and read API tests**

Run: `bun test packages/sdk/src/frame.test.ts`
Expected: PASS; unsupported format observes zero repository reads and custom repository tests do not touch the filesystem.

- [ ] **Step 5: Run SDK typecheck and commit**

Run: `bun run --filter '@frame/sdk' typecheck`
Expected: PASS with public declarations referencing only installable package exports.

```bash
git add packages/sdk
git commit -m "feat(sdk): add Frame client and read APIs"
```

### Task 3: Add SDK mutations, configuration, and explicit initialization

**Files:**
- Create: `packages/sdk/src/mutations.ts`
- Create: `packages/sdk/src/config.ts`
- Create: `packages/sdk/src/errors.ts`
- Create: `packages/fs/src/realm.initializer.ts`
- Create: `packages/fs/src/realm.initializer.test.ts`
- Create: `packages/sdk/src/initialize.ts`
- Modify: `packages/sdk/src/frame.test.ts`
- Modify: `packages/sdk/src/frame.ts`
- Modify: `packages/sdk/src/index.ts`
- Modify: `packages/fs/src/index.ts`

**Interfaces:**
- Consumes: `Frame` lifecycle/read APIs from Task 2; existing create/edit/delete/status use cases and `recordTrace`; `readRealmConfig`, `writeRealmConfig`, state and format helpers from `@frame/fs`.
- Produces: static `Frame.initialize({ root })` for `.frame/`, manifest, state, templates, and initial config only; `frame.config.get()` and `frame.config.set(key, value)` for currently supported writable scalar keys.
- Produces: `initializeRealm(root: string): Promise<void>` in `@frame/fs`, which creates format-owned realm files and templates idempotently without Git hooks, excludes, guide files, or console output.
- Produces: mutation methods on domain namespaces. Creation inputs reuse entity `Create*Params` without IDs plus actor metadata; issue edits use `EditIssuePatch`; status changes take typed target status, actor, and optional note. Export `FrameInputError` with codes `DUPLICATE_GATE`, `GATE_NOT_FOUND`, and `CONFIG_STORAGE_UNAVAILABLE`; issue gate add/remove route changes through `EditIssueUseCase` so traces remain consistent. `config.set` requires a root so it can persist `.frameconfig`.

- [ ] **Step 1: Write mutation, config, and initialization tests**

Extend `frame.test.ts` with named tests `createsEntitiesAndRecordsTraces`, `editsAndChangesStatuses`, `deletesIssuesAndRetainsDeletionTrace`, `startsAndCompletesIssuesWithCoreRules`, `addsAndRemovesIssueGates`, `readsDefaultsForMissingOrMalformedConfig`, `persistsSupportedConfigUpdates`, `rejectsUnsupportedConfigKeys`, `rejectsConfigWritesWithoutRoot`, and `initializesRealmFilesWithoutCliSideEffects`. Assert failed gates/status transitions preserve existing domain errors, duplicate/missing gates raise the SDK input error, config writes without a root reject with `CONFIG_STORAGE_UNAVAILABLE`, existing config is not overwritten, and no `AGENTS.md` or Git hook is written. In `realm.initializer.test.ts`, add `createsAllFormatFiles` and `doesNotOverwriteExistingConfigManifestOrTemplates`, asserting the `.frame/manifest.json`, `.frame/.state`, templates, and initial `.frameconfig` contents.

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `bun test packages/fs/src/realm.initializer.test.ts packages/sdk/src/frame.test.ts`
Expected: FAIL for the new initializer and SDK APIs before implementation.

- [ ] **Step 3: Implement mutation, config, and initialization APIs**

Keep ID parsing and business rules in existing value objects/use cases. Implement gate changes as read-check-edit operations and retain typed missing-issue errors. Keep the CLI's restricted config-set policy in the SDK so CLI and library callers share validation. Move format-owned templates and file setup out of `apps/cli/src/commands/init.ts` into `packages/fs/src/realm.initializer.ts`; make `Frame.initialize` delegate to `initializeRealm`. Initialization may write only Frame realm data; it must not import `@frame/git`, `@frame/lint`, or CLI code.

- [ ] **Step 4: Run the new tests to verify they pass**

Run: `bun test packages/fs/src/realm.initializer.test.ts packages/sdk/src/frame.test.ts`
Expected: PASS, including malformed config fallback, invalid config key, gate errors, initializer idempotence, and initialization side-effect boundary.

- [ ] **Step 5: Run package checks and commit**

Run: `bun run --filter '@frame/sdk' build && bun run --filter '@frame/sdk' typecheck`
Expected: PASS; SDK imports and declarations have no `@frame/lint` reference.

```bash
git add packages/sdk packages/fs/src/index.ts packages/fs/src/realm.initializer.ts packages/fs/src/realm.initializer.test.ts
git commit -m "feat(sdk): add Frame data operations"
```

### Task 4: Move the CLI package to `apps/cli` without changing behavior

**Files:**
- Move: `packages/frame/**` to `apps/cli/**`
- Modify: moved `apps/cli/package.json` based on the existing CLI package manifest
- Modify: moved `apps/cli/tsconfig.json` based on the existing CLI tsconfig
- Modify: `package.json`
- Modify: `tsconfig.base.json`
- Modify: path references in docs and scripts found by `rg 'packages/frame|@frame/frame'`

**Interfaces:**
- Consumes: existing `buildCLI(): Command`, CLI entry point, handlers, and worktree code unchanged.
- Produces: workspace package `frame` from `apps/cli`, retaining `bin.frame`, version `0.1.1`, and current CLI source entry point.

- [ ] **Step 1: Move the CLI tree and update workspace paths**

Create `apps/`, then use `git mv packages/frame apps/cli`. Add the app package to root build and clean filters; update `tsconfig.base.json` to include `apps/*/src` and add the CLI path alias. Keep aliases for `@frame/core`, `@frame/fs`, `@frame/git`, and `@frame/lint` resolving to their current source packages. Update explicit path references from `packages/frame` to `apps/cli`.

- [ ] **Step 2: Run the CLI tests at the new path**

Run: `bun test apps/cli/src`
Expected: PASS with the same command behavior and worktree semantics as before the move.

- [ ] **Step 3: Run root typecheck and build**

Run: `bun run typecheck && bun run build`
Expected: PASS with no remaining source/config reference to `packages/frame`.

- [ ] **Step 4: Commit the package move**

```bash
git add -A packages/frame apps/cli package.json tsconfig.base.json
git commit -m "refactor(cli): move CLI package to apps"
```

### Task 5: Make CLI data commands consume the SDK and retain CLI linting

**Files:**
- Modify: `apps/cli/src/container.ts`
- Modify: `apps/cli/src/commands/project/**`
- Modify: `apps/cli/src/commands/milestone/**`
- Modify: `apps/cli/src/commands/issue/**`
- Modify: `apps/cli/src/commands/spec/**`
- Modify: `apps/cli/src/commands/{brief,config,context,doctor,history,init,next}.ts`
- Keep CLI lint composition in: `apps/cli/src/commands/{lint,doctor}.ts`
- Modify: `apps/cli/src/commands/commands.test.ts`
- Modify: CLI command tests under `apps/cli/src/commands/**`

**Interfaces:**
- Consumes: public `Frame` API from Tasks 2–3; `scanRealmRaw` from `@frame/fs`; `LintEngine`/`LintFinding` from `@frame/lint`.
- Produces: CLI composition context containing `frame: Frame`, root/worktree metadata, and claim store; it no longer manually constructs core use cases or passes raw repositories to entity command handlers.
- Produces: CLI `lint` and `doctor` continue scanning raw realm files and formatting findings locally; neither operation calls or imports a lint API from `@frame/sdk`.

- [ ] **Step 1: Add CLI regression tests for SDK-backed data operations and raw lint**

Update CLI test fixtures to construct a `Frame` over temporary realms. Keep assertions for current command output, JSON shape, errors, and exit codes. Add tests `issueListMatchesSdkFilters`, `issueShowIncludesSdkTraces`, and `gateCommandsMatchSdkMutations`. Add a malformed-frontmatter fixture and test `lintJsonReportsRawParseDiagnostic`, asserting the parse error is reported with its file path and error severity.

- [ ] **Step 2: Run affected CLI tests to verify the context/API mismatch**

Run: `bun test apps/cli/src/commands`
Expected: FAIL until command contexts and handlers are switched to `Frame` and the malformed lint fixture is added.

- [ ] **Step 3: Replace manual container use-case assembly with Frame**

In `container.ts`, keep the existing `GitAdapter` and construct `FsRealmRepository(realmRoot, git)`, then pass `root`, that repository, and the already loaded `config` to `new Frame({ root: realmRoot, repository, config })`. This preserves the repository's current best-effort staging and config-based query ordering for CLI mutations while normal SDK consumers still get the plain FS default. Retain CLI-owned Git/worktree/claim metadata. Update data handlers to call SDK methods for entity reads, writes, config, and initialization. Replace `issue/worktree.ts` direct repository reads and `DAGService` eligibility calculation with `frame.issues.get`, `frame.issues.list`, and `frame.issues.isEligibleToStart`; retain Git worktree and claim operations in the CLI. Pass claim-derived excluded issue IDs into `next` and `brief`. Keep raw scan plus `LintEngine` composition in `lint.ts` and `doctor.ts`. Keep serialization, human/JSON formatting, Commander, `doctor --fix`, Git hook/exclude setup, worktree coordination, and process exits in the CLI. Translate string IDs and actor flags at this boundary without changing CLI behavior.

- [ ] **Step 4: Run CLI regression tests**

Run: `bun test apps/cli/src/commands`
Expected: PASS with previous command names, options, serialized fields, human output, lint findings, and error exit behavior preserved.

- [ ] **Step 5: Run all tests and commit**

Run: `bun test`
Expected: PASS across core, adapters, SDK, and CLI.

```bash
git add apps/cli
git commit -m "refactor(cli): use shared Frame SDK"
```

### Task 6: Package installable artifacts and update contributor/product docs

**Files:**
- Modify: `packages/sdk/package.json`
- Modify: `packages/core/package.json`
- Modify: `packages/fs/package.json`
- Modify: `apps/cli/package.json`
- Modify: root build, test, clean, and package scripts in `package.json`
- Modify: `README.md`
- Modify: `docs/archi.md`
- Create: `packages/sdk/README.md`
- Create: `scripts/package-smoke/**`

**Interfaces:**
- Consumes: complete SDK API and CLI package from Tasks 1–5.
- Produces: installable `@frame/sdk` with public `@frame/core`/`@frame/fs` dependencies, plus a `frame` CLI artifact whose internal implementation does not require workspace-only packages after install.

- [ ] **Step 1: Write SDK consumer and CLI artifact smoke checks**

Create an isolated consumer fixture that installs packed SDK/support artifacts, imports `Frame`, initializes a temporary realm, and lists projects. Add a packed CLI check that installs the `frame` artifact outside the monorepo, sets `FRAME_ROOT` to that realm, and invokes `frame --help` and `frame lint`.

- [ ] **Step 2: Inspect package contents before finalizing build metadata**

Run: `bun pm pack --dry-run` from `packages/sdk`, `packages/core`, `packages/fs`, and `apps/cli` after running the workspace build.
Expected: SDK includes `package.json`, ESM output, declarations, and README; core/fs support packages include their manifests, ESM output, and declarations; CLI includes its manifest, README, `bin` target, and built entry point. No artifact retains an unresolved `workspace:*` dependency.

- [ ] **Step 3: Configure package builds and declarations**

Build SDK JavaScript and declarations against public `@frame/core`/`@frame/fs` exports. Build the CLI entry point as Node-targeted bundled JavaScript with its `@frame/sdk`, `@frame/git`, `@frame/lint`, and other internal runtime code included. Keep `commander` bundled or declare it as a regular npm dependency. Ensure each package `files` list contains the required output and docs only.

- [ ] **Step 4: Run packed-artifact consumer checks**

Run: `bun run build`; pack each of `packages/core`, `packages/fs`, `packages/sdk`, and `apps/cli` with `bun pm pack --destination /tmp/frame-package-smoke`; install those tarballs into `scripts/package-smoke`; then run its SDK and CLI checks.
Expected: SDK import/typecheck/runtime and CLI `--help`/`lint` succeed without workspace paths or undeclared private packages.

- [ ] **Step 5: Update docs to describe the two product entry points**

Document `new Frame({ root })`, the default FS adapter, custom repository option, supported data operations, and async error behavior in `packages/sdk/README.md` and root `README.md`. Rewrite `docs/archi.md` package table/diagram and update CLI source paths to `apps/cli`. Describe `@frame/core`/`@frame/fs` only as SDK support dependencies. State clearly that linting and `doctor --fix` remain CLI capabilities.

- [ ] **Step 6: Run the complete repository gates**

Run: `bun run build && bun run typecheck && bun test && bun run lint`
Expected: PASS. Also run `git diff --check` and `rg 'packages/frame' packages apps tsconfig.base.json package.json docs/archi.md README.md`; only intentional migration notes, if retained in those files, may refer to the former path.

- [ ] **Step 7: Commit the release-ready workspace artifacts**

```bash
git add package.json bun.lock README.md docs/archi.md packages/sdk packages/core/package.json packages/fs/package.json apps/cli/package.json scripts
git commit -m "feat: ship Frame SDK and CLI entry points"
```

---

## Execution Notes

- Keep commits focused at task boundaries; do not publish packages or push a remote branch.
- Existing package build output in `dist/` is generated and must not be committed unless package conventions explicitly require it.
- The spec leaves exact SDK method names open. Tasks 2–3 define the API surface; Task 5 preserves CLI behavior and keeps all linting in CLI code.
- A package-artifact smoke failure is a release-blocking result even if workspace tests and typecheck pass.
