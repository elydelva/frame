# S17 — Collaboration et notifications

Statut : contrat cible proposé ; aucune capacité distante n'est réputée livrée.
Dépendances de socle : S00, S02–S05, S11. S15 et S19 raccordent intégration/synchronisation ; commentaires et inbox locaux restent utilisables sans fournisseur.

## Objet et limites

Frame DOIT porter les échanges avec leur objet métier et fournir une inbox personnelle.
Un commentaire, une trace d'exécution et une publication de santé sont trois objets distincts.
Le périmètre comprend fils, réponses, résolution, mentions explicites, abonnements et updates.
Les annotations inline avancées, la coédition, les réactions et le stockage binaire sont différés.
Une pièce jointe importée DOIT conserver une référence accessible ou un diagnostic de perte.
Aucun abonnement local ne constitue une autorisation d'envoyer un message externe.
La synchronisation d'une inbox Linear exige une capacité S19 vérifiée séparément.

## Données et autorité

| Objet | Champs obligatoires et contraintes |
|---|---|
| Commentaire | UUID, `targetType`, `targetId`, `threadId`, `parentId`, corps Markdown, révision |
| Provenance | `authorId`, auteur rapporté distant facultatif, source, `createdAt`, `editedAt` |
| Fil | UUID racine, cible unique, `state: open|resolved`, révision, résolution éventuelle |
| Résolution | acteur, date, opération, motif facultatif ; distincte d'une suppression |
| Mention | UUID membre résolu, ancre dans le corps, identité d'événement causal |
| Update | UUID, cible projet ou initiative, corps, auteur, `health`, date de publication |
| Abonnement | principal, workspace, cible, `enabled`, catégories suivies, révision privée |
| Notification | UUID, destinataire, événement causal, cible, motif, `readAt`, `dismissedAt` |

Les objets partagés vivent dans `comments/` et `updates/`, sous forme Markdown canonique.
Le premier commentaire porte l'identité du fil et son état ; les réponses référencent ce fil.
Une réponse DOIT viser une racine existante du même workspace et de la même cible.
`parentId` permet la provenance d'une réponse, sans arborescence de cibles différente.
La suppression d'un commentaire crée une tombstone ; elle ne détruit pas ses réponses.
Une édition conserve l'auteur initial et ajoute l'identité de l'éditeur à l'événement.
Un auteur distant rapporté ne devient jamais le principal authentifié de la session.
Le service partagé vérifie les permissions ; le mode local ne prétend pas imposer des ACL.

Les abonnements, états lu/masqué et préférences restent dans le stockage utilisateur hors Git.
Le stockage est partitionné par `workspaceId`, principal et fournisseur d'inbox.
Une inbox locale et une inbox distante portent des namespaces explicitement différents.
L'absence de droits sur une cible interdit de restituer son titre ou son extrait au destinataire.
Une copie Git déjà distribuée ne peut pas être rendue secrète par un filtre d'inbox.

## Fils et mentions

`open → resolved → open` sont les transitions autorisées d'un fil vivant.
Résoudre n'empêche pas sa lecture ; répondre ne le rouvre pas implicitement.
`comment reopen` exige la révision attendue de la racine.
Ajouter une réponse et mettre à jour les métadonnées du fil est une transaction S11.
Une cible supprimée reste consultable avec tombstone selon les droits, sans nouvelle réponse.
Une cible archivée accepte la lecture ; une nouvelle écriture exige sa restauration explicite.

Une mention est saisie par ID ou par alias résolu sans ambiguïté avant validation.
Le texte brut `@sam` non résolu demeure du texte et produit un avertissement explicite.
Le rendu affiche le nom courant, mais la référence stockée conserve l'UUID.
Une édition qui conserve la même mention ne redélivre pas la notification d'origine.
Retirer puis réintroduire une mention crée un nouvel événement identifié, pas un retry.
Une mention de l'auteur lui-même n'émet pas une notification par défaut.
Les imports utilisent le mapping source pour reconnaître les mentions déjà livrées.

## Santé publiée

`health` vaut `on-track`, `at-risk` ou `off-track` ; aucune valeur absente ne devient verte.
La santé est déclarée par l'auteur, indépendante du statut et de la progression calculée.
Une update proposée sur work reste une proposition tant que S15 ne l'a pas acceptée.
`publishedAt` est la date métier de publication attestée, locale ou distante ; `acceptedAt` et `recordedAt` décrivent respectivement l’acceptation et la réception locales. Une date métier inconnue reste null et ne remplace pas une date attestée par l’heure d’import.
Modifier une update publiée ajoute une révision visible ; cela ne réécrit pas sa provenance.
La santé courante provient de la dernière publication métier acceptée non retirée, selon l’ordre source/causal attesté et publishedAt. Un import ancien ne dépasse pas une publication plus récente du seul fait de son acceptedAt. Une chronologie indécidable est signalée ; les rappels S18 utilisent ce même ordre métier.
Un retrait conserve l'historique et recalcule la santé à partir des publications restantes.
À date identique, l'ordre causal accepté tranche ; un ordre inconnu est signalé, pas deviné.
Une initiative ne reçoit pas automatiquement la santé de son projet le moins sain.
S08 expose une vue consolidée en conservant chaque cible et chaque auteur.

## Modèles de corps

Les modèles `comment-body` et `update-body` sont des variantes de Template S05 ne matérialisant que du Markdown. `comment add` et `update add` acceptent `--template` ; le body explicite remplace le modèle selon le même ordre de priorité que S05. Auteur, cible, dates, publication et santé ne sont jamais copiés implicitement : health reste une entrée explicite pour une update. La provenance du template/révision est enregistrée ; modifier le modèle ne réécrit pas les publications existantes.

## Contrat CLI et SDK

Les alias suivants sont résolus en UUID avant appel au coordinateur commun.
Les lectures acceptent `--scope accepted|work|global` ; global est strictement non modifiable.
Les mutations partagées visent le work courant, sauf résolution explicite de l'autorité accepted.
Toute mutation porte `operationId` UUID et les révisions attendues des objets lus.
Les exemples utilisent des variables contenant les UUID et révisions retournés par la CLI.

```sh
frame comment add --issue ENG-101 --body-file question.md --operation-id "$OP" --expected-revision "$REV" --json
frame comment reply "$COMMENT" --body-file reponse.md --operation-id "$OP2" --expected-revision "$THREAD_REV"
frame comment resolve "$COMMENT" --operation-id "$OP3" --expected-revision "$THREAD_REV2"
frame comment reopen "$COMMENT" --operation-id "$OP4" --expected-revision "$THREAD_REV3"
frame comment list --issue ENG-101 --scope global --json
frame issue subscribe ENG-101 --operation-id "$OP5" --expected-revision "$SUB_REV"
frame update add --project PROJ-0001 --health at-risk --body-file point.md --operation-id "$OP6" --expected-revision "$PROJECT_REV"
frame update list --initiative INIT-0001 --include-descendants --scope accepted
frame inbox list --source local --unread --json
frame inbox read "$NOTICE" --operation-id "$OP7" --expected-revision "$NOTICE_REV"
```

Un résultat d'ajout contient `operationId`, `commentId`, `threadId`, `revision`, `scope`.
Il contient aussi `notificationState: deferred-until-accepted|queued|none` et ses raisons.
Une inbox retourne `items`, `cursor`, `source`, `principalId`, `asOf` et fraîcheur.
Chaque item expose cible autorisée, motif, événement causal et état de lecture personnel.
Marquer lu retourne la nouvelle révision privée et ne modifie aucun fichier partagé.
Réutiliser un operationId avec une autre charge retourne `OPERATION_ID_REUSED`.
La réponse JSON ne contient ni token, ni chemin privé, ni extrait interdit.

## Livraison et reprise

Seuls les événements métier acceptés alimentent la file de notifications partagées.
Un changement de branche, fetch, relecture de fichier ou reconstruction d'index n'en crée pas.
La clé de livraison est `(workspaceId, recipientId, causalEventId, channel)`.
Si plusieurs motifs visent le même événement et destinataire, un item liste tous les motifs.
Le pipeline persiste `pending → delivering → delivered|uncertain|failed` hors Git.
L'acquittement perdu produit `uncertain` et exige une réconciliation avant nouvel envoi.
Aucune garantie universelle d'exactement une livraison n'est annoncée pour un fournisseur.
Une inbox locale matérialise l'événement et sa clé atomiquement dans son stockage privé.
Le redémarrage retrouve la clé existante et ne réinitialise pas `readAt`.
L'acceptation d'un fil complet distribue les événements inédits selon leurs causalités.
Un import historique est silencieux par défaut et présente le nombre d'événements ignorés.
Un mode de notification à l'import doit être activé explicitement et dédupliqué.

Les sorties JSON utilisent l'enveloppe S00 ; les champs décrits appartiennent à `data`.
Une mutation confirmée porte `outcome: committed|already-applied` ; les états de livraison restent séparés.
Après décision durable S11, une erreur locale devient `WRITE_INDETERMINATE` et exige le roll-forward.

## Erreurs et concurrence

| Code | Comportement et reprise |
|---|---|
| `TARGET_NOT_FOUND` | Aucun commentaire écrit ; choisir une cible existante |
| `TARGET_INACCESSIBLE` | Aucun extrait divulgué ; rétablir l'accès sans supprimer les données |
| `MENTION_AMBIGUOUS` | Présenter les identités permises ; exiger un ID explicite |
| `REVISION_CONFLICT` | Conserver le corps soumis ; relire ou résoudre via S15 |
| `THREAD_TARGET_MISMATCH` | Refuser réponse et notification dans la même opération |
| `INBOX_CAPABILITY_UNAVAILABLE` | Conserver l'inbox locale ; ne pas simuler une lecture distante |
| `DELIVERY_UNCERTAIN` | Inspecter le reçu fournisseur avant retry |

Deux réponses indépendantes sont ajoutables par UUID ; la racine reste validée par révision.
Résolution et réouverture concurrentes produisent un conflit, jamais un dernier écrivain gagnant.
Les corps modifiés des deux côtés sont soumis au dossier de conflit commun S15.
Une livraison en attente est réévaluée si les droits sont révoqués avant sa matérialisation.

## Responsabilités

- Core : invariants des cibles, fils, mentions et publications de santé.
- Coordinateur S11 : transactions, versions attendues, opérations et événements acceptés.
- Fs : codecs Markdown et tombstones ; aucun état personnel dans les objets partagés.
- Stockage personnel : abonnements, inbox, clés de livraison, reprise par principal.
- Worker : consommation causale et notifications ; aucun polling de fichiers comme intention.
- Adaptateurs S19 : mapping distant et capacités ; aucune écriture Markdown directe.
- SDK/CLI : mêmes mutations, rendu des motifs et distinction locale/distante.

## Critères d'acceptation

- **S17-A01** : deux réponses importées retrouvent la même racine et leurs auteurs source.
- **S17-A02** : résoudre puis rouvrir conserve le fil, les réponses et les événements.
- **S17-A03** : éditer sans changer une mention ne génère aucun nouvel item.
- **S17-A04** : mention locale réimportée via Linear conserve une seule livraison causale.
- **S17-A05** : lu pour A reste non lu pour B et aucun état personnel n'apparaît dans Git.
- **S17-A06** : une update work at-risk laisse la santé accepted inchangée avant intégration.
- **S17-A07** : conflit de résolution conserve les deux intentions et aucune écriture partielle.
- **S17-A08** : crash après matérialisation avant acquittement ne recrée pas l'item local.
- **S17-A09** : permission retirée masque titre et corps sans interpréter la cible comme supprimée.
- **S17-A10** : suppression de la racine conserve ses réponses et interdit une nouvelle réponse.
- **S17-A11** : capability distante absente produit un refus inspectable, sans faux marquage lu.
- **S17-A12** : checkout et réimport historique n'émettent aucune rafale de notifications.

## Sources et limites de conformité

- [Recherche services, sections 2–4 et 9–10](../../../research/03-services-actifs.md).
- [Modèle local, sections 6–8](../../../research/01-modele-local.md).
- [Branches et effets acceptés](../../../research/06-design-global-branches-frame.md), sections 8 et 12.
- Références fonctionnelles documentées par la recherche : [Comments](https://linear.app/docs/comment-on-issues), [Notifications](https://linear.app/docs/notifications), [Updates](https://linear.app/docs/initiative-and-project-updates).
- La correspondance exacte des mutations, résolutions et états d'inbox dépend de la matrice S19.
