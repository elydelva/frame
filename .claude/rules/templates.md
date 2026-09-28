# Templates

## Locations

```text
.github/
  ISSUE_TEMPLATE/
    bug.yml       ← bug report (auto-proposed by GitHub)
    feature.yml   ← feature / ADR (auto-proposed by GitHub)
    config.yml    ← disables blank issues
  PULL_REQUEST_TEMPLATE/
    bugfix.md     ← PR fixing a bug
    feature.md    ← PR implementing an ADR or feature
```

## Which to use

| Situation | Template |
|-----------|---------|
| Unexpected behavior | `.github/ISSUE_TEMPLATE/bug.yml` |
| New work / ADR | `.github/ISSUE_TEMPLATE/feature.yml` |
| Bug fix PR | `.github/PULL_REQUEST_TEMPLATE/bugfix.md` |
| Feature PR | `.github/PULL_REQUEST_TEMPLATE/feature.md` |

## PR checklist requirements

Both templates share: `bun test`, `bun run typecheck`, `bun run lint` must pass.

- **feature.md** — Notable changes must be non-obvious (not a commit paraphrase). Must include `Closes #N`. Also verify no regressions in `frame context` or `frame next` output.
- **bugfix.md** — Must add a non-regression test or explicitly justify its absence. Includes before/after output snippet.

## Issue requirements

- **Bug Report** (`bug.yml`) — auto-labels `bug, triage`. Required: observed behavior, expected behavior, reproduction steps, frame version, OS, impact level.
- **Feature Request** (`feature.yml`) — auto-labels `enhancement, triage`. Required: context (problem/motivation), goal, acceptance criteria. Before opening, check if a related ADR already exists in `docs/adr/`.

## CLI

```sh
# Issues — GitHub proposes templates automatically; or:
gh issue create --title "ADR-00X — …"

# PRs
gh pr create --draft \
  --title "feat(core): short description" \
  --body-file .github/PULL_REQUEST_TEMPLATE/feature.md \
  --base main

gh pr ready <number>  # promote from draft when done
```
