# S06 — Cycles, affectations et historique

Statut : cible proposée au 2026-09-29 ; aucun scheduler ni cycle attesté dans la baseline.
Dépendances : [S02](02-issues-relations-cycle-de-vie.md), [S11](11-stockage-transactions.md).
Exécution : [S18](18-automatisations-admission.md) ; indicateurs : [S08](08-pilotage-progression.md).

Les champs communs `kind`, identité, provenance et les enveloppes JSON suivent [S00](00-contrats-transverses.md).
Les raisons métier détaillées complètent ses codes d’erreur communs, sans créer une autre enveloppe.

## Objectif et périmètre

Un cycle est une période de travail d'équipe, distincte d'un projet ou d'un milestone.
Permettre planification, consultation de la période courante, cooldown et historique des affectations.
Conserver les mouvements de scope nécessaires aux lectures de succès et aux reports.
La création récurrente, les rappels et le rattrapage du runner appartiennent à S18.
Les formules de progression, succès et capacité appartiennent à S08, sans budget inventé ici.
Les cycles d'un projet n'existent pas ; un projet rassemble des issues de plusieurs cycles d'équipe.

## Champs et paramètres

| Objet/champ | Contrat |
|---|---|
| Cycle `id`, `identifier`, `revision` | UUID stable, alias CYCLE-…, révision S11 |
| `teamId`, `number`, `title`, `body` | Équipe propriétaire, numéro de séquence, titre, description vide par défaut |
| `startsAt`, `endsAt`, `timezone` | Bornes UTC, fuseau IANA ayant déterminé leur calcul |
| `cooldownEndsAt` | Fin de cooldown UTC, égale à endsAt si aucun cooldown |
| `scheduleRevision`, `originOccurrenceKey` | Révision des réglages et clé logique de l'occurrence, null si création ponctuelle |
| `creatorId`, `createdAt`, `updatedAt` | Provenance et instants de création/modification |
| `deletedAt`, `archivedAt` | Lifecycle et provenance, null par défaut |
| Team cycle settings | `cycleRuleId` référence la règle S18 ; enabled, cadence, timezone, cooldown et owner sont des projections de cette règle |

`team.cycleRuleId` est le seul rattachement de configuration exécutable. La règle S18 porte les valeurs canoniques, politiques DST et rattrapage ; l’équipe les expose sans seconde copie mutable. `scheduleRevision` est sa révision, `originOccurrenceKey` la clé d’occurrence définie dans S18. Une occurrence conserve son snapshot de paramètres après évolution de la règle.

`number` sert à l'affichage et n'est jamais l'identité de synchronisation.
Les alias en collision sont traités selon S00 ; aucun compteur local n'est une identité globale.
`startsAt < endsAt <= cooldownEndsAt` ; une période active est `[startsAt, endsAt)`.
Le cooldown est `[endsAt, cooldownEndsAt)` ; les instants de frontière appartiennent à la période suivante.
Les réglages sont explicites : aucune heure ou timezone de la machine n'est choisie implicitement.
L'activation exige date d'ancrage, heure locale, durée positive, cooldown non négatif et owner.
`owner` vaut frame ou linear pour l'exécution ; un seul propriétaire crée les occurrences.
Une durée ou combinaison non validée pour le profil Linear est conservée mais non exécutable en mode conforme.
Un changement de paramètres n'altère pas les bornes ni le fuseau d'anciennes occurrences.
Les cycles hérités éventuels exposent leur équipe source et leur règle de disponibilité validée.
Sans règle d'héritage validée, une issue ne peut être affectée qu'à un cycle de sa propre équipe.

## Affectations et historique

Une issue possède au plus un `cycleId` courant, facultatif selon S02.
Ajouter une issue au cycle ne change ni projet, ni statut, ni estimation.
Retirer une issue ne signifie ni annulation ni suppression.
Chaque affectation, retrait ou report enregistre un événement métier durable S09/S11.
L'événement contient UUID, issueId, ancien/nouveau cycleId, effectiveAt, recordedAt, acteur, origine et operationId.
Un report ajoute sourceCycleId, destinationCycleId et motif ; il reste lié à la même issue.
Un événement importé distingue la date distante connue de sa date locale de réception.
Si la date effective manque, l'historique est marqué incomplet ; la date d'import n'est pas présentée comme engagement initial.
Le scope de début, les ajouts/retraits et le scope de fin sont reconstruits seulement depuis des preuves disponibles.
L'absence d'événement n'est jamais transformée en historique synthétique certain.
Les changements d'estimation et de statut sont associés à la version de politique d'équipe utilisée.
Les lectures historiques ne recalculent pas rétroactivement tout le passé avec l'estimation actuelle.
La liste actuelle d'issues et l'historique d'un cycle sont deux résultats distincts.
Une issue reportée reste visible dans l'historique de son cycle d'origine.

## Cycle courant, cooldown et report

`current` résout l'équipe, l'instant de référence et les réglages effectifs.
Dans une période active unique, il renvoie ce cycle et `phase: active`.
Dans un cooldown, il renvoie le cycle venant de finir et `phase: cooldown` avec le prochain cycle connu.
En dehors des périodes connues, il renvoie `phase: none` ; il ne crée pas de cycle pendant la lecture.
Plusieurs cycles actifs contradictoires produisent un diagnostic d'ambiguïté, pas un choix par numéro.
Le runner propriétaire propose le report des issues éligibles à la frontière déterminée par son profil.
L'éligibilité des annulations, doublons et réouvertures doit être validée dans ce profil.
Tant que ces cas ne sont pas validés, le report automatique correspondant est indisponible, avec liste des objets concernés.
Le report publie toutes les affectations et événements d'une occurrence sous le même coordinateur S11.
Le cooldown permet le traitement des complétions tardives selon le contrat Linear vérifié.
Le rattachement exact d'une complétion tardive reste une capacité de conformité distincte.
Sans validation, Frame conserve l'événement daté et n'attribue pas arbitrairement du succès à un cycle.
Après le début du cycle suivant, aucune réécriture rétroactive n'est déduite automatiquement d'une complétion.
Une donnée distante explicite peut enrichir l'historique, avec provenance et diagnostic de divergence.
La capacité et le succès estimé non validés restent indisponibles ; les comptes bruts sont consultables.

## Contrat CLI et résultats

```sh
frame team cycles configure ENG --duration-weeks 2 --timezone Europe/Paris --anchor-date 2026-10-05 --start-time 09:00 --cooldown-days 2 --owner frame --dst-gap next-valid --dst-fold first --catch-up latest --max-occurrences 10
frame cycle list --team ENG --scope accepted --json
frame cycle current --team ENG --scope work
frame cycle new --team ENG --title "Cycle 41" --start 2026-10-05T09:00:00+02:00 --end 2026-10-19T09:00:00+02:00
frame issue edit ENG-101 --cycle CYCLE-0001
frame issue edit ENG-101 --no-cycle
frame cycle show CYCLE-0001 --progress --explain --scope global
frame cycle history CYCLE-0001 --changes scope --scope accepted --json
frame automation run --due --dry-run
```

Configurer la cadence crée/modifie sa règle sans l’activer implicitement. L’activation passe par `frame automation enable RULE-id` sur une règle acceptée et vérifiée ; une limite de rattrapage laisse le solde dû visible dans S18.
Une création ponctuelle exige un fuseau d'équipe connu et ne reprogramme pas sa cadence.
Les lectures acceptent accepted/work/global ; défaut work et global non modifiable.
Le résultat `current` inclut instant évalué, phase, bornes, fuseau et provenance des paramètres.
`history` inclut couverture, événements ordonnés et distinction effectiveAt/recordedAt.
Le JSON de progression cite S08 et rend une valeur indisponible avec raison plutôt qu'un zéro trompeur.
Toute mutation utilise `operationId`, révisions attendues et le même coordinateur CLI/SDK S11.
La synchronisation d'occurrences et d'historique utilise uniquement `frame sync linear …`.

## Erreurs, concurrence et responsabilités

Cycle incompatible, bornes invalides, fuseau inconnu et occurrence ambiguë sont des erreurs structurées.
Une issue transférée d'équipe pendant un report invalide le plan d'affectation devenu obsolète.
Deux runners de S18 ne peuvent publier deux fois une même `originOccurrenceKey`.
Un changement d'owner frame→linear exige reprise/réconciliation S18 avant de créer d'autres occurrences.
Un arrêt prolongé ne déplace pas la date logique d'un cycle vers la date de redémarrage.
Le comportement de rattrapage est celui de S18 ; cette spec conserve toutes les périodes identifiées.
`packages/core/src/entities/` porte Cycle et réglages d'équipe ; les services core portent validation temporelle.
Les cas d'usage core gèrent affectations et lecture historique sans dépendance à un scheduler.
`packages/fs/src/realm.repository.ts` charge objets et événements par snapshot cohérent.
`packages/lint/src/engine.ts` vérifie bornes, disponibilité d'équipe et références.
S18 possède le runner ; S08 les indicateurs ; S09 la couverture temporelle ; la CLI ne duplique aucun calcul.

## Critères d'acceptation

1. S06-A01 — Affecter une issue à un cycle de son équipe conserve projet, statut et estimation.
2. S06-A02 — Un cycle incompatible avec l'équipe est refusé avant toute écriture d'événement.
3. S06-A03 — Au début et à la fin exacte d'une période, `current` respecte les bornes et le cooldown déclarés.
4. S06-A04 — Une occurrence traversant le changement d'heure conserve l'heure locale du profil et les bornes UTC correctes.
5. S06-A05 — Un report montre la même issue dans l'historique source et dans le scope courant destination.
6. S06-A06 — Deux runners sur la même occurrence ne créent qu'un cycle et un ensemble d'événements de report.
7. S06-A07 — Un import sans dates d'affectation signale un historique incomplet au lieu de fabriquer un engagement initial.
8. S06-A08 — Une complétion tardive sans profil validé est conservée mais ne produit aucun succès numérique inventé.
9. S06-A09 — Lire current sans occurrence disponible renvoie none sans déclencher le runner.

## Sources et frontières de conformité

[Modèle local, cycles](../../../research/01-modele-local.md), [cycle graph et histoire](../../../research/02-pilotage-calcule.md).
[Services actifs, cadence et propriétaire](../../../research/03-services-actifs.md).
[Cycles](https://linear.app/docs/use-cycles), [Cycle graph](https://linear.app/docs/cycle-graph).
Les exemples de succès documentés servent aux tests S08 ; ils ne prouvent ni coefficients estimés ni capacité ni toutes les frontières de cooldown.
