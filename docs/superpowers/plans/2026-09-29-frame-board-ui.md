# Frame Board UI and Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer les parcours du board et les distribuer avec la CLI, avec preuves fonctionnelles, visuelles et de performance.

**Architecture:** Routes et filtres dans TanStack Router, données serveur dans Query, contrôles Base UI personnalisés, listes virtualisées. Les assets Vite sont transformés en module embarqué commun aux builds npm et Bun.

**Tech Stack:** React, Vite, Tailwind, shadcn/Base UI, TanStack Router/Query/Virtual, Lucide, Inter, dnd-kit, react-markdown/GFM, Playwright, Bun test.

**Spec:** [Interface/distribution](../specs/2026-09-29-frame-board-ui-design.md), [serveur](../specs/2026-09-29-frame-board-server-design.md), [architecture](../specs/2026-09-29-frame-board-design.md).

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

C1–C11 du [plan directeur](2026-09-29-frame-board.md#global-constraints). React SPA, UI anglaise, dark/light/system, reduced-motion, sidebar 240 px, toolbar 48 px, lignes 32/40 px, panneau 640 px max, transitions 120/180 ms. Pas de nouvelles entités métier, de stockage de tokens en localStorage, de CDN ni de retry automatique de mutations.

## Review Focus

- Retour navigateur, filtres invalides et détail d’issue supprimée : URL récupérable et focus restauré ; C2/C3.
- Deux mutations d’une même issue dont la première échoue : pas de rollback global d’un état plus récent ; C4.
- IME ou saisie dans le Markdown : raccourcis de lettres inactifs ; C6.
- DnD d’une carte sortie du viewport : overlay stable et action clavier équivalente ; C4.
- Exécutable installé hors checkout, chunk différé et fonte hors ligne : aucun chemin de développement requis ; C7/C8.

---

## Organisation et harness

L’arborescence de la spec est normative. Les routes sont déclarées explicitement dans `src/routes/router.tsx` sans génération de fichiers de route. Les fichiers nommés ci-dessous sont les points d’entrée ; créer un fichier par composant exporté sous la feature concernée au lieu d’accumuler tous les JSX dans une page.

Créer les tests E2E avec suffixe `.spec.ts` sous `apps/board/e2e`, les unit tests `.test.ts` à côté de la logique client. Le harness Playwright lance un serveur réel sur realm temporaire via une fixture contrôlée ; Vite en proxy pour les tests de développement, assets production pour packaging/perf. Aucun accès à un workspace Linear privé n’est nécessaire aux tests.

### Task C1: Shell et système visuel

**Files:** Create `apps/board/{package.json,tsconfig.json,vite.config.ts,index.html,playwright.config.ts}`, `src/{main.tsx,app.tsx}`, `src/routes/router.tsx`, `src/styles/{tokens,themes,global}.css`, `src/components/shell/{sidebar,toolbar,panel,breadcrumbs}.tsx`, `src/components/ui/` (primitives utilisées), `e2e/{fixtures,shell.spec}.ts`, `public/fonts/` et licence ; modify root `package.json`, `tsconfig.base.json`, `bunfig.toml`, `bun.lock`.

**Interfaces:** `BoardApp(): ReactElement`, `BoardShell({children}: {children:ReactNode})`, `DetailPanel({open,onClose,children})` ; props de shell portent callbacks/navigation, aucune dépendance FS. Scripts root nouveaux : `board:dev`, `board:build`, `board:e2e`. Playwright navigateur installé uniquement à l’exécution.

- [ ] **Step 1 — Tests E2E.** Page shell avec fixtures : navigation sidebar au clavier, thème système/clair/sombre, focus visible, panneau Escape restaure le déclencheur, reduced-motion. Créer smoke accessibilité avec assertions de rôle et noms ; captures 1440×900 et 768×1024.
  ```ts
  await page.getByRole('button', { name: 'Open issue details' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open issue details' })).toBeFocused();
  ```
  Le déclencheur de cet exemple est une fixture de test, pas une fausse action dans le produit livré.
- [ ] **Step 2 — Rouge.** Après setup harness minimal, `bun run board:e2e -- shell.spec.ts` échoue sur shell absent ; vérifier que l’échec n’est pas seulement celui du navigateur non installé.
- [ ] **Step 3 — Implémenter tokens/shell.** Ajouter seulement les primitives nécessaires, palette de la spec, Inter locale et Lucide. Définir JSX/browser tsconfig et exclure E2E du runner Bun sans masquer les tests existants. Vite dev sert via proxy même origine vers le serveur fixture ; aucune connexion distante.
- [ ] **Step 4 — Vert.** Même E2E, `bun run typecheck`, `bun run board:build`. Ouvrir les screenshots et vérifier visuellement les surfaces ; créer `docs/validation/frame-board-visual.md` avec sources publiques Linear observées et différences constatées, sans approuver automatiquement une image générée.
- [ ] **Step 5 — Commit.** `git commit -S -m "feat(board): add the application shell and visual tokens"` après staging ciblé, fontes/licence incluses.

### Task C2: Routes, client typé et reprise de synchronisation

**Files:** Create `apps/board/src/data/{client,query-keys,bootstrap,sync}.ts`, `src/data/sync.test.ts`, `src/routes/search-params.ts`, `src/routes/search-params.test.ts`, `e2e/sync.spec.ts`; modify `app.tsx`, `routes/router.tsx`.

**Interfaces:** `bootstrapBoard(): Promise<{realmKey:string;client:BoardClient;snapshot:BoardSnapshot}>` ; `BoardClient` type inféré du client tRPC d’AppRouter ; `startBoardSync(client:BoardClient, cache:QueryClient, snapshot:BoardSnapshot): () => void` ; `parseIssueSearch(raw:Record<string,unknown>): IssueSearch` selon URL de la spec. bootstrap charge une fois hors cache pour apprendre realmKey, puis initialise la clé snapshot canonique.

- [ ] **Step 1 — Tests.** Query keys isolées par realm ; bootstrap fragment effacé ; token jamais en localStorage ; replay de deux events/duplicata ; reset rebootstrap snapshot puis reprise sans trou ; déconnexion désactive writes ; query invalide et back/forward ne crashent pas. Test logique :
  ```ts
  expect(parseIssueSearch({ layout: 'other', direction: 'oops' })).toMatchObject({ layout: 'list', direction: 'asc' });
  ```
  E2E : éditer le realm depuis une seconde CLI et attendre le nouveau titre dans le DOM sans reload.
- [ ] **Step 2 — Rouge.** `bun test apps/board/src/data/sync.test.ts apps/board/src/routes/search-params.test.ts`, puis `bun run board:e2e -- sync.spec.ts`.
- [ ] **Step 3 — Implémenter.** tRPC Query + httpSubscriptionLink avec Authorization, cache unique, batching invalidations ; paramètres URL validés et retour focus déclenche resnapshot. Subscription depuis cursor du snapshot, aucun refetch global par fichier. Donner un état session-expired avec possibilité de rouvrir l’URL terminal.
- [ ] **Step 4 — Vert.** Même commandes, test deux onglets et arrêt serveur ; inspecter bundle pour absence `node:fs`/runtime SDK.
- [ ] **Step 5 — Commit.** `git commit -S -m "feat(board): synchronize routes and cached realm data"`.

### Task C3: Liste virtualisée et détail Markdown

**Files:** Create `src/features/issues/{issue-list,issue-row,issue-detail,issue-editor,issue-filters}.tsx`, `src/features/issues/select-issues.ts`, son `.test.ts`, `src/components/markdown.tsx`, `e2e/issues.spec.ts` (tous sous apps/board) ; modify router, package.json, bun.lock.

**Interfaces:** `selectIssues(rows: readonly Versioned<IssueSummary>[], query: BoardQuery, order: {sort:'priority'|'updated';direction:'asc'|'desc'}, config: RealmConfigDTO): readonly Versioned<IssueSummary>[]`; composants reçoivent ID ou DTO, jamais repository. Éditeur expose `onSave(body:string):Promise<void>` branché sur le coordinateur C4 ; lecture et brouillon fonctionnent avant sa livraison.

- [ ] **Step 1 — Tests.** Filtre ID/titre NFC, priorité custom, égalités triées par ID, 10k lignes mais DOM borné au viewport+overscan ; deep link, panneau depuis query issue, body absent du bootstrap, suppression externe ferme panneau. Markdown script/URL javascript et image distante non exécutés/chargés.
  ```ts
  expect(await page.locator('[data-issue-row]').count()).toBeLessThan(100);
  await expect(page.getByRole('heading', { name: fixtureTitle })).toBeVisible();
  ```
- [ ] **Step 2 — Rouge.** `bun test apps/board/src/features/issues/select-issues.test.ts` et `bun run board:e2e -- issues.spec.ts`.
- [ ] **Step 3 — Implémenter.** TanStack Virtual, filtres dérivés, query détail lazy, source Markdown+aperçu chunké, aucun raw HTML ; brouillon sessionStorage par realm/id, conflit externe conservant le brouillon. Actions mutatrices raccordées en C4, sans livrer de bouton actif factice dans ce commit.
- [ ] **Step 4 — Vert.** Tests et screenshots liste/détail dark/light ; restaurer scroll/focus via back. Documenter les écarts de rendu à la référence publique observée.
- [ ] **Step 5 — Commit.** `git commit -S -m "feat(board): browse virtualized issues and markdown details"`.

### Task C4: Mutations optimistes et board interactif

**Files:** Create `src/data/mutations.ts`, `mutations.test.ts`, `src/features/issues/{issue-board,issue-card,create-issue-dialog,issue-properties,bulk-actions}.tsx`, `e2e/mutations.spec.ts`, `e2e/board.spec.ts`; modify issue-editor, routes, dépendances dnd-kit.

**Interfaces:** `createMutationCoordinator({client,cache,realmKey}: {client:BoardClient;cache:QueryClient;realmKey:string}): {execute(command:BoardCommand):Promise<CommandResult>;pending(entity:EntityRef):boolean;dispose():void}` ; `IssueBoard({issues,onStatusChange})` où callback `(id:string,status:IssueDTO['status'])=>Promise<void>`. Générer UUID mutation/epoch courant dans les actions, expected revision via cache puis réponse précédente de la file.

- [ ] **Step 1 — Tests.** Deux edits rapides sur même ID, échec du premier, événement externe entre patch et réponse, retry désactivé, ID temporaire remplacé, delete, création ambiguë, gate refusée. DnD souris/clavier avec virtualisation et drop même colonne sans requête ; bulk partiellement refusé affiche les résultats par ID.
  ```ts
  expect(recordedCommands).toHaveLength(1); // réponse perdue ne crée aucun retry
  expect(cache.getQueryData(issueKey)).toEqual(latestCanonicalIssue);
  ```
  Le test contrôle le client et la livraison des réponses avec des Promises résolues explicitement, pas des délais réels.
- [ ] **Step 2 — Rouge.** `bun test apps/board/src/data/mutations.test.ts`, `bun run board:e2e -- mutations.spec.ts board.spec.ts`.
- [ ] **Step 3 — Implémenter.** File par entité, patch marqué mutationId, rebase et abandon explicite de pending en erreur ; aucun rollback de tout le snapshot. Brancher tous champs issue exposés, save body, création et suppression confirmée. DnD overlay et action menu équivalente, aucun ordre durable inventé.
- [ ] **Step 4 — Vert.** Tests ; lancer scénario complet UI→SDK→fichiers→CLI et CLI→SSE→UI ; fermer la connexion après commit et vérifier absence de deuxième trace automatique.
- [ ] **Step 5 — Commit.** `git commit -S -m "feat(board): edit issues optimistically and move cards"`.

### Task C5: Projets, jalons, specs et activité

**Files:** Create `src/features/projects/{project-list,project-detail,create-project-dialog}.tsx`, `src/features/milestones/{milestone-list,create-milestone-dialog}.tsx`, `src/features/specs/{spec-list,spec-detail,create-spec-dialog}.tsx`, `src/features/activity/activity-list.tsx`, `e2e/projects.spec.ts`; modify router et palette d’actions.

**Interfaces:** Pages consomment snapshot/detail/history et les variantes de BoardCommand existantes ; `ProjectDetail({projectId:string})` contient les cinq onglets exacts de la spec. Aucun endpoint ajouté pour contourner l’absence de métier.

- [ ] **Step 1 — E2E.** Créer projet, milestone, spec via UI ; statut modifié et trace affichée ; issues d’un autre projet absentes de la vue scoped même si query string le réclame ; pagination historique aux timestamps égaux ne duplique ni ne saute ; empty/error states et suppression externe.
  ```ts
  await expect(page.getByRole('tab', { name: 'Milestones' })).toBeVisible();
  await expect(page.getByText(otherProjectIssueTitle)).toHaveCount(0);
  ```
- [ ] **Step 2 — Rouge.** `bun run board:e2e -- projects.spec.ts` échoue sur routes/actions absentes.
- [ ] **Step 3 — Implémenter les pages.** Réutiliser composants shell/propriétés/Markdown et filtres ; création/status seulement pour ces objets, pas de faux édition/delete. Activité paginée et pas toutes les traces au bootstrap.
- [ ] **Step 4 — Vert.** E2E ; captures de chaque onglet en dark/light et vérification focus. Les vues utilisent les vrais types de domaine, aucun cycle sous le nom milestone.
- [ ] **Step 5 — Commit.** `git commit -S -m "feat(board): navigate projects milestones specs and activity"`.

### Task C6: Palette, vues enregistrées et settings

**Files:** Create `src/features/search/{command-palette,shortcuts}.tsx`, `src/features/views/{saved-views,preferences}.ts`, `src/features/views/preferences.test.ts`, `src/features/settings/settings-page.tsx`, `e2e/navigation.spec.ts`; modify shell et router.

**Interfaces:** BoardPreferences défini au serveur B4 ; `loadPreferences(client:BoardClient):Promise<Versioned<BoardPreferences>>`, `savePreferences(client:BoardClient, current:Versioned<BoardPreferences>, next:BoardPreferences):Promise<Versioned<BoardPreferences>>`. `useBoardShortcuts(actions: ShortcutActions): void` ; actions nommées openPalette/createIssue/focusSearch/next/previous/open/close.

- [ ] **Step 1 — Tests.** JSON corrompu → defaults et diagnostic sans écrasement ; isolation deux realms ; deux onglets se réconcilient au focus ; une vue persiste après restart sur nouveau port via même realmKey et le stockage serveur. Conflit de préférence entre onglets → relecture avant réécriture. Raccourcis ignorés lors de saisie/IME, overlays Escape en pile, Ctrl/Cmd+K, settings config valide/invalide.
- [ ] **Step 2 — Rouge.** `bun test apps/board/src/features/views/preferences.test.ts`, `bun run board:e2e -- navigation.spec.ts`.
- [ ] **Step 3 — Implémenter.** Palette Base UI Combobox, navigation par raccourcis de spec, favoris/vues, thème/densité via board.preferences.get/set ; config via board.execute avec operation config.set et expectedConfigRevision. Ne jamais stocker un token ou le snapshot dans localStorage. Les libellés de raccourcis sont visibles dans la palette.
- [ ] **Step 4 — Vert.** Tests, inspection visuelle des menus/dialogues imbriqués, clavier sur 768 px.
- [ ] **Step 5 — Commit.** `git commit -S -m "feat(board): add keyboard navigation and saved views"`.

### Task C7: Assets embarqués et distribution hors checkout

**Files:** Create `scripts/build-board-assets.mjs`, `scripts/build-board-assets.test.ts`, `apps/cli/src/board-assets.ts`, `scripts/board-package-smoke.mjs`; modify `.gitignore`, root `package.json`, `apps/cli/package.json`, `apps/cli/src/commands/board.ts`, `scripts/prepare-cli-release.mjs`, `scripts/package-smoke/run.mjs`, `.github/workflows/ci.yml` et pipeline release si son entrée de build contourne le script partagé.

**Interfaces:** Script génération prend `apps/board/dist`, produit `apps/cli/src/generated/board-assets.ts` ignoré ; `getBoardAsset(path:string):Promise<{body:Uint8Array;contentType:string;etag:string}|null>` satisfait AssetProvider. Scripts `board:build` puis génération avant les deux builds ; `board:smoke` = script smoke paquet/binaire, sans publication.

- [ ] **Step 1 — Tests.** Manifeste inclut CSS, fonts, chunks, index ; chemins encodés normalisés/refusés ; binary bytes base64 round-trip exact, hash stable, asset absent null. Smoke E2E attend serveur installé hors checkout et vérifie aucun accès externe, route profonde et chunk éditeur.
  ```ts
  expect(await getBoardAsset('/assets/missing.js')).toBeNull();
  expect(Buffer.from(asset.body)).toEqual(originalFontBytes);
  ```
- [ ] **Step 2 — Rouge.** `bun test scripts/build-board-assets.test.ts` puis premier `bun run board:smoke` échoue sans assets intégrés ; distinguer le résultat du pack/install de celui du navigateur.
- [ ] **Step 3 — Implémenter le pipeline.** Vite build unique, module généré, decoding lazy, import serveur/UI seulement pour board. Normaliser MIME/ETag et fichiers incluant noms Unicode ; aucun chemin absolu embarqué vers le checkout. Adapter release preparation sans perdre les dépendances bundlées. Ajouter CI E2E/smoke sans toucher aux secrets ni lancer publication.
- [ ] **Step 4 — Vert.** `bun run build`, `bun run build:bin`, `bun run board:smoke` ; tester sous Node 22 et 24 et le binaire Bun. `frame --help` ne démarre pas le serveur ; noter coût startup/poids binaire dans rapport.
- [ ] **Step 5 — Commit.** `git commit -S -m "build(board): embed frontend assets in CLI distributions"`.

### Task C8: Validation finale et budgets mesurés

**Files:** Create `scripts/board-benchmark.ts`, `apps/board/e2e/performance.spec.ts`, `docs/validation/frame-board-performance.md`; update `docs/validation/frame-board-runtime.md`, `docs/validation/frame-board-visual.md`, `README.md`, `apps/cli/README.md`, `docs/archi.md`, root scripts.

**Interfaces:** `board:bench` génère des realms temporaires seed 42, lance build production et Playwright ; écrit JSON/rapport avec versions/hardware/corpus/p50/p95/mémoire. Ne stocker aucun corpus généré ni screenshot temporaire dans les sources par défaut ; pièces de validation sous répertoire d’artefacts ignoré et liens précis dans le rapport.

- [ ] **Step 1 — Écrire les scénarios de mesure.** Dix lancements, trente interactions après cinq warmups, corpus 1k/10k/50k de la spec ; chronométrer startup/scan distincts du rendu à chaud, recherche/navigation, réponse visuelle optimiste distincte du commit, propagation externe après fichier stabilisé. Capturer RSS/heap et long tasks. Les tests produisent aussi une mesure lorsque le budget est dépassé, avec statut failed au lieu de supprimer la ligne.
- [ ] **Step 2 — Vérifier la détection d’un dépassement.** Introduire dans le harness de test une latence contrôlée de 200 ms à une recherche ; l’assertion p95 < 100 ms doit échouer. Retirer l’injection avant les mesures produit. Aucun ralentissement artificiel dans les fixtures normales.
- [ ] **Step 3 — Compléter documentation et observations.** Fonctionnement local, limites éditeurs externes/anciens clients, recovery conflict, config, routes disponibles ; matrice références visuelles observées/non observées. Référencer la spec initiale sans dire que tous les écrans Linear ont été répliqués.
- [ ] **Step 4 — Gate final.** `bun run typecheck`, `bun run lint`, `bunx biome format .`, `bun run test`, `bun run build`, `bun run build:bin`, `bun run board:e2e`, `bun run board:smoke`, `bun run board:bench`. Zéro échec non expliqué ; budgets 10k respectés ou écart explicite et tâche de correction avant déclaration complète. Revue Chromium/Firefox/WebKit, captures et reduced-motion ; nouvelle revue globale après toute correction structurante.
- [ ] **Step 5 — Commit.** `git commit -S -m "test(board): verify local workflows packaging and performance"` avec scripts/docs/tests concernés. Aucun push. Rapport final : ce qui fonctionne, commandes réellement passées, budgets atteints et limites restantes.
