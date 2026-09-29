# S01 — Workspace, équipes et workflows

Statut : cible proposée au 2026-09-29 ; aucune implémentation nouvelle attestée.
Dépendances : [S00](00-contrats-transverses.md), [S11](11-stockage-transactions.md).

Les champs communs `kind`, identité, provenance et les enveloppes JSON suivent [S00](00-contrats-transverses.md).
Les raisons métier détaillées complètent ses codes d’erreur communs, sans créer une autre enveloppe.

## Objectif et périmètre

Un realm représente un workspace opérationnel indépendant du dépôt de code.
Il fournit les identités et paramètres nécessaires à toutes les issues.
Sont inclus membres, équipes, workflows, priorités, labels et estimations.
Droits distants, SSO, SCIM et confidentialité distribuée relèvent de S20 ou sont différés.
La baseline inspectée possède des acteurs libres et des statuts fixes, pas ces objets.
Les chemins existants cités ci-dessous indiquent une responsabilité, pas un support livré.

## Identités et champs

Tout objet possède un UUID, une révision, les dates UTC de création/modification et une provenance S00.
Les références stockées utilisent les UUID ; noms, clés et aliases sont résolus à l'entrée.
Un alias ambigu retourne les candidats sans choisir le premier résultat.

| Objet | Champs métier obligatoires ou facultatifs |
|---|---|
| Workspace | `id`, `name`, `defaultTeamId: UUID|null`, `defaultTimezone`, `formatVersion` |
| User | `id`, `displayName`, `active`, `externalIds`; email facultatif, jamais identité canonique |
| Team | `id`, `key`, `name`, `memberIds[]`, `parentTeamId|null`, `timezone`, `settings` |
| WorkflowState | `id`, `teamId`, `name`, `category`, `position`, `isDefault`, `reservedRole|null` |
| Label | `id`, `name`, `scope: workspace|team`, `teamId|null`, `groupId|null`, `color|null` |
| LabelGroup | `id`, `name`, `scope`, `teamId|null`, `exclusive: true` |

`Team.key` est unique dans le realm et sert uniquement aux identifiants affichés.
Un changement de clé préserve UUID et aliases historiques non ambigus.
`memberIds` est un ensemble ; désactiver un membre préserve ses attributions historiques.
Un membre local n'est pas une preuve d'identité authentifiée sur un service distant.
`parentTeamId` doit former un arbre sans cycle ; aucun héritage n'est implicite.
Un réglage hérité porte `sourceTeamId` et la révision du réglage effectif.
Une capacité d'héritage non validée est indisponible ; elle n'est pas remplacée par une copie silencieuse.

## Workflows et priorités

Les catégories d'issue sont `triage`, `backlog`, `unstarted`, `started`, `completed`, `canceled`.
Les noms personnalisés restent libres ; la catégorie garde sa signification stable.
Il existe exactement un état initial effectif par équipe ; le triage est facultatif.
Un rôle réservé `duplicate` désigne un état d'annulation, sans nouvelle catégorie.
L'initialisation exige un profil explicite ou importé ; elle montre les états créés.
En solo, le profil crée une équipe par défaut ; il ne rend pas `teamId` facultatif.
Une issue créée sans état reçoit l'état initial effectif, jamais une chaîne globale figée.
Les transitions ne suivent pas un graphe universel imposé par Frame.
Retirer un état référencé exige un mapping explicite vers un autre état de la même équipe.
Un changement de catégorie historise l'ancienne définition pour les mesures passées.
Les cinq priorités sont `none`, `low`, `medium`, `high`, `urgent`.
L'ordre d'urgence décroissant est urgent, high, medium, low, none.
L'ordre manuel au sein d'une priorité est conservé séparément de cet ordre.
Les anciennes priorités non représentables exigent un mapping S21.

## Labels et estimations

Un label d'équipe n'est assignable que dans son scope effectif ; un label workspace est transversal.
Deux labels homonymes de scopes différents restent deux identités distinctes.
Une écriture affectant deux labels d'un même groupe exclusif est refusée.
Un remplacement de label du groupe doit être explicite et atomique.
Supprimer un label utilisé exige un plan de retrait/remplacement, sans suppression cachée.
Les réglages d'estimation sont versionnés par équipe.
Ils contiennent `enabled`, `scale`, `allowedValues`, `allowZero`, `unestimatedPolicy` et provenance d'héritage.
`scale` désigne une échelle validée ; les tailles de vêtements conservent leur mapping Fibonacci.
Une échelle inconnue importée est préservée mais non utilisable pour un calcul présenté comme conforme.
`estimate: null` signifie non estimé ; `0` est une estimation explicite si autorisée.
Estimation désactivée : les statistiques comptent une unité par issue selon S08.
La valeur statistique d'une issue non estimée est résolue depuis `unestimatedPolicy`.
Aucun défaut statistique ne réécrit le champ `estimate` de l'issue.
La politique inconnue rend la mesure indisponible ; aucune conversion heures/points n'est automatique.
Les changements de réglage ne réécrivent pas l'historique avec la politique actuelle.

## Contrat CLI et SDK

```sh
frame team new --key ENG --name Engineering
frame team show ENG --estimates --scope work --json
frame team member add ENG --user USER-ELY
frame team workflow show ENG --scope accepted
frame team workflow apply ENG --file ./workflow.json
frame team estimates configure ENG --file ./estimates.json
frame label new --team ENG --name Bug
frame label list --scope global --json
```

Les fichiers de configuration sont des données validées, jamais du code exécutable.
Toute lecture accepte `--scope accepted|work|global` ; défaut work courant.
Les mutations ciblent work par défaut ; une écriture globale est toujours refusée.
Le SDK expose les mêmes opérations typées et le même coordinateur S11.
Le résultat JSON inclut objet, révision, paramètres effectifs et diagnostics de résolution.
Une configuration héritée affiche la chaîne de provenance sans masquer un override local.
Les opérations de configuration ne déclenchent aucun appel réseau.
La publication distante éventuelle passe uniquement par `frame sync linear …`.

## Erreurs, concurrence et propriété

`DOMAIN_REJECTED` porte les raisons `ambiguous_reference`, `invalid_scope`, `invalid_estimate` ou `referenced_state`.
Une référence absente n'est pas créée à partir de son nom pendant une mutation.
Le coordinateur vérifie `operationId`, révisions des objets et révision des paramètres consultés.
Deux créations simultanées de la même clé d'équipe ne peuvent réussir toutes les deux.
Une modification concurrente du workflow invalide une mutation préparée sur l'ancien mapping.
Une configuration invalide écrite à la main est diagnostiquée par lint, jamais ignorée dans une lecture complète.
`packages/core/src/entities/` porte les nouveaux objets et invariants.
`packages/core/src/value-objects/status/status.ts` est la baseline à remplacer pour les issues.
`packages/core/src/use-cases/` résout paramètres et références sans IO fournisseur.
`packages/fs/src/realm.repository.ts` charge les objets et configurations versionnés via S11.
`packages/lint/src/engine.ts` valide scopes, références et exclusivité hors CLI.
`packages/sdk/src/frame.ts` expose les opérations ; `apps/cli/src/cli.ts` adapte arguments et rendu.

## Critères d'acceptation

1. S01-A01 — Deux équipes possèdent un état « Review » : une issue le résout uniquement dans son équipe.
2. S01-A02 — Créer sans projet utilise l'équipe explicite et son état initial effectif.
3. S01-A03 — Deux labels homonymes produisent une ambiguïté ; leurs UUID restent utilisables.
4. S01-A04 — Affecter deux labels d'un groupe exclusif échoue sans modification partielle.
5. S01-A05 — `null`, zéro autorisé et zéro interdit donnent trois résultats distincts et explicables.
6. S01-A06 — Désactiver un membre préserve les anciennes références et empêche une nouvelle attribution implicite.
7. S01-A07 — Une révision d'estimation changée entre lecture et écriture produit un conflit récupérable.
8. S01-A08 — Retirer un statut utilisé exige un mapping ; le rejeu du plan ne double pas les événements.
9. S01-A09 — Un profil d'héritage inconnu préserve les données et rend son calcul indisponible.

## Sources et limites

Recherche : [modèle local, sections 2 et 4](../../../research/01-modele-local.md), [estimations](../../../research/02-pilotage-calcule.md).
Références : [concepts](https://linear.app/docs/conceptual-model), [workflows](https://linear.app/docs/configuring-workflows).
Références : [priorités](https://linear.app/docs/priority), [labels](https://linear.app/docs/labels), [estimations](https://linear.app/docs/estimates).
Les sources sont celles de la recherche ; aucune nouvelle vérification distante n'a été exécutée.
Les réglages API non établis sont conservés à l'import et bloquent uniquement l'opération qui en dépend.
