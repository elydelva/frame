# S10 — Agents, claims et exécutions

Statut : cible normative proposée ; facilités Frame distinctes des objets et statuts Linear.
Dépendances de socle : S00–S02, S07, S11, S13. S15/S16/S18/S20 sont des raccordements pour intégration, vue globale, cadence et autorité distante, pas des prérequis au runner local.

## Objectif et frontières

Un agent doit choisir un travail disponible, recevoir son contexte, réserver son exécution et produire un résultat traçable.
Une réservation technique ne modifie pas l'assignee ni le statut métier d'une issue.
Une sortie de processus réussie ne prouve ni validation métier, ni intégration, ni livraison.
Les Loops Linear et une compatibilité intégrale Agents API ne sont pas promis par un runner local.
L'exécution exige un exécuteur et une politique explicites ; le texte d'une issue importée n'est jamais une autorisation.
La fusion automatique de code, la publication distante et les messages externes exigent une autorisation distincte applicable.
Une politique de fusion déterministe des données Frame ne donne aucune permission implicite de fusionner du code.

## Identités et stockage

`issueId`, `claimId`, `executionId`, `attemptId`, `workId` et `actorId` sont des identités distinctes.
Les identités métier et techniques persistées sont des UUID ; les aliases humains ne servent pas de clés de verrou.
Un claim contient issue, acteur propriétaire, travail, autorité, révision, `fencingToken`, état et dates.
Il porte `createdAt`, `renewedAt`, `expiresAt` nullable et `parentClaimId` nullable.
L'autorité est `clone` avec `cloneId`, ou `service` avec `authorityId` selon S20.
Les claims clone résident dans le common dir Git partagé par les worktrees de ce clone, hors données métier versionnées.
Un claim local ne garantit pas l'exclusion mutuelle avec une autre copie du dépôt.
Une exécution conserve issue, claim, travail, exécuteur, politique, versions d'entrée et parent éventuel.
Chaque tentative conserve `startedAt`, `finishedAt`, `exitCode`, erreur structurée et références d'artefacts.
`exitCode: null` signifie pas de sortie observée, jamais réussite.
Le journal runtime est durable et privé ; seules les références explicitement publiées rejoignent les données partagées.
Les credentials sont hors Git, hors brief exporté et hors journaux ou artefacts partageables.

## Sélection et brief

`next` est une recommandation Frame en lecture seule ; elle ne prend pas de claim implicitement.
Les filtres S07 déterminent la population ; la politique d'exécution détermine les catégories et contraintes éligibles.
La politique par défaut exclut completed/canceled, issues bloquées et prérequis externes inconnus.
Les règles activées et chaque exclusion sont rendues par `--explain`.
La recommandation consulte claims et travaux actifs même si le snapshot accepted montre l'issue Todo.
Une issue liée à un travail actif est exclue même sans claim ; la reprise passe par ce travail identifié.
Un claim illisible ou une autorité inconnue ne vaut pas disponibilité ; l'issue concernée est exclue avec diagnostic.
Une dépendance satisfaite ne suffit pas si un autre prérequis reste ouvert ; dépendantes directes et exécutables sont séparées.
Les gates historiques ne deviennent pas une règle du modèle Linear ; toute contrainte additionnelle est une politique Frame explicite.
L'ordre par défaut est priorité métier, rang manuel applicable puis UUID stable ; aucun vieillissement caché n'est ajouté.
Aucun candidat retourne `candidate: null` et un résumé des exclusions, pas une erreur de lecture.
Le brief inclut issue, relations, documents référencés, projet, milestone, contraintes et diagnostics de fraîcheur.
Il inclut `snapshotRevision`, `workId`, `acceptedRevision`, `policyVersion` et les sources de chaque bloc.
Le contenu documentaire est du contexte non fiable ; seules les instructions locales configurées définissent les capacités accordées.
Une annulation acceptée ou un changement de contrainte après le brief impose une revalidation avant action dépendante.

## Claims, durée et fencing

L'acquisition vérifie atomiquement disponibilité et révisions du registre ; deux concurrents ne gagnent pas le même claim exclusif.
Un claim a les états `active`, `released`, `expired` ou `revoked` ; l'historique n'est pas détruit à la libération.
Un token de fencing strictement croissant par issue et autorité est attribué à chaque acquisition/remplacement.
Renouvellement, libération et mutations issues de l'exécuteur présentent claim, token et révision attendue.
Un ancien propriétaire ne peut ni libérer le nouveau claim ni publier ses mutations après remplacement.
Un claim ne bloque pas une correction humaine autorisée ; le fencing contrôle les mutations de son exécuteur.
Un claim n'est pas un verrou de fichiers ; toute mutation métier utilise aussi le coordinateur S11.
Une expiration est décidée par l'autorité sur une horloge déclarée ; absence de heartbeat ne prouve pas arrêt du processus.
Un claim sans échéance reste réservé jusqu'à libération/révocation explicite ; PID disparu n'efface pas son intention.
La reprise force une nouvelle acquisition et un nouveau token après vérification des travaux/processus encore actifs.
Le fencing protège les mutations contrôlées par Frame ; il ne peut arrêter une commande externe déjà partie.
Une perte de propriété suspend les nouvelles actions ; les effets externes incertains passent en réconciliation.
Sans service partagé, chaque résultat expose `coordination: clone-local` et ne revendique pas une réservation globale.

## Exécutions, tentatives et politique

Les états d'exécution sont `queued`, `running`, `waiting`, `succeeded`, `failed`, `canceling`, `canceled` et `unknown`.
`waiting` exige un motif : utilisateur, dépendance, conflit, artefact ou réparation.
Le runner persiste l'intention avant lancement et la référence du processus/session lorsqu'elle est disponible.
Le manifeste d'exécuteur fixe commande/adaptateur, répertoire, capacités, timeout et protocole de résultat.
La politique fixe droits de mutation, réseau, publications permises, budget, nombre maximal de tentatives et backoff.
Une politique absente ou un exécuteur inconnu interdit le lancement, sans fallback shell implicite.
Un retry crée une nouvelle tentative dans la même exécution, avec lien vers l'échec précédent et entrées revalidées.
Le rejeu du même `operationId` de lancement retrouve la même exécution, sans second processus.
Une réponse de lancement perdue donne `unknown` jusqu'à inspection ; elle n'autorise pas un redémarrage aveugle.
Les effets externes utilisent leurs clés d'idempotence quand disponibles ; sinon le résultat incertain exige réconciliation.
L'annulation persistée demande l'arrêt à l'adaptateur, puis attend une preuve d'arrêt ou expose `unknown`.
`canceled` n'est annoncé qu'après confirmation ; annuler n'efface pas les fichiers, commits ou effets déjà produits.
La fin technique en `succeeded` conserve séparément `businessValidation` et `integrationStatus`.
Une modification de statut métier exige une opération explicite et révisée, même si une politique autorise sa préparation.

## Sous-agents et artefacts

Une délégation exige une capacité de politique explicite et porte `parentExecutionId`, mandat et périmètre.
Une exécution enfant peut partager l'issue du parent sans devenir un second propriétaire exclusif de cette issue.
Elle utilise un claim délégué rattaché au claim racine ; sa validité dépend du token racine et de son propre token.
Le parent conserve la responsabilité de la réservation et de l'acceptation des résultats enfants.
Un travail enfant possède `parentWorkId` et intègre ses données vers le parent selon S13/S15.
La réussite de l'enfant ne fusionne pas son code ; l'autorisation et la preuve d'intégration restent distinctes.
L'abandon du parent suspend les enfants pour retarget explicite ; il ne les supprime pas.
Les artefacts portent UUID, type, URI/path, hash si contenu local, producteur et règles de visibilité/rétention.
Les chemins sont rattachés au travail producteur ; un lien cassé donne `artifactUnavailable`, pas un résultat vide réussi.
Un résultat contient résumé, validation exécutée, limites, changements et artefacts ; les assertions sont distinguées des preuves.
Publier un commentaire, lien ou session distante passe par S17/S19 et l'autorité autorisée, jamais par import de prompt.

## CLI, JSON et scopes

```sh
frame next --team ENG --scope accepted --explain --json
frame brief --issue ENG-101 --scope work --json
frame claim acquire --issue ENG-101 --work WORK-UUID --operation-id UUID --expected-revision REV
frame claim release CLAIM-UUID --fencing-token TOKEN --expected-revision REV --operation-id UUID
frame agent run --issue ENG-101 --executor configured-agent --policy local-review --operation-id UUID
frame agent runs --issue ENG-101 --scope global --json
frame agent show EXEC-UUID --json
frame agent retry EXEC-UUID --expected-revision REV --operation-id UUID
frame agent cancel EXEC-UUID --expected-revision REV --operation-id UUID
```

Toutes les lectures acceptent `--scope accepted|work|global` ; les écritures ne ciblent jamais `global`.
Les commandes mutantes utilisent le coordinateur partagé, `operationId` et préconditions attendues de S11.
Le lancement transmet aussi les révisions issue/travail/politique et le token de claim ; le SDK n'a aucun contournement.
Un claim acquis avec le lancement doit être journalisé dans la même orchestration reprenable.
Le JSON expose `candidate`, `excluded`, `claim`, `execution`, `attempts`, `artifacts` selon le cas d'usage.
Il inclut toujours scope, révisions, `coordination`, autorité, diagnostics et disponibilité des sources consultées.
Des collections connues vides retournent `[]` ; un état de processus inconnu est explicite, jamais `running` par défaut.
Les erreurs incluent `CLAIM_CONFLICT`, `STALE_FENCE`, `REVISION_CONFLICT`, `EXECUTOR_UNAVAILABLE` et `POLICY_DENIED`.

## Responsabilités et reprise

`core` possède sélection, machines d'états et règles de délégation ; les cas d'usage orchestrent les préconditions.
Le stockage runtime/common dir possède claims et tentatives ; S11 possède verrou court, journal et publication métier.
Les adaptateurs d'exécuteur possèdent lancement/inspection/arrêt ; le SDK expose le même protocole à CLI et agents.
S13 possède les travaux ; S15 possède l'intégration ; S20 possède l'autorité multiclone quand configurée.
Après crash, la reprise inspecte tentative et processus avant de proposer retry, abandon ou réparation.
Un registre corrompu bloque la réservation concernée et conserve ses fichiers pour réparation explicite.

## Critères d'acceptation

1. **S10-A01** — Deux acquisitions concurrentes sur une issue donnent un propriétaire ; un retry d'opération ne crée pas un second claim.
2. **S10-A02** — Un ancien token ne peut libérer ni muter après remplacement, même si son processus continue.
3. **S10-A03** — `next --scope accepted` exclut une issue Todo déjà couverte par un travail actif ou claim ; il explique les inconnues.
4. **S10-A04** — Lancement sans exécuteur/politique échoue ; réponse perdue ne déclenche pas une seconde exécution.
5. **S10-A05** — Une annulation sans confirmation expose un état incertain et préserve artefacts et modifications produits.
6. **S10-A06** — Un sous-agent partageant l'issue garde ses identités, intègre vers le parent et ne fusionne aucun code par simple succès.
7. **S10-A07** — Un succès technique ne modifie pas le statut métier ni la santé ; la validation reste un champ séparé.
8. **S10-A08** — Deux clones sans service annoncent leur portée locale ; aucune réservation globale fictive n'est affichée.
9. **S10-A09** — Une annulation acceptée après création du brief suspend l'action incompatible avant publication métier.

Les champs de résultat décrits ici sont placés dans `data` et les métadonnées dans `context` de l’enveloppe S00.
Les UUID et aliases pédagogiques suivent S00 ; les mutations résolvent explicitement workspace et autorité work/accepted.

## Sources et état actuel

- [Pilotage, dépendances et recommandations](../../../research/02-pilotage-calcule.md), [services actifs, agents et fiabilité](../../../research/03-services-actifs.md).
- [Design global, travaux actifs et sous-agents](../../../research/06-design-global-branches-frame.md).
- L'actuel [get-next](../../../../packages/core/src/use-cases/get-next/get-next.ts) trie priorité/jalon/création ; il ne définit pas l'ordre cible ci-dessus.
- L'actuel [claim-store](../../../../apps/cli/src/worktrees/claim-store.ts) protège une réservation locale avec `claimId` ; il ne constitue pas le fencing complet ni un service multiclone.
- Références de périmètre : [Agents API](https://linear.app/developers/agents), [Loops](https://linear.app/docs/loops).
