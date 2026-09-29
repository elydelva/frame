# S02 — Issues, relations et cycle de vie

Statut : cible proposée au 2026-09-29 ; baseline inspectée `451914f`.
Dépendances : [S01](01-workspace-equipes-workflows.md), [S03](03-projets-milestones.md), [S11](11-stockage-transactions.md).

Les champs communs `kind`, identité, provenance et les enveloppes JSON suivent [S00](00-contrats-transverses.md).
Les raisons métier détaillées complètent ses codes d’erreur communs, sans créer une autre enveloppe.

## Objectif et périmètre

Capturer, affecter, déplacer et terminer une issue d'équipe sans projet obligatoire.
Représenter sous-issues, blocages, associations et doublons sans reproduire les gates strictes.
Inclure suppression réversible, consultation d'archives et restauration ; l'archivage est automatique.
Le runner d'archivage et le triage actif relèvent de [S18](18-automatisations-admission.md).
Claims et exécutions relèvent de S10, et ne sont pas des statuts métier.
La baseline `Issue` impose `projectId`, chaînes d'acteur/labels et état initial `not-started`.

## Champs et identités

| Champ | Contrat cible |
|---|---|
| `id`, `identifier`, `aliases[]`, `revision` | UUID stable, alias humain tel ENG-101, historique d'aliases, révision S11 |
| `teamId`, `title`, `body` | Équipe obligatoire, titre non vide, Markdown facultatif par défaut vide |
| `statusId`, `priority`, `position` | État de l'équipe, priorité S01, ordre manuel stable dans son contexte |
| `projectId`, `milestoneId`, `cycleId` | UUID ou null ; tous null par défaut |
| `parentId`, `assigneeId` | UUID ou null ; null par défaut |
| `labelIds`, `estimate`, `dueDate` | Ensemble vide, null, date civile ISO ou null par défaut |
| `creatorId`, `createdAt`, `updatedAt` | Identité/provenance de création, instants UTC |
| `startedAt`, `completedAt` | Instants projetés des transitions connues ; null si absents/inconnus |
| `deletedAt`, `archivedAt` | Instants de cycle de vie indépendants du statut ; null par défaut |
| `extensions.frame` | Données locales explicites et provenance de migration, sans sens Linear implicite |

Les événements conservent toutes les entrées/sorties de statut ; les deux dates projetées ne suffisent pas à l'historique.
Une réouverture efface la complétion courante et conserve l'événement précédent.
Le premier démarrage connu reste distingué des démarrages ultérieurs dans les lectures historiques.
`milestoneId` exige le projet propriétaire correspondant ; `cycleId` exige disponibilité dans l'équipe.
Une équipe contributrice au projet doit être explicite ; aucune modification cachée du projet lors d'une affectation.
L'affectation d'une issue ne fait pas implicitement de son assignee un membre du projet.
Les anciennes branches/règles d'agent sont conservées dans les extensions ou liaisons S10/S13.

## Création, transitions et transfert

L'état initial vient de S01, priorité none, estimation non renseignée.
Une transition choisit l'UUID de statut ou résout son nom dans l'équipe.
Une transition completed → unstarted est autorisée ; les états terminaux ne sont pas irréversibles.
Une relation de blocage ne constitue pas une interdiction générale de terminer.
Une politique agent peut refuser de sélectionner une issue bloquée, avec explication séparée.
Un transfert prépare un mapping de statut, labels, cycle et identifiant affiché.
Il conserve UUID, contenu, auteur et historique ; il ne clone pas l'issue.
Une correspondance unique validée peut être proposée ; un choix ambigu exige une résolution explicite.
Les labels workspace survivent ; les labels d'équipe non disponibles exigent remplacement ou retrait explicite.
Le cycle incompatible doit être retiré/remplacé explicitement dans la même mutation.
L'alias précédent reste résolvable lorsqu'il est non ambigu ; les collisions affichent les candidats.
Changer de projet avec un jalon incompatible exige également retrait/remplacement explicite.

## Parentage et relations

Une issue possède au plus un parent ; aucun auto-parentage ni cycle d'ascendance n'est permis.
Les sous-issues restent des issues complètes, conservées dans `issues/` sans déplacement de chemin.
La création d'une sous-issue peut copier les seules propriétés du profil d'équipe validé.
Les champs explicitement fournis prévalent sur ce profil ; l'aperçu montre les copies appliquées.
Aucun héritage permanent ni copie générale des règles exécutables n'est induit par le parentage.
Les automatismes parent/enfants sont configurés et historisés ; profil inconnu signifie indisponibilité.
Une relation possède UUID, type, sourceId, targetId, dates et révision.
`blocks` est orientée ; `related` est symétrique avec une paire canonique dédupliquée.
La résolution d'un blocage convertit sa relation selon la règle Linear validée, en conservant l'événement d'origine.
Si le traitement d'annulation/réouverture n'est pas établi, cette conversion automatique est indisponible avec diagnostic.
Une dépendance cyclique n'empêche pas l'import fidèle ; le graphe signale son caractère non exécutable.
Une relation vers une référence inaccessible conserve son identité/provenance comme référence non résolue.
Un doublon conserve l'issue source et un `duplicateOfId` canonique, sans fusion destructive des corps.
Marquer doublon utilise l'état réservé de son équipe et enregistre les deux changements ensemble.
Auto-doublon et cycle de doublons sont refusés ; une chaîne valide est résolue vers sa cible terminale.
La suppression d'un doublon ne supprime jamais sa cible.

## Suppression, archives et commandes

Une suppression crée une tombstone récupérable ; elle ne disparaît pas d'un export autorisé sans trace.
Les lectures ordinaires excluent les objets supprimés/archivés ; des filtres explicites les rendent consultables.
La restauration conserve UUID, liens et provenance, avec validation des références devenues invalides.
La rétention distante est une capacité S19 ; aucune durée Linear non vérifiée n'est inventée.
L'absence d'un objet dans une réponse distante ne prouve ni suppression ni archivage.
Aucune commande d'archivage manuel n'est présentée comme parité Linear.
Le runner S18 évalue l'éligibilité sur les états acceptés ; une lecture ne déclenche pas d'archivage.

```sh
frame issue add --team ENG --title "Invitation expirée"
frame issue edit ENG-101 --project PROJ-0001 --milestone MILE-0001
frame issue status ENG-101 Done
frame issue status ENG-101 Todo
frame issue transfer ENG-101 --team DES --mapping-file ./transfer.json
frame issue relation add ENG-102 --blocked-by ENG-101
frame issue relation remove REL-0001
frame issue duplicate ENG-104 --of ENG-101
frame issue delete ENG-104
frame issue restore ENG-104
frame issue list --team ENG --archived include --scope accepted --json
```

Les lectures acceptent accepted/work/global ; les mutations refusent global et ciblent work par défaut.
Le SDK partage le coordinateur, `operationId` et les révisions attendues des objets touchés.
Les éditions groupées rendent un résultat par opération ; elles ne prétendent pas être une transaction distante.
Le JSON de mutation indique changements explicites, changements dérivés et événements produits.

## Erreurs, concurrence et responsabilités

Un parent supprimé, jalon incompatible ou référence ambiguë produit un refus structuré avant publication.
L'import d'une incohérence distante conserve la donnée et un diagnostic au lieu de falsifier son statut.
Deux opérations ajoutant des parents opposés sont validées contre la même révision de graphe ; une seule peut passer.
Une relation symétrique créée simultanément ne devient pas deux relations métier.
Un transfert concurrent à une transition invalide la résolution de statut devenue obsolète.
`packages/core/src/entities/issue/issue.ts` porte le modèle ; les services de graphe portent ses invariants.
`packages/core/src/use-cases/` orchestre transferts, doublons, restauration et transitions.
`packages/fs/src/realm.repository.ts` et S11 publient tous les objets touchés ensemble.
`packages/lint/src/engine.ts` détecte aussi les incohérences après édition manuelle.
`packages/sdk/src/frame.ts` et `apps/cli/src/cli.ts` exposent le même contrat.

## Critères d'acceptation

1. S02-A01 — Une issue sans projet se crée dans l'équipe demandée et reçoit ses valeurs initiales.
2. S02-A02 — Done → Todo conserve la trace de complétion et remet `completedAt` courant à null.
3. S02-A03 — Un transfert ambigu ne modifie ni identifiant ni labels avant résolution complète.
4. S02-A04 — Un jalon d'un autre projet est refusé par CLI, SDK et lint.
5. S02-A05 — Deux parentages concurrents formant un cycle ne peuvent être publiés tous deux.
6. S02-A06 — Marquer doublon conserve corps/UUID et rejouer l'opération ne répète pas la transition.
7. S02-A07 — Restaurer une issue supprimée retrouve ses liens ; une cible supprimée produit un diagnostic.
8. S02-A08 — Une issue bloquée importée completed garde cet état ; aucune gate ne réécrit l'import.
9. S02-A09 — Une lecture d'archives ne déclenche aucune mutation ni aucun effet externe.

## Sources

[Modèle local, sections 4–5 et 9](../../../research/01-modele-local.md), [services actifs, archivage](../../../research/03-services-actifs.md).
[Statuts](https://linear.app/docs/configuring-workflows), [relations](https://linear.app/docs/issue-relations), [sous-issues](https://linear.app/docs/parent-and-sub-issues).
[Suppression et archivage](https://linear.app/docs/delete-archive-issues) ; la conformité API détaillée appartient à S19.
