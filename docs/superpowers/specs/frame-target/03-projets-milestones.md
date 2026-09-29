# S03 — Projets et milestones

Statut : spécification cible proposée, 2026-09-29 ; aucune mutation produit exécutée.
Dépendances : [S01](01-workspace-equipes-workflows.md), [S11](11-stockage-transactions.md).
Lectures calculées : [S08](08-pilotage-progression.md) ; documents : [S05](05-documents-templates.md).

Les champs communs `kind`, identité, provenance et les enveloppes JSON suivent [S00](00-contrats-transverses.md).
Les raisons métier détaillées complètent ses codes d’erreur communs, sans créer une autre enveloppe.

## Objectif et périmètre

Un projet coordonne un livrable partagé par plusieurs équipes et éventuellement plusieurs dépôts.
Un milestone est une étape interne à un seul projet, avec date cible et ordre.
Inclure propriétés, membres, dates, ressources, dépendances et déplacement des affectations d'issues.
Les releases, budgets et pourcentages métier saisis manuellement sont hors périmètre.
La baseline Project contient titre, statut fixe, `leads[]`, auteur, dates et corps.
La baseline Milestone possède `pending|active|done` manuel ; ce statut n'est pas une vérité reconduite.

## Données du projet

| Champ | Règle |
|---|---|
| `id`, `identifier`, `revision` | UUID canonique, alias humain, révision S11 |
| `title`, `summary`, `body` | Titre non vide, résumé vide et corps Markdown vide par défaut |
| `statusId` | État du workflow de projets du workspace, distinct du workflow d'issues |
| `teamIds`, `leadTeamId` | Ensemble non vide, équipe pilote incluse dans cet ensemble |
| `leadId`, `memberIds` | Lead unique facultatif, membres explicites sans doublons |
| `priority`, `labelIds` | none et ensemble vide par défaut ; scopes projet validés |
| `startDate`, `targetDate` | Date typée ou null, null par défaut |
| `initiativeIds` | Ensemble de références explicites, vide par défaut |
| `resourceIds` | Références vers ressources liées, vide par défaut |
| `creatorId`, `createdAt`, `updatedAt` | Provenance et dates UTC |
| `deletedAt`, `archivedAt` | Métadonnées de lifecycle distinctes du statut, null par défaut |

Un seul lead n'interdit pas plusieurs membres responsables de contributions.
L'import de plusieurs anciens leads exige un choix, jamais le premier élément arbitraire.
Les états projet utilisent des identités propres et catégories `backlog|planned|started|paused|completed|canceled`.
Le profil de workspace fixe explicitement l'état initial et les transitions supportées.
Un statut importé non mappé reste conservé avec diagnostic ; aucune catégorie proche n'est devinée.
Un projet terminé peut être rouvert selon le workflow ; les dates de transition restent historisées.
L'affectation d'une issue exige une équipe contributrice disponible dans `teamIds`.
Retirer une équipe avec des issues affectées exige un plan explicite de transfert/détachement.
La suppression d'un membre conserve les événements passés ; elle ne réattribue pas ses issues.

## Dates et ressources

Une date est `{precision, value}` ; les précisions admises sont day, month, quarter et year.
La valeur respecte respectivement YYYY-MM-DD, YYYY-MM, YYYY-Qn et YYYY.
Une valeur distante d'autre précision est conservée opaque et non éditable tant que son mapping est indisponible.
Aucune précision faible ne devient artificiellement le premier ou dernier jour de sa période.
Une comparaison impossible ou ambiguë entre périodes produit un diagnostic, pas une date inventée.
Une date de début strictement postérieure à toute la période cible est refusée à la création locale.
Les imports incohérents conservent les dates et leur diagnostic de provenance.
Une ressource possède UUID, projectId, title, URL ou documentId, type et provenance.
Exactement une cible URL ou documentId est renseignée ; aucune copie du document n'est créée.
Une ressource externe inaccessible reste visible avec son lien et un état de disponibilité.
Les documents suivent S05 ; pièces binaires et stockage collaboratif ne sont pas introduits ici.

## Milestones et dépendances

Un milestone contient UUID, identifier, revision, projectId, title, body, targetDate, position et dates.
`projectId` est obligatoire et fixe sa propriété exclusive ; corps vide et date null par défaut.
`position` définit un ordre stable par projet ; deux créations concurrentes ne doivent pas perdre un jalon.
Les milestones résident dans `projects/<projectId>/milestones/` sous leur propriétaire.
Les issues restent dans `issues/` et référencent le jalon par UUID.
Déplacer une issue d'un jalon vers un autre change seulement son rattachement et son historique.
Une modification de projet exige une sélection de jalon compatible ou un retrait explicite.
Déplacer un milestone entre projets n'est pas une opération primitive de cette cible.
Une suppression de jalon avec issues exige une destination explicite ou `--detach-issues`.
La liste de ces issues et les révisions attendues font partie du plan publié atomiquement.
Le statut manuel historique reste dans les métadonnées de migration, pas dans un champ actif concurrent.
La progression, le jalon courant et les règles du jalon vide appartiennent à S08.
Un pourcentage non validé reste indisponible ; les comptes bruts et dates restent lisibles.
Une dépendance projet est une relation UUID orientée `finish-to-start` entre deux projets distincts.
Elle informe le planning sans bloquer arbitrairement une transition métier.
Les cycles de dépendances sont diagnostiqués ; ils ne servent pas à inventer une date prédite.
Aucun changement automatique de dates n'est appliqué sans règle explicitement configurée et validée.

## Commandes et résultat

```sh
frame project new --title "Onboarding v2" --team ENG --lead USER-ELY
frame project edit PROJ-0001 --add-team DES --priority high --target-date 2026-12-15
frame project member add PROJ-0001 --user USER-SAM
frame project show PROJ-0001 --dependencies --scope global --json
frame milestone new --project PROJ-0001 --title "Alpha" --target-date 2026-10-30
frame milestone list --project PROJ-0001 --scope work
frame milestone edit MILE-0001 --title "Alpha interne"
frame issue edit ENG-101 --milestone MILE-0001
frame milestone delete MILE-0001 --detach-issues
frame project dependency add PROJ-0002 --blocked-by PROJ-0001
frame project resource add PROJ-0001 --title "Maquettes" --url https://example.org/design
```

Les commandes de lecture acceptent accepted/work/global ; défaut work, global non modifiable.
Le SDK partage les mêmes validations, effets dérivés et coordinateur S11.
Les résultats rendent UUID, alias, révision, provenance et changements induits sur les rattachements.
La suppression d'un projet n'efface pas ses issues, documents ou updates en cascade cachée.
Un plan de suppression liste les dépendances et choisit les détachements nécessaires avant publication.
La restauration conserve l'identité et valide les références, comme les principes S02.
Une archive importée est préservée ; aucun archivage manuel n'est déclaré équivalent à Linear.
Les transports sont explicitement `frame sync linear …` et `frame sync git …`.

## Concurrence et modules

Modifier équipe pilote, membres et équipes exige une révision cohérente de tout le projet.
Un retrait d'équipe préparé avant l'ajout concurrent d'une issue échoue avec conflit de références.
Une suppression de milestone ne peut laisser une issue ajoutée concurremment avec une référence pendante.
Le rejeu d'une création avec même `operationId` renvoie le même UUID.
`packages/core/src/entities/project/project.ts` et `milestone/milestone.ts` portent les modèles.
Les cas d'usage core portent modifications d'affectation, dépendances et validation de dates.
`packages/fs/src/realm.repository.ts` et S11 garantissent publication cohérente et chemins canoniques.
`packages/lint/src/engine.ts` valide propriété des jalons et intégrité des équipes.
Le SDK expose les queries ; la CLI ne calcule pas elle-même la progression.

## Critères d'acceptation

1. S03-A01 — Un projet multiéquipe possède un lead unique, une équipe pilote membre et plusieurs contributeurs.
2. S03-A02 — Importer une date trimestrielle conserve sa précision et ne fabrique aucune date journalière.
3. S03-A03 — Affecter une issue à un jalon d'un autre projet est refusé sans modification partielle.
4. S03-A04 — Supprimer un jalon occupé exige un choix ; détacher conserve les UUID des issues.
5. S03-A05 — Un ajout d'issue concurrent invalide le plan de retrait d'équipe ou de jalon concerné.
6. S03-A06 — Un jalon vide ne reçoit pas automatiquement 100 % ni un statut done manuel.
7. S03-A07 — Deux projets reliés par dépendance conservent leurs dates et statuts lors de la lecture.
8. S03-A08 — Une ressource Document pointe vers l'objet canonique, jamais vers une deuxième copie du corps.

## Sources

[Modèle local, sections 3, 5, 8](../../../research/01-modele-local.md), [pilotage, projets et jalons](../../../research/02-pilotage-calcule.md).
[Projects](https://linear.app/docs/projects), [Project overview](https://linear.app/docs/project-overview).
[Milestones](https://linear.app/docs/project-milestones), [dépendances](https://linear.app/docs/project-dependencies).
La validation des opérations API et des formules reste conditionnée aux capacités S19 et aux preuves S08.
