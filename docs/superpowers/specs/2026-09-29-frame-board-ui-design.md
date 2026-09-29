# Frame Board — interface, parcours et distribution

Parent : [architecture](2026-09-29-frame-board-design.md), C1–C11. Prérequis : [serveur](2026-09-29-frame-board-server-design.md). Livrable : commande locale utilisable dans la distribution npm et le binaire.

## Commande et cycle de vie

`frame board [--port <0..65535>] [--no-open]`. Port défaut 0. Racine résolue comme la CLI ; acteur `FRAME_ACTOR ?? GIT_AUTHOR_NAME ?? USER ?? 'unknown'`. Aucune création de realm implicite : si `.frame` n’existe pas, expliquer `frame init` et sortir 1. Format incompatible → erreur avant serveur. Port explicitement occupé → message et sortie 1 ; aucune sélection silencieuse d’un autre port.

Afficher `Frame Board: <URL bootstrap>` dans le terminal puis ouvrir le navigateur avec la bibliothèque `open`, sans interpolation shell ; `--no-open` n’ouvre rien. Échec de lancement du navigateur → message avec URL et serveur toujours actif. SIGINT/SIGTERM ferment le handle puis sortent 0. Pas de daemon, pas de singleton interprocessus imposé : deux boards du même realm partagent la coordination FS mais ont des sessions distinctes.

Support initial à valider : macOS/Linux, Node 22 et Node 24 pour le paquet npm, Bun épinglé par le dépôt pour le binaire. L’UI vise Chromium, Firefox et WebKit desktop ; largeurs de validation 1440, 1024 et 768 px. En dessous de 768 px, conserver une liste accessible et une sidebar repliable ; pas de promesse d’application mobile native. Aucun changement du support des commandes CLI existantes n’est déduit de ces cibles de test.

## Routes et pages

| Route | Contenu et actions |
| --- | --- |
| `/issues` | Liste/board de toutes les issues, filtres et création |
| `/my-issues` | Même vue, assignee fixé à l’acteur local |
| `/issues/$issueId` | Détail autonome ; ouverture depuis liste dans un panneau via `?issue=` |
| `/projects` | Projets et création |
| `/projects/$projectId/overview` | Corps Markdown, propriétés et statut |
| `/projects/$projectId/issues` | Liste/board filtré par projet |
| `/projects/$projectId/milestones` | Liste, création et statut des jalons |
| `/projects/$projectId/specs` | Liste et création de specs |
| `/projects/$projectId/activity` | Traces du projet |
| `/specs/$specId` | Détail et statut de spec |
| `/activity` | Traces globales |
| `/views/$viewId` | Vue enregistrée locale |
| `/settings` | Thème/densité et config modifiable du SDK |

Index `/` redirige `/issues`. Paramètres URL : `layout=list|board`, filtres BoardQuery, `sort=priority|updated`, `direction=asc|desc`, `issue=<id>`. Défauts : list, priority, asc ; l’ordre de priorité vient de config ; tie-break par ID. Paramètres inconnus ignorés ; valeurs invalides remplacées par défaut avec URL canonique, sans crash. Back/forward restaure filtres, panneau et scroll. Scope de projet imposé par la route, pas modifiable par query string.

Pas d’onglets Inbox/Cycles inactifs. Le texte UI est en anglais pour se rapprocher de la référence ; textes documentaires et aide explicative peuvent rester français. Branding Frame, icônes Lucide cohérentes, fonte Inter embarquée avec sa licence, aucune dépendance CDN.

## Fondations visuelles

Tokens initiaux de conception, à vérifier visuellement, **pas des mesures prétendument extraites de Linear** : sidebar 240 px, toolbar 48 px, ligne compacte 32 px/confort 40 px, texte principal 13 px/20 px, détail 640 px maximum, séparateur 1 px, rayon contrôles 6 px, cartes 8 px. Surface dark `#101113`, sidebar `#151619`, elevated `#1B1D21`, border `#2A2C32`, texte `#EEEFF2`, muted `#989BA5`, accent `#7C82F5`. Thème clair parallèle, contraste vérifié ; focus visible et états non distingués par couleur seule.

Transition contrôles 120 ms, panneau 180 ms, easing `cubic-bezier(.2,.8,.2,1)` ; uniquement opacity/transform sur les parcours critiques. `prefers-reduced-motion` supprime les mouvements. Z-index centralisé : sidebar 10, overlay DnD 30, popover 40, dialog 50, toast 60 ; tester les portals imbriqués plutôt que supposer que cette échelle suffit.

Pas de texture décorative ou de blur systématique ajouté sans référence visuelle. Une checklist de référence datée couvre sidebar, toolbar, onglets, listes, board, panneau, palette, menus et états dark/light. Utiliser les captures publiques déjà accessibles dans la documentation officielle de Linear et leurs URLs ; si une surface n’est pas observable, noter « référence non observée » dans le rapport, sans prétendre à une identité pixel près. Les captures propres au produit servent aux régressions une fois la présentation vérifiée.

## Composants et responsabilités

```text
apps/board/src/
  app.tsx                         # providers, router, boundaries
  routes/                         # définition explicite des routes
  components/ui/                  # primitives shadcn/Base UI sélectionnées
  components/shell/               # sidebar, toolbar, panel, breadcrumbs
  features/issues/                # liste, board, détail, mutations
  features/projects/              # pages projets et onglets
  features/milestones/            # liste, création, statut
  features/specs/                  # liste, création, détail
  features/activity/              # traces paginées
  features/search/                # palette et index titre/ID
  features/views/                 # filtres persistants locaux
  features/settings/              # préférences et config métier
  data/                           # tRPC, Query, sync, clés, optimisme
  styles/                         # tokens, thèmes, CSS global
```

Un fichier par composant public. Introduire uniquement les primitives consommées : button, input, select/combobox, dialog, popover/menu, tabs, tooltip. La palette utilise Base UI Combobox et une liste d’actions ; ne pas ajouter un autre moteur de focus. Les pages n’importent ni FS ni les commandes CLI.

## Propriété de l’état et synchronisation

TanStack Query est propriétaire des données serveur : clé snapshot `['board', realmKey, 'snapshot']`, détails `['board', realmKey, kind, id]`, activité `['board', realmKey, 'history', filters]`. Router possède URL/filtres ; React possède focus, sélection et ouverture des menus. Pas de copie permanente des entités dans un second store.

Initialisation : échanger le bootstrap, charger snapshot, s’abonner depuis son cursor. On applique les réponses de mutation aux détails/snapshot concernés puis on réconcilie sur batch ; un même événement est sans effet s’il ne change pas la révision. Suppressions retirent les résumés et ferment le panneau avec message. Un reset recharge atomiquement le snapshot avant le réabonnement ; les interactions en cours restent visibles mais les commandes sont suspendues jusqu’à reprise.

Changements externes fréquents : regrouper invalidations par batch ; pas de refetch de toutes les queries à chaque fichier. Les données résumées sont dérivées pour filtre/recherche/tri. Memoization et sélecteurs par lignes ; virtualiser les listes et l’intérieur des colonnes avec TanStack Virtual. Corps Markdown chargés à l’ouverture du détail. Éditeur et rendu Markdown sont des chunks différés.

Mutations : une file par entité, une seule requête active pour cet ID ; état optimiste immédiat, commandes suivantes rebasées sur la révision de la réponse précédente. Une erreur invalide/recharge l’entité et abandonne ses commandes en attente avec message. Un patch optimiste porte son mutationId ; un ancien callback ne restaure jamais un snapshot global. Création utilise un ID temporaire UI, remplacé par l’ID canonique ; échec ambigu conserve un marqueur « à vérifier », pas une seconde création automatique. `retry: false` pour toutes les mutations.

Déconnecté : bannière discrète, lecture du cache disponible, contrôles mutateurs désactivés. Brouillon du corps conservé dans sessionStorage par realmKey/id ; si la révision externe change pendant édition, afficher le conflit et conserver le brouillon sans autosave. Aucun replay automatique à la reconnexion.

Préférences version 1 dans le fichier local du serveur `~/.frame/state/<realmKey>/board-preferences.json` : thème system/light/dark, densité compact/comfortable, favoris, vues `{id:UUID,name,query,layout,sort,direction}`. Cette persistance indépendante de l’origine conserve les vues lorsque le port change. Pas de corps ni tokens. Le client lit/écrit par `board.preferences.get/set` avec révision attendue ; plusieurs onglets se réconcilient au retour de focus et après sauvegarde. JSON invalide → defaults avec diagnostic, fichier conservé, écriture refusée jusqu’à réparation explicite du fichier ; autre realm → données distinctes. Les brouillons en sessionStorage restent limités à l’onglet et à son origine : un changement de port ne promet pas leur récupération.

## Interactions

Cmd/Ctrl+K ouvre la palette ; `C` ouvre création d’issue ; `/` recherche ; `J/K` ou flèches déplacent la ligne active ; Enter ouvre ; Escape ferme l’overlay au sommet et restaure le focus. Ignorer les raccourcis de lettres dans input/textarea/contenteditable et pendant composition IME. Palette : navigation, recherche ID/titre, création. Pas de capture des raccourcis réservés au navigateur hors commande explicite.

DnD : déplacer une issue vers une colonne propose la transition `issue.setStatus`. Overlay dédié stable hors liste virtualisée, scroll automatique borné ; mêmes actions accessibles par menu clavier sans drag. Réponse DOMAIN_REJECTED → restauration de la carte canonique et message de gate/transition. Une drop dans la même colonne ne fait rien. Pas de rang persistant ni changement d’ordre promis.

Sélection multiple sur liste : shift-range et toggle ; actions de statut exécutées séquentiellement par issue avec rapport réussites/échecs. Pas de transaction globale de sélection. Suppression explicite dans un dialogue, pas au simple appui Backspace dans une liste. Éditeur Markdown : textarea monospace et aperçu, Ctrl/Cmd+Enter sauvegarde ; fermeture avec brouillon conserve la version session sans l’envoyer.

## Build et packaging

Vite produit des assets avec chemins relatifs au serveur et un manifeste. Un script transforme tous les fichiers `apps/board/dist` en module généré `apps/cli/src/generated/board-assets.ts` (base64 + MIME + hash). Ce fichier est ignoré par Git et généré avant les builds CLI/npm/binaire ; le provider décode paresseusement avec cache, pas tout au lancement de `frame --help`. Cela évite des chemins vers le checkout et garde les imports du board différés. Compresser à la réponse seulement si les mesures le justifient.

Le build normal, `build:bin`, `scripts/prepare-cli-release.mjs` et `scripts/package-smoke/run.mjs` doivent tous emprunter le même pipeline d’assets. Tester le paquet npm installé dans un répertoire temporaire et le binaire copié ailleurs ; lancer depuis un troisième répertoire avec FRAME_ROOT explicite. Vérifier les routes profondes, polices et chunks différés sans réseau externe. Ne pas publier pendant le smoke test.

Adapter tsconfig pour JSX et frontières browser/server via configs par app ; préserver le contrôle de tous les packages dans `bun run typecheck`. Playwright specs en `apps/board/e2e/*.spec.ts` exclues explicitement de Bun via `testPathIgnorePatterns` ; coverage server/core inchangée, logique client testée avec Bun, interactions dans Playwright. Ne pas réduire le seuil existant de couverture pour faire passer la suite.

## Mesures et définition de terminé

Budgets sur corpus 10 000 issues : premier écran à chaud < 1 s ; navigation/recherche p95 < 100 ms ; retour optimiste < 50 ms ; modification externe→UI p95 < 300 ms après stabilisation du fichier. Budget frame 16,7 ms à 60 Hz. Ces budgets ne s’appliquent pas au scan initial à froid, à mesurer séparément.

Corpus reproductibles 1k/10k/50k, seed fixe 42, 10 projets, titres 80 caractères, corps 2 Kio, 3 labels et 2 traces par issue, pas de données réelles. Dix lancements et trente interactions par scénario après cinq warmups ; rapport p50/p95, machine, OS, versions, build, RSS serveur, heap Chromium, taille JS/CSS compressée et non compressée. Les mesures 50k sont une caractérisation, pas une promesse de budget identique. En cas de dépassement, profiler et corriger ou signaler le budget non atteint ; ne pas fabriquer un PASS.

E2E : création/modification/statut, refus de gate, modification CLI visible, conflit éditeur, suppression externe, reconnexion, deux onglets, fermeture serveur, deep links, mode offline, focus et DnD clavier. Captures dark/light en 1440/1024/768, reduced-motion et overlays. Accessibilité : noms des contrôles, focus, navigation clavier et contraste contrôlés ; aucun score universel annoncé.

Couverture : U1 shell/tokens → C1 ; U2 état/routes/sync → C2 ; U3 liste/détail → C3 ; U4 DnD/mutations → C4 ; U5 pages secondaires → C5 ; U6 palette/préférences → C6 ; U7 distribution → C7 ; U8 validation/performance → C8.
