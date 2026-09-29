# Linear ↔ Frame : écarts opérationnels

État au 29 septembre 2026. Code Frame inspecté à `3587379`, checkout initialement propre. Comparaison avec la documentation officielle publique de Linear, tous plans confondus ; aucune inspection d'un workspace Linear particulier. Ce document est un inventaire pour discussion, pas une roadmap approuvée.

**Constat : Frame possède un socle d'exécution par issues, avec projets, jalons, specs et coordination Git. Il ne possède pas encore le modèle de pilotage stratégique, temporel et collaboratif de Linear.**

L'[inventaire Linear détaillé](linear-operational-inventory.md) complète cette matrice : opérations, sources officielles et limites documentées. « Absent » ci-dessous signifie absent du modèle et des interfaces livrés dans ce checkout ; écrire du texte libre ou utiliser un script externe ne constitue pas une fonctionnalité native.

## 1. Les modèles ne sont pas équivalents

| Relation | Linear | Frame actuel |
|---|---|---|
| Conteneur principal | Workspace avec équipes | Realm de fichiers ouvert par un `root` ; pas d'objet organisation/équipe |
| Stratégie | Initiatives et sous-initiatives | Absent |
| Initiative → initiative | Jusqu'à cinq niveaux ; plusieurs parents possibles | Absent |
| Initiative → projets | Regroupement stratégique et remontée des projets descendants | Absent |
| Projet → équipes | Plusieurs équipes, dont une équipe responsable | Absent |
| Issue → équipe | Une équipe porte le workflow | Pas d'équipe |
| Issue → projet | Projet facultatif ; au plus un projet à la fois | Exactement un projet obligatoire |
| Issue → milestone | Jalon facultatif du projet | `milestoneId` facultatif |
| Issue → parent | Sous-issues, conversions, automatismes | `parentId` facultatif ; pas des mêmes automatismes |
| Issue → cycle | Planification temporelle distincte du projet | Absent |
| Projet → documents | Documents et ressources | Corps Markdown et specs dédiées aux décisions |

Sources Linear : [Concepts](https://linear.app/docs/conceptual-model), [Projects](https://linear.app/docs/projects), [Sub-initiatives](https://linear.app/docs/sub-initiatives), [Project overview](https://linear.app/docs/project-overview). Sources Frame : [entités](../../packages/core/src/entities/index.ts), [SDK](../../packages/sdk/src/frame.ts), [stockage](../../packages/fs/src/realm.repository.ts).

Conséquences : un jalon n'est pas une sous-initiative ; un cycle n'est pas un jalon. Une initiative multiparent exige des relations explicites, pas seulement des dossiers imbriqués. Le projet obligatoire de Frame empêche aussi un backlog d'équipe sans projet artificiel. Un realm peut contenir plusieurs projets, mais Frame ne fournit pas de fédération de plusieurs realms.

## 2. Initiatives et sous-initiatives

Tout ce bloc est **absent** de Frame : aucune entité, persistance, commande ou API initiative.

| Dimension Linear | Ce qu'il faudrait représenter dans Frame pour une parité fonctionnelle |
|---|---|
| Identité et description | Identifiant, titre, description de l'objectif |
| Statut | Proposed, Planned, Active, Completed, Canceled |
| Priorité et labels | Priorisation et classification au niveau stratégique |
| Responsabilité | Owner et équipe responsable |
| Échéance | Date cible de l'initiative |
| Composition | Projets associés, parents et sous-initiatives |
| Ressources | Documents et liens attachés |
| Communication | Updates datées et indicateur de santé |
| Consolidation | Projets descendants, santé et avancement agrégés |
| Exploration | Filtres, regroupements, vues sauvegardées et graphe d'activité |

Les sous-initiatives et vues d'initiatives sont documentées comme Enterprise ; les initiatives d'équipe comme Business/Enterprise. Il s'agit ici du périmètre fonctionnel global, pas du seul plan gratuit. Sources : [Initiatives](https://linear.app/docs/initiatives), [Sub-initiatives](https://linear.app/docs/sub-initiatives), [Updates](https://linear.app/docs/initiative-and-project-updates).

## 3. Projets : propriétés et opérations

| Propriété / opération | Frame | Écart avec Linear |
|---|---|---|
| Identifiant, titre, description | Présent | Corps Markdown ; pas de résumé court séparé |
| Statut | Partiel | Cinq statuts fixes ; Linear permet des statuts personnalisés |
| Responsable | Différent | `leads: string[]`, contre un lead membre identifié dans Linear |
| Membres et équipes | Absent | Pas de membership ni de lead team |
| Priorité | Absent | La priorité configurable Frame concerne les issues |
| Labels et groupes de labels | Absent | La taxonomie Frame ne fournit pas de labels de projets |
| Date de début et date cible | Absent | Les dates de création/modification ne les remplacent pas |
| Icône et couleur | Absent | Propriétés de présentation |
| Initiatives associées | Absent | Pas de rattachement stratégique |
| Dépendances entre projets | Absent | Les gates d'issues ne modélisent pas une dépendance projet |
| Santé : on track / at risk / off track | Absent | Distinct du statut de cycle de vie |
| Updates de projet | Absent | Les traces d'opérations ne sont pas des rapports de santé |
| Documents et ressources | Partiel | Corps et specs ; pas d'objet ressource générique lié au projet |
| Avancement et prévision | Absent | Pas de pourcentage/velocity/prévision exposés dans les lectures inspectées |
| Créer / lister / changer le statut | Présent | CLI et SDK |
| Lire un projet isolé | Présent dans le SDK | Pas de `project show` dans la CLI ; contexte projet disponible |
| Modifier titre, responsables, dates | Incomplet | Pas d'opération `projects.edit` / `project edit` ; édition de fichier pour les champs existants |
| Clôturer puis rouvrir | Incomplet | `completed` et `cancelled` sont terminaux dans Frame |
| Templates, duplication, archivage | Absent comme workflow complet | Pas de commandes dédiées correspondantes |

Linear documente des dépendances projet **fin → début**, pas un ordonnanceur universel de type Gantt. Sources : [Overview](https://linear.app/docs/project-overview), [Priority](https://linear.app/docs/project-priority), [Status](https://linear.app/docs/project-status), [Dependencies](https://linear.app/docs/project-dependencies), [Updates](https://linear.app/docs/initiative-and-project-updates). Frame : [Project](../../packages/core/src/entities/project/project.ts), [commandes](../../apps/cli/src/commands/project/register.ts), [mutations SDK](../../packages/sdk/src/mutations.ts).

## 4. Milestones

| Capacité | Frame | Écart |
|---|---|---|
| Titre, description, projet | Présent | Base comparable |
| Date cible | Présent | `targetDate` |
| Ordre | Présent | Champ `order` ; pas de commande de réordonnancement après création |
| Statut | Présent | `pending`, `active`, `done`, changé explicitement |
| Rattacher / détacher une issue | Présent | Création et édition d'issue |
| Progression calculée à partir des issues | Absent | Linear expose la progression du jalon |
| Modifier / supprimer le jalon | Incomplet | Création, lectures et statut ; pas d'API générale d'édition/suppression |
| Convertir le jalon en projet | Absent | Opération Linear dédiée |
| Affichage timeline / filtres de jalon | Partiel | Filtre d'issues par milestone ; pas de timeline |

Les milestones Linear sont eux aussi internes à un projet, pas partagés entre projets. Source : [Project milestones](https://linear.app/docs/project-milestones). Frame : [Milestone](../../packages/core/src/entities/milestone/milestone.ts), [commandes](../../apps/cli/src/commands/milestone/register.ts).

## 5. Issues : propriétés

| Propriété | Frame | Différence |
|---|---|---|
| ID, titre, description | Présent | Identifiants `ISSUE-xxxx` au niveau realm, pas de préfixe d'équipe |
| Statut | Partiel | Enum fixe, sans catégories configurables |
| Priorité | Présent | Niveaux personnalisables dans `.frameconfig` |
| Estimation | Présent | Échelles configurables ; ne signifie pas suivi du temps passé |
| Labels | Partiel | Noms sur l'issue ; config avec couleur/groupe, sans gestion complète des groupes exclusifs |
| Assigné | Partiel | Chaîne libre, pas d'identité membre ni de permissions associées |
| Projet | Présent, plus restrictif | Obligatoire et non modifiable via `EditIssuePatch` |
| Milestone | Présent | Facultatif |
| Parent | Présent | Un `parentId`, ajout/retrait possibles |
| Dépendances | Partiel | `gates` ; sémantique différente des relations Linear |
| Liens « related » / doublons | Absent | Pas de relation dédiée ni de fusion de doublon |
| Équipe / cycle | Absent | Pas d'entités correspondantes |
| Date d'échéance / SLA | Absent | `startedAt` et `completedAt` sont des dates constatées |
| Abonnés, notifications | Absent | Aucun modèle de subscription |
| Client / demande client | Absent | Pas de Customer ni CustomerRequest |
| Release | Absent | Pas d'objet release opérationnelle |
| Liens PR / pièces jointes structurés | Absent | `branch` et liens dans le corps possibles, sans intégration |
| Auteur, dates, historique | Présent sous une autre forme | Traces locales et Git ; pas de journal serveur de collaboration |
| Champs personnalisés arbitraires | Pas de support Frame | Ne pas présumer un moteur de champs typés arbitraires côté Linear : non confirmé dans les sources consultées |

Sources Linear : [Concepts](https://linear.app/docs/conceptual-model), [Due dates](https://linear.app/docs/due-dates), [Issue relations](https://linear.app/docs/issue-relations), et sources thématiques de l'[inventaire](linear-operational-inventory.md). Frame : [Issue](../../packages/core/src/entities/issue/issue.ts), [EditIssuePatch](../../packages/core/src/use-cases/edit-issue/edit-issue.ts), [configuration](../../packages/core/src/config/realm-config.ts).

## 6. Issues : workflows réels

| Opération | Frame | Écart opérationnel |
|---|---|---|
| Créer, lire, lister, supprimer | Présent | CLI et SDK ; suppression sans corbeille applicative |
| Modifier les propriétés | Partiel | Titre, priorité, estimation, jalon, assigné, branche, labels, parent, gates |
| Modifier description / règles | Fichier uniquement après création via les API inspectées | `EditIssuePatch` ne contient ni `body` ni `rules` |
| Changer de projet / équipe | Absent | Pas de mutation de transfert de projet ; pas d'équipe |
| Démarrer / terminer / bloquer / abandonner | Présent | Transitions fixées dans le code |
| Rouvrir une issue terminée | Absent dans le workflow | `completed`, `abandoned`, `skipped` n'ont aucune transition sortante |
| Backlog, triage, review, QA | Absent comme états dédiés configurables | Pas d'équivalence complète avec `not-started` ou `blocked` |
| Sous-issues | Partiel | Parentage et héritage de règles dans le brief ; pas de clôture automatique parent/enfants |
| Conversion issue → projet | Absent | Ni duplication hiérarchique ni conversion native |
| Dépendances | Partiel | Vérifiées à la complétion ; utilisées par `next` et l'éligibilité worktree |
| Relations externes | Référence seulement | Les gates stockées en chaînes externes sont considérées satisfaites par le DAG |
| Répétition planifiée | Absent | Pas de récurrence ni de scheduler |
| Templates opérationnels / formulaires | Absent | Des fichiers exemples sont initialisés, sans moteur de sélection/application dans les créations inspectées |
| Opérations groupées | Absent comme API dédiée | Possible de boucler avec le SDK, mais ce n'est pas une opération de lot native |
| Archivage / rétention / restauration | Absent | Git permet de récupérer du contenu, sans workflow d'archivage Frame |

**Nuance sur les gates :** `start` valide la transition, mais pas les dépendances ; `complete` les contrôle. `issue worktree` contrôle d'abord l'éligibilité. Ce sont trois comportements distincts. Une gate `IssueId` résolue dans le realm bloque tant que sa cible n'est pas `completed` ; une référence externe en chaîne n'est pas résolue par ce moteur.

Sources Linear : [Issue status](https://linear.app/docs/configuring-workflows), [Parent and sub-issues](https://linear.app/docs/parent-and-sub-issues), [Issue relations](https://linear.app/docs/issue-relations). Frame : [transitions](../../packages/core/src/services/state-machine/state-machine.service.ts), [DAG](../../packages/core/src/services/dag/dag.service.ts), [start](../../packages/core/src/use-cases/start-issue/start-issue.ts), [complete](../../packages/core/src/use-cases/complete-issue/complete-issue.ts), [initialisation](../../packages/fs/src/realm.initializer.ts), [commandes issue](../../apps/cli/src/commands/issue/register.ts).

## 7. Les autres familles opérationnelles

Les sources précises, variantes et limites de ces fonctionnalités Linear sont regroupées dans l'[inventaire officiel sourcé](linear-operational-inventory.md). L'absence locale est établie par les entités, configuration, cas d'usage et surfaces CLI/SDK inspectés.

| Domaine Linear | Frame aujourd'hui | Nature du manque |
|---|---|---|
| Équipes, sous-équipes, membres, équipes privées | Pas d'objet équipe/utilisateur | Modèle et autorisations |
| Cycles, cadence, capacité, report des issues | Aucun cycle | Modèle temporel et automatisation |
| Triage, règles de routage, responsabilité du triage | Pas de file d'entrée | Processus d'admission du travail |
| Asks, formulaires, demandes Slack/email | Pas de connecteur | Collecte et synchronisation |
| Clients, demandes, importance et contexte commercial | Aucun objet client | Modèle de feedback produit |
| Releases et rattachement aux déploiements | Pas de release métier | Modèle et intégration CI/CD ; distinct des releases du binaire Frame |
| Commentaires, réponses, réactions, mentions | Corps Markdown et notes de traces | Collaboration structurée |
| Documents collaboratifs et commentaires inline | Specs locales | Édition collaborative et annotations |
| Inbox, abonnements, rappels, notifications | Aucune inbox | Identités et exécution active |
| Updates de santé et diffusion de l'avancement | Traces techniques | Communication du pilotage |
| Listes et filtres | Filtres CLI/SDK simples | Déjà une base ; pas de vues sauvegardées |
| Boards, timelines, regroupements, vues personnelles/partagées | Pas d'interface graphique | Interface et modèle de vues |
| Recherche globale et filtres avancés | Pas de commande de recherche dédiée | Index/requêtes ; `rg` reste un outil externe |
| Insights, dashboards, mesures de flux et prévisions | Pas d'analytics natifs | Agrégations et présentation |
| Automatisation PR GitHub/GitLab et intégrations support | Git local, branche, staging | Connecteurs distants et événements |
| API distante, webhooks, OAuth, MCP Linear | SDK TypeScript et CLI JSON | Transport, événements, authentification |
| Agents et automatisations IA Linear | Brief/règles et attribution humain/agent | Frame fournit du contexte ; pas de service IA d'exécution embarqué |
| Import/export et migration de trackers | Markdown + sorties JSON | Pas d'importateur/synchroniseur Linear fourni |
| Administration, invités, rôles, SSO/SCIM, audit d'accès | Permissions du système/Git | Gouvernance d'un service partagé |

## 8. Ce que Frame apporte déjà spécifiquement

Ces capacités sont des choix propres à Frame ; cela ne prétend pas que Linear ne possède aucun équivalent adjacent.

- **Données locales lisibles et versionnées avec le code** : Markdown/frontmatter, diffs, branches, revues et historique Git.
- **Specs comme décisions** : états `draft/proposed/accepted/superseded/deferred/abandoned`, relations de remplacement et liens entre specs.
- **Contexte agent** : `brief`, `context`, historique et règles regroupées par trigger. Le brief collecte les règles de l'issue, des parents et des specs du projet ; le modèle Project ne contient pas de champ `rules`, malgré une formulation plus large du README.
- **Sélection de travail** : `next` choisit une issue éligible d'un projet actif, selon priorité, ordre du jalon puis ancienneté. Ce n'est pas un planificateur de capacité/date.
- **Exécution Git** : claim local d'issue, branche/worktree, démarrage et release du claim. Les claims coordonnent les worktrees d'un clone, pas les autres clones.
- **Traçabilité et qualité structurelle** : traces d'acteurs, lint des références/IDs/gates, doctor, version du format.
- **Programmabilité locale** : SDK asynchrone, adaptateur de repository injectable et CLI JSON. Le SDK n'embarque ni lint CLI ni orchestration des worktrees.

Les règles sont des instructions pour l'agent, pas des assertions exécutées automatiquement. Les traces sont émises par les opérations Frame ; une modification manuelle du Markdown ne produit pas automatiquement une trace métier.

Sources : [brief](../../packages/core/src/use-cases/get-brief/get-brief.ts), [next](../../packages/core/src/use-cases/get-next/get-next.ts), [spec](../../packages/core/src/entities/spec/spec.ts), [worktrees](../../apps/cli/src/commands/issue/worktree.ts), [claim store](../../apps/cli/src/worktrees/claim-store.ts), [lint](../../packages/lint/src/engine.ts), [SDK](../../packages/sdk/README.md).

## 9. « Linear local dans le Markdown » : trois périmètres possibles

Cette séparation prépare la priorisation sans la décider.

| Périmètre | Exemples | Ce que cela implique |
|---|---|---|
| Modèle opérationnel local | Initiatives, relations, dates, santé, updates, cycles, membres nommés | Données typées, validation, stockage et opérations CLI/SDK ; compatible avec des fichiers Markdown |
| Pilotage local calculé | Progression, retards, vues sauvegardées, recherche, tableaux de bord | Requêtes et calculs au-dessus des fichiers ; une UI est facultative pour les calculs mais nécessaire à certaines interactions |
| Service collaboratif actif | Notifications, webhooks, récurrence automatique, synchro, présence, droits fins | Processus actif local ou distant et, selon la fonction, identité/service réseau ; le Markdown seul ne l'exécute pas |

Un fichier libre peut décrire toutes ces notions, mais une capacité native doit pouvoir être lue, modifiée, validée, reliée et interrogée par Frame. **Aujourd'hui, les propriétés inconnues ne sont pas préservées par le cycle parse/serialize d'un projet.** Ajouter `initiativeIds` à la main ne suffit donc pas : une réécriture métier peut l'effacer.

Git change également la sémantique : des branches peuvent porter des états opérationnels différents ; les clones ne partagent pas une réservation instantanée ; l'identité déclarée par `FRAME_ACTOR` n'est pas une identité authentifiée. Ces points deviennent des décisions produit si l'on vise un usage collectif.

## 10. Décisions à prendre ensemble, après l'inventaire

Pas de classement P0/P1 imposé ici. Les axes suivants permettent de choisir le périmètre :

1. **Niveau stratégique** : initiatives seules, ou sous-initiatives multiparents et agrégations dès le départ ?
2. **Complétude du socle** : opérations d'édition/réouverture/déplacement, dates et relations avant de multiplier les entités ?
3. **Organisation** : outil centré dépôt, ou espace opérationnel qui couvre plusieurs dépôts/équipes ?
4. **Planification** : besoin de cycles et capacité, ou principalement de jalons/échéances ?
5. **Interaction** : CLI/SDK seulement, interface locale, ou collaboration partagée ?
6. **Relation à Linear** : alternative indépendante, export, ou synchronisation bidirectionnelle ?

Ce sont des arbitrages, pas une proposition d'implémentation validée. Une fois choisis, chaque lot pourra préciser modèle, invariants, commandes, stockage, migration et preuve attendue.

## 11. Méthode et vérifications

- Lecture du code courant : entités, parseurs/sérialiseurs, cas d'usage, transitions, DAG, CLI, SDK, configuration et stockage ; le founding paper et les archives ne servent pas de preuve de livraison.
- Documentation officielle Linear consultée le 29/09/2026. Inventaire large des familles opérationnelles, sans prétendre couvrir chaque raccourci, intégration tierce ou option commerciale.
- Vérification Bun en mémoire, sans écrire de données : propriété projet inconnue `initiativeIds` non conservée après parse/serialize ; transition `completed → in-progress` refusée par la machine d'états.
- Pas de suite de tests complète exécutée pour cet inventaire ; les autres constats Frame sont issus de l'inspection statique. Pas de validation runtime de Linear ni de ses intégrations.
- Aucun changement de code fonctionnel, aucune migration, aucune publication.
