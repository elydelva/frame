# S16 — Projection globale des travaux

Statut : cible proposée · Dépendances : S07, S10, S15 · [Index](README.md).

## Objectif

Voir le travail de tous les agents avant merge, son origine et les conflits potentiels, sans présenter des propositions incompatibles comme un état accepté unique. La projection est reconstruisible ; elle ne publie pas de mutations métier.

## Trois lectures

| Scope | Contenu et autorité |
|---|---|
| accepted | État accepté local et mutations durables non checkpointées de main, avec signalement |
| work | État d’un work et ses divergences face à la cible actuelle |
| global | accepted + deltas des travaux connus, conflits, réservations et fraîcheur |

Les mesures officielles S08/S09 reposent sur accepted. Une simulation peut combiner un ensemble nommé de propositions compatibles, avec résultats marqués prévisionnels. En cas de conflit, la métrique dépendante reste indisponible ou présente plusieurs scénarios distincts ; jamais moyenne de statuts concurrents.

## Données et algorithme

ReadVector : workspaceId, acceptedOid, acceptedGeneration, travaux [{workId, oid, generation, baseOid, lifecycle}], remoteObservedAt et projectionVersion.

Contribution : entityId, field, baseValue, proposedValue, originWorkId, contributingWorkIds, operationIds, revision, checkpoint state, freshness. Les textes volumineux se chargent en détail ; le snapshot de liste ne multiplie pas les corps par nombre de branches.

1. Résoudre le registre et les références ; valider workspace/format de chaque source.
2. Capturer des snapshots cohérents par espace via S11 et leurs générations.
3. Lire les reçus intégrés pour identifier les changements déjà acceptés.
4. Calculer le delta de chaque work face à sa base ; attribuer les héritages à l’origine.
5. Dédupliquer objets/opérations par identité, payload et reçus ; appliquer tombstones/résolutions au calcul.
6. Construire lignes et conflits potentiels, puis publier un vecteur de versions complet.

Ne pas compter la copie entière d’un projet dans chaque work. L’enfant intégré dans un parent puis archivé ne contribue pas une deuxième fois à la vue globale. Une même opération avec payload différent est une anomalie, pas un doublon acceptable.

## CLI et JSON

```sh
frame view global --json
frame issue show ENG-101 --scope global --json
frame project show PROJ-1 --scope accepted --progress
frame work status --json
frame view global --work WORK-id
```

La dernière commande filtre les contributions affichées sans changer leur source d’autorité. `workId` absent pour accepted est distinct d’un work inconnu.

```json
{
  "entityId": "uuid",
  "accepted": { "status": "todo", "checkpointState": "pending" },
  "proposals": [
    { "workId": "work-uuid", "status": "in-progress", "freshness": "local-current" }
  ],
  "conflicts": [],
  "actionability": { "reserved": true, "claimScope": "clone-local" }
}
```

Ce fragment appartient à `data` dans l’enveloppe S00. Le statut métier ne devient pas « réservé » ; la réservation est un attribut technique de l’actionabilité. `next` utilise cette information pour éviter une double affectation locale.

## Fraîcheur et défaillances

Un watcher invalide, puis le module rescane sous coordination. Un scan périodique et la reprise au démarrage couvrent les notifications manquées. Les caches se reconstruisent après suppression sans modifier les objets canoniques.

Un work local illisible conserve un diagnostic et, si disponible, sa dernière valeur valide marquée périmée. Un remote n’expose que les checkpoints récupérés ; absence d’événement n’est pas une preuve d’inactivité. Les détails indiquent dernière observation, base connue et cause de non-actualisation.

La capture de plusieurs espaces est un vecteur, pas un instant atomique universel. Si une mutation arrive pendant agrégation, elle déclenche une invalidation ; le résultat reste attaché aux versions effectivement lues. Une vue ne mélange pas un corps d’une génération avec des propriétés d’une autre pour le même objet.

Les événements de projection portent version et cursor ; un client trop ancien reçoit reset puis snapshot, pas un delta impossible à appliquer. L’ordre de tri stable et la pagination suivent S07.

## Confidentialité et lecture distante

N’afficher que les sources autorisées au lecteur. Le registre local ne constitue pas une ACL : un service authentifié filtre réellement les sources avant calcul, y compris les comptes/métriques. Un Git distribué intégralement ne masque pas des fichiers privés à ses lecteurs.

Une mutation depuis la vue globale doit choisir explicitement l’objet, le work cible et la révision. Aucun bouton/commande ne traduit global en « écrire dans toutes les copies ».

## Module

GlobalProjection expose snapshot, detail, changes et rebuild. Il compose les lectures S07, identités S13, reçus S15 et exécutions S10. Il ne choisit pas le gagnant d’un conflit et n’appelle pas une mutation pendant la reconstruction.

## Critères d’acceptation

- S16-A1 : deux agents sont visibles avant checkpoint/merge avec leurs modifications locales.
- S16-A2 : un objet présent dans cinq branches compte une fois dans accepted.
- S16-A3 : enfant intégré/parent actif ne double pas ses opérations.
- S16-A4 : valeurs contradictoires affichent deux propositions, pas un statut inventé.
- S16-A5 : une mutation main non checkpointée est visible et distinguée de l’état distant.
- S16-A6 : work inaccessible est inconnu/périmé, pas vide ou terminé.
- S16-A7 : reconstruction cache reproduit les mêmes IDs, deltas et métriques.
- S16-A8 : snapshot/cursor permettent reprise ou reset explicite après changement de génération.
- S16-A9 : origine et tombstones restent cohérents après squash et nouvelle époque.
- S16-A10 : aucun lecteur ne reçoit une contribution interdite ni une métrique qui la révèle.

## Sources

[Design global, sections 8 et 13](../../../research/06-design-global-branches-frame.md), [pilotage](../../../research/02-pilotage-calcule.md), [services](../../../research/03-services-actifs.md).
