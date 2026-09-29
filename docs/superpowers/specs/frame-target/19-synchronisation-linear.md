# S19 — Synchronisation Linear

Statut : contrat cible proposé ; aucun aller-retour API n'est prouvé par cette spécification.
Dépendances de socle : S00–S06, S11, S15, S17. S18/S20 raccordent propriétaires de règles et service partagé ; une synchronisation ponctuelle locale ne les exige pas.

## Objectif et périmètre

Frame DOIT échanger les objets communs sans confondre copie, autorité et capacité API.
Le connecteur expose import, plan de push et mode bidirectionnel par périmètre validé.
Toutes ses mutations locales passent par le coordinateur S11 et le moteur de conflits S15.
Les branches de travail ne publient pas directement leurs propositions vers Linear.
Les claims, traces, règles d'agent, extensions de Spec et métadonnées privées restent locaux.
Les références inconnues sont conservées ou explicitement exclues dans le plan avant application.
Un import de Linear seul n'est jamais présenté comme une sauvegarde complète de Frame.

## Capabilities comme condition d'ouverture

Chaque connexion DOIT exposer une matrice par type, opération et champ.
La capacité publique vaut `supported|read-only|unverified|unavailable` conformément à S00.
Sa preuve porte `verification: verified|unknown|expired` et un motif précis de restriction.
Seule une preuve `verified`, dans le périmètre et les droits courants, autorise son opération.
`read-only` autorise les seules lectures vérifiées ; forbidden ou unimplemented expliquent unavailable.
La simple existence d'un type GraphQL ne prouve ni sa mutation, ni sa visibilité, ni son aller-retour.
Chaque preuve enregistre schéma/version ou empreinte, date, scénario, principal et scopes utilisés.
Les permissions effectives sont revérifiées avant application, même si le schéma n'a pas changé.
Une modification incompatible du schéma invalide les capacités affectées et les plans préparés.
Une expiration de preuve bloque les écritures concernées jusqu'à nouvelle vérification.
La conformité s'effectue sur des ressources autorisées ; le connecteur ne crée pas de fixtures externes implicitement.

| Type | Lecture à vérifier | Mutations à vérifier séparément | Points de conformité |
|---|---|---|---|
| Workspace/users/teams | Pagination et visibilité | Champs réellement modifiables | Identités et équipes privées |
| States/labels/estimates | Scope et catégories | Création, édition, retrait | Groupes exclusifs, defaults |
| Initiatives | Parents et relations | CRUD et parentage | Multiparents, restrictions de plan |
| Projects/milestones | Dates et ressources | CRUD, rattachement | Date imprécise, appartenance unique |
| Issues/relations | Archives et dépendances | CRUD, transfert, doublon | Statuts d'équipe, relation résolue |
| Cycles | Périodes et historique | Affectation, réglages supportés | Propriétaire de cadence S18 |
| Documents | Corps riche et rattachement | Création, édition, suppression | Pièces jointes, auteur, extensions |
| Comments/threads | Réponses et auteurs | Ajout, édition, résolution | Racine, mentions, suppressions |
| Updates | Santé et publications | Création, édition, retrait | Date/auteur source non falsifiés |
| Inbox/subscriptions | Principal et catégories | Lecture/abonnement supportés | État personnel hors Git |
| Lifecycle | Tombstones/archives | Suppression/restauration | Absence versus accès interdit |

Pour chaque ligne : vérifier pagination complète, erreurs, rate limits et événements disponibles.
Une capacité webhook est distincte d'une capacité lecture ; le polling peut rester nécessaire.
Une capacité création n'autorise pas par déduction édition, suppression ou restauration.
Le bidirectionnel est fermé si une opération nécessaire au périmètre n'a pas de preuve.
Un périmètre réduit peut être validé, avec exclusion lisible des autres types/champs.

## Connexion, mapping et bases

| Donnée | Emplacement et invariant |
|---|---|
| Connexion | UUID, nom local, workspace Frame, workspace Linear, mode et sélection |
| Credentials | Secret store utilisateur/service hors Git, jamais logs ni reçus |
| Mapping portable | `(provider, remoteWorkspaceId, type, remoteId) ↔ frameId` |
| Politique d'autorité | Par type/champ : `linear|frame|both|local-only`, versionnée sans secret |
| Base de sync | Valeurs normalisées comparées, empreinte source, révisions des deux côtés |
| Checkpoint | Curseur, bornes de lecture, page acquittée, runId ; runtime privé durable |
| Plan | UUID, autorité, bases, révisions, capacités, actions, exclusions et pertes |
| Reçu | operationId UUID, effets appliqués, résultat distant, conflits et prochaine action |

Un alias d'équipe, titre, URL d'affichage ou chemin de fichier n'est jamais une clé de mapping.
Un transfert d'équipe garde le frameId et remoteId, même si l'identifiant humain change.
Deux correspondances pour le même objet distant produisent `MAPPING_COLLISION`.
Les bases et checkpoints ne contiennent pas de token ; leurs contenus restent protégés localement.
Un nouveau clone sans base ne déduit aucune suppression ni priorité d'horodatage.
Il effectue une lecture initiale et une comparaison inspectable avant tout push bidirectionnel.
L'autorité des numéros définitifs d'issues est Linear lorsque cette attribution lui est déléguée.
Les aliases provisoires sont redirigés après confirmation distante, sans changer les références UUID.

## Préparation et application

L'import lit d'abord identités/configurations, puis objets, puis relations à résoudre.
Les références non encore reçues restent dans un staging privé ; aucun graphe incomplet n'est publié.
Le plan fige le périmètre, les trois versions et les exclusions proposées.
Une modification d'un seul côté se propage si la politique de ce champ le permet.
Des modifications disjointes peuvent fusionner après validation de l'objet et de ses relations.
Deux modifications incompatibles d'un même champ créent un conflit S15.
Ni le timestamp le plus récent ni l'ordre d'arrivée réseau ne désignent le gagnant.
Un champ absent d'une réponse partielle vaut `not-fetched`, distinct de `null` et de suppression.
L'export ne réinitialise jamais un champ non fetché ou non représenté localement.

`pull` importe vers l'autorité accepted explicitement résolue, jamais vers global.
`push` exporte uniquement les changements accepted autorisés par la politique.
`bidirectional` applique les mêmes règles champ par champ, sans priorité implicite au local.
Un changement Linear accepté devient une nouvelle cible pour les branches de travail ouvertes.
Une branche déjà squashée reste immuable ; une reprise locale ouvre une nouvelle époque S15.
Les snapshots S14 restent scellés : un import ne corrige jamais rétroactivement leur contenu.

L'application locale est transactionnelle par unité de dépendances validée selon S11.
Les mutations distantes ne constituent pas une transaction globale entre plusieurs objets.
Le reçu distingue `applied-local`, `applied-remote`, `conflicted`, `uncertain`, `pending` par action.
La base avance uniquement pour les champs dont les effets des deux côtés sont confirmés.
Une erreur au milieu conserve les actions confirmées et reprend les autres avec les mêmes IDs.
Un effet externe ne part qu'après persistance de son intention et vérification de ses préconditions.
Une API sans révision conditionnelle vérifiable ne reçoit pas de promesse de comparaison atomique.
La capacité doit annoncer cette limite et bloquer les écritures concurrentes non protégeables du périmètre bidirectionnel.

## Contenu riche et extensions

La conversion expose une matrice pour titres, listes, tableaux, code, mentions, liens et attachements.
Chaque nœud non représentable est conservé dans une représentation source protégée ou signalé avant apply.
Un plan avec perte exige `--accept-loss-report <digest>` correspondant au rapport exact.
Ce choix autorise uniquement les pertes listées ; une nouvelle perte invalide l'application.
Une URL de pièce jointe expirée produit `ATTACHMENT_UNAVAILABLE`, jamais une suppression du lien source.
Un corps Markdown simple réussi ne valide pas l'ensemble de l'éditeur riche.
L'auteur et les dates distantes sont conservés comme provenance, sans prétendre les réécrire.
Les extensions Frame `status`, `supersedes`, `rules` restent sous namespace local explicite.
Une représentation lisible de ces extensions dans le corps exige une politique d'export choisie.
Ce texte n'est jamais reparsé comme instruction exécutable à l'import.

## Visibilité, suppression et événements

Une équipe privée n'est importable que dans un stockage dont la diffusion convient à ses lecteurs.
Le plan affiche audience distante et audience du dépôt ; incompatibilité bloque la copie.
Git distribué ne reproduit pas des ACL par objet et ne permet pas de révoquer les clones déjà diffusés.
Le retrait d'une permission produit `inaccessible`, sans tombstone locale automatique.
Une absence de page, un 404 ambigu ou un échec temporaire n'est pas une preuve de suppression.
Seul un événement ou contrôle de lifecycle vérifié autorise une tombstone synchronisée.
Un conflit suppression/édition conserve les versions et exige une décision S15.

Un webhook est authentifié selon le contrat fournisseur ; l'auteur du payload n'est pas le principal.
Le journal persiste ID événement, connexion, origine et causalité avant acquittement.
Un replay retrouve son reçu ; les événements hors ordre déclenchent une lecture de l'état courant.
Les événements propres à Frame réimportés retrouvent leur mapping et ne créent pas de boucle.
Le polling réconcilie les trous avec bornes de lecture et pagination, sans perte entre deux pages.
Le curseur n'avance qu'après staging durable de la page ; le rejeu de page est idempotent.
Les limites API produisent une prochaine tentative persistée et visible, sans boucle serrée.

## CLI et résultats

```sh
frame sync linear connect --name company --json
frame sync linear capabilities --connection company --json
frame sync linear plan --connection company --direction pull --json
frame sync linear plan --connection company --direction push --type document --id DOC-0001 --json
frame sync linear apply --plan "$PLAN" --operation-id "$OP" --expected-revision "$REV" --json
frame sync linear status --connection company --json
frame sync linear conflict list --connection company
frame sync linear conflict resolve "$CONFLICT" --take linear --operation-id "$OP2" --expected-revision "$CONFLICT_REV"
```

Les variables sont des UUID et révisions retournés par les commandes précédentes.
Les lectures métier acceptent `--scope accepted|work|global` ; les plans sortants exigent accepted.
`plan` retourne `planId`, bases, capacité/empreinte, actions, conflits, exclusions et lossReport.
`apply` retourne le reçu détaillé et `syncState: completed|partial|conflicted|uncertain`, jamais un succès global trompeur.
Toutes les sorties utilisent l'enveloppe S00 ; ces champs figurent sous `data`.
Les mutations locales confirmées portent `outcome: committed|already-applied`, distinct de syncState.
Après décision durable S11, une erreur locale devient `WRITE_INDETERMINATE` et reprend en roll-forward.
`status` montre dernière lecture, dernière écriture confirmée, autorité, retard et prochaine action.
Une résolution `--take linear` prépare une décision S15 conditionnelle, sans écriture aveugle.

## Erreurs et responsabilités

`PLAN_STALE`, `SCHEMA_CHANGED`, `CAPABILITY_UNAVAILABLE` et `PERMISSION_CHANGED` arrêtent l'action concernée.
`REMOTE_RESULT_UNCERTAIN` exige recherche de l'effet avant retry ; aucune exactement-une-fois universelle.
`BASE_MISSING` interdit le push destructif et demande une nouvelle comparaison initiale.
Core possède normalisation/invariants ; S15 possède les conflits ; S11 possède publication locale.
L'adaptateur Linear possède schéma, auth, transport, conversion et capacités vérifiées.
Le SyncWorker possède planning, checkpoints, intent log, backoff et réconciliation.
SDK et CLI exposent le même plan/reçu ; aucun connecteur ne réécrit directement les Markdown.

## Critères d'acceptation

- **S19-A01** : import puis réimport conserve IDs, relations et cardinalité sans doublon.
- **S19-A02** : opération API non vérifiée reste indisponible même si la lecture du type fonctionne.
- **S19-A03** : modification incompatible du schéma invalide le plan avant tout effet.
- **S19-A04** : éditions concurrentes produisent un conflit avec base et deux versions.
- **S19-A05** : transfert d'équipe conserve mapping stable et actualise l'alias humain.
- **S19-A06** : réponse partielle ne vide aucun champ distant lors du push suivant.
- **S19-A07** : perte de permission et page absente ne produisent aucune suppression.
- **S19-A08** : équipe privée vers dépôt trop ouvert bloque l'import avant copie des corps.
- **S19-A09** : tableaux, mentions, attachements et nœuds inconnus ont chacun un résultat de conformité.
- **S19-A10** : interruption entre pages puis webhook répété ne duplique ni objet ni notification.
- **S19-A11** : réponse de création perdue produit uncertain et une réconciliation sans création aveugle.
- **S19-A12** : clone sans base refuse un push destructif ; import ne réactive aucune règle locale.

## Sources

- [Services actifs, sections 2–4 et 9–11](../../../research/03-services-actifs.md).
- [Modèle commun et migration](../../../research/01-modele-local.md), sections 6, 9 et 10.
- [Autorité accepted et synchronisation](../../../research/06-design-global-branches-frame.md), section 12.
- Références de conformité : [API GraphQL](https://linear.app/developers/graphql), [Documents](https://linear.app/docs/documents).
