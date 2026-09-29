# S07 — Vues, filtres et recherche

Statut : cible normative proposée ; aucune livraison revendiquée.
Dépendances de socle : S00–S06, S11. Raccordement global : S16, sans dépendance du moteur local à sa projection.

## Objectif et périmètre

Une même sélection doit produire les mêmes identités et le même ordre dans la CLI, le SDK et les consommateurs agents.
Les vues incluent issues, projets, initiatives et documents ; les propriétés filtrables dépendent du type interrogé.
La recherche porte sur identifiants, titres, résumés et corps textuels accessibles dans le scope demandé.
Une vue est une requête dynamique, jamais un conteneur propriétaire des objets.
La reproduction d'une interface graphique et un langage de programmation de requêtes sont exclus.
La syntaxe structurée Frame est propre au produit ; son mapping Linear ne vaut que pour les opérateurs validés.

## Données et grammaire

Une vue partagée possède `id` UUID, `alias`, `revision`, `name`, `entityType`, `query`, `sort` et `groupBy`.
Elle porte `createdBy`, `createdAt`, `updatedAt` et une version `queryVersion`.
Les vues partagées sont des objets Markdown versionnés ; les préférences personnelles restent hors Git.
Le corps de requête est un arbre JSON typé, sans expressions JavaScript ni interpolation exécutable.
Un nœud est soit `{all: [...]}`, soit `{any: [...]}`, soit une condition `{field, operator, value}`.
Les opérateurs cibles sont `eq`, `neq`, `in`, `notIn`, `contains`, `before`, `after`, `isNull` et `isNotNull`.
Le schéma publie pour chaque propriété les opérateurs et types de valeurs autorisés.
`contains` s'applique aux textes ou ensembles selon le type publié ; aucune coercition implicite n'est permise.
Un groupe `all: []` sélectionne tout le périmètre ; `any: []` ne sélectionne rien.
Une liste vide dans `in` ne sélectionne rien ; `notIn: []` ne retranche rien.
Une propriété absente normalisée à `null` ne satisfait que les tests explicites de nullité.
Ainsi `neq` et `notIn` n'incluent pas implicitement les objets sans valeur.
Un champ inconnu, un opérateur incompatible ou une version inconnue entraîne un diagnostic bloquant.
Une valeur de référence contient un UUID ; les aliases CLI sont résolus avant évaluation.
Deux labels homonymes de scopes différents ne sont jamais fusionnés.
Les membres utilisent leur identité stable ; `me` est un symbole résolu à l'exécution.
L'absence d'identité personnelle produit `IDENTITY_REQUIRED`, jamais une sélection vide trompeuse.

## Périmètre, visibilité et ordre

Toutes les lectures acceptent `--scope accepted|work|global` selon S00 et S16.
Le scope opérationnel est fourni à l'exécution, pas fixé silencieusement par une vue partagée.
Les listes métier utilisent `work` par défaut selon S00 ; les rapports officiels utilisent accepted. Un choix explicite reste visible dans le résultat.
`global` conserve les candidats et leur provenance sans inventer une valeur unique en cas de conflit.
Le filtrage global identifie la variante correspondante ; une identité commune n'est comptée qu'une fois.
Un résultat global expose `matchesOn` avec les origines acceptées ou proposées qui satisfont le filtre.
Les objets archivés sont exclus par défaut, inclus avec `--archived include` ou seuls avec `--archived only`.
Les objets supprimés sont exclus ; leur recherche relève de la consultation explicite des tombstones de S02.
Ces conventions de liste ne déterminent jamais silencieusement le périmètre d'une mesure de S08.
Les tris sont une liste ordonnée de `{field, direction, nulls}` ; `nulls` vaut `first` ou `last`.
Le tri par priorité suit l'ordre métier défini en S01, pas l'ordre lexical des libellés.
À priorité égale, l'ordre manuel déclaré dans le contexte de la vue doit être préservé.
Un rang manuel se rattache au contexte et à l'identité ; déplacer une ligne ne change pas son statut.
Sans rang applicable, le départage est stable par UUID ; la date de création n'est pas imposée.
Un regroupement ne réordonne pas implicitement les éléments au sein de chaque groupe.
Un groupe de propriété nulle apparaît explicitement avec `key: null`.
Les échéances relatives utilisent `asOf` et le fuseau d'équipe résolu dans le résultat.
`overdue` signifie une date cible antérieure au jour local, hors catégories completed/canceled.
Une échéance imprécise dont l'ordre n'est pas déterminable reste inconnue avec diagnostic.

## Interface CLI et JSON

```sh
frame issue list --assignee me --team ENG --sort priority --group-by project --scope accepted
frame issue list --project PROJ-0001 --due overdue --json
frame view save --name "Mes urgences" --from-query ./query.json --operation-id UUID
frame view show VIEW-0001 --json
frame view run VIEW-0001 --scope work --json
frame view edit VIEW-0001 --from-query ./query.json --expected-revision REV --operation-id UUID
frame view delete VIEW-0001 --expected-revision REV --operation-id UUID
frame search "invitation" --type document --scope global --json
```

La création reçoit les préconditions de collection/autorité définies en S11 ; edit/delete reçoivent la révision de vue.
Le SDK soumet les mêmes commandes au coordinateur partagé ; aucun writer de vue ne contourne S11.
`global` n'est jamais une destination d'écriture, y compris pour sauvegarder une vue.
Une préférence personnelle utilise un stockage et une commande explicitement personnels, sans commit métier.
Le résultat contient `items`, `groups`, `total`, `nextCursor`, `query`, `resolvedIdentity` et `resolvedReferences`.
Il inclut `scope`, `snapshotRevision`, `versionVector`, `calculatedAt`, `asOf`, `timezone` et `diagnostics`.
`complete` indique si tous les objets du périmètre sont lisibles ; `total` n'est définitif que si `complete: true`.
Une sélection vide complète retourne `items: []`, `total: 0`, `nextCursor: null`.
Une source inaccessible ne vaut pas zéro ; les diagnostics identifient les origines manquantes.
Le curseur lie requête normalisée, identité résolue, scope et version du snapshot.
Une page ultérieure sur une version incompatible produit `CURSOR_STALE`, sans doublon ni omission silencieuse.
Les overrides ponctuels d'une vue sont renvoyés dans `effectiveQuery` sans réécrire la vue.
L'affichage texte est une présentation du même résultat, sans calcul secondaire divergent.

## Recherche et index

La recherche distingue correspondance d'identifiant exact et correspondance textuelle.
La normalisation textuelle est Unicode, insensible à la casse ; sa version est déclarée par `searchVersion`.
Les termes textuels sont conjonctifs par défaut ; aucune syntaxe cachée AND/OR n'est interprétée dans le texte libre.
Les filtres structurés permettent de restreindre le type, l'équipe et le projet avant classement.
Le classement privilégie identifiant exact, titre puis corps ; les égalités sont départagées par UUID.
Les résultats exposent `matchedFields`, `excerpt` et `rankReason`, sans prétendre reproduire le classement Linear.
Un index est reconstructible et porte la révision de sa source ; il n'est jamais l'autorité métier.
Un index périmé est reconstruit ou remplacé par un scan cohérent avant d'annoncer un résultat complet.
Un changement de branche invalide les entrées concernées même si le watcher n'a reçu aucun événement.
Les fichiers invalides donnent une lecture partielle diagnostiquée ou un échec en mode strict.
La lecture d'une vue ou la reconstruction d'index ne modifie ni issue, ni santé, ni historique métier.

## Responsabilités et concurrence

`core` définit AST, validation, prédicats et ordre ; les cas d'usage résolvent identité et périmètre.
`fs` fournit snapshots cohérents, persistance des vues et index versionnés reconstruisibles.
`SDK` expose run/search/save et les résultats communs ; `CLI` résout les options et formate.
Le résolveur S16 fournit les variantes globales ; le connecteur Linear traduit seulement les filtres supportés.
Deux modifications de vue sur la même révision produisent un succès et un conflit explicite.
La réorganisation manuelle est une mutation révisée du contexte d'ordre, pas une série de réécritures sans préconditions.
Une panne avant publication conserve la vue précédente ; le rejeu du même `operationId` restitue le résultat.

## Critères d'acceptation

1. **S07-A01** — Une requête imbriquée AND/OR donne les mêmes UUID et ordre en CLI texte, JSON et SDK.
2. **S07-A02** — Deux personnes exécutant une vue contenant `me` voient leur sélection ; une identité absente échoue explicitement.
3. **S07-A03** — Null, zéro, liste vide et labels homonymes suivent les règles ci-dessus sans coercition.
4. **S07-A04** — Une priorité égale conserve le rang manuel après modification du titre et redémarrage.
5. **S07-A05** — Une archive n'apparaît que selon l'option demandée, sans changer une mesure officielle de S08.
6. **S07-A06** — Un index périmé après checkout ne renvoie pas une liste annoncée complète issue de l'ancienne branche.
7. **S07-A07** — Deux éditions concurrentes d'une vue ne s'écrasent pas ; le rejeu d'une opération réussie ne la duplique pas.
8. **S07-A08** — Un objet global divergent retourne les origines correspondantes et une seule identité ; un curseur périmé échoue.

Les champs de résultat décrits ici sont placés dans `data` et les métadonnées dans `context` de l’enveloppe S00.
Les UUID et aliases pédagogiques suivent S00 ; les mutations résolvent explicitement workspace et autorité work/accepted.

## Sources et points de raccordement

- [Recherche de pilotage, sections 8 et 11](../../../research/02-pilotage-calcule.md).
- [Modèle local et identités](../../../research/01-modele-local.md).
- [Projection des branches](../../../research/06-design-global-branches-frame.md).
- Références fonctionnelles : [Filters](https://linear.app/docs/filters), [Views](https://linear.app/docs/custom-views), [Search](https://linear.app/docs/search), [Priority](https://linear.app/docs/priority).
- Points actuels : [services core](../../../../packages/core/src/services/index.ts), [repository fs](../../../../packages/fs/src/realm.repository.ts), [SDK](../../../../packages/sdk/src/frame.ts).
