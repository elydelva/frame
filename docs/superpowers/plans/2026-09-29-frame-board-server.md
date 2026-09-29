# Frame Board Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exposer une API locale cohérente avec le SDK, une projection observable et un flux de changements récupérable.

**Architecture:** Package privé board-server ; tRPC valide et sérialise, les commandes composent SDK/transaction, la projection sert les queries. Hono et deux adaptateurs runtime servent le même protocole.

**Tech Stack:** Hono, tRPC, Zod, Chokidar, TypeScript, Bun test ; contrats et transactions du lot A.

**Spec:** [Serveur](../specs/2026-09-29-frame-board-server-design.md) et [architecture](../specs/2026-09-29-frame-board-design.md).

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

C1–C11 du [plan directeur](2026-09-29-frame-board.md#global-constraints). Loopback `127.0.0.1`, port défaut 0, payload 2 Mio, corps 1 Mio, titre 500 caractères, journal 1 000 batches/5 minutes, queue client 100 batches, stabilité 100 ms et debounce 50 ms, réconciliation 30 s, déduplication 10 minutes/10 000 résultats.

## Review Focus

- Fichier malformé entre deux sauvegardes : conserver dernière entité valide et diagnostic, pas un faux delete ; B2.
- Événement entre snapshot et subscription : replay complet et queue bornée ; B3.
- Révision valide avant attente de verrou mais obsolète ensuite : refus sous verrou ; B4.
- Ancien epoch ou mutationId réutilisé avec autre payload : rejet avant écriture ; B4.
- Host hostile, chemin asset encodé, port occupé et stop doublé : aucun accès hors contrat et fermeture complète ; B5/B6.

---

## Structure et prérequis

Le lot A doit avoir passé son gate. Créer `packages/board-server` en package privé nommé `@frame/board-server`. Dépendances runtime explicites sur SDK, FS et lint ; core seulement si un type non réexporté est indispensable, jamais sur apps/cli. `api/dto.ts` et `api/schemas.ts` définissent ensemble le contrat réseau, `api/router.ts` exporte `AppRouter` comme type.

### Task B1: Contrats web sérialisables

**Files:** Create `packages/board-server/package.json`, `tsconfig.json`, `src/index.ts`, `src/api/{dto,schemas,errors}.ts`, `src/api/contracts.test.ts`; modify root `package.json`, `tsconfig.base.json`, `bun.lock`.

**Interfaces:** EntityRef, Cursor, Versioned, Diagnostic, ChangeBatch, BoardSnapshot, BoardQuery, BoardCommand, CommandResult et HistoryInput/HistoryPage définis dans la spec. `toIssueDTO(issue: Issue): IssueDTO` et équivalents project/milestone/spec/trace ; `toBoardError(error: unknown, requestId: string): BoardError`, BoardError `{code:string,message:string,requestId:string}` avec union des codes de la spec.

- [ ] **Step 1 — Tests.** DTO sans classe/Date ; nulls conservés ; priorité custom validée avec config ; paramètres inconnus rejetés ; limites titre/body en UTF-8 ; corps omis des résumés ; chemins absolus et stacks absents des erreurs.
  ```ts
  expect(JSON.parse(JSON.stringify(dto))).toEqual(dto);
  expect('body' in summary).toBe(false);
  expect(commandSchema.safeParse({ ...validCommand, actor: 'spoof' }).success).toBe(false);
  ```
- [ ] **Step 2 — Rouge.** `bun test packages/board-server/src/api/contracts.test.ts` échoue sur les contrats absents.
- [ ] **Step 3 — Implémenter contrats et wiring workspace.** Ajouter les versions compatibles épinglées ; types dérivés des schémas quand possible, sérialisation explicite. N’importer aucun helper de terminal. Inclure le package dans build/typecheck sans l’ajouter à la publication npm.
- [ ] **Step 4 — Vert.** Test ciblé et `bun run typecheck` ; schemas stricts pour toutes les variantes de commande.
- [ ] **Step 5 — Commit.** `git commit -S -m "feat(board): define validated web contracts"` avec staging des fichiers de la tâche.

### Task B2: Projection incrémentale et diagnostics

**Files:** Create `packages/board-server/src/projection/{index,scan,revisions}.ts`, `src/projection/index.test.ts`, `src/test/realm.fixture.ts`.

**Interfaces:** `createBoardProjection({root,actor}: {root:string;actor:string}): Promise<BoardProjection>` ; méthodes snapshot/detail/history/reconcile/close de la spec. `entityRevision(files: readonly {path:string;hash:string}[]): string`. `createTestRealm(): Promise<{root:string;frame:Frame;close():Promise<void>}>` est le helper partagé des tests serveur et se nettoie après chaque test.

- [ ] **Step 1 — Tests.** Snapshot sans corps/traces globales, changements sur un fichier seulement, pagination stable des traces aux dates égales, suppression/rename de slug, ID dupliqué, fichier invalide au boot puis après valeur valide, config invalide et manifest incompatible. Scans sous verrou, lecture bornée à 16. Exemple :
  ```ts
  expect(projection.snapshot().issues[0]?.revision).not.toBe(previousRevision);
  expect(projection.snapshot().diagnostics).toContainEqual(expect.objectContaining({ code: 'DUPLICATE_ID' }));
  ```
- [ ] **Step 2 — Rouge.** `bun test packages/board-server/src/projection/index.test.ts` échoue avant implémentation.
- [ ] **Step 3 — Implémenter index et scan.** Réutiliser raw scanner/parsers existants ; diagnostics déterministes, hashes de chemins relatifs triés ; index Map par type/ID. Corps conservés seulement au niveau du cache interne ; pas de lecture complète à chaque query. Le mode read-only diagnostique bloque execute lorsque le realm est invalide.
- [ ] **Step 4 — Vert.** Même commande ; vérifier par instrumentation du driver de test qu’une query répétée n’effectue pas de scan disque.
- [ ] **Step 5 — Commit.** `git commit -S -m "feat(board): index realm reads with diagnostics"`.

### Task B3: Watcher et journal SSE récupérable

**Files:** Create `packages/board-server/src/sync/{watcher,journal,coordinator}.ts`, `src/sync/{journal,watcher}.test.ts` ; modify `src/projection/index.ts`, `packages/board-server/package.json`, `bun.lock` pour la dépendance de lecture Git ; modifier `packages/git/src/worktree.adapter.ts` et son test pour les chemins observés.

**Interfaces:** `ChangeJournal.append(batch: Omit<ChangeBatch,'cursor'>): ChangeBatch`; `subscribe(after: Cursor, emit: (event: BoardEvent) => void): () => void`; `reset(): Cursor`; `BoardEvent` union changes/reset de la spec. `startRealmWatcher(root: string, reconcile: (paths?: readonly string[]) => Promise<void>): Promise<{close():Promise<void>}>`. Coordinator sérialise projection/publication et fournit le cursor partagé. Ajouter `GitWorktreeAdapter.getWatchPaths(): Promise<string[]>` : `git rev-parse --git-path HEAD`, ref symbolique si présente et packed-refs via --git-path ; chemins absolus, detached HEAD accepté, aucune écriture Git. Tester également worktree lié et branche sans commit.

- [ ] **Step 1 — Tests.** Injecter horloge/journal et source d’événements contrôlées ; événement ajouté entre snapshot et subscribe délivré exactement une fois ; journal expiré, seq futur et epoch inconnu → reset ; 101 batches non consommés → reset/fermeture. Watcher réel sur realm temporaire : rename, écriture partielle et modifications groupées ; test séparé du rescan 30 s avec horloge fake.
  ```ts
  expect(delivered.map(x => x.batch?.cursor.seq).filter(Boolean)).toEqual([1, 2]);
  expect(expiredEvents[0]?.type).toBe('reset');
  ```
- [ ] **Step 2 — Rouge.** `bun test packages/board-server/src/sync/journal.test.ts packages/board-server/src/sync/watcher.test.ts`.
- [ ] **Step 3 — Implémenter.** Installer watcher avant bootstrap scan, bufferiser, drainer, exposer ; config invalide observable. Pour Git, résoudre le fichier HEAD du worktree et la ref active via l’adapter Git en lecture seule ; observer ces chemins explicitement malgré l’exclusion générale `.git`. HEAD/ref changé ou plus de 1 000 chemins dans un lot → epoch neuf et rescan complet. Realm non Git reste supporté.
- [ ] **Step 4 — Vert.** Même commande, timers/handles libérés. Aucun test unitaire n’attend 30 s réelles.
- [ ] **Step 5 — Commit.** `git commit -S -m "feat(board): replay realm changes across reconnects"`.

### Task B4: Routeur tRPC et commandes métier

**Files:** Create `packages/board-server/src/api/{router,commands,mutation-cache}.ts`, `src/api/{router,commands}.test.ts`; modify `src/api/errors.ts`, `src/index.ts`.

**Interfaces:** `createBoardRouter(runtime: BoardRuntime)` exporte `AppRouter`; BoardRuntime `{projection:BoardProjection,journal:ChangeJournal,root:string,actor:string}` ; `executeCommand(runtime: BoardRuntime, command: BoardCommand): Promise<CommandResult>`. Inputs snapshot/detail/history/events/execute strictement ceux de la spec. Produit aussi BoardPreferences/SavedView et `getBoardPreferences(root:string):Promise<Versioned<BoardPreferences>>`, `setBoardPreferences(root:string,expectedRevision:string,value:BoardPreferences):Promise<Versioned<BoardPreferences>>`. Pas de route universelle d’exécution de shell.

- [ ] **Step 1 — Tests.** Exercer toutes les variantes de commande avec fixtures ; gate refusée sans trace, actor navigateur ignoré/rejeté, revision périmée après attente, duplicate mutationId concurrent → une trace, payload divergent → INVALID_INPUT, epoch ancien → SESSION_EXPIRED. Réponse perdue après commit puis même ID dans epoch → même résultat ; après redémarrage → aucune répétition acceptée sous ancien epoch. Vérifier snapshot/cursor après confirmation. Préférences : concurrence de révision, persistance après redémarrage/changement de port, fichier corrompu conservé, limites et isolation de realms.
  ```ts
  expect(await executeCommand(runtime, command)).toEqual(firstResult);
  expect((await frame.history({ issueId })).length).toBe(traceCountAfterFirst);
  ```
- [ ] **Step 2 — Rouge.** `bun test packages/board-server/src/api/router.test.ts packages/board-server/src/api/commands.test.ts packages/board-server/src/api/preferences.test.ts`.
- [ ] **Step 3 — Implémenter dispatch explicite.** Une transaction pour revérifier epoch et révision + mutation SDK ; config via applyConfigValue et driver scoped. Préparer result DTO, committer, réconcilier, puis publier et répondre. Dédup cache plafond/durée, refus d’ancien epoch, aucune annulation de commit sur disconnect. Mapper toutes erreurs connues, notamment WRITE_INDETERMINATE. Préférences via JSON atomique local et verrou partagé, sans trace métier ni journal SSE ; chemins déterminés par le serveur.
- [ ] **Step 4 — Vert.** Même commande et B2/B3 : aucun double batch en cas de watcher qui observe l’écriture déjà réconciliée.
- [ ] **Step 5 — Commit.** `git commit -S -m "feat(board): execute versioned SDK commands over tRPC"`.

### Task B5: Session locale, assets et runtime portable

**Files:** Create `packages/board-server/src/{server,assets}.ts`, `src/http/{app,session,assets}.ts`, `src/runtime/{node,bun}.ts`, `src/http/{session,assets}.test.ts`, `src/server.test.ts`, `scripts/board-server-smoke.mjs`; modify package exports/dependencies et `bun.lock`.

**Interfaces:** `AssetProvider`, BoardServerOptions, BoardServerHandle et `startBoardServer` de la spec. `createBoardApp(runtime: BoardRuntime, assets: AssetProvider, origin: string): {app:Hono;bootstrap:string;close():void}` ; adapters runtime sélectionnés par entrée explicite, aucun top-level Bun global dans le chemin Node.

- [ ] **Step 1 — Tests.** Bootstrap avec Origin exact, bearer par session, autre Host/Origin/absence token refusés, pas de CORS wildcard ; limites 2 Mio ; asset manquant 404, traversal encodé refusé, deep link HTML shell et route tRPC inconnue JSON 404. Tester close deux fois, SSE ouvert puis stop et port réutilisable.
  ```ts
  expect((await app.request('/trpc/board.snapshot')).status).toBe(401);
  expect((await app.request('/assets/missing.js')).status).toBe(404);
  ```
- [ ] **Step 2 — Rouge.** `bun test packages/board-server/src/http packages/board-server/src/server.test.ts`.
- [ ] **Step 3 — Implémenter.** Token bootstrap 256 bits, tokens session en mémoire, anti-Origin/Host, CSP de la spec, manifest fermé d’assets. Créer des assets HTML fixture minimaux uniquement dans les tests ; le vrai build appartient à C7. La commande intermédiaire affiche une page informative intégrée au package tant que C1/C7 ne sont pas livrés.
- [ ] **Step 4 — Vert.** Tests ciblés ; exécuter smoke runtime Node et Bun sur le même fixture en ajoutant `scripts/board-server-smoke.mjs`, avec exit 0, HTTP fermé et aucun handle orphelin.
- [ ] **Step 5 — Commit.** `git commit -S -m "feat(board): serve authenticated loopback sessions"`.

### Task B6: Commande board et gate serveur

**Files:** Create `apps/cli/src/commands/board.ts`, `board.test.ts`; modify `apps/cli/src/cli.ts`, `apps/cli/package.json`, root scripts, `bun.lock`, `apps/cli/README.md`, `docs/validation/frame-board-runtime.md`.

**Interfaces:** `runBoard(root: string, options: {port?:number;open:boolean}): Promise<void>` ; résolution acteur via helper existant ; dépendance serveur en devDependency bundlée, `open` en dépendance du chemin board. Module chargé à la demande dans l’action Commander.

- [ ] **Step 1 — Tests.** --no-open, port 0/occupé/invalide, FRAME_ROOT hors cwd et avec espaces, absence realm sans init implicite, erreur navigateur sans tuer le serveur, deux boards, SIGINT/SIGTERM. Fixture enfant imprime son URL ; attendre disponibilité par HTTP, pas délai arbitraire.
- [ ] **Step 2 — Rouge.** `bun test apps/cli/src/commands/board.test.ts` : commande absente puis tests fonctionnels rouges.
- [ ] **Step 3 — Implémenter lancement/arrêt.** Enregistrement explicite dans cli.ts, ouvrir URL sans shell, handlers signal démontés au cleanup ; préserver la sortie des autres commandes et `--help` sans démarrage réseau.
- [ ] **Step 4 — Gate B.** `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build`, puis `node scripts/board-server-smoke.mjs` et `bun scripts/board-server-smoke.mjs`. Rapporter les runtime réellement disponibles ; aucune claim de support si un test n’a pas tourné.
- [ ] **Step 5 — Commit.** `git commit -S -m "feat(cli): launch the local frame board server"` avec docs d’utilisation et preuve du lot B.
