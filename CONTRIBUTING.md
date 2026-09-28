# Contributing

## Setup

```bash
bun install
bun run build
```

Requires [Bun](https://bun.sh) ≥ 1.3.

## Common commands

| Command | Description |
|---|---|
| `bun test` | Run all tests |
| `bun run typecheck` | TypeScript type check (no emit) |
| `bun run lint` | Lint with Biome |
| `bun run check` | Lint + format (auto-fix) |
| `bun run build` | Build all packages |
| `bun run build:bin` | Compile standalone `frame` binary |

## Workflow

1. **Open an issue** — use the GitHub issue templates (bug or feature).
2. **Create a branch** from `main` — name it `feat/…`, `fix/…`, `chore/…`, `docs/…`.
3. **Open a Draft PR** as soon as the branch has a first meaningful commit. Link it to the issue with `Closes #N`.
4. **Write conventional commits** — `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `perf:`, `test:`. These feed the automated changelog.
5. **Mark ready for review** when done. All CI checks must pass.

## PR templates

```bash
# Feature PR
gh pr create --draft \
  --title "[FEAT] Short description" \
  --body-file .github/PULL_REQUEST_TEMPLATE/feature.md \
  --base main

# Bugfix PR
gh pr create --draft \
  --title "[FIX] Short description" \
  --body-file .github/PULL_REQUEST_TEMPLATE/bugfix.md \
  --base main
```

## Commit conventions

This project uses [Conventional Commits](https://www.conventionalcommits.org/). Examples:

```text
feat(core): add state machine transitions for deferred status
fix(fs): handle missing frontmatter gracefully
chore(ci): pin action versions to commit hashes
docs: update v0.1 scope
```

Breaking changes: add `!` after the type (`feat(core)!:`) or a `BREAKING CHANGE:` footer.

## Monorepo structure

```text
packages/
  core/     @frame/core   — domain, ports, use cases
  fs/       @frame/fs     — filesystem adapter
  git/      @frame/git    — git adapter
  lint/     @frame/lint   — validation engine
  frame/  frame         — published binary `frame` (entry point + DI)
docs/       — founding paper, architecture, v0.x scope docs
```

Only `frame` (the `frame` binary) is published to npm. All `@frame/*` packages are private (monorepo-only) in v1.

## Code quality

- **Formatter / linter**: [Biome](https://biomejs.dev/) — `bun run check` to auto-fix.
- **Pre-commit hook**: runs `biome check --write` on staged `*.ts` files (Husky + lint-staged).
- **Type checking**: strict TypeScript — `bun run typecheck` before opening a PR.
- **Tests**: `bun test` with 80% coverage threshold.
