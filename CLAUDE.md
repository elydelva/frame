# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun install          # Install dependencies
bun run build        # Build all packages
bun run build:bin    # Compile standalone frame binary
bun test             # Run all tests
bun test --watch     # Watch mode
bun run typecheck    # TypeScript strict check (no emit)
bun run lint         # Lint with Biome
bun run check        # Lint + auto-format (biome check --write)
bun run clean        # Clean all dist/ directories
```

Run a single test file: `bun test packages/core/src/services/dag.service.test.ts`
