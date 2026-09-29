# S18 — Automatisations et admission

Statut : contrat cible proposé ; aucune exécution ou connexion activée par ce document.
Dépendances de socle : S06, S10, S11, S15, S17. S19/S20 sont requis uniquement pour les règles connectées ou l’autorité distribuée.

## Objet et périmètre

Frame DOIT exécuter des règles explicites, identifiables et reprenables sur l'état accepté.
Sont inclus cycles/report, récurrence, rappels, éligibilité à l'archivage, triage, intake et événements PR.
Le lancement d'agents utilise S10 ; la fin d'un processus ne signifie pas validation métier.
SLA, Customer Requests, Loops et releases métier restent hors périmètre.
Un document importé ne peut créer ou activer une règle exécutable.
Un serveur Board n'est pas implicitement un runner permanent.

## Règles et état durable

| Champ | Contrat |
|---|---|
| `ruleId`, `revision` | UUID et révision de la configuration partagée |
| `workspaceId`, `target` | Autorité accepted et sélection d'objets autorisés |
| `kind` | `recurrence|cycle|reminder|archive|intake|pr-transition` |
| `owner` | `frame` ou `linear`, unique pour cette règle logique |
| `ownerEpoch` | Entier de fencing changé lors d'un transfert d'exécuteur |
| `enabled` | Faux à la création ; activation explicite après validation |
| `schedule` | Cadence, fuseau IANA, date de début, heure locale, jours ou intervalle |
| `catchUp` | `none|latest|all`, avec maximum d'occurrences par exécution |
| `cooldown` | Durée et événement de départ explicites ; jamais un délai implicite |
| `action` | Type fermé, paramètres validés, cibles et effets externes déclarés |
| `externalRuleId` | Identité de la règle Linear si Linear en est propriétaire |

Les configurations partageables sont versionnées ; secrets, leases et tentatives restent hors Git.
Le runtime conserve occurrence logique, instant prévu UTC, fuseau et version de règle capturée.
`occurrenceKey = ruleId + ownerEpoch + logicalOccurrence` identifie l'effet à reprendre.
Changer une cadence ne renumérote pas rétroactivement les occurrences déjà produites. Pour les cycles, team.cycleRuleId référence cette règle canonique ; l’interface `team cycles configure` est une façade de configuration, pas un second magasin. Le reçu de transfert conserve les occurrences déjà consommées de l’ancien ownerEpoch et initialise une borne de reprise : incrémenter l’epoch ne permet pas de recréer une occurrence passée.
Le reçu relie occurrence, opération UUID, IDs créés, révisions, événements et résultat fournisseur.
Les tâches utilisent `due → claimed → prepared → applied → delivered|uncertain|failed`.
`skipped` exige un motif durable : rattrapage désactivé, hors période ou condition non satisfaite.
L'arrêt d'un runner ne transforme pas une occurrence due en occurrence réussie.

## Cadence, fuseaux et cooldown

La cadence hebdomadaire exige jour et heure ; la cadence mensuelle exige une politique de jour absent.
Le fuseau est une identité IANA, jamais seulement un décalage numérique.
Pour une heure locale inexistante au printemps, `dstGap` vaut explicitement `skip|next-valid`.
Pour une heure locale répétée à l'automne, `dstFold` vaut `first|second`, une seule occurrence.
La configuration refuse une cadence sans politiques DST définies ; la CLI montre leurs valeurs.
Une occurrence conserve sa date logique lors d'une reprise plusieurs jours après l'échéance.
`catchUp=latest` exécute la dernière occurrence due et journalise les précédentes comme ignorées.
`catchUp=all` traite dans l'ordre avec limite ; le reste demeure due pour un prochain appel.
`catchUp=none` ignore celles manquées durant l'arrêt, avec fenêtre de tolérance configurée.
Une limite atteinte retourne `remainingDue`, sans prétendre que le runner est à jour.

Le cooldown d'un cycle suit S06 et ne devient pas une issue récurrente artificielle.
Le report traite seulement les issues éligibles du cycle clôturé selon la configuration acceptée.
Un rappel d'update vérifie la dernière publication acceptée, pas une update encore en branche.
Une récurrence crée de nouveaux UUID depuis un template figé dans le reçu.
Une occurrence déjà créée demeure liée à sa règle même après modification de son titre.
L'archivage recalcule éligibilité et révision juste avant application.
Le seuil d'âge, les catégories éligibles et les exclusions sont stockés et affichés.
Les paramètres revendiquant une conformité Linear restent désactivés sans preuve S19.
Une commande manuelle d'archive n'est pas présentée comme l'équivalent de cet automatisme.
La restauration d'un objet archivé suit S02 et suspend sa rééligibilité selon la règle explicite.

## Propriété d'exécution et concurrence

Pour une même règle logique, un seul des systèmes Frame et Linear produit les occurrences.
Une règle Linear active rend Frame importateur des résultats, sans ordonnanceur miroir.
Le transfert passe par `pausing → reconciled → transferred → active`.
L'ancien exécuteur doit être arrêté ou sa révocation confirmée avant activation du nouveau.
L'impossibilité de confirmer cet arrêt produit `OWNER_TRANSFER_UNVERIFIED`.
Les occurrences en vol sont réconciliées avant d'incrémenter `ownerEpoch`.
Une lease périmée ne suffit pas à annuler un effet déjà envoyé ; son reçu est inspecté.
Deux runners du même clone partagent coordinateur et clés d'idempotence S11.
Deux clones exigent un service partagé ou une autorité d'exécution unique explicite S20.
Un verrou fichier ne fournit aucune exclusion globale entre machines.
Les effets externes partent uniquement d'événements accepted de l'autorité désignée.
Une règle en work peut être simulée, jamais exécutée contre un fournisseur.

## Admission, triage et collecte

Une demande devient une issue d'équipe ; aucun projet de rangement n'est obligatoire.
Le triage exige une catégorie triage configurée dans l'équipe, sinon retourne un refus.
`accept` choisit état cible hors triage et éventuel responsable dans une transaction.
`snooze` conserve `snoozedUntil` UTC, fuseau de saisie, acteur et motif facultatif.
Le réveil retire le snooze à l'échéance sans accepter automatiquement l'issue.
`duplicate` désigne l'issue canonique et utilise les invariants de relations S02.
Le routage choisit équipe, état et labels compatibles ; ambiguïté implique attente explicite.

Un intake conserve `(provider, tenantId, channelId, sourceMessageId)` comme clé de déduplication.
Il conserve également URL source, auteur rapporté, révision source, dates et provenance.
Un message édité met à jour la demande existante selon la base ; le titre n'est jamais une clé.
Deux messages au même titre restent deux demandes distinctes.
Une suppression source ne supprime pas l'issue ; elle enregistre un événement source.
Si Linear Asks possède la collecte, Frame importe son issue au lieu de créer un deuxième intake.
Les contenus reçus sont des données non fiables ; aucun prompt ou lien ne déclenche une commande.
Une réponse externe est une action distincte, configurée et autorisée, jamais déduite d'un import.
L'identité de l'auteur rapporté ne confère pas les droits du principal qui reçoit le webhook.

## Événements Git et PR

L'identité PR est `(provider, repositoryId, pullRequestId)` ; son numéro seul est insuffisant.
Un événement garde ID fournisseur, date observée, version distante, origine et causalité.
Sa réception déclenche la vérification de l'état courant du fournisseur, pas une transition aveugle.
Les règles filtrent branche cible, type d'événement et relation aux issues.
Plusieurs PR exigent une politique `any|all|required-set` explicitement configurée.
Une fermeture sans merge n'est pas équivalente à une fusion.
Un changement de branche cible réévalue l'éligibilité avant toute transition.
`merged → Done` n'est permis que si la règle d'équipe choisit explicitement cette correspondance.
L'intégration du code déclenche une demande S15 avec preuve ; elle n'accepte pas toutes les données Frame.
Si Linear possède la règle Git, Frame importe les liens/statuts produits et ne les rejoue pas.
Un événement hors ordre ou répété ne réapplique pas une transition ni une notification.

## Interface et résultats

Les lectures proposent `--scope accepted|work|global` ; global n'est jamais une cible d'écriture.
Les mutations manuelles utilisent opération UUID et révisions attendues, comme S11.
Les variables ci-dessous portent des IDs et révisions réellement retournés par la CLI.

```sh
frame issue recurring create --team ENG --template weekly-review --schedule weekly --weekday monday --time 09:00 --timezone Europe/Paris --dst-gap next-valid --dst-fold first --catch-up latest --operation-id "$OP" --expected-revision "$TEAM_REV"
frame automation enable "$RULE" --expected-revision "$RULE_REV" --operation-id "$ENABLE_OP"
frame automation disable "$RULE" --expected-revision "$RULE_REV2" --operation-id "$DISABLE_OP"
frame automation run --due --dry-run --json
frame automation run --due --operation-id "$RUN" --expected-revision "$AUTHORITY_REV" --json
frame automation worker start --foreground
frame automation status --scope accepted --json
frame automation explain --event "$EVENT" --scope accepted
frame triage accept ENG-104 --status Todo --assignee USER-ELY --operation-id "$OP2" --expected-revision "$REV"
frame triage snooze ENG-104 --until 2026-10-07T09:00:00+02:00 --operation-id "$OP3" --expected-revision "$REV2"
frame triage duplicate ENG-104 --of ENG-101 --operation-id "$OP4" --expected-revision "$REV3"
frame intake list --source slack --scope accepted --json
```

`enable` exige règle accepted, révision actuelle, owner valide et capacités vérifiées ; une proposition work ne peut pas activer un effet. `disable` empêche les nouvelles prises d’occurrences, sans prétendre annuler un effet en vol : celles-ci restent réconciliées. L’état activé et sa révision sont retournés. Un runner ponctuel se lance avec run ; un processus persistant configuré peut appeler ce même module, sans être requis pour lire/écrire les données.

Le worker persistant exécute le même module que run ; `frame automation worker stop` arrête les nouvelles prises puis conserve/reconcilie les opérations en vol. Sans worker ni appel ponctuel, aucun traitement en arrière-plan n’est promis.

Le dry-run retourne règle/version, propriétaire, occurrences, entrées et effets prévus sans livraison.
`run` retourne `runId`, `authorityRevision`, `applied`, `skipped`, `uncertain`, `remainingDue`.
Chaque entrée retourne `occurrenceKey`, `operationId`, `entityIds`, tentative et prochaine action.
`explain` expose filtres évalués, preuve distante, mapping de statut et raison d'application/refus.
`status` indique dernier passage, prochain passage, owner, epoch et absence éventuelle de runner.

Les sorties JSON utilisent l'enveloppe S00 ; les champs décrits appartiennent à `data`.
Une mutation confirmée porte `outcome: committed|already-applied` ; les états de livraison restent séparés.
Après décision durable S11, une erreur locale devient `WRITE_INDETERMINATE` et exige le roll-forward.

## Erreurs, reprise et responsabilités

`STALE_RULE`, `REVISION_CONFLICT` et `OWNER_CHANGED` invalident la préparation avant application.
`REMOTE_RESULT_UNCERTAIN` exige réconciliation par clé fournisseur avant renvoi.
`CAPABILITY_UNAVAILABLE` laisse la règle désactivée avec capacité manquante, sans comportement approché.
Le backoff est borné, persistant et visible ; épuisement mène à `needs-attention`.
Aucun réseau ni attente humaine ne se déroule sous verrou de données.
Core possède validation et décisions ; S11 possède les mutations ; S06 possède les cycles.
Le scheduler calcule les occurrences ; le runner orchestre leases, reçus et reprise.
Les adaptateurs possèdent transport, vérification des événements et idempotence fournisseur.
S17 possède les notifications ; S19/S20 résolvent autorité et synchronisation.

## Critères d'acceptation

- **S18-A01** : heure inexistante et heure répétée suivent les deux politiques DST sans doublon.
- **S18-A02** : arrêt de trois semaines produit les occurrences attendues pour chaque catchUp.
- **S18-A03** : deux runners d'une même autorité créent une seule issue par occurrence.
- **S18-A04** : transfert non confirmé de Linear vers Frame refuse l'activation Frame.
- **S18-A05** : cooldown et report de cycle respectent la période S06 et les révisions courantes.
- **S18-A06** : objet devenu inéligible après préparation n'est pas archivé.
- **S18-A07** : snooze réveille sans accepter ; doublon conserve son lien canonique.
- **S18-A08** : message édité conserve l'issue ; titre identique sans même ID crée une autre issue.
- **S18-A09** : import Asks ou document contenant des règles n'active aucune automatisation.
- **S18-A10** : PR fermée sans merge et PR retargetée n'appliquent pas une règle merged inadéquate.
- **S18-A11** : répétition/hors ordre et propagation via Linear ne doublent aucun effet.
- **S18-A12** : crash après réponse fournisseur perdue produit uncertain puis réconciliation.
- **S18-A13** : simulation work ne livre rien et deux clones sans autorité n'affichent aucune exclusion globale.

## Sources

- [Services actifs, sections 5–10](../../../research/03-services-actifs.md).
- [Modèle local, sections 4 et 7](../../../research/01-modele-local.md).
- [Design global, sections 11–12](../../../research/06-design-global-branches-frame.md).
- Références à vérifier dans S19 : [Cycles](https://linear.app/docs/use-cycles), [Triage](https://linear.app/docs/triage), [Asks](https://linear.app/docs/linear-asks), [GitHub](https://linear.app/docs/github), [Archivage](https://linear.app/docs/delete-archive-issues).
