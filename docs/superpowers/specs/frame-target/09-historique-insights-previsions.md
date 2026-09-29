# S09 — Historique, insights et prévisions

Statut : cible normative proposée ; aucune reconstruction Linear non vérifiée n'est annoncée disponible.
Dépendances de socle : S00, S06–S08, S11. S14–S16 et S19 fournissent des provenances supplémentaires via le même contrat d’événements, sans bloquer le journal local.

## Objectif et périmètre

Les rapports doivent expliquer les changements de scope et mesurer des flux à partir de faits datés fiables.
Ils couvrent historique de projet/cycle, transitions d'issues, débit, temps de cycle et prévision de projet.
Une lecture présente ce que les sources permettent de savoir, y compris les périodes manquantes.
L'état actuel ne suffit pas à reconstituer le passé ; la date de modification d'un fichier n'est pas un événement métier.
Les insights conformes Linear et les compteurs propres à Frame ont des identifiants distincts.
Une simulation statistique alternative à Linear n'est pas incluse sous le nom de prévision Linear.

## Événements durables

Un événement possède `id` UUID, `operationId`, `entityId`, `entityType`, `eventType` et `schemaVersion`.
Il conserve `actorId`, `origin`, `causationId`, `correlationId` et `sourceEventId` quand ils existent.
`occurredAt` est l'instant métier attesté, nullable ; `recordedAt` est l'instant d'enregistrement local obligatoire.
`timeEvidence` distingue horodatage fournisseur, commande locale, import et observation externe.
`beforeRevision`, `afterRevision`, `changes`, `workId` et `epoch` relient l'événement à une mutation vérifiable.
`changes` expose les propriétés nécessaires aux calculs avec anciennes et nouvelles valeurs typées.
Les événements utiles comprennent affectation de projet/cycle/milestone, statut, estimation et suppression/restauration.
Les versions de réglages d'équipe sont conservées ou résolubles à la date de mesure.
Une modification de scope est un ajout/retrait explicite, pas seulement une différence de compte agrégée.
Un transfert conserve une causalité commune entre la sortie du périmètre source et l'entrée du périmètre cible.
Une suppression conserve le minimum historique nécessaire sans restaurer l'objet dans les listes actives.
Un événement de correction référence l'événement corrigé ; une trace durable n'est pas réécrite silencieusement.
Les secrets et prompts privés d'exécution ne font pas partie de l'historique métier partagé.

## Dates, import et qualité historique

Un import initialise une baseline datée avec `historyKnownFrom` et la couverture fournie par la source.
Sans événements source, une baseline ne crée pas artificiellement des transitions entre création et import.
Les dates de création/import/connaissance ne sont pas interchangeables.
Une édition Markdown réconciliée donne un événement d'observation avec date effective inconnue si elle n'est pas attestée.
L'instant d'observation peut servir à un rapport explicitement observé, jamais à un temps métier prétendument exact.
Une correction d'horloge ou un événement distant tardif déclenche le recalcul des fenêtres affectées.
Les événements fournisseur dupliqués sont dédupliqués par `(provider, remoteWorkspaceId, sourceEventId, sourceVersion)` ; connectionId reste une provenance. Reconnecter un workspace ne recrée pas ses événements ni ses notifications.
Les événements hors ordre sont ordonnés selon la preuve de séquence source ; une ambiguïté demeure diagnostiquée.
L'heure murale ne sert pas de dernier écrivain gagnant ni de preuve suffisante de causalité.
Les limites des fenêtres sont `[since, until)` et le fuseau d'agrégation est explicite.
Un intervalle ouvert ou non attesté est exclu d'une durée complète avec motif, jamais remplacé par zéro.

## Portée des historiques

`--scope accepted|work|global` est disponible sur chaque lecture selon S00/S16.
L'historique officiel utilise `accepted`, y compris les mutations durables acceptées non encore checkpointées.
Les propositions d'une branche restent identifiées comme propositions tant qu'elles ne sont pas acceptées.
L'événement conserve origine métier et date d'acceptation ; accepter tardivement ne falsifie pas sa date d'origine.
Une série officielle déclare si elle mesure les transitions acceptées ou les dates métier attestées importées.
La même opération héritée par un enfant puis intégrée au parent n'est comptée qu'une fois.
Les reçus de S15 relient contributions acceptées et événements d'origine, sans effacer la provenance.
La projection globale permet l'inspection de scénarios ; elle ne somme pas des histoires incompatibles.
Une époque de travail clôturée conserve ses événements ; une nouvelle époque n'en produit pas des copies nouvelles.
Un historique Git réécrit ne réécrit pas les identités d'événement ni leur causalité.

## Insights et définitions

Chaque métrique utilise l'enveloppe de S08 : définition versionnée, source, paramètres, couverture et disponibilité.
Une définition Linear doit fixer catégories, transitions retenues, population, bornes temporelles et réouvertures.
Pour le temps de cycle, entrée en started, sorties, reprises et complétions multiples exigent des scénarios conformes.
Aucune durée « création vers clôture » n'est appelée temps de cycle sans validation de sa définition.
Le débit conforme précise unités, regroupement temporel et traitement des réouvertures et annulations.
Tant que ces règles ne sont pas vérifiées, la mesure Linear retourne `FORMULA_UNVERIFIED`.
Une série Frame `frame.completed-transition-count.v1` peut être fournie séparément.
Elle compte les événements attestés passant d'une catégorie non completed vers completed dans la fenêtre.
Une seconde complétion après réouverture compte une seconde transition ; `distinctIssueCount` indique séparément les UUID uniques.
La série n'est pas une vélocité en points et n'est pas assimilée au débit Linear.
Elle expose les événements sources et la définition du scope choisi, avec buckets vides à zéro seulement si la couverture est complète.
Une fenêtre sans couverture donne `value: null`, `coverage: unknown` ; l'absence de trace ne prouve pas l'absence de travail.
Les filtres et populations sont inclus dans la définition effective ; un rapport ne compare pas silencieusement deux populations différentes.

## Prévision de projet

La sortie contient `forecastDate`, `rangeStart`, `rangeEnd`, `status`, `reason` et la provenance S08.
Elle expose `historyWindow`, `scopeRevision`, `definitionVersion`, `assumptions` et `coverage`.
Une date distante est présentée comme valeur Linear avec sa date de récupération et son contexte vérifiable.
Une valeur dont le scope a changé localement est périmée ; elle n'est pas projetée sur le nouveau scope sans calcul validé.
La documentation décrit une base hebdomadaire, un poids supérieur au récent et un traitement du travail en cours.
Ces indications et une fourchette documentée ne définissent pas tous les coefficients d'un algorithme local.
Une reconstruction ne devient disponible qu'après validation des coefficients et des cas limites retenus.
Moins d'une semaine d'historique ne permet pas d'annoncer une prévision locale conforme ; `INSUFFICIENT_HISTORY` est explicite.
Débit nul, historique troué, changements de scope et réouvertures ne produisent pas une date certaine par défaut.
Si le comportement conforme n'est pas établi pour l'un de ces cas, la prévision reste indisponible.
Les données hebdomadaires observées restent affichables avec leurs limites, même sans prévision.
Une fourchette n'est pas appelée intervalle de confiance probabiliste sans définition statistique attestée.
Un pourcentage de confiance n'est jamais inventé à partir de la seule quantité d'historique.

## CLI et résultats

```sh
frame project history PROJ-0001 --since 2026-10-01 --changes scope --scope accepted --json
frame cycle history CYCLE-0001 --changes scope --json
frame issue history ENG-101 --json
frame insights --team ENG --metric cycle-time --since 2026-10-01 --until 2026-11-01 --explain --json
frame insights --project PROJ-0001 --metric frame.completed-transition-count.v1 --json
frame project forecast PROJ-0001 --scope accepted --explain --json
```

Le JSON historique expose `events`, `baseline`, `coverageIntervals`, `gaps`, `nextCursor` et `diagnostics`.
Le JSON métrique expose `metric`, `population`, `buckets`, `sourceEventIds` et `excludedObservations`.
Chaque réponse porte `scope`, `snapshotRevision`, `versionVector`, `calculatedAt` et `timezone`.
Une liste vide complète est `events: []` ; une collecte incomplète ajoute ses lacunes sans total trompeur.
Une mesure indisponible constitue un résultat métier consultable avec `value: null`, pas une sortie numérique zéro.
Une requête invalide, une version inconnue ou une source illisible en mode strict constitue une erreur structurée S00.
Les corrections d'événements utilisent le coordinateur S11 avec `operationId` et révisions attendues ; aucune écriture `global`.

## Concurrence, reprise et responsabilités

L'événement et sa mutation sont publiés selon la transaction S11 ; une trace en best effort ne suffit pas.
Un crash après publication et avant acquittement ne génère pas de deuxième transition au rejeu.
Un événement en attente de publication n'est pas compté comme accepté.
Le calcul capture un snapshot et une borne de journal ; l'arrivée concurrente est visible au prochain calcul.
Les caches d'agrégats sont reconstruisibles depuis événements, baselines et versions de réglages durables.
`core` possède définitions et règles de population ; les cas d'usage orchestrent fenêtres et preuves.
`fs` possède journal durable et snapshots ; `SDK` expose historiques et insights ; `CLI` formate sans recalculer.
Les adaptateurs S19 fournissent provenance et identités distantes ; S14/S15 fournissent associations et reçus.
La rétention du journal ne peut supprimer une preuve utilisée par une mesure sans rendre sa couverture dégradée explicite.

## Critères d'acceptation

1. **S09-A01** — Un import de fichiers courants sans traces ne fabrique ni transitions passées ni temps de cycle.
2. **S09-A02** — Un crash entre publication et réponse suivi du même `operationId` conserve exactement un événement métier.
3. **S09-A03** — Une fermeture, réouverture et seconde fermeture donnent deux transitions Frame, une issue distincte et aucune parité Linear implicite.
4. **S09-A04** — Un événement tardif recalcule le bucket approprié ; une heure ambiguë est diagnostiquée.
5. **S09-A05** — Une opération enfant intégrée au parent puis acceptée n'est comptée qu'une fois dans le même historique officiel.
6. **S09-A06** — Historique insuffisant, débit nul ou formule inconnue donnent une prévision indisponible avec motif et sans date inventée.
7. **S09-A07** — Une semaine couverte sans événement donne zéro ; une semaine inconnue donne null et une lacune.
8. **S09-A08** — Une modification locale de scope rend la prévision distante périmée ; le rapport expose les deux révisions.

Les champs de résultat décrits ici sont placés dans `data` et les métadonnées dans `context` de l’enveloppe S00.
Les UUID et aliases pédagogiques suivent S00 ; les mutations résolvent explicitement workspace et autorité work/accepted.

## Sources

- [Pilotage calculé, sections 4, 7, 10–12](../../../research/02-pilotage-calcule.md).
- [Services actifs, fiabilité des événements](../../../research/03-services-actifs.md).
- [Design global, provenance et reçus](../../../research/06-design-global-branches-frame.md).
- Références fonctionnelles : [Insights](https://linear.app/docs/insights), [Project graph](https://linear.app/docs/project-graph), [Cycle graph](https://linear.app/docs/cycle-graph).
- Point actuel à faire évoluer : [record-trace](../../../../packages/core/src/use-cases/record-trace.ts).
