# S04 — Initiatives et sous-initiatives

Statut : cible proposée au 2026-09-29, sans implémentation ni conformité distante attestée.
Dépendances : [S03](03-projets-milestones.md), [S11](11-stockage-transactions.md).
Pilotage : [S08](08-pilotage-progression.md) ; updates : [S17](17-collaboration-notifications.md).

Les champs communs `kind`, identité, provenance et les enveloppes JSON suivent [S00](00-contrats-transverses.md).
Les raisons métier détaillées complètent ses codes d’erreur communs, sans créer une autre enveloppe.

## Objectif et périmètre

Une initiative regroupe explicitement des projets pour porter un objectif stratégique.
Une sous-initiative est la même entité reliée à un ou plusieurs parents.
Le modèle doit permettre un programme transverse et une navigation consolidée sans double comptage.
Les labels, vues filtrées, dépôts et dossiers n'établissent jamais une composition implicite.
La baseline inspectée n'exporte aucune entité Initiative dans `entities/index.ts`.
Cette spécification n'introduit ni objectifs chiffrés inventés ni moyenne de santé automatique.

## Champs et valeurs initiales

| Champ | Contrat |
|---|---|
| `id`, `identifier`, `revision` | UUID stable, alias humain INIT-…, révision S11 |
| `title`, `summary`, `body` | Titre obligatoire, résumé et Markdown vides par défaut |
| `ownerId` | Un utilisateur ou null ; null par défaut |
| `status` | `planned|active|completed`, planned à la création locale |
| `targetDate` | Date à précision préservée selon S03, ou null |
| `parentIds` | Ensemble d'UUID Initiative, vide par défaut |
| `positionByParent` | Ordre explicite dans chaque parent, sans effet de propriété |
| `creatorId`, `createdAt`, `updatedAt` | Provenance et instants UTC |
| `deletedAt`, `archivedAt` | Lifecycle indépendant, null par défaut |
| `extensions` | Données importées non mappées et métadonnées locales déclarées |

Le profil de statuts ci-dessus est le profil local proposé ; son mapping distant doit être validé par S19.
Un statut distant non reconnu est conservé opaque et non modifiable, sans reclassement implicite.
Les liens projet→initiative sont canoniques dans `Project.initiativeIds` défini par S03.
`projectIds` est une projection de lecture, jamais une deuxième liste modifiable concurrente.
Les rattachements documentaires sont canoniques sur Document selon S05.
La santé vient de publications S17 et ne devient pas un champ édité implicitement avec le statut.
Un changement d'owner ne réécrit pas les auteurs des publications antérieures.
Un changement de statut ne termine ni projets ni sous-initiatives par propagation implicite.

## Graphe de composition

Le graphe des initiatives est orienté des parents vers les enfants et doit rester acyclique.
Une initiative peut avoir plusieurs parents, y compris dans des programmes différents.
La profondeur maximale est cinq niveaux, racine comprise.
Pour une initiative multiparent, tous les chemins depuis chaque racine doivent respecter cette borne.
Ajouter une arête valide donc les ancêtres du parent et les descendants de l'enfant.
Auto-parentage, cycle et profondeur dépassée sont refusés avant toute publication.
Retirer un parent n'efface pas l'enfant ni ses autres relations.
Une initiative sans parent devient une racine, sans migration de son fichier canonique.
Les fichiers résident dans `initiatives/`, jamais dans un dossier propriétaire `sub-initiatives/`.
Un projet peut être directement rattaché à plusieurs initiatives.
La suppression d'un lien de composition ne supprime pas le projet.
Des restrictions du plan Linear distant limitent les opérations synchronisées, pas l'identité locale.
Une restriction détectée avant export rend le plan non applicable avec la liste des liens concernés.
L'import d'un graphe invalide est conservé en zone de réconciliation avec diagnostics.
Il ne remplace pas silencieusement le graphe accepté par une version tronquée.

## Navigation et consolidation

`show --tree` affiche les arêtes et les identifiants réutilisés, même lorsqu'un enfant a plusieurs parents.
L'affichage marque les références déjà visitées pour rester fini et compréhensible.
`--projects` sélectionne les projets directement rattachés par défaut.
`--include-descendants` étend cette sélection à tous les descendants accessibles.
La liste consolidée déduplique par UUID projet ; plusieurs chemins ne multiplient pas le scope.
Chaque projet peut exposer `viaInitiativeIds` pour expliquer ses chemins de rattachement.
Les comptes directs et consolidés sont nommés séparément.
Les objets supprimés sont exclus par défaut mais restent consultables avec filtre explicite.
La présence d'archives est signalée et la définition des indicateurs reste celle de S08.
Une référence inaccessible ne devient pas un projet absent : le résultat expose une couverture incomplète.
La santé publiée de l'initiative et la distribution des santés projet restent deux lectures distinctes.
Un projet sans update est « sans update », jamais automatiquement sain.
Aucun pourcentage de projet ne détermine à lui seul le succès métier de l'initiative.

## Commandes et résultat

```sh
frame initiative new --title "Lancement Enterprise" --owner USER-ELY
frame initiative new --title "Confiance client" --parent INIT-0001
frame initiative parent add INIT-0002 --parent INIT-0003
frame initiative parent remove INIT-0002 --parent INIT-0001
frame initiative edit INIT-0002 --status active --target-date 2026-Q4
frame project edit PROJ-0001 --initiative INIT-0002
frame initiative show INIT-0001 --tree --scope work
frame initiative show INIT-0001 --projects --include-descendants --scope global --json
frame initiative show INIT-0001 --health --scope accepted
frame initiative delete INIT-0002 --detach-relations
frame initiative restore INIT-0002
```

Le paramètre `--initiative` de S03 ajoute une appartenance ; un retrait utilise une opération explicite.
Les lectures acceptent accepted/work/global et défaut work ; global est toujours non modifiable.
Les mutations partagent `operationId`, révisions attendues et coordinateur S11 avec le SDK.
Les résultats JSON comprennent objet, arêtes changées, révision de graphe et diagnostics.
`delete --detach-relations` prépare la liste des liens parents/enfants/projets touchés.
La suppression publie tombstone et détachements ensemble, sans supprimer descendants ou projets.
La restauration propose les liens historiques et refuse les rétablissements devenus invalides.
Les archives distantes sont préservées ; aucune commande d'archive manuelle n'est introduite.

## Concurrence et responsabilités

La validation ne se limite pas à la révision de l'initiative directement éditée.
Elle vérifie la révision du graphe lu pour détecter un cycle créé par deux commandes concurrentes.
Deux opérations indépendantes peuvent se rebaser seulement après nouvelle validation explicite S11.
Le dernier horodatage n'est jamais un arbitre de parentage ou de propriété.
Une suppression concurrente à un rattachement produit un conflit de référence inspectable.
`packages/core/src/entities/` porte Initiative et les références typées.
Les services core portent profondeur, acyclicité et traversées dédupliquées.
Les cas d'usage core portent rattachement/détachement et plans de lifecycle.
`packages/fs/src/realm.repository.ts` charge un graphe cohérent ; les caches sont reconstructibles.
`packages/lint/src/engine.ts` signale aussi les graphes invalides introduits à la main.
Le SDK expose les mêmes queries ; la CLI formate l'arbre sans recalcul métier autonome.
S19 décide des capacités du connecteur ; `frame sync linear …` reste le transport explicite.

## Critères d'acceptation

1. S04-A01 — Une sous-initiative sous deux parents garde un UUID, un fichier et deux arêtes.
2. S04-A02 — Un diamant de composition ne compte qu'une fois le projet accessible par deux chemins.
3. S04-A03 — Ajouter un sixième niveau échoue sur tous les chemins concernés sans mutation partielle.
4. S04-A04 — Deux ajouts concurrents A→B et B→A ne peuvent créer un cycle accepté.
5. S04-A05 — Supprimer un parent avec détachement conserve enfants, projets et leurs historiques.
6. S04-A06 — La lecture directe diffère de la lecture descendants avec des chemins de provenance explicites.
7. S04-A07 — Un projet sans update n'hérite pas de la santé de son initiative.
8. S04-A08 — Un plan distant sans sous-initiatives bloque l'export concerné sans aplatir la hiérarchie.

## Sources

[Modèle local, initiatives](../../../research/01-modele-local.md), [consolidation](../../../research/02-pilotage-calcule.md).
[Initiatives](https://linear.app/docs/initiatives), [sous-initiatives](https://linear.app/docs/sub-initiatives).
[Updates](https://linear.app/docs/initiative-and-project-updates) ; contraintes d'API détaillées sous S19.
