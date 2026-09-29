# Frame Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer `frame board`, application locale fidèle à Linear sur les objets actuels de Frame, cohérente avec la CLI et les agents.

**Architecture:** Une SPA React communique avec un serveur local par tRPC/SSE. Le serveur projette les fichiers Markdown en mémoire et compose les mutations SDK dans une persistance coordonnée. La CLI distribue l’interface compilée dans son paquet npm et son binaire Bun.

**Tech Stack:** Bun du dépôt, TypeScript strict, Node pour la distribution npm, React/Vite, shadcn/Base UI, Tailwind, TanStack Router/Query/Virtual, Hono/tRPC/Zod, Chokidar, proper-lockfile, dnd-kit, react-markdown, Playwright.

**Spec:** [Architecture et périmètre](../specs/2026-09-29-frame-board-design.md), puis les trois sous-spécifications liées.

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

## Review Focus

- Racines symlinkées et worktrees distincts : même racine canonique = même verrou, autre worktree = autre identité ; A1 et B6.
- Écriture après crash partiel et édition brute concurrente : récupérer sans doubler trace ni écraser conflit détecté ; A2 et B4.
- Snapshot puis abonnement avec événement intercalé : aucun trou ni événement rejoué deux fois ; B3 et C2.
- Mutation avec réponse perdue ou ancien epoch : ne pas recréer une issue automatiquement ; B4 et C4.
- Assets installés hors checkout, route profonde et absence de réseau : produit utilisable dans les deux distributions ; C7 et C8.

---

## État de cette préparation

Conception et plans terminés, exécution non démarrée. L’utilisateur a demandé de passer automatiquement les décisions de préparation ; cette autorisation ne s’étend pas au code produit. Aucun statut de test runtime ou de performance n’est acquis par ces documents.

Méthode retenue pour la prochaine passe : **subagent-driven-development**, un implémenteur par tâche puis revue de conformité et revue de code avant la suivante ; revue globale à la fin. Ne pas lancer 19 implémenteurs simultanément : les contrats et la persistance sont partagés.

## Ordre et dépendances

| Lot | Plan | Tâches | Résultat autonome |
| --- | --- | --- | --- |
| A | [Persistance](2026-09-29-frame-board-data.md) | A1–A5 | CLI/SDK coordonnés et récupération testée |
| B | [Serveur](2026-09-29-frame-board-server.md) | B1–B6 | API locale et événements testés, commande démarrable |
| C | [Interface et distribution](2026-09-29-frame-board-ui.md) | C1–C8 | Board complet, distribution et rapport de validation |

Chaîne : A1 → A2 → A3 → A4 → A5 → B1 → B2 → B3 → B4 → B5 → B6 → C1 → C2 → C3 → C4 → C5 → C6 → C7 → C8. Les fixtures documentaires peuvent être préparées en parallèle, mais aucune modification du même fichier par deux agents.

Chaque tâche comporte un cycle test rouge/implémentation/test vert et un commit signé ciblé. Ne pas écrire l’implémentation complète dans le plan ; les signatures et les comportements fixent les choix qui importent.

## Prévol de la future exécution

- [ ] Inspecter `git status`, HEAD, les artefacts/worktrees disponibles et les fichiers AGENTS applicables ; préserver les travaux d’autres chats.
- [ ] Appliquer using-git-worktrees à l’exécution ; réutiliser un checkout adapté ou créer un worktree géré et une branche `codex/frame-board` si nécessaire.
- [ ] Lire architecture et trois specs ; comparer la base réelle à `3587379`, adapter uniquement les chemins si le dépôt a évolué et consigner toute différence de contrat.
- [ ] Exécuter `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build` ; noter les échecs de base sans les présenter comme régressions du board.
- [ ] Résoudre les nouvelles dépendances lors de la première tâche consommatrice ; vérifier leurs peer dependencies et le support du Bun épinglé. En cas d’incompatibilité, choisir la dernière version stable compatible de la même bibliothèque et l’épingler, pas changer de stack silencieusement.
- [ ] Commencer A1 seulement après une instruction utilisateur d’exécution dans le second temps.

## Contrôles de passage

- [ ] Après A : toutes mutations SDK FS passent par la coordination ; custom repositories et CLI historiques restent compatibles ; crash/concurrence interprocessus prouvés.
- [ ] Après B : tests API/session/replay passent ; commande libère tous ses handles ; une modification CLI devient un batch de changements.
- [ ] Après C : parcours, screenshots, package npm et binaire hors checkout passent ; rapport de perf présente mesures et écarts aux budgets.
- [ ] Exécuter une seule fois la suite complète après la dernière modification pertinente ; élargir seulement si une nouvelle anomalie le justifie.
- [ ] Revue globale contre les exigences D1–D7, S1–S6, U1–U8 et C1–C11 ; aucune affirmation de parité totale Linear au-delà du périmètre livré.

## Auto-revue de préparation

Critères de couverture : chaque exigence D/S/U possède une tâche propriétaire et un scénario de validation. Les limites offline, éditeurs externes, domaines futurs et chiffres de performance sont explicites. Les noms de procédures sont identiques entre specs et plans. Les commandes de tests nouvelles ne sont utilisées qu’après la tâche qui les crée.

Documents de validation à produire **pendant l’exécution**, pas résultats anticipés : `docs/validation/frame-board-runtime.md`, `docs/validation/frame-board-visual.md`, `docs/validation/frame-board-performance.md`. Ils doivent contenir les commandes réellement exécutées, les versions et les écarts observés. Le dossier présent ne contient aucune mesure inventée.
