# roadkit

> *Git tracks what changed. roadkit tracks why.*

Decision-first, agent-native project management system that lives inside your git repository. Ships the `rkit` CLI.

## Install

```bash
npm install -g roadkit
```

## Quick start

```bash
cd your-project
rkit init

rkit project new --title "Auth overhaul"
rkit milestone new --project PROJ-0001 --title "JWT + refresh tokens"
rkit issue add --milestone MILE-0001 --title "Implement token rotation"
rkit spec new --project PROJ-0001 --title "Switch auth to JWT"

rkit context --active | pbcopy   # paste into your agent
rkit next                         # what to work on next
rkit issue worktree ISSUE-0001    # claim, create a branch and start in isolation
# cd into the absolute path printed by rkit
export ROADKIT_ROOT="$PWD"
rkit brief --issue ISSUE-0001
# after the branch is integrated, release only its local claim
rkit issue release ISSUE-0001
```

Worktree claims coordinate agents using linked worktrees in one local clone.
They are not shared across separate clones. Releasing a claim never deletes its
worktree or changes issue status; remove the worktree separately when it is safe.

## Realm format compatibility

`rkit init` records the entity data format in `.roadkit/manifest.json`. Its
`formatVersion` is separate from `roadfig.yml`'s configuration `version` and
from the installed `rkit` package version. Realms created before the manifest
was introduced are read as format 1; running `rkit init` adds the manifest.

If a realm uses a format the installed CLI cannot read, `rkit` stops before
reading or changing realm data. Use a compatible `rkit` version or restore a
supported realm format from version control. Roadkit does not migrate formats
automatically.

## Documentation

Full documentation in the [GitHub repository](https://github.com/elydelva/roadkit).

## License

MIT
