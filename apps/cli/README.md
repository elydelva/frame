# frame

> *Git tracks what changed. frame tracks why.*

Decision-first, agent-native project management system that lives inside your git repository. Ships the `frame` CLI.

## Install

```bash
brew install elydelva/tap/frame
```

## Quick start

```bash
cd your-project
frame init

frame project new --title "Auth overhaul"
frame milestone new --project PROJ-0001 --title "JWT + refresh tokens"
frame issue add --milestone MILE-0001 --title "Implement token rotation"
frame spec new --project PROJ-0001 --title "Switch auth to JWT"

frame context --active | pbcopy   # paste into your agent
frame next                         # what to work on next
frame issue worktree ISSUE-0001    # claim, create a branch and start in isolation
# cd into the absolute path printed by frame
export FRAME_ROOT="$PWD"
frame brief --issue ISSUE-0001
# after the branch is integrated, release only its local claim
frame issue release ISSUE-0001
```

Worktree claims coordinate agents using linked worktrees in one local clone.
They are not shared across separate clones. Releasing a claim never deletes its
worktree or changes issue status; remove the worktree separately when it is safe.

## Realm format compatibility

`frame init` records the entity data format in `.frame/manifest.json`. Its
`formatVersion` is separate from `.frameconfig`'s configuration `version` and
from the installed `frame` package version. Realms created before the manifest
was introduced are read as format 1; running `frame init` adds the manifest.

If a realm uses a format the installed CLI cannot read, `frame` stops before
reading or changing realm data. Use a compatible `frame` version or restore a
supported realm format from version control. Frame does not migrate formats
automatically.

## Documentation

Full documentation in the [GitHub repository](https://github.com/elydelva/frame).

## License

MIT
