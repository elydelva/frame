# S20 — Synchronisation Git et service partagé

Statut : contrat cible proposé ; protocole distant à implémenter et vérifier.
Dépendances de socle : S00, S11, S13–S15. S16/S18/S19 sont des consommateurs de projection, exécution et connecteurs ; le transport Git reste indépendant.

## Objectif et frontières

Frame DOIT distinguer données acceptées localement, propositions publiées et acceptation distante.
La synchronisation transporte les historiques et leurs références nécessaires, sans intégrer aveuglément.
Le service partagé est un mode facultatif d'autorité authentifiée et d'exécution continue.
Le mode CLI hors ligne demeure utilisable sans service, sans prétendre fournir des claims globaux.
La présence de fichiers Git n'authentifie ni leur auteur déclaré ni ses permissions d'API.
Une publication code et Frame sur plusieurs services n'est pas une transaction distribuée.

## Autorité et données

| Donnée | Contrat |
|---|---|
| `workspaceId` | UUID commun aux clones du même realm |
| `remoteId` | Identité configurée du dépôt distant, URL normalisée sans credentials |
| `authorityMode` | `local|shared-service|designated-writer` |
| `acceptedRef` | Référence distante canonique de `frame/main` et propriétaire explicite |
| `workId` | UUID stable d'époque ; indépendant du nom humain de branche code |
| `publisherId` | Identité authentifiée du producteur si service ; provenance déclarative sinon |
| `publicationId` | UUID du job ; requête normalisée et operationId associés |
| `expectedRefs` | Référence → ancien OID observé, absence attendue explicite |
| `requiredRefs` | Références work, main, code sélectionné et rétention nécessaires |
| `receipt` | Résultats par ref, preuve distante, instant d'observation et limites |

Le mapping portable entre work, code, checkpoints et intégrations vit dans `_frame/`.
Le registre de chemins/checkouts, les bases de réconciliation et tentatives sont runtime privés.
Les checkpoints métier portables S14 ne sont pas les curseurs privés de transport.
Les credentials Git/API, abonnements et marqueurs personnels restent hors Git.
Le service conserve une base durable protégée pour sa queue, ses clés et son audit d'accès.
Les OID sont opaques et leur longueur ne suppose pas uniquement SHA-1.
Un OID mentionné dans un JSON ne remplace pas une référence qui retient réellement son objet.

## Ensemble transporté et rétention

Le plan calcule la fermeture des références nécessaires à chaque checkpoint et reçu annoncé.
Elle comprend les têtes work publiées et les sources terminales exigées par les reçus d'intégration.
Un checkpoint `history-only` exige la ref retenue qui rend `snapshotCommitOid` récupérable.
Les snapshots scellés S14 sont immuables ; sync ne les reconstruit pas à partir du checkout courant.
La source d'une époque squashée reste immuable et retenue ; poursuivre crée une nouvelle époque.
Les références de rétention sont publiées dans un namespace configuré accepté par le serveur.
L'absence de support de ce namespace bloque la promesse de sauvegarde complète.
Une capacité distante inconnue est `unverified` et interdit l'opération qui en dépend.

Une politique de rétention expose durée minimale, destinataires de sauvegarde et preuves requises.
Le nettoyage refuse de retirer la dernière ref d'un snapshot/reçu encore nécessaire.
La suppression d'une branche humaine ne retire pas automatiquement les refs de rétention Frame.
Le fetch ne prune pas les objets nécessaires simplement parce qu'une ref distante a disparu.
Avant purge autorisée, le plan liste reçus affectés et confirme les copies requises.
Un clone neuf DOIT pouvoir récupérer les sources annoncées via les refspecs documentés.
Le reflog local n'est jamais présenté comme sauvegarde intermachine.

## Fetch, plan et publication

Le fetch récupère dans les refs de suivi, sans modifier silencieusement un checkout de données sale.
Après fetch, Frame compare heads, bases connues, reçus et epochs avant de préparer un plan.
Les références récupérées sont validées : format, workspace, liens et objets requis.
Une référence d'un autre workspace est isolée et refusée, sans import dans le graphe courant.
Une avance distante de main conduit à une intégration sémantique S15, pas à un merge Markdown brut.
Les changements directs du main local divergent sont traités comme proposition à réconcilier.
Un plan conserve source, cible, base et révisions ; tout changement de tête invalide sa décision.

Le job prépare sans verrou réseau, puis prend la coordination locale pour vérifier et publier localement.
Les mutations métier suivent exclusivement la décision durable de roll-forward S11.
La publication locale des refs utilise des préconditions sur les anciens OID.
Cela ne rend pas atomiques fichiers, refs Git, journal et serveur ; la reprise inspecte chaque résultat.
La file par branche S14 ordonne checkpoints et intégrations avant leurs jobs de transport.
Le transport ne publie pas un checkpoint avant les refs dont sa validité dépend.
Une publication tardive d'un snapshot utilise le parcours `history-only` S14.
Elle ajoute la provenance à l'autorité désignée sans rouvrir une source terminale.

Un push refusé pour avance distante déclenche fetch et nouveau plan sémantique.
Le nombre de reprises automatiques est borné et visible ; épuisement donne `needs-resolution`.
Aucun force-push de confort ne réécrit `frame/main` ni une source terminale.
Un force-push externe détecté suspend l'automatisme et conserve anciennes refs et diagnostic.
Une erreur d'authentification n'est ni une suppression de ref ni une instruction de changer de remote.
Une réponse réseau perdue produit `uncertain` jusqu'à lecture vérifiée des refs distantes.
Un retry inspecte les OID et reçus existants avant toute nouvelle publication.

## Atomicité distante explicite

La publication couplée déclare toutes ses refs, éventuellement code et Frame du même remote.
Le mode `atomic` est disponible seulement après vérification du support et des permissions.
Si le serveur refuse cette capacité, `CAPABILITY_UNAVAILABLE` termine sans fallback silencieux.
Deux remotes distincts ne peuvent pas être présentés comme un push atomique unique.
Le mode `ordered` doit être choisi explicitement et annonce qu'une publication partielle est possible.
Il publie d'abord les dépendances de rétention, puis les références qui les annoncent.
Le reçu ordered détaille chaque ref confirmée et celles restant à publier.
Une capacité atomic vérifiée ne contourne ni les protections de branche ni les droits de publication.
Une PR fusionnée hors Frame peut donner `code-integrated / frame-pending` ; cet état est normal et réparable.
Une politique CI peut exiger les checkpoints sources ; elle ne rend pas les deux intégrations atomiques.

## Plusieurs clones et service partagé

Un verrou sous le common dir Git sérialise uniquement les processus de ce clone.
Sans service, deux clones publient des workId distincts ou organisent un transfert explicite d'un workId.
Le transfert fige la tête, réconcilie les jobs en vol et attribue une nouvelle époque de propriété.
Un clone ancien ne peut annoncer un succès global de claim ou de numéro d'issue hors ligne.
Le mode désigné réserve les écritures du main distant à une autorité connue.
Les autres clones publient des propositions et reçoivent des demandes d'intégration identifiées.
Un refus de protection de branche conduit au parcours de demande autorisé, jamais à un contournement.

Le service authentifie le principal et évalue les permissions sur workspace, action et cible.
Les permissions minimales distinguent lecture, proposition, intégration, exécution et administration.
`authorId`, signature rapportée et propriété inscrite dans Markdown ne remplacent pas cette vérification.
La queue d'intégration conserve demande, source figée, cible attendue, preuve et décision.
Elle suit `requested → prepared → conflicts|ready → applied → synced` selon S15.
Une tentative concurrente réévalue la cible avant décision et ne réutilise pas un plan périmé.
Une lease distribuée porte un jeton de fencing ; l'ancien worker ne peut valider après réattribution.
Les demandes rejouées retrouvent leur reçu par operationId et empreinte de requête.
Les claims globaux ne sont annoncés que si leur autorité et leur mécanisme d'exclusion sont actifs.
Une panne de service laisse les propositions locales disponibles, mais pas une fausse acceptation distante.

Le service ne distribue jamais un historique complet à un lecteur exclu d'une partie de cet historique.
Pour des objets privés, isoler le stockage ou limiter le périmètre ; une ACL d'interface ne suffit pas.
La révocation d'accès ne détruit pas une copie Git déjà téléchargée.
La queue et l'audit ne contiennent pas de secrets ou de corps dont le lecteur n'a pas l'accès.

## Exploitation du service facultatif

`frame sync git service configure --file service.json` valide un profil sans démarrer le service ; `start --foreground`, `stop` et `status` pilotent son cycle de vie. Le profil fixe workspace, stockage/runtime, remote, acceptedRef, mode d’autorité, adresse d’écoute, authentification, rôles et limites de file. Par défaut, écouter seulement en local ; une exposition distante exige un transport authentifié et chiffré configuré, sans fallback anonyme.

Le démarrage récupère les jobs/journaux avant d’accepter des mutations. L’arrêt refuse les nouvelles prises, termine ou journalise les phases en cours, puis ferme les ressources ; un arrêt forcé reste récupérable. Une panne ne supprime pas la file. Deux instances sur la même autorité exigent un mécanisme de coordination/fencing validé ; sinon la seconde refuse de devenir writer.

Les appels du service réutilisent les requêtes/réponses SDK S00 avec principal authentifié injecté par le transport. Les sorties de status donnent rôle effectif, fraîcheur, jobs pending/uncertain et disponibilité des dépendances, sans credentials. Les clients locaux peuvent continuer des propositions offline lorsque le service est arrêté, mais ne simulent pas une acceptation distante.

## Vue globale et hors ligne

`--scope accepted|work|global` conserve le sens de S16 ; global est non modifiable.
Les propositions locales peuvent inclure du travail non commité identifié comme tel.
Pour un autre clone, seuls les checkpoints publiés puis récupérés sont connus.
La projection indique remote, OID, `fetchedAt`, dernier checkpoint et fraîcheur par source.
L'absence d'un nouveau commit ne signifie pas qu'un agent distant est inactif.
Un fetch échoué conserve la dernière vue connue marquée périmée et son erreur.
Les compteurs distinguent accepted local, accepted distant observé et propositions non acceptées.

## CLI et enveloppes

```sh
frame sync git fetch --remote origin --json
frame sync git plan --remote origin --work "$WORK" --publication-mode atomic --json
frame sync git apply --plan "$PLAN" --operation-id "$OP" --expected-revision "$REV" --json
frame sync git status --remote origin --json
frame sync git retention list --remote origin --json
frame sync git service status --json
```

Les variables contiennent des UUID et révisions retournés ; le plan sélectionne les refs explicitement.
Toutes les réponses utilisent l'enveloppe S00 ; champs métier et statut du job sont dans `data`.
`plan` expose expectedRefs, requiredRefs, capacités, autorité, changements et conflits.
`apply` expose publicationId, résultat par ref, `transportState` et prochaine action.
Une mutation locale confirmée porte `outcome: committed|already-applied`, distinct du transport.
Un résultat externe indéterminé retourne le code CLI 5 et l'identité permettant l'inspection.
`status` distingue `local-only`, `pending`, `synced`, `rejected`, `uncertain` sans masquer les refs partielles.

## Erreurs et responsabilités

`PLAN_STALE`, `PERMISSION_DENIED`, `CAPABILITY_UNAVAILABLE` suivent les erreurs communes S00.
`REMOTE_ADVANCED`, `REMOTE_REWRITTEN`, `RETENTION_INCOMPLETE` précisent l'action de réparation.
`WRITE_INDETERMINATE` local suit S11 ; une incertitude réseau reste un état de transport distinct.
WorkspaceRegistry S13 résout les montages ; S14 possède snapshots/checkpoints et leur ordre.
S15 possède intégrations/conflits ; GitTransport possède fetch/push et diagnostics des refs.
SyncWorker possède reprise et reçus de transport ; aucun merge métier propre au transport.
Le service possède authentification, autorisation, queue et exclusion distante réelle.
SDK/CLI utilisent les mêmes cas d'usage, sans writer ni file parallèle contournant S11.

## Critères d'acceptation

- **S20-A01** : clone neuf récupère work, main et snapshots history-only par leurs refs retenues.
- **S20-A02** : serveur sans atomic refuse ce mode sans effectuer un push ordered implicite.
- **S20-A03** : ordered interrompu expose les refs publiées et reprend seulement les manquantes.
- **S20-A04** : main distant avancé entraîne fusion S15 sans force-push ni perte de décision.
- **S20-A05** : deux clones intégrateurs produisent une seule acceptation pour une même opération.
- **S20-A06** : perte de réponse push est réconciliée par lecture des refs, sans fausse réussite.
- **S20-A07** : checkpoint tardif conserve les propriétés courantes et la source squashée immuable.
- **S20-A08** : purge refuse la dernière ref requise malgré l'existence de son SHA dans un JSON.
- **S20-A09** : identité administrative forgée dans Markdown n'autorise pas l'appel de service.
- **S20-A10** : droits retirés produisent un refus, sans fallback vers une ref non protégée.
- **S20-A11** : mode hors ligne affiche la fraîcheur distante et ne prétend pas connaître les éditions distantes.
- **S20-A12** : PR déjà fusionnée et Frame en attente restent réparables sans seconde fusion du code.

## Sources

- [Services actifs, sections 9–10](../../../research/03-services-actifs.md).
- [Design global, sections 6–8 et 11–13](../../../research/06-design-global-branches-frame.md).
- [Audit Git, sections 2, 6 et 7](../../../research/07-git-hooks-et-cas-limites.md).
- Primitives documentées : [git-push](https://git-scm.com/docs/git-push), [git-update-ref](https://git-scm.com/docs/git-update-ref), [git-fetch](https://git-scm.com/docs/git-fetch).
