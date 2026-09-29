# Utiliser le SDK TypeScript

`@frame/sdk` fournit une API asynchrone pour lire et modifier les données d’un
realm Frame depuis un programme TypeScript ou JavaScript. Le SDK choisit
l’adaptateur filesystem par défaut. Il ne lance pas le CLI et ne fait ni lint,
ni formatage de sortie, ni gestion de worktrees.

## Installation

```bash
npm install @frame/sdk
# ou
bun add @frame/sdk
```

Le SDK est un package ESM. Il est utilisable depuis Node.js et Bun.

## Ouvrir un dépôt

Passez à `root` le chemin du répertoire racine du dépôt, celui qui contient
`.frameconfig` et `.frame/`. Vous pouvez utiliser un chemin absolu ou un chemin
relatif au répertoire courant du processus.

```ts
import { Frame, IssueId } from "@frame/sdk";

const frame = new Frame({ root: "/workspace/my-project" });
const projects = await frame.projects.list();
```

La construction de `Frame` est synchrone et n’accède pas au disque. Le premier
appel asynchrone vérifie le format du realm, lit la configuration et crée
l’adaptateur filesystem. Si `.frameconfig` est absent, les valeurs par défaut
sont utilisées. Une instance mémorise cette initialisation pour ses appels
suivants.

Pour créer les fichiers Frame qui manquent avant d’ouvrir le realm, utilisez
l’initialiseur statique :

```ts
const frame = await Frame.initialize({ root: "/workspace/my-project" });
```

`Frame.initialize` crée les données et modèles Frame manquants, sans installer
de hook Git ni écrire de fichier `AGENTS.md`.

## Lire les données

Les identifiants peuvent être passés sous forme de chaîne (`"ISSUE-0001"`) ou
de valeur typée importée de `@frame/sdk`. Les méthodes `get` renvoient
`null` si l’entité n’existe pas.

```ts
const issues = await frame.issues.list({
  projectId: "PROJ-0001",
  status: "not-started",
  priority: "high",
});

const issue = await frame.issues.get("ISSUE-0001");
const eligible = await frame.issues.isEligibleToStart("ISSUE-0001");
const next = await frame.next();
const brief = await frame.brief({ issueId: IssueId.from("ISSUE-0001") });
```

`brief` accepte des identifiants typés pour `issueId` et `projectId` :

```ts
import { Frame, IssueId } from "@frame/sdk";

const frame = new Frame({ root: process.cwd() });
const brief = await frame.brief({ issueId: IssueId.from("ISSUE-0001") });
```

Les points d’entrée de lecture sont :

- `projects.list({ status? })` et `projects.get(id)` ;
- `milestones.list({ projectId?, status? })` et `milestones.get(id)` ;
- `issues.list({ projectId?, status?, assignee?, milestoneId?, label?, branch?, priority? })`,
  `issues.get(id)` et `issues.isEligibleToStart(id)` ;
- `specs.list({ projectId?, status? })` et `specs.get(id)` ;
- `traces.list(filter?)` ;
- `next(options?)`, `context(filter?)`, `history(filter?)` et `brief(filter?)`.

## Créer et modifier des données

Les mutations appliquent les règles métier du domaine et enregistrent les
traces associées. Fournissez un auteur pour une création et un acteur pour une
mutation ; `actorType` et `note` sont facultatifs.

```ts
const issue = await frame.issues.create({
  projectId: "PROJ-0001",
  title: "Documenter l’intégration SDK",
  author: "docs-bot",
  priority: "medium",
  labels: ["documentation"],
  actor: "docs-bot",
  actorType: "agent",
  note: "Créée depuis le guide d’intégration",
});

await frame.issues.start(issue.id, { actor: "worker-1", assignee: "worker-1" });
await frame.issues.complete(issue.id, { actor: "worker-1" });
```

Les méthodes de mutation disponibles sont :

- projets : `create`, `setStatus` ;
- jalons : `create`, `setStatus` ;
- issues : `create`, `edit`, `delete`, `start`, `complete`, `setStatus`,
  `addGate`, `removeGate` ;
- specs : `create`, `setStatus`.

Les transitions de statut interdites, dépendances non satisfaites et entités
introuvables rejettent la promesse avec une erreur. L’API ne transforme pas
ces erreurs en chaînes ou en codes de sortie de processus.

## Configuration

Lisez une copie de la configuration avec `config.get()`. Les écritures
supportées sont `priority.default`, `estimation.scale` et
`estimation.default` :

```ts
const config = await frame.config.get();
await frame.config.set("priority.default", "high");
```

`config.set` écrit `.frameconfig` à la racine donnée à `Frame`. Avec un
repository injecté sans `root`, la lecture utilise la configuration par défaut
ou la configuration fournie, mais les écritures de configuration échouent car
aucun emplacement filesystem n’est défini.

## Adapter de stockage personnalisé

Pour brancher une persistance différente, fournissez une implémentation de
`IRealmRepository`. Passez aussi `config` si elle ne doit pas utiliser les
valeurs par défaut :

```ts
import { DEFAULT_CONFIG, Frame, type IRealmRepository } from "@frame/sdk";

declare const repository: IRealmRepository;

const frame = new Frame({
  repository,
  config: DEFAULT_CONFIG,
});

const issues = await frame.issues.list({ status: "in-progress" });
```

Avec un repository personnalisé, `root` est facultatif. S’il est fourni, le
SDK vérifie quand même le format du realm à cet emplacement. Les lectures et
mutations utilisent le repository injecté.

## Types et erreurs

Le package exporte `Frame`, `IRealmRepository`, les entités, les identifiants
(`ProjectId`, `IssueId`, etc.), `RealmConfig` et les erreurs publiques du
domaine. Les méthodes asynchrones peuvent notamment rejeter avec une erreur
de transition (`InvalidTransitionError`), de dépendance (`GatesNotClearedError`),
de format (`RealmFormatError`) ou d’entrée (`FrameInputError`). Laissez ces
erreurs remonter ou interceptez-les à la frontière de votre application :

```ts
try {
  await frame.issues.start("ISSUE-0001", { actor: "worker-1" });
} catch (error) {
  if (error instanceof Error) {
    console.error(error.message);
  }
}
```

La validation structurelle des données brutes, le lint, `doctor --fix`, les
hooks Git, la sortie terminal et la coordination des worktrees restent des
fonctions du CLI `frame`.
