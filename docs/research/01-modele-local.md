# Modèle local : reprendre les concepts de Linear dans la CLI Frame

29 septembre 2026. Orientation demandée : **fidélité à Linear pour toutes les fonctionnalités retenues parce qu'elles sont utiles à Frame**. Le stockage Markdown et l'accès CLI changent le support, pas le sens des objets. Cette révision remplace les propositions précédentes de ce fichier.

État inspecté : `451914f`. Ce document décrit une cible, pas le format actuellement supporté. Toutes les nouvelles commandes, propriétés et arborescences sont proposées. Les deux autres axes sont [le pilotage](02-pilotage-calcule.md) et [les services actifs](03-services-actifs.md).

## 1. Ce que signifie « alignement à 100 % »

Pour un usage retenu, reprendre les objets, relations, propriétés, valeurs par défaut et comportements de Linear. Ne pas construire une variante simplifiée qui porte le même nom avec une autre sémantique. Une fonctionnalité peut être différée sans inventer son remplacement.

Trois catégories explicites :

| Catégorie | Traitement |
|---|---|
| Socle à aligner | Équipes, issues, projets, jalons, documents, relations, workflows, priorités, estimations et labels |
| Extensions utiles du même modèle | Initiatives, cycles, updates, vues, commentaires, templates ; activation selon le besoin |
| Besoins spécialisés à différer | SLA, demandes clients, releases, gouvernance distante ; reprendre le modèle Linear si on les active |

Les capacités réservées à certains plans Linear peuvent exister localement. Une synchronisation doit cependant respecter les capacités et permissions du workspace distant. « 100 % » est un objectif de compatibilité sur le périmètre retenu, pas une affirmation de parité déjà testée ni une obligation de reproduire toute l'interface ou l'infrastructure de Linear.

Les références officielles restent normatives. Lorsqu'un détail n'est pas documenté, le vérifier dans le schéma/API ou par un scénario de comparaison avant de figer une règle Frame. Les noms de champs locaux ci-dessous ne prétendent pas reproduire exactement le schéma GraphQL.

## 2. Modèle métier cible

| Objet Linear à reprendre | Relation cible dans Frame | Ce qui manque aujourd'hui | Valeur dans la CLI |
|---|---|---|---|
| Workspace | Un realm représente un espace opérationnel ; identité indépendante du dépôt de code | Un simple chemin `root` | Sélectionner explicitement l'espace de travail |
| User / Team | Annuaire, membres, paramètres par équipe ; une équipe par défaut en solo | Chaînes libres pour les acteurs, aucune équipe | Affecter et filtrer sans ambiguïté |
| Issue | Appartient à une équipe ; projet, jalon, parent et cycle facultatifs | Projet obligatoire | Capturer une issue avant de choisir un projet |
| Project | Livrable partagé par des équipes ; équipe pilote et lead | Propriétés limitées | Planifier et coordonner un résultat |
| Project milestone | Étape interne à un seul projet | Objet présent, opérations limitées | Découper un livrable, déplacer une issue entre étapes |
| Initiative | Regroupement stratégique de projets | Absente | Relier plusieurs livrables à un objectif |
| Sub-initiative | Initiative liée à un ou plusieurs parents ; jusqu'à cinq niveaux | Absente | Représenter les programmes transverses |
| Cycle | Période de travail d'équipe, distincte du projet | Absent | Sélectionner le travail du cycle courant |
| Document | Contenu attaché au travail : projet, initiative, équipe, issue ou cycle | Seulement `Spec` spécialisée et corps Markdown | Lire/éditer une spec, un brief ou des notes |
| Update | Publication de santé d'un projet ou d'une initiative | Seulement traces techniques | Publier un point d'avancement explicite |
| View | Sélection dynamique, sans propriété des objets | Filtres ponctuels | Retrouver les mêmes listes en une commande |

Sources : [Concepts](https://linear.app/docs/conceptual-model), [Sous-initiatives](https://linear.app/docs/sub-initiatives), [Documents](https://linear.app/docs/documents). Les cardinalités documentaires exactes acceptées par l'API devront être confirmées pour chaque type de rattachement ; ne pas supposer qu'un document peut avoir arbitrairement plusieurs propriétaires simultanés.

## 3. Parcours CLI : organiser un programme

```sh
# Syntaxe cible. Les IDs ci-dessous représentent les valeurs retournées à la création.
frame team new --key ENG --name Engineering
frame initiative new --title "Lancement Enterprise" --owner USER-ELY
frame initiative new --title "Onboarding autonome" --parent INIT-0001
frame project new --title "Onboarding v2" --team ENG --lead USER-ELY
frame project edit PROJ-0001 --initiative INIT-0002 --priority high --target-date 2026-12-15
frame milestone new --project PROJ-0001 --title "Alpha interne" --target-date 2026-10-30
frame milestone new --project PROJ-0001 --title "Bêta clients" --target-date 2026-11-20
frame milestone list --project PROJ-0001
frame initiative show INIT-0001 --tree
```

Compléter création, lecture, édition, rattachement/détachement et suppression/restauration selon le cycle de vie de chaque objet. Les opérations de CLI appellent les mêmes cas d'usage que le SDK. L'initiative conserve une composition explicite ; une vue filtrée par label ne devient pas une initiative implicite.

Les projets reçoivent résumé et description, lead unique, membres, équipes et équipe pilote, priorité, labels, dates et ressources. Les périodes de date éventuellement moins précises qu'un jour doivent être préservées à l'import, pas converties silencieusement en dates inventées. Source : [Projects](https://linear.app/docs/projects), [Project overview](https://linear.app/docs/project-overview).

## 4. Parcours CLI : recevoir, planifier et terminer une issue

```sh
frame issue add --team ENG --title "Un nouvel utilisateur ne reçoit pas son invitation"
frame issue list --team ENG --status-category triage
frame issue edit ENG-101 --project PROJ-0001 --milestone MILE-0001 --assignee USER-ELY
frame issue edit ENG-101 --priority high --estimate 3 --due-date 2026-10-20
frame issue edit ENG-101 --cycle CYCLE-0001
frame issue status ENG-101 "In Review"
frame issue status ENG-101 Done
frame issue status ENG-101 Todo
frame issue edit ENG-101 --no-project --no-milestone
```

La dernière transition illustre la réouverture : ne pas conserver les états terminaux irréversibles de Frame. Les IDs d'état sont canoniques ; les noms sont des raccourcis résolus dans l'équipe de l'issue. Un transfert d'équipe doit mapper état, cycle et labels selon le contexte destination ; si une correspondance n'est pas unique, retourner les choix et un conflit explicite.

| Sujet | Alignement demandé | Conséquence pour Frame |
|---|---|---|
| Workflow | Statuts par équipe, catégories stables, état initial configurable, triage facultatif, doublon réservé | Remplacer les enums et comparaisons dispersées ; ne pas imposer un graphe universel de transitions |
| Priorité | None, low, medium, high, urgent ; ordre manuel dans un niveau | Les niveaux personnalisés actuels deviennent une donnée à migrer, pas le nouveau standard |
| Estimation | Paramètres et échelles Linear par équipe, valeur non estimée distincte de zéro | Revoir la configuration globale ; pas de conversion automatique heures→points |
| Labels | Identités, scope workspace/équipe, groupes exclusifs | Les noms seuls ne suffisent plus |
| Sous-issues | Parentage, copie de certaines propriétés et automatismes configurables | Reproduire le comportement documenté, sans inventer un héritage général |
| Archivage | Archivage automatique des éléments éligibles, accès aux archives et restauration | Pas de commande d'archivage manuel présentée comme équivalente à Linear |

Sources : [Issue status](https://linear.app/docs/configuring-workflows), [Priority](https://linear.app/docs/priority), [Estimates](https://linear.app/docs/estimates), [Labels](https://linear.app/docs/labels), [Parent and sub-issues](https://linear.app/docs/parent-and-sub-issues), [Delete and archive](https://linear.app/docs/delete-archive-issues).

La compatibilité inclut les defaults : sans estimation explicite, Linear peut compter une valeur par défaut selon les réglages d'équipe. La CLI doit montrer la configuration effective. Les opérations groupées utilisent les mêmes validations ; leur résultat JSON distingue les réussites et refus sans prétendre à une transaction distante globale.

## 5. Relations : ne pas assimiler un blocage Linear à une gate Frame

```sh
frame issue relation add ENG-102 --blocked-by ENG-101
frame issue relation add ENG-103 --related ENG-101
frame issue duplicate ENG-104 --of ENG-101
frame issue edit ENG-105 --parent ENG-101
frame project dependency add PROJ-0002 --blocked-by PROJ-0001
```

Reprendre les relations bloqué/bloquant, lié et doublon, et les dépendances projet fin→début. Linear documente notamment le passage d'un blocage résolu vers les relations associées. Source : [Issue relations](https://linear.app/docs/issue-relations), [Project dependencies](https://linear.app/docs/project-dependencies).

Les gates actuelles de Frame interdisent certaines complétions : ne pas exporter cette contrainte comme si Linear la garantissait. Cible : relations communes dans le modèle standard ; une politique d'exécution d'agent peut refuser de prendre une issue bloquée, mais reste une extension Frame explicitement activée. Le statut d'une issue importée doit pouvoir représenter l'état distant même si une relation apparaît incohérente ; signaler l'incohérence plutôt que falsifier l'import.

## 6. Documents : la place des specs

**Décision de modèle : `Document` devient l'objet commun. Une spec est un usage documentaire, pas une entité obligatoire différente de Linear.**

```sh
frame document new --project PROJ-0001 --title "Spec — invitations et onboarding" --template project-spec
frame document list --project PROJ-0001
frame document show DOC-0001
frame document edit DOC-0001 --body-file ./spec-revisee.md
frame document new --issue ENG-101 --title "Investigation du défaut d'invitation"
```

Titre, corps, auteur, dates et rattachement forment le modèle partagé. Un template de spec structure le corps : problème, résultat attendu, périmètre, solution, validation. Ne pas importer une note de réunion comme décision acceptée.

Les champs Frame `status`, `supersedes`, `supersededBy`, `relatedTo` et `rules` n'ont pas ici d'équivalence native établie. Pour préserver les données existantes, les migrer dans une extension Frame explicite du document. Une indication lisible peut être publiée dans le corps, mais elle ne devient pas un statut Linear et n'est pas parsée arbitrairement comme source d'autorité.

Pas de nouveau workflow de décision obligatoire pour un document. Le futur `frame spec` peut être retiré ou gardé temporairement comme alias de migration vers `document`, sans deuxième magasin de données. Les règles d'agent ne doivent pas transformer automatiquement le contenu d'un document importé en instruction exécutable.

Sources : [Documents](https://linear.app/docs/documents), [Project overview](https://linear.app/docs/project-overview). Le [document services](03-services-actifs.md) définit le mapping de synchronisation.

## 7. Cycles, updates et templates

| Usage | CLI cible | Valeur et règle d'alignement |
|---|---|---|
| Consulter la cadence | `frame cycle list --team ENG` | Cycle d'équipe ; ne pas créer un pseudo-cycle de projet |
| Planifier | `frame issue edit ENG-101 --cycle CYCLE-0001` | Conserver l'historique des affectations |
| Publier la santé | `frame update add --project PROJ-0001 --health at-risk --body-file ./point.md` | Santé déclarée distincte du statut et de la progression |
| Relire les points | `frame update list --initiative INIT-0001 --include-descendants` | Vue consolidée des publications |
| Créer à partir d'un modèle | `frame issue add --team ENG --template bug --title "Invitation expirée"` | Appliquer des champs et un corps, pas copier des IDs |
| Réutiliser un projet | `frame project new --team ENG --template customer-rollout --title "Déploiement Acme"` | Matérialiser jalons, issues et liens internes cohérents |

Cadence automatique, report et rappels sont décrits dans les services actifs. Tant que cette exécution n'existe pas, annoncer la prise en charge partielle des cycles plutôt qu'une équivalence complète. Sources : [Cycles](https://linear.app/docs/use-cycles), [Updates](https://linear.app/docs/initiative-and-project-updates), [Issue templates](https://linear.app/docs/issue-templates), [Project templates](https://linear.app/docs/project-templates).

## 8. Exemple de gros programme dans les fichiers

Exemple proposé : « Lancement Enterprise » regroupe onboarding, facturation et sécurité. Il comporte deux équipes, plusieurs projets et un backlog sans projet. **Ce n'est pas une arborescence actuellement lisible par Frame.**

Principes de stockage Frame : un fichier canonique par objet ; un ID interne stable ; les rattachements dans le frontmatter. Les dossiers sont une représentation locale, pas un format Linear. Les clés courtes ci-dessous représentent des IDs immuables pour rendre l'exemple lisible ; la cible utilise des IDs globaux résistants aux collisions, distincts des identifiants affichés comme `ENG-101`.

```text
.frameconfig                         # defaults locaux, connexion nommée sans secret
.frame/
├── manifest.json                    # version du format + identité du realm
├── workspace.md
├── users/
│   ├── user-ely.md
│   └── user-sam.md
├── teams/
│   ├── team-eng/
│   │   ├── team.md                  # clé ENG, membres, paramètres
│   │   ├── workflow.yaml           # IDs de statuts, catégories, ordre
│   │   └── cycles/
│   │       ├── cycle-41.md
│   │       └── cycle-42.md
│   └── team-design/
│       ├── team.md
│       └── workflow.yaml
├── initiatives/
│   ├── init-enterprise.md           # objectif parent
│   ├── init-adoption.md             # parentIds: [init-enterprise]
│   └── init-trust.md                # parentIds: [init-enterprise]
├── projects/
│   ├── project-onboarding/
│   │   ├── project.md
│   │   └── milestones/
│   │       ├── mile-alpha.md
│   │       ├── mile-beta.md
│   │       └── mile-launch.md
│   ├── project-billing/
│   │   ├── project.md
│   │   └── milestones/
│   │       ├── mile-checkout.md
│   │       └── mile-invoices.md
│   └── project-security/
│       ├── project.md
│       └── milestones/
│           └── mile-audit.md
├── issues/
│   ├── issue-101.md                 # ENG-101 : onboarding, alpha, cycle 41
│   ├── issue-102.md                 # ENG-102 : sous-issue de 101
│   ├── issue-103.md                 # ENG-103 : bêta, dépend de 101
│   ├── issue-104.md                 # ENG-104 : triage, aucun projet
│   ├── issue-201.md                 # ENG-201 : facturation
│   ├── issue-301.md                 # ENG-301 : sécurité
│   └── issue-design-12.md           # DES-12 : contribution design à onboarding
├── documents/
│   ├── doc-spec-onboarding.md       # spec attachée au projet onboarding
│   ├── doc-api-invitations.md       # autre document du même projet
│   ├── doc-program-brief.md         # document de l'initiative Enterprise
│   └── doc-runbook.md               # document de l'équipe ENG
├── relations/
│   ├── relation-01.md              # issue-101 bloque issue-103
│   └── relation-02.md              # dépendance entre projets
├── updates/
│   ├── update-onboarding-01.md
│   └── update-enterprise-01.md
├── comments/
│   └── comment-01.md               # target: issue-101
├── labels.yaml                     # labels, scopes et groupes
├── views/
│   ├── view-my-work.md
│   └── view-enterprise.md
├── templates/
│   ├── bug.md
│   ├── project-spec.md
│   └── customer-rollout.md
└── events/                         # historique métier durable, pas cache de calcul
    └── event-01.md
```

Les milestones sont physiquement **dans leur projet**, car ils lui appartiennent exclusivement. Les issues ne sont pas rangées dans les milestones : une issue peut changer de projet, de cycle et de jalon sans changer d'identité ni de chemin. Les sous-issues restent dans `issues/` avec `parentId`. Un dossier `sub-initiatives/` serait incorrect pour une initiative ayant plusieurs parents.

Documents et updates sont au niveau realm, rattachés par ID ; cela permet plusieurs types de cibles sans copies concurrentes. Aucun dossier `specs/` distinct en cible. Le dossier des projets ne représente pas des dépôts Git : un projet opérationnel peut couvrir plusieurs dépôts.

### Contenu d'un projet

```yaml
# .frame/projects/project-onboarding/project.md
---
id: project-onboarding
identifier: PROJ-0001
name: Onboarding v2
summary: Première utilisation autonome pour les clients Enterprise
statusId: project-started
leadId: user-ely
teamIds: [team-eng, team-design]
leadTeamId: team-eng
memberIds: [user-ely, user-sam]
initiativeIds: [init-adoption]
priority: high
startDate: '2026-10-01'
targetDate: '2026-12-15'
---
Permettre la configuration, l'invitation et la première utilisation sans support manuel.
```

### Contenu d'un milestone

```yaml
# .frame/projects/project-onboarding/milestones/mile-alpha.md
---
id: mile-alpha
projectId: project-onboarding
name: Alpha interne
targetDate: '2026-10-30'
position: 1
---
Parcours complet validé sur un tenant interne.
```

Le statut manuel `pending/active/done` de l'ancien modèle n'est pas reconduit comme vérité indépendante : la cible restitue la progression du jalon à partir des issues selon les règles Linear. Les détails API non confirmés sont vérifiés avant migration.

### Contenu d'une issue

```yaml
# .frame/issues/issue-101.md
---
id: issue-101
identifier: ENG-101
teamId: team-eng
projectId: project-onboarding
milestoneId: mile-alpha
cycleId: cycle-41
parentId: null
title: Envoyer une invitation au premier administrateur
statusId: eng-in-progress
priority: high
estimate: 3
assigneeId: user-ely
labelIds: [label-feature]
dueDate: '2026-10-20'
---
L'administrateur reçoit un lien à usage unique et peut rejoindre son organisation.
```

`issue-102` référence `parentId: issue-101`. Pour `issue-104`, `projectId`, `milestoneId` et `cycleId` valent `null` ; `teamId` reste renseigné. Un milestone doit appartenir au projet choisi. Le cycle doit être disponible pour l'équipe, en tenant compte d'un éventuel héritage.

### Contenu d'une spec, désormais document

```yaml
# .frame/documents/doc-spec-onboarding.md
---
id: doc-spec-onboarding
title: Spec — invitations et onboarding
projectId: project-onboarding
---
## Problème
La configuration initiale exige une intervention du support.

## Résultat attendu
Le premier administrateur termine le parcours seul.

## Périmètre
Invitation, activation du compte et choix de l'organisation.

## Validation
Tester lien expiré, réutilisation et invitation déjà acceptée.
```

Les autres types de document utilisent leur rattachement approprié, par exemple `initiativeId` ou `teamId`, selon le contrat API validé. Les métadonnées communes d'auteur/dates sont omises de ces exemples courts. Les définitions de statuts et labels référencées sont rangées dans la configuration de workspace/équipe ; les exemples ne constituent pas un realm de test complet.

Le cache, les checkpoints de synchronisation, réservations, livraisons et secrets ne sont pas mêlés à cette arborescence métier versionnée. Leur emplacement privé doit être explicitement lié au realm et, si nécessaire, au worktree.

## 9. Synchronisation et migration : préserver les données sans préserver les divergences

Le mapping relie ID Frame, ID Linear et type d'objet ; un titre ou un chemin n'est jamais une clé de synchronisation. Les relations restent en IDs internes, les identifiants lisibles sont résolus par la CLI. Un transfert d'équipe peut modifier l'identifiant affiché sans changer l'identité de l'issue.

| Ancien Frame | Cible | Migration nécessaire |
|---|---|---|
| Issue obligatoirement dans un projet | Issue d'équipe, projet facultatif | Équipe de destination explicite, nouveaux chemins, IDs conservés/mappés |
| `Spec` | `Document` | Corps conservé ; propriétés spécifiques dans extension Frame |
| `leads[]` | Lead unique + membres | Choix explicite si plusieurs leads, aucun premier élément choisi arbitrairement |
| Statuts fixes | Statuts d'équipe et catégories Linear | Mapping exhaustif, y compris `blocked`, `skipped`, `abandoned` |
| Priorités libres, heures | Valeurs/échelles compatibles | Rapport des valeurs non représentables ; conversion choisie |
| Gates strictes | Relations + éventuelle politique locale | Pas de contrainte inventée dans Linear |
| Milestone à état manuel | Jalon piloté selon le modèle Linear | Conserver l'ancien état dans l'historique de migration |

`blocked` ne devient pas automatiquement un état Linear : le blocage relève d'une relation ou d'un statut personnalisé explicitement choisi. La migration doit proposer un résultat inspectable, ne pas supprimer les propriétés non mappées et permettre une reprise après interruption.

Changer le format, refuser les anciens écrivains, fournir une commande de migration explicite et garder une sauvegarde. Les realms sans manifeste restent interprétés selon l'ancien format. La migration n'est jamais déclenchée par une lecture.

## 10. Intégration et critères de fidélité

- [core](../../packages/core/src/entities/index.ts) : objets et invariants compatibles ; comportement commun à toutes les entrées.
- [fs](../../packages/fs/src/realm.repository.ts) : fichiers canoniques, codecs, migration et écritures récupérables.
- [lint](../../packages/lint/src/engine.ts) : contrôler également les fichiers modifiés manuellement.
- [SDK](../../packages/sdk/src/frame.ts) : mêmes objets et mutations que la CLI, sans logique de terminal.
- [CLI](../../apps/cli/src/cli.ts) : commandes explicites, `--json`, erreurs structurées, lecture de corps depuis fichier/stdin.

Pour chaque opération retenue, vérifier scénario local, équivalent Linear, export/import et rejeu sans doublon. Les règles API non confirmées apparaissent comme couverture manquante. Les commentaires, abonnements et autres objets importés ne doivent pas être silencieusement perdus.

Ces documents remplacent les options précédentes « workflow global d'abord », « équipe facultative » et « Spec centrale ». Le [comparatif initial](2026-09-29-linear-frame-gap-analysis.md) reste un audit historique du code ; cette série définit désormais la cible produit. Aucun changement fonctionnel ni migration n'est exécuté ici.
