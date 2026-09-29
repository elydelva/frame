# Frame Board — architecture et périmètre retenus

Date : 2026-09-29. Base inspectée : `3587379`. Statut : conception finalisée pour préparation de l’exécution ; aucun composant implémenté.

## Mandat

L’utilisateur a demandé de retenir automatiquement les recommandations de la recherche, de dérouler Superpowers sans questions jusqu’au plan, puis de réserver l’exécution à un second temps. Cette instruction remplace les validations intermédiaires interactives du workflow ; elle n’autorise pas le démarrage de l’implémentation dans cette passe.

Objectif : `frame board` ouvre une application personnelle locale, rapide, fidèle aux interactions et à la présentation de Linear, branchée sur les données réelles de Frame. Hypothèses retenues : un utilisateur local, un realm/worktree par processus serveur, plusieurs onglets, des agents et une CLI concurrents, fonctionnement sans Internet après installation.

## Dossier de conception et ordre de réalisation

1. [Persistance coordonnée](2026-09-29-frame-board-data-design.md) — transactions coopérantes, révisions et récupération.
2. [Serveur et synchronisation](2026-09-29-frame-board-server-design.md) — projection, API, événements et session locale.
3. [Interface et distribution](2026-09-29-frame-board-ui-design.md) — parcours, composants, packaging et mesures.
4. [Plan directeur](../plans/2026-09-29-frame-board.md) — dépendances, tâches et arrêt avant exécution.

Le découpage donne trois livrables testables. Il ne transforme pas un simple affichage de liste en livraison complète : la définition de terminé porte sur les trois lots.

## Contraintes globales normatives

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

## Décisions prises

| Décision | Choix | Alternative écartée et raison | Réouverture |
| --- | --- | --- | --- |
| Rendu | SPA React | SSR : couche supplémentaire sans gain mesuré pour l’usage répété | Premier écran reste hors budget après optimisation |
| UI | shadcn/Base UI personnalisé | Kumo : travail de transformation d’une identité Cloudflare ; Base UI nu : davantage de présentation à écrire | Pas de mélange de familles de primitives |
| Styles | CSS statique, tokens et Tailwind | StyleX : bénéfices possibles mais outillage supplémentaire | Profilage montre un coût de style significatif |
| API | tRPC JSON + schémas Zod | gRPC/Connect : contrats multilangages non requis | Un client non-TS devient un livrable réel |
| Événements | SSE tRPC | WebSocket : pas de flux bidirectionnel continu nécessaire | Présence/collaboration en temps réel |
| Données | Markdown + projection mémoire | SQLite métier, CRDT : changeraient le stockage et le modèle de conflits | SQLite seulement comme index reconstructible si mémoire/scan insuffisants |
| Préférences | JSON local serveur par realm | localStorage : origine changeante avec port éphémère | Pas de nouvelle entité métier |
| Cache navigateur | TanStack Query en mémoire | IndexedDB : invalidation et isolation supplémentaires | Temps de reprise mesuré insuffisant |
| DnD | `@dnd-kit/core` et `@dnd-kit/sortable`, versions compatibles épinglées ensemble | Déplacement HTML natif : contrôle clavier/overlay moins adapté au parcours retenu | Échec des tests clavier et virtualisation |
| Texte | `react-markdown` + GFM, éditeur source Markdown avec aperçu | Éditeur riche : risque de perte au round-trip | Besoin WYSIWYG ultérieur avec tests de fidélité |
| Animations | CSS transform/opacity | Bibliothèque d’animation globale : dépendance non nécessaire à ces transitions | Chorégraphie non réalisable proprement en CSS |
| État UI | React et URL | Deuxième store global répliquant les données Query | Seulement sur mesure de complexité réelle |
| Exécution future | Superpowers subagent-driven, séquentielle par tâche avec revue | Exécution native : moins de revues intermédiaires | Choix recommandé retenu automatiquement par instruction utilisateur |

Versions exactes des nouvelles bibliothèques à résoudre au début de la première tâche qui les consomme, vérifier leurs peer dependencies, puis épingler. Cette résolution ne remet pas en discussion les choix de stack. Le plan ne prétend pas avoir vérifié des combinaisons de versions non installées.

## Périmètre fonctionnel livré par les trois plans

| Surface | Capacités livrées | Source |
| --- | --- | --- |
| Shell | Sidebar, onglets, breadcrumbs, recherche et palette clavier | Routes et état UI |
| Issues | Liste/board, filtres, détail, création, édition des champs existants et du corps, statut, suppression | SDK + ajout ciblé de `body` à EditIssuePatch |
| Mes issues | Filtre sur l’acteur local du serveur | Champ `assignee` |
| Projets | Liste, création, détail, statut, onglets Overview/Issues/Milestones/Specs/Activity | SDK existant |
| Jalons | Liste, création, statut, issues associées | SDK existant |
| Specs | Liste, création, détail Markdown, statut | SDK existant |
| Activité | Traces filtrables, pagination | SDK existant |
| Vues enregistrées | Nom et filtres stockés dans le stateDir local du serveur | Préférences locales, aucune nouvelle entité métier |
| Settings | Thème et densité locaux ; champs configurables déjà exposés par le SDK | `.frameconfig` pour la configuration métier |
| États | Chargement, vide, conflit, déconnexion, fichier invalide, suppression externe | Contrats serveur |

Déplacements entre colonnes = changement de statut. Aucun ordre manuel durable des issues, champ de rang, déplacement entre projets, modification des règles métier ni glisser-déposer qui contourne les gates.

Projets, jalons et specs n’obtiennent pas une API CRUD imaginaire : seuls les opérations existantes et l’ajout explicite du corps d’issue sont exposés. Leur édition Markdown externe reste visible via synchronisation.

## Trajectoire vers toutes les pages de Linear

La demande de fidélité complète reste l’orientation produit. La première livraison couvre les domaines que Frame sait représenter. Les éléments ci-dessous sont explicitement hors des trois plans, et ne doivent pas être simulés par des onglets non fonctionnels.

| Extension future | Dépendance métier avant son UI | Critère de déclenchement |
| --- | --- | --- |
| Inbox | Abonnements, notifications, read/snooze persistants | Dossier métier dédié après validation du board |
| Cycles | Cycle, dates, allocation des issues et report | Ne pas réutiliser Milestone sous un autre nom |
| Teams / initiatives | Propriété, appartenance, relations entre projets | Choisir les nouveaux contrats et la migration du format |
| Commentaires / mentions | Identités et journal conversationnel | Ne pas faire passer une Trace pour un commentaire éditable |
| Worktrees / claims | Extraire la coordination CLI dans un service consommable | Même garanties de claim et de récupération que la CLI |
| Offline éditable / multiutilisateur | Files de mutations persistantes et politique de fusion | Nouveau besoin ; aucune promesse implicite en V1 |

Ces extensions ne disposent pas d’un faux plan prêt à coder : elles nécessitent des décisions de domaine distinctes. Le plan actuel est complet pour le périmètre recommandé, pas pour une réimplémentation de tout Linear.

## Risques et arbitrages

| Risque | Réponse décidée | Preuve attendue |
| --- | --- | --- |
| CLI et board écrivent ensemble | Transaction coopérante au niveau SDK/FS | Processus concurrents, pas seulement Promises |
| Crash entre entité et trace | Journal local et roll-forward idempotent | Injection de crash à chaque frontière de commit |
| Éditeur externe ignore le verrou | Hash des fichiers lus, vérification avant commit, arrêt sur conflit | Modification brute et conflit de récupération |
| Perte d’événements filesystem | Réconciliation, resnapshot sur trou/epoch | Watcher volontairement interrompu |
| Reconnexion après mutation ambiguë | Pas de retry automatique ; relecture canonique | Réponse perdue et redémarrage serveur |
| Rendu trop coûteux | Résumés sans corps, virtualisation, filtres dérivés | Corpus 1k/10k/50k, p50/p95 et mémoire |
| Nouvelles pages sans modèle | Périmètre et roadmap séparés | Aucun onglet factice dans les captures |
| Markdown malformé masqué par les parsers défensifs | Diagnostic explicite, dernière valeur valide marquée périmée | Fichier invalide visible sans suppression silencieuse |
| Assets manquants dans npm/binaire | Deux smoke tests hors checkout, sans Internet | CSS/fonts/chunks et routes profondes chargés |
| Dépendances navigateur dans core/SDK | Contrats DTO à imports type-only et garde de bundles | Aucun `node:fs` dans le bundle navigateur |

Limite acceptée : une édition brute peut se produire entre vérification de hash et renommage ; un verrou coopératif ne transforme pas un éditeur externe en transaction. Conserver les données de journal en cas de conflit et ne jamais annoncer une protection absolue contre ces écrivains.

## Validation et sortie

Vérification métier et protocole dans Bun ; vrais processus pour concurrence ; Playwright pour parcours, clavier, screenshots et mesures. Pas de test qui vérifie uniquement qu’un composant contient la même chaîne que son implémentation.

Gates : tests existants, typecheck, lint, format, couverture actuelle de 80 % lignes/fonctions conservée, build npm, build binaire, smoke tests hors checkout, E2E, audit visuel et rapport de performances. Les budgets sont des objectifs de conception, jamais des résultats présumés.

Référence documentaire : [recherche initiale et sources](../../frame-board-research.md). La présentation Linear d’août 2026 motive les choix de cache et CSS statique, sans extrapoler ses chiffres à Frame. Sources complémentaires : [proper-lockfile](https://github.com/moxystudio/node-proper-lockfile), [dnd-kit](https://dndkit.com/), [react-markdown](https://github.com/remarkjs/react-markdown).

## Journal du workflow de préparation

- [x] Explorer le checkout et les chemins actifs ; distinguer l’ancien emplacement `packages/frame` de `apps/cli`.
- [x] Reprendre les besoins exprimés et consigner les hypothèses sans questionnaire.
- [x] Comparer les approches et choisir automatiquement les recommandations.
- [x] Décomposer la conception par responsabilités et spécifier les limites.
- [x] Écrire les sous-spécifications et les plans associés.
- [x] Relire cohérence des signatures, risques et couverture des exigences.
- [ ] Exécuter les plans — réservé au prochain temps explicitement demandé par l’utilisateur.
