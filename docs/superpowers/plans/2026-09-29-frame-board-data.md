# Frame Board Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Coordonner les écritures CLI/SDK/board et récupérer les mutations interrompues sans changer les formats métier.

**Architecture:** Le port repository propose une transaction optionnelle ; FS l’implémente avec verrou, overlay explicite et journal de roll-forward. Le SDK groupe les cas d’usage et la CLI réutilise ces garanties.

**Tech Stack:** TypeScript, Bun test, node:fs, node:crypto, proper-lockfile ; runtime Node/Bun existant.

**Spec:** [Persistance](../specs/2026-09-29-frame-board-data-design.md) et [architecture](../specs/2026-09-29-frame-board-design.md).

## Global Constraints

- C1 — La commande publique est `frame board` ; la racine reste `FRAME_ROOT ?? process.cwd()`.
- C2 — Le serveur écoute uniquement `127.0.0.1` ; aucun mode LAN, cloud, compte distant ou télémétrie n’est ajouté.
- C3 — Les fichiers Markdown et `.frameconfig` restent la source d’autorité ; le format des entités reste inchangé.
- C4 — Les lectures HTTP utilisent une projection reconstruisible ; les mutations métier passent par `@frame/sdk` et `@frame/core`.
- C5 — La CLI npm reste compatible Node ; le binaire Bun embarque aussi les assets du board. Aucun serveur Vite n’est requis en production.
- C6 — Une mutation confirmée a persisté son entité, sa trace et ses compteurs concernés ; une issue bloquée par ses gates ne peut pas être complétée par le board.
- C7 — L’interface utilise React, Vite, TanStack Router/Query/Virtual, shadcn sur Base UI, Tailwind et variables CSS ; le serveur utilise Hono, tRPC et SSE.
- C8 — Les outils et versions existants ne sont pas mis à niveau sans nécessité démontrée ; les nouvelles dépendances sont épinglées dans le lockfile à l’exécution.
- C9 — Aucun push, publication npm ou déploiement ne fait partie de ces plans.
- C10 — Les garanties concernent les clients Frame mis à jour sur un filesystem local ; les anciens clients et éditeurs externes ne participent pas au verrou.
- C11 — Chaque plan conserve ces contraintes ; aucune tâche ne lance l’exécution d’un autre plan implicitement.

Les contraintes C1–C11 du [plan directeur](2026-09-29-frame-board.md#global-constraints) s’appliquent intégralement. Valeurs propres à ce lot : timeout verrou 5000 ms, retry 100 ms, stale 30000 ms, update 10000 ms, état `~/.frame/state/<sha256(realpath(root))>`, répertoire 0700/fichiers 0600, format entités inchangé.

## Review Focus

- Symlink de racine et symlink interne : canonicaliser le premier, refuser le second ; A1/A2.
- Processus interrompu après décision de commit : roll-forward exactement une fois pour les contenus ; A2.
- Counter et trace écrits par deux processus : IDs distincts et aucune trace perdue ; A3.
- Config mise à jour depuis un contexte SDK ancien : relecture sous verrou ; A4.
- Repository externe sans capacité transactionnelle : signatures et comportement historique conservés ; A3/A5.

---

## Fichiers et frontière

Nouveaux modules FS sous `packages/fs/src/transactions/` : `types.ts`, `identity.ts`, `lock.ts`, `file-transaction.ts`, `journal.ts`, `run.ts`, `errors.ts`. Ils ne connaissent ni HTTP ni React. `realm.repository.ts` conserve les parsers et serializers, mais délègue ses accès aux fichiers à un driver explicite ; créer `repository-files.ts` pour le driver direct et transactionnel. Ne pas dupliquer tous les codecs dans un second repository.

### Task A1: Identité de realm et verrou interprocessus

**Files:** Create `packages/fs/src/transactions/{identity,lock,errors}.ts`, `packages/fs/src/transactions/lock.test.ts`, `packages/fs/src/transactions/lock-process.fixture.ts`; modify `packages/fs/package.json`, `bun.lock`.

**Interfaces:** `getRealmIdentity(root: string): Promise<{root: string; key: string; stateDir: string}>`; `withRealmLock<T>(root: string, operation: () => Promise<T>, timeoutMs?: number): Promise<T>`. Produit erreurs avec `code: 'REALM_BUSY'|'LOCK_COMPROMISED'`.

- [ ] **Step 1 — Écrire les assertions de verrou.** Ajouter fixture enfant prenant les paramètres `root`, `holdMs` et imprimant `acquired` après acquisition. Le test attend ce signal avant de lancer le concurrent ; pas de sleep pour deviner l’ordre. Assertions centrales :
  ```ts
  expect((await getRealmIdentity(link)).key).toBe((await getRealmIdentity(root)).key);
  await expect(withRealmLock(root, async () => 1, 100)).rejects.toMatchObject({ code: 'REALM_BUSY' });
  ```
  Tester aussi deux racines différentes, libération après exception, callback onCompromised et acquisition après sortie du premier enfant.
- [ ] **Step 2 — Rouge.** `bun test packages/fs/src/transactions/lock.test.ts` doit échouer sur les exports absents.
- [ ] **Step 3 — Implémenter identité/verrou.** Utiliser les permissions/paramètres de la spec ; créer le stateDir avant proper-lockfile, ne jamais supprimer un verrou d’autrui en cleanup. Ajouter la dépendance uniquement à FS.
- [ ] **Step 4 — Vert.** Même commande : zéro échec, enfants terminés et aucun verrou laissé par la suite.
- [ ] **Step 5 — Commit.** Stage les fichiers listés et `bun.lock` uniquement ; `git commit -S -m "feat(fs): coordinate realm access across processes"`.

### Task A2: Overlay explicite et journal récupérable

**Files:** Create `packages/fs/src/transactions/{types,file-transaction,journal,run}.ts`, `packages/fs/src/transactions/{file-transaction,journal}.test.ts`, `packages/fs/src/transactions/crash-process.fixture.ts`; modify `packages/fs/src/transactions/errors.ts`, `packages/fs/src/index.ts`.

**Interfaces:** Consomme A1. Produit `RealmFileTransaction` et `runRealmTransaction<T>(root, operation, options?): Promise<T>` tels que la spec ; `recoverRealm(root: string): Promise<void>` acquiert le verrou et récupère le pending journal. Tests injectent les phases de crash via une dépendance interne `onPhase(phase: string): void`, jamais par variable d’environnement de production.

- [ ] **Step 1 — Écrire les tests.** Read-your-writes, delete/création, listes cohérentes, exception avant journal sans changement, racine symlinkée acceptée mais fichier symlink refusé, `..` rejeté. Pour chaque frontière journal/rename/cleanup, tuer le processus fixture puis récupérer deux fois. Assertion :
  ```ts
  await recoverRealm(root);
  await recoverRealm(root);
  expect(await readIssueAndTraceBytes(root)).toEqual(expectedCommittedBytes);
  ```
  `readIssueAndTraceBytes` est un helper local du test lisant les deux chemins fixture constants. Modifier ensuite une cible au hash inconnu : attendre RECOVERY_CONFLICT et conservation de `pending.json`.
- [ ] **Step 2 — Rouge.** `bun test packages/fs/src/transactions/file-transaction.test.ts packages/fs/src/transactions/journal.test.ts` : échecs sur nouvelles interfaces.
- [ ] **Step 3 — Implémenter overlay/journal.** Driver chemins bornés, baseline des lectures/listings, écritures temporaires voisines, journal version 1, roll-forward comparant avant/après. Définir les erreurs de la spec ; WRITE_INDETERMINATE après décision de commit. Nettoyer uniquement les fichiers temporaires appartenant à cette transaction.
- [ ] **Step 4 — Vert.** Même commande ; toutes phases récupèrent les octets attendus, aucun test ne prétend simuler une panne électrique.
- [ ] **Step 5 — Commit.** `git commit -S -m "feat(fs): recover interrupted realm transactions"` après staging explicite des fichiers de cette tâche.

### Task A3: Grouper les mutations du SDK

**Files:** Modify `packages/core/src/ports/realm-repository/realm.repository.ts`, `packages/fs/src/realm.repository.ts`, `packages/fs/src/config/state.manager.ts`, `packages/fs/src/index.ts`, `packages/sdk/src/mutations.ts`; create `packages/fs/src/repository-files.ts`, `packages/fs/src/transactional-repository.test.ts`, `packages/sdk/src/transactions.test.ts`, `packages/sdk/src/transaction-process.fixture.ts`.

**Interfaces:** Produit `IRealmRepository.withTransaction?` et `createTransactionalRepository(root: string, files: RealmFileTransaction): IRealmRepository`. `MutationApi.runMutation<T>` est privé et reçoit un callback repository, sans mutation de contexte partagé.

- [ ] **Step 1 — Écrire les tests.** Dix processus SDK créent chacun une issue dans le même projet ; IDs tous distincts, dix traces et compteur final augmenté de dix. Faire échouer `appendTrace` avant décision de commit et vérifier absence de l’issue et compteur inchangé. Tester state malformé/absent dans realm non vide (refus sans reset), counter valide inférieur aux IDs existants (allocation après le maximum), addGate/removeGate concurrents, titre renommé sans doublon, config de repository injecté sans transaction, et staging des chemins après commit seulement.
  ```ts
  expect(new Set(created.map(x => x.id)).size).toBe(10);
  expect(createdTraces).toHaveLength(10);
  expect(rawState.issue).toBe(initialCounter + 10);
  ```
- [ ] **Step 2 — Rouge.** `bun test packages/fs/src/transactional-repository.test.ts packages/sdk/src/transactions.test.ts` échoue sur concurrence/atomicité de l’implémentation actuelle.
- [ ] **Step 3 — Adapter le repository et MutationApi.** Introduire le driver explicite pour conserver les mêmes parsers/serializers, lectures overlay et paths. Chaque méthode publique mutatrice du SDK exécute tout son cas d’usage dans le callback scoped ; les writers directs FS prennent une transaction courte. Les opérations scoped ne tentent pas de reprendre le verrou. La primitive `incrementCounter` exportée utilise aussi ce mécanisme lorsqu’appelée directement ; validation stricte du state et allocation max(counter, IDs existants)+1 selon la spec.
- [ ] **Step 4 — Vert.** Tests ciblés puis `bun test packages/sdk/src/frame.test.ts packages/fs/src/realm.repository.test.ts` : zéro régression des contrats existants.
- [ ] **Step 5 — Commit.** `git commit -S -m "feat(sdk): transact filesystem mutations as a unit"` avec les seuls chemins listés.

### Task A4: Config, initialisation et doctor coordonnés

**Files:** Modify `packages/fs/src/config/realm-config.reader.ts`, `packages/fs/src/realm.initializer.ts`, `packages/fs/src/index.ts`, `packages/sdk/src/config.ts`, `packages/sdk/src/index.ts`, `apps/cli/src/commands/doctor.ts`; create `packages/sdk/src/config-values.ts`, `packages/fs/src/config/transactional-config.test.ts`, `apps/cli/src/commands/doctor-transaction.test.ts`; modify `packages/fs/src/realm.initializer.test.ts`.

**Interfaces:** `updateRealmConfig(root: string, update: (current: RealmConfig) => RealmConfig): Promise<RealmConfig>` ; `applyConfigValue(current: RealmConfig, key: string, value: string): RealmConfig` exporté par SDK pour la composition web ; `readRealmConfig(root: string, files?: RealmFileTransaction)` et `writeRealmConfig(root, config, files?)` gardent les signatures actuelles compatibles. Quand files est fourni, aucune reprise de verrou.

- [ ] **Step 1 — Tests.** Deux updates de clés distinctes depuis deux anciens contextes gardent les deux changements ; config set invalide conserve les octets ; init simultané est idempotent ; doctor --fix attend le writer puis rescane avant suppression. Tester qu’une réparation ne supprime pas le fichier devenu canonique pendant l’attente.
  ```ts
  expect((await readRealmConfig(root)).priority.default).toBe('high');
  expect((await readRealmConfig(root)).estimation.scale).toBe('hours');
  ```
- [ ] **Step 2 — Rouge.** `bun test packages/fs/src/config/transactional-config.test.ts apps/cli/src/commands/doctor-transaction.test.ts packages/fs/src/realm.initializer.test.ts` : au moins le scénario stale config échoue avant correction.
- [ ] **Step 3 — Implémenter.** Extraire la validation de ConfigApi sans la réécrire ; recharger sous verrou ; mettre à jour le contexte après commit. Init et doctor passent le driver transactionnel explicitement. Exporter applyConfigValue dans `packages/sdk/src/index.ts` et son test de valeurs existantes.
- [ ] **Step 4 — Vert.** Même commande et tests config SDK existants ; scripts CLI existants inchangés.
- [ ] **Step 5 — Commit.** `git commit -S -m "fix(fs): coordinate config initialization and repairs"` après staging ciblé.

### Task A5: Édition du corps et preuve de compatibilité

**Files:** Modify `packages/core/src/use-cases/edit-issue/edit-issue.ts`, son `.test.ts`, `packages/sdk/src/frame.test.ts`, `docs/sdk.md`, `docs/archi.md`; create `docs/validation/frame-board-runtime.md` (section lot A).

**Interfaces:** `EditIssuePatch.body?: string`, propagé par l’API existante `frame.issues.edit(id, patch)` ; aucun endpoint nouveau dans ce lot.

- [ ] **Step 1 — Tests.** Corps absent conservé, corps vide effacé, Markdown Unicode/retours à la ligne conservés au round-trip et une seule trace issue_edited.
  ```ts
  expect((await frame.issues.edit(id, { body: '', actor: 'test' })).body).toBe('');
  ```
- [ ] **Step 2 — Rouge.** `bun test packages/core/src/use-cases/edit-issue/edit-issue.test.ts packages/sdk/src/frame.test.ts` : nouveau cas échoue.
- [ ] **Step 3 — Implémenter le champ et documenter les garanties.** Conserver règles/format et préciser limites des écrivains externes, recovery journal et adapters sans transaction.
- [ ] **Step 4 — Gate A.** `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build`. Zéro nouvel échec ; couverture ≥ 80 % lignes/fonctions. Consigner commandes et tests interprocessus réels dans le rapport, sans recopier des résultats historiques.
- [ ] **Step 5 — Commit.** `git commit -S -m "feat(issues): edit markdown body through the SDK"` avec tests et documentation concernés.
