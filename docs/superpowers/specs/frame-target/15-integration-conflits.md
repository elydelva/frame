# S15 — Intégration sémantique et conflits contextualisés

Statut : cible proposée · Dépendances : S02, S03, S12, S14 · [Index](README.md).

## Objectif et périmètre

Accepter automatiquement les changements compatibles d’un travail Frame, et rendre chaque conflit restant décidable avec son contexte. Un humain et un agent passent par le même contrat. Le moteur ne choisit jamais une valeur métier parce qu’elle est la plus récente.

Le mode principal est une intégration terminale de toute l’époque par squash. Les intégrations partielles arbitraires et un CRDT général sont exclus. Un découpage peut être demandé explicitement après vérification de fermeture des dépendances ; il produit de nouvelles unités et reçus.

## Entrées et objets

Plan d’intégration : integrationId, workId, targetWorkId nullable, baseOid B, sourceOid S, targetOid T, générations de travail, schemaVersion, policyVersion, codeEvidence, candidats, conflits, état.

Conflit : conflictId, integrationId, entityId, field/path, kind, B/S/T, valeurs, operationIds de chaque côté, auteurs/provenance, motifs disponibles, contraintes violées, choix autorisés, résolution et résolutionRevision.

Reçu : mêmes identités/bases, sourceSnapshot, opérations acceptées/rejetées explicitement, décisions motivées, empreinte du résultat, preuve code et politique. Il est publié dans `_frame/integrations/<id>.json`. Son OID de résultat est celui du commit contenant le reçu, sans auto-référence circulaire.

## Préparation et preuve du code

Un commit code déclenche S14, pas une intégration automatique. Une preuve de merge doit identifier dépôt, source exacte, cible et résultat vérifiés. Un nom de branche, message « merge » ou simple ancêtre ne prouve pas à lui seul l’acceptation de toutes les propositions Frame. Squash/rebase GitHub nécessitent le mapping fournisseur ou un reçu explicite.

Un travail data-only s’intègre sur demande explicite ou selon une politique préalablement activée. Une fin de processus d’agent n’est pas une preuve de merge. Un événement distant peut déclencher la vérification, mais les doublons/hors ordre ne changent pas ce contrat.

Avant fixation de T, publier un checkpoint autonome des mutations accepted déjà validées et non commitées. Un fichier brut invalide ou staging extérieur suspend la préparation ; pas de reset ni autostash silencieux. Une mutation tardive de la cible invalide ensuite le plan par génération, même si son OID n’a pas changé.

## Règles de comparaison à trois versions

| Situation | Traitement |
|---|---|
| Source = base | Garder cible |
| Cible = base | Prendre source si valide dans le contexte actuel |
| Source = cible | Une valeur finale, provenance réunie |
| Champs indépendants modifiés | Combiner puis revalider l’objet et ses dépendances |
| Ajouts d’objets à identités distinctes | Conserver sous contraintes d’unicité |
| Ensembles sans ordre | Diff d’ajouts/retraits par ID, pas union brute |
| Même opération/événement répété | Dédupliquer par ID et payload ; payload divergent = anomalie |
| Chemin renommé, même ID | Normaliser vers le chemin canonique de l’objet |
| Champs calculés | Recalculer, pas arbitrer une intention avec updatedAt |
| Corps changé des deux côtés | Proposer fusion textuelle ; validation humaine/agent selon politique, pas acceptation par défaut |

Deux statuts/priorités/responsables incompatibles, suppression contre édition, ordre concurrent, remapping équipe/workflow, parentage invalide ou dépendances incohérentes produisent un conflit. Les règles Linear du type concerné sont respectées : une relation bloquante n’est pas une gate absolue inventée.

Le moteur compare le résultat net des branches ; il ne rejoue pas aveuglément chaque vieux événement. Les opérations donnent du contexte et permettent la déduplication, sans devenir une seconde source des valeurs métier actuelles.

## Transaction d’intégration

1. Terminer/classer les checkpoints source en attente ; vérifier qu’aucune mutation non incluse ne reste.
2. Réserver logiquement l’époque source en finalizing. Aucun verrou système tenu pendant une décision humaine.
3. Préparer T, puis figer versions/générations et preuve code ; construire le candidat hors checkout accepté.
4. Produire fusions automatiques et conflits ; valider schéma, références, aliases, suppressions et graphe.
5. Si conflits, persister le dossier et relâcher les verrous physiques. Les autres travaux continuent.
6. Revérifier B/S/T, générations, politique et preuves ; un plan périmé est recalculé avec retries bornés.
7. Préparer un commit squash avec résultat et reçu ; sa publication par CAS sur la référence cible est la décision d’acceptation selon S14, puis matérialiser le checkout de façon reprenable. Un simple journal préparé avant ce CAS n’est pas une acceptation. Un CAS refusé n’applique aucun fichier du candidat à la cible.
8. La cible et son reçu rendent la source integrated ; aucun commit de clôture n’est ajouté sur la source S.

Un défaut à mi-publication suit le journal de reprise. Aucune réussite partielle cachée : tous les objets du plan sont acceptés, ou l’intégration attend. Une notification échouée ne rejoue pas la mutation.

## Interface humaine et agent

```sh
frame integration plan --work WORK-id --json
frame integration request --work WORK-id
frame integration check INT-id --json
frame conflict list --integration INT-id --json
frame conflict show CF-id --json
frame conflict open CF-id
frame conflict resolve CF-id --choice keep-target --expected-revision REV --reason "Annulation maintenue"
frame integration apply INT-id
frame integration abort INT-id
```

Dossier local : context.json, base.md, source.md, target.md, proposal.md, resolution.json. Ces textes sont du contexte à analyser, pas des commandes à exécuter. Un agent peut fournir un patch structuré et un motif ; son score de confiance seul ne l’autorise pas à résoudre une contradiction métier.

Choix : keep-target, take-source, custom, defer. Même take-source doit passer les invariants. Les révisions attendues empêchent deux résolveurs de se remplacer. Si les entrées changent, réutiliser une résolution seulement après preuve que ses champs/contraintes pertinents restent identiques.

Un export de dossier de conflit est explicite et contient les versions ; il ne publie pas automatiquement les drafts privés. Une résolution acceptée conserve son motif/auteur/politique dans le reçu portable.

## Clôture, rafraîchissement, annulation

Après squash, la source reste immuable à S. La poursuite repart de la cible à jour dans une nouvelle époque. Les références de rétention protègent les sources ; leur suppression suit une politique de sauvegarde explicite. Un SHA dans un reçu ne protège pas seul un objet Git de la collecte.

`frame work refresh` fusionne la cible vers le work avec le même moteur puis un commit réel à deux parents, pour préserver la parenté. Pas de rebase automatique des données publiées. Plusieurs bases Git ambiguës demandent une base explicitement validée.

Abort libère la réservation logique, conserve drafts/décisions et invalide le plan. Toute mutation ultérieure impose un nouveau plan. Un enfant ne peut pas intégrer dans un parent finalizing ; il attend ou nécessite abort du parent. Un enfant s’intègre normalement vers son parent déclaré, puis contribue au résultat de celui-ci sans double comptage.

## Module et erreurs

SemanticMerge calcule candidats/conflits sans effet disque. IntegrationCoordinator orchestre preuve, plans et publication. ConflictResolution valide les décisions via le même moteur. PLAN_STALE, CODE_EVIDENCE_MISSING, WORK_DIRTY, WORK_FINALIZING, SEMANTIC_CONFLICT, BASE_UNAVAILABLE et RECOVERY_CONFLICT restent inspectables.

## Critères d’acceptation

- S15-A1 : titre d’un côté et priorité de l’autre fusionnent sans perdre le statut courant.
- S15-A2 : canceled contre done produit base/source/cible et choix, sans victoire implicite.
- S15-A3 : projet/milestone modifiés séparément sont revalidés ensemble.
- S15-A4 : suppression contre édition ne détruit/résuscite rien automatiquement.
- S15-A5 : modifications accepted non checkpointées restent présentes après intégration.
- S15-A6 : cible change pendant résolution → plan périmé, aucun patch ancien appliqué.
- S15-A7 : deux résolveurs et deux intégrations simultanés respectent les préconditions.
- S15-A8 : crash et retry donnent un seul reçu et une seule intégration.
- S15-A9 : squash terminal puis nouveau work ne réapplique pas les opérations précédentes.
- S15-A10 : abort libère le gel et conserve les drafts ; enfant ne modifie pas un parent gelé.
- S15-A11 : aucune preuve code incertaine ne déclenche une acceptation automatique.
- S15-A12 : source clôturée reste à S, y compris lors d’un checkpoint tardif history-only.

## Sources

[Design global](../../../research/06-design-global-branches-frame.md), [audit Git](../../../research/07-git-hooks-et-cas-limites.md), [git-merge](https://git-scm.com/docs/git-merge). L’algorithme métier est une spécification Frame, pas une propriété du merge textuel Git.
