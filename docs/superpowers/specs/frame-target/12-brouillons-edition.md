# S12 — Sessions d’édition et brouillons

Statut : cible proposée · Dépendance : [S11](11-stockage-transactions.md) · [Index](README.md).

## Objectif

Permettre à un humain ou un agent d’éditer longtemps un Markdown dans son outil habituel, sans bloquer les mutations concurrentes et sans écraser une version plus récente. Une session ne réserve pas l’issue et ne tient pas le verrou pendant l’édition.

## Données et propriété

Session locale durable : `editId`, workspaceId, workId, entityId, format, baseRevision, baseDigest, auteur, createdAt, état, dernière tentative. Fichiers privés `base.md`, `draft.md`, puis `current.md`, `proposal.md` et résolution lors d’un conflit. La base est immuable pour le client ; aucune propriété technique changée dans draft ne modifie l’identité cible.

États : `open → validating → saved`, ou `conflict → open/resolved → saved`; `abandoned` explicite. Un échec technique laisse le draft disponible. Une session enregistrée garde le résultat de son dernier operationId ; une reprise ne republie pas.

Les sessions ne sont pas commitées avec les objets métier. Une session n’est pas un cache supprimable à l’expiration d’un délai. L’utilisateur choisit de l’abandonner ; le nettoyage des sessions terminées suit une rétention visible.

## Commandes

```sh
frame edit begin --document DOC-12 --json
frame edit begin --issue ENG-101 --json
frame edit list --json
frame edit diff EDIT-123 --json
frame edit save EDIT-123 --json
frame edit resolve EDIT-123
frame edit abandon EDIT-123
frame document edit DOC-12
```

Les identifiants sont illustratifs. `begin` renvoie editId, draftPath, baseRevision et contexte. Le raccourci `document edit` ouvre `$EDITOR`, attend sa fin puis tente save ; sortie non nulle de l’éditeur conserve le brouillon sans l’accepter. Un appel sans terminal utilise begin/save, sans prompt interactif caché.

`diff` compare base/draft et signale les changements du canonique depuis la base. Les chemins locaux ne sont retournés qu’au client local ; un service distant fournit des ressources autorisées, pas un chemin de sa machine.

## Sauvegarde

1. Parser le draft, préserver le texte et valider son format.
2. Dériver un patch des champs éditables ; rejeter IDs, mapping, révisions ou objets étrangers modifiés.
3. Sous S11, comparer baseRevision au canonique de la même branche.
4. Si identique, appliquer/valider le patch et retourner les nouvelles versions.
5. Si divergente, conserver base/draft/current, produire un conflit local et refuser toute publication silencieuse.

La première version est strictement conditionnelle. L’aide à fusion peut proposer les changements disjoints de frontmatter et une fusion textuelle à trois versions du corps. Tout candidat passe par les contraintes métier et une nouvelle précondition de cible. Deux paragraphes non chevauchants ne prouvent pas une compatibilité de sens.

## Résolution

Le dossier reprend la structure de conflit S15 sans rendre S12 dépendante de l’intégration Git : conflit local à une entité, versions précises, champs, causes et choix. `keep-current`, `take-draft` ou patch personnalisé sont des intentions soumises à validation. Aucun marqueur de conflit ne va dans un Markdown canonique.

Un autre acteur peut encore modifier le canonique pendant la résolution ; save retourne alors un nouveau conflit. Une suppression fournit tombstone et options d’abandon/export ; la restauration est une commande distincte, pas un effet de save.

Un changement de branche du checkout ne déplace pas la session : elle reste liée au workId d’origine. Si ce travail est intégré/fermé, exporter son draft ou créer une session dans une nouvelle époque via un rebase explicite ; ne pas réouvrir la source.

## Mode maintenance

Les interventions directes sur le stock nécessitent une maintenance exclusive : suspendre tous les écrivains de l’espace, éditer, scanner/valider, produire les opérations d’import et renouveler les révisions avant reprise. Sans cette discipline, Frame peut détecter des divergences mais ne garantit pas de retrouver des octets écrasés avant observation.

Une modification accidentelle de base.md rend la session invalide par empreinte ; la copie source conservée dans le journal/snapshot peut la restaurer si disponible. Une base absente ne doit pas être recréée à partir du canonique actuel en prétendant qu’elle est ancienne.

## Module et erreurs

`EditingSessions.begin/diff/save/resolve/abandon` gère les sessions et appelle MutationCoordinator. L’éditeur n’appelle pas FsRealmRepository directement. Les transports exposent le même patch et les mêmes décisions.

EDIT_NOT_FOUND, DRAFT_INVALID, BASE_CORRUPTED, TARGET_DELETED, WORK_CLOSED, REVISION_CONFLICT, WRITE_INDETERMINATE complètent S00. Le client conserve son texte pour tous ces échecs ; les messages indiquent la prochaine action possible.

## Critères d’acceptation

- S12-A1 : humain écrit un corps, agent change le statut ; save conserve le draft et explique la divergence.
- S12-A2 : résolution conservant les deux changements est validée sans bloquer pendant l’édition.
- S12-A3 : nouvelle mutation pendant résolution invalide la précondition.
- S12-A4 : fermeture/crash éditeur ne supprime pas le draft ; reprise après redémarrage.
- S12-A5 : mutation d’un ID technique dans draft est refusée sans réaffectation.
- S12-A6 : objet supprimé ou work fermé ne réapparaît pas implicitement.
- S12-A7 : réponse perdue de save puis retry ne crée qu’une mutation.
- S12-A8 : markers de conflit/parsing invalide ne sont jamais publiés.
- S12-A9 : changement de branche ne redirige pas le draft vers une autre issue.

## Sources

[Recherche édition](../../../research/05-concurrence-et-edition-markdown.md), [design global](../../../research/06-design-global-branches-frame.md), [git merge-file](https://git-scm.com/docs/git-merge-file). Git fournit une aide textuelle, pas la validation métier.
