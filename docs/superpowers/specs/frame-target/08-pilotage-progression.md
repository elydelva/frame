# S08 — Pilotage et progression

Statut : cible normative proposée ; les mesures non vérifiées restent indisponibles.
Dépendances de socle : S01–S07, S17. Séries et variantes globales sont des raccordements S09/S16 ; le calcul courant ne dépend pas de leur livraison.

## Objectif et périmètre

Les rapports doivent séparer périmètre, travail commencé, travail terminé et santé publiée.
Ils couvrent projets, milestones, initiatives et cycles, avec drill-down vers les objets sources.
Ils rendent les lectures Linear retenues sans substituer une formule Frame sous le même nom.
Un taux de livraison ne constitue pas une mesure de résultat business.
Cette spec ne modifie ni statut métier, ni dates, ni santé à la lecture d'un rapport.
Les graphiques interactifs et toute formule Linear non établie sont hors de ce contrat de livraison numérique.

## Contrat d'une mesure

Chaque mesure porte `metricId`, `definitionVersion`, `status`, `value`, `unit` et `reason`.
`status` vaut `available`, `unavailable` ou `stale` ; une indisponibilité retourne `value: null`.
`source` vaut `linear-remote`, `linear-validated-local` ou `frame-local`.
La provenance comprend `sourceRevision`, `fetchedAt`, `calculatedAt`, `parameters` et `diagnostics`.
Un résultat local porte le snapshot, les versions des réglages et le jeu de conformité associé.
Une valeur distante garde sa révision et sa date ; `fetchedAt` ne prouve pas qu'elle décrit les mutations locales.
Une divergence locale du périmètre ou des paramètres marque la valeur distante `stale`.
Une valeur périmée peut être consultée comme historique, jamais présentée comme progression actuelle.
`reason` contient un code stable et une explication lorsqu'une mesure est indisponible ou périmée.
Les motifs incluent `FORMULA_UNVERIFIED`, `SOURCE_UNAVAILABLE`, `INCOMPLETE_SNAPSHOT` et `INCOMPATIBLE_PARAMETERS`.
Un résultat zéro n'est disponible que si la définition s'applique et que les sources sont complètes.
Un dénominateur nul ne devient ni 0 % ni 100 % par défaut ; le scénario conforme doit en décider.
`--explain` expose définition, inclusions, exclusions, contributions et limites de conformité.
L'explication ne révèle pas des secrets de connexion ou des données hors périmètre accessible.

## Réglages d'estimation

Chaque contribution résout l'équipe et la version de sa politique d'estimation.
L'estimation explicite zéro reste distincte d'une estimation absente.
L'explication distingue `explicitEstimate`, `effectiveWeight` et `weightReason`.
Les modes sans estimation, les valeurs non estimées et les tailles de vêtements suivent S01.
La conversion Fibonacci et les paramètres hérités sont contrôlés par les cas de conformité applicables.
Un projet multiéquipe ne reçoit pas arbitrairement la politique de son équipe pilote.
Les anciennes durées en heures ne sont pas additionnées aux points sans mapping explicite validé.
Une politique incompatible rend indisponible la mesure pondérée concernée, sans masquer les listes d'issues.
Changer la politique crée une nouvelle version ; les séries passées gardent leur contexte de calcul.

## Projet et comptes Frame

Le rapport projet expose séparément le scope, les catégories commencées et les catégories terminées.
Les totaux conformes Linear exigent une définition validée pour parents, enfants, archives, doublons et annulations.
Suppression, transfert, réouverture et changement d'estimation doivent être couverts avant revendication de conformité.
Un filtre visuel de S07 n'altère pas silencieusement ces totaux ; une simulation porte ses propres paramètres.
Une mesure locale distincte `frame.issue-count-by-category.v1` reste disponible sur un snapshot complet.
Elle compte une fois chaque UUID d'issue dont `projectId` désigne le projet dans le périmètre déclaré.
Elle inclut parents, enfants et archives existants, avec sous-comptes explicites ; les tombstones sont exclus.
Elle conserve les catégories canceled et les doublons comme catégories/propriétés observées, sans les assimiler à du livré.
Elle ne calcule aucun pourcentage de progression Linear.
Le résultat présente `countsByCategory`, `archivedCount`, `unestimatedCount`, `zeroEstimateCount` et les IDs sources.
En snapshot partiel, les comptes observés portent `complete: false` et ne représentent pas le total du projet.
Les variations de périmètre relèvent des événements fiables S09, pas d'une inférence depuis les seuls fichiers actuels.

## Milestones

Un jalon expose projet parent, ordre, date cible, issues sources et comptes bruts par catégorie.
Le pourcentage doit prendre en compte le travail commencé selon un comportement Linear validé.
Aucun coefficient de cycle n'est transposé au jalon sans preuve dédiée.
L'ancien statut manuel pending/active/done n'est pas la progression calculée du jalon.
Un jalon vide n'est pas déclaré terminé par convention ; son pourcentage reste indisponible si le cas n'est pas établi.
`currentMilestoneId` désigne le prochain jalon incomplet uniquement si les règles d'ordre et de complétion sont validées.
Sinon `currentMilestoneId: null` est accompagné d'un motif ; la liste ordonnée reste accessible.
Des jalons parallèles ne sont pas rendus bloquants par leur seul ordre d'affichage.
Une réouverture ou un déplacement d'issue invalide le cache des jalons source et destination.

## Initiatives et santé

Le rapport distingue projets directs et projets atteints via descendants selon S04.
La consolidation déduplique les projets par UUID, même dans un graphe multiparent.
Chaque projet conserve ses chemins d'appartenance dans `membershipPaths` pour expliquer sa présence.
La santé déclarée de l'initiative vient de ses publications S17, jamais d'une moyenne de progressions.
La distribution des santés projet présente les états déclarés, leur date et un compartiment sans publication.
`publishedHealth: null` signifie absence de santé publiée ; ce n'est ni sain ni à risque.
Une publication ancienne est signalée selon un seuil explicite de rapport, sans réécrire sa santé.
Un score de risque éventuel est une métrique distincte, avec définition et provenance propres.
Les projets sans update ne sont pas exclus de la composition consolidée.

## Cycles

Le rapport cycle distingue scope, commencé, terminé et succès ; succès n'est pas taux de complétion.
Le scénario officiel sans ambiguïté de poids, cinq terminées/quatre commencées/une non commencée, produit 60 %.
Ce scénario ne suffit pas à autoriser toutes les pondérations d'estimation ou tous les cas limites.
La formule locale n'est disponible que pour le sous-ensemble de paramètres couvert par le corpus de conformité.
Les variantes non couvertes retournent `FORMULA_UNVERIFIED`, même si une extrapolation semble plausible.
La capacité exige une définition Linear vérifiée ; elle n'est pas remplacée par un budget local arbitraire.
Les ajouts, retraits, reports et complétions tardives sont expliqués à partir des affectations historisées S06/S09.
Le fuseau d'équipe et les frontières de cooldown font partie des paramètres, jamais ceux de la machine par défaut.
Un cycle sans issues suit la règle de dénominateur nul, sans succès certain inventé.

## CLI, scopes et cohérence

```sh
frame project show PROJ-0001 --progress --scope accepted --explain --json
frame milestone list --project PROJ-0001 --progress --json
frame milestone show MILE-0001 --issues --explain --json
frame initiative show INIT-0001 --include-descendants --health --json
frame cycle show CYCLE-0001 --progress --explain --json
```

Les lectures acceptent `--scope accepted|work|global` ; les mesures officielles utilisent `accepted` par défaut.
`work` produit une simulation nommée liée à son `workId` ; elle ne remplace pas le rapport accepté.
`global` montre les alternatives et leurs effets, sans additionner des propositions incompatibles.
Le JSON comprend `entityId`, `scope`, `simulation`, `snapshotRevision`, `versionVector`, `metrics` et `diagnostics`.
Il comprend `coverage`, `sourceIssueIds` et les versions de définition ; les résultats vides utilisent des listes vides.
Un rapport ne déclenche aucune mutation ; les corrections passent par le coordinateur S11 avec opération et révisions attendues.
Le snapshot lie objets et réglages ; un changement concurrent impose un retry borné ou un résultat explicitement ancien.
Une branche inaccessible reste inconnue dans la projection, jamais un travail à zéro.
Un cache est invalidé par révisions métier et versions de paramètres, y compris après checkout externe.

## Responsabilités

`core/services` possède les définitions pures et registres de conformité ; aucun appel réseau dans une formule.
Les cas d'usage résolvent le périmètre ; `fs` fournit snapshots et diagnostics de couverture.
Le connecteur Linear fournit les valeurs distantes et leur provenance selon S19 ; il n'implémente pas un second calcul.
`SDK` expose les rapports communs ; `CLI` formate les valeurs et rend visibles indisponibilité et simulation.
S17 possède les publications de santé ; S09 possède les séries ; S16 possède la projection des propositions.

## Critères d'acceptation

1. **S08-A01** — Zéro explicite, non estimée et estimations désactivées donnent des contributions distinguables et explicables.
2. **S08-A02** — Une mutation locale après synchronisation marque la valeur distante périmée sans la présenter comme actuelle.
3. **S08-A03** — Un jalon started ne reçoit aucun coefficient inventé ; vide et réouvert suivent des scénarios vérifiés ou restent indisponibles.
4. **S08-A04** — Un projet accessible par deux sous-initiatives compte une fois ; absence d'update reste une catégorie visible.
5. **S08-A05** — Le cas cycle 5/4/1 produit 60 % sur le corpus validé ; une variante non vérifiée expose un motif.
6. **S08-A06** — Parent, enfant, archive et tombstone produisent les comptes Frame spécifiés sans revendication de progression Linear.
7. **S08-A07** — Une branche divergente ne change pas le rapport accepté ; sa simulation expose origine et version.
8. **S08-A08** — Un fichier invalide interdit une annonce de couverture totale et ne transforme pas le manque en zéro.

Les champs de résultat décrits ici sont placés dans `data` et les métadonnées dans `context` de l’enveloppe S00.
Les UUID et aliases pédagogiques suivent S00 ; les mutations résolvent explicitement workspace et autorité work/accepted.

## Sources

- [Pilotage calculé, sections 2–7 et 11–12](../../../research/02-pilotage-calcule.md).
- [Design global, scopes et indicateurs](../../../research/06-design-global-branches-frame.md).
- Références fonctionnelles : [Estimates](https://linear.app/docs/estimates), [Project graph](https://linear.app/docs/project-graph), [Milestones](https://linear.app/docs/project-milestones), [Cycle graph](https://linear.app/docs/cycle-graph), [Updates](https://linear.app/docs/initiative-and-project-updates).
