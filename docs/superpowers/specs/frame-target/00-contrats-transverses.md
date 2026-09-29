# S00 — Contrats transverses

Statut : cible proposée, non implémentée · Dépendances : aucune · [Index](README.md).

## Objectif

Fixer le vocabulaire et les contrats communs pour que les specs métier, Git, CLI, SDK et connecteurs décrivent un seul produit. Le stockage reste lisible en Markdown ; les usages retenus conservent la sémantique Linear. Les mécanismes de branches, checkpoints et claims sont des extensions Frame explicitement nommées.

## Glossaire normatif

| Terme | Sens |
|---|---|
| Workspace métier / realm | Ensemble cohérent d’équipes, d’objets et de paramètres ; `workspaceId` stable |
| Équipe | Propriétaire du workflow et des paramètres d’une issue |
| Projet | Livrable pouvant associer plusieurs équipes ; pas une branche de code |
| Milestone | Jalon appartenant à un seul projet |
| Initiative | Regroupement stratégique ; ses relations parent/enfant forment un graphe validé |
| Document | Contenu de travail ; une spec est un document avec template, pas un type métier supplémentaire |
| Travail / work | Proposition isolée, identifiée par `workId`, associée à un contexte de code |
| Exécution | Tentative d’un acteur pour réaliser du travail ; plusieurs tentatives possibles |
| Claim | Réservation technique temporaire ; n’interdit pas les corrections humaines |
| Mutation | Changement métier validé et durable, identifié par `operationId` |
| Snapshot | État figé et identifié, indépendant d’un message ou nom de branche |
| Checkpoint | Enregistrement Git d’un état ou d’une association avec un commit de code |
| Intégration | Acceptation d’une proposition dans une cible Frame, avec reçu |
| Synchronisation | Échange avec un autre clone ou fournisseur ; distinct d’une acceptation locale |

`workspaceId`, `workId`, `entityId`, `operationId`, `snapshotId`, `checkpointId`, `integrationId` sont des UUID opaques. Les préfixes pédagogiques des exemples (`WORK-…`, `ENG-101`) ne définissent pas leur stockage. L’alias lisible d’un objet ne sert jamais de clé de référence durable.

## Enveloppes CLI/SDK

Les modules core reçoivent des objets typés ; la CLI transforme options et fichiers en commandes, sans duplications des règles métier. Le serveur et les connecteurs utilisent le même module de mutation.

```ts
type ReadScope = 'accepted' | 'work' | 'global';
type Versioned<T> = {
  value: T;
  revision: string;
  provenance: { workspaceId: string; workId: string | null; scope: ReadScope };
};
type MutationRequest = {
  operationId: string;
  workspaceId: string;
  workId: string | null;
  expected: Array<{ entityId: string; revision: string | null }>;
  command: { type: string; input: unknown };
};
```

`command` est une union fermée validée par schéma ; `unknown` ci-dessus désigne la frontière de décodage, pas une autorisation d’appeler une méthode arbitraire. `null` comme révision attendue exprime une création attendue, pas une absence de contrôle.

L’édition/remplacement d’un objet existant exige une révision attendue. Une commande immédiate de CLI peut la lire dans sa transaction courte ; une décision issue d’une lecture antérieure renvoie cette révision, sans retry aveugle sur la dernière version. Les références et invariants interobjets sont relus sous coordination.

`--json` renvoie une seule enveloppe versionnée sur stdout : `{schemaVersion, ok, data, context, warnings}` en succès, `{schemaVersion, ok:false, error:{code,message,details,retryable}, context}` en échec. Les logs vont sur stderr. `context` contient scope, identités et versions utiles ; un endpoint distant ne divulgue pas les chemins locaux. Les gros corps s’obtiennent par détail/pagination, pas dans chaque liste.

En mutation réussie, `data` contient `operationId`, `outcome: committed|already-applied`, objets changés et nouvelles révisions. Un `pending` de job n’est pas un `committed` métier. Un échec indéterminé inclut l’ID permettant une inspection.

Codes CLI : 0 succès ; 1 défaillance technique ; 2 entrée invalide ; 3 conflit/précondition ; 4 refus métier ou permission ; 5 opération en attente/résultat indéterminé. Le code JSON reste l’autorité détaillée. Cette convention remplace seulement les nouvelles commandes/modes cibles ; la migration des erreurs existantes est explicite dans S21.

## Scopes et autorité

`--scope work` lit l’espace courant ; `accepted` lit l’autorité locale acceptée et signale ses mutations non checkpointées ; `global` projette plusieurs propositions avec leur provenance. `global` n’accepte aucune mutation. En dehors d’une association résolue, une écriture échoue au lieu de choisir un dossier voisin.

Le scope par défaut est fixé par usage, et non par une option de transport : listes/détails/recherche/vues/brief utilisent `work` ; rapports de progression, insights, prévisions, historique officiel et `next` utilisent `accepted`. `view global` impose `global`. Une option explicite prime toujours et figure dans le résultat. La résolution du checkout fournit le work courant, mais ne change pas le scope par défaut d’un rapport.

Les effets externes, notifications métier globales, règles automatiques et exports Linear partent d’accepted par défaut. Une notification de conflit ou d’exécution locale peut concerner un work sans publier sa proposition comme décision acceptée.

Une identité locale déclarée n’est pas une permission distante. Le service partagé authentifie et autorise réellement son appelant. Credentials, préférences personnelles et marqueurs de lecture ne sont pas déposés dans les Markdown partagés.

## Format et validation communs

Chaque objet a `id`, `kind`, `title` lorsque pertinent, dates de provenance, propriétés spécifiques et corps Markdown facultatif. Les propriétés inconnues sont conservées dans une extension opaque lorsqu’elles peuvent l’être sans risque ; sinon une écriture du type concerné est refusée. Ne jamais les supprimer en sérialisant un sous-ensemble connu.

Les dates civiles, périodes approximatives et instants UTC sont des types distincts. Une date cible « novembre » n’est pas le premier novembre inventé. Le fuseau et la politique d’estimation sont enregistrés avec toute mesure qui en dépend. Les sorties triées utilisent un tie-breaker stable par ID et des curseurs liés au scope/révision.

Les textes de titre sont non vides après trim. Les limites existantes du Board (titre 500 caractères, corps 1 Mio UTF-8, payload HTTP 2 Mio) restent des limites du transport Board ; la CLI doit annoncer ses propres limites et refuser avant mutation, pas tronquer. Les schemas métier partagés évitent des contenus acceptés par une interface et corrompus par l’autre.

## Erreurs communes

| Code | Sens et conduite |
|---|---|
| INVALID_INPUT | Structure/option inconnue ou incohérente ; pas de mutation |
| NOT_FOUND | Objet absent dans le scope choisi ; aucune recherche implicite sur d’autres branches |
| REVISION_CONFLICT | Version divergente ; présenter les versions et relire avant nouvelle décision |
| DOMAIN_REJECTED | Invariant métier violé ; corriger l’intention |
| REALM_BUSY / LOCK_COMPROMISED | Coordination non acquise/perdue ; pas de publication nouvelle |
| FORMAT_UNSUPPORTED / CAPABILITY_UNAVAILABLE | Format/capacité non pris en charge ; détail de la limite |
| WRITE_INDETERMINATE / RECOVERY_CONFLICT | Reprise/inspection nécessaire ; ne pas refaire sous un autre ID |
| ASSOCIATION_UNVERIFIED / PLAN_STALE | Preuve ou base insuffisante pour l’automatisme |
| PERMISSION_DENIED | Autorité refusée, jamais convertie en absence d’objet |

Les codes spécialisés définis par une spec sont autorisés, avec un `error.category` stable (`input`, `conflict`, `domain`, `permission`, `capability`, `pending`, `internal`) déterminant le code de sortie S00. Les messages ne servent pas de clés aux clients. Chaque adapter transporte le code spécialisé sans perdre sa catégorie ; les codes inconnus restent affichables et ne deviennent pas un succès. Une mesure indisponible à l’intérieur d’un rapport valide n’est pas une erreur de commande : elle porte `value: null` et son motif selon S08.

Les lectures de lifecycle utilisent `--archived exclude|include|only`, exclude par défaut. Les commandes ciblant une entité emploient un nom singulier, notamment `frame conflict`; les noms collectifs `insights`, `inbox`, et les options ne sont pas renommés artificiellement.

## Fidélité Linear

Chaque capacité exposée précise `supported`, `read-only`, `unverified`, `unavailable` et la raison. Une mesure non vérifiée n’affiche pas un faux pourcentage. Les fonctions différées de l’index restent différées. Les descriptions d’API non vérifiées ne deviennent pas des mutations distantes promises.

## Articulation avec les specs existantes

| Sujet ancien | Contrat de cette cible |
|---|---|
| Board : transaction optionnelle du repository | S11 obligatoire pour annoncer des mutations coordonnées ; adapter sans garantie visible comme tel |
| Board : staging best effort après chaque mutation | S14 possède les checkpoints ; plus de staging métier implicite dans l’index de code |
| Board : déduplication mémoire limitée | S11 durable par opération ; le cache HTTP peut rester une optimisation |
| Board : état privé par hash de chemin | S13 identité et common dir ; S21 migre l’état existant sans perdre un journal |
| Board : DTO `Spec`, enums de statuts | S01/S05 modèle cible ; endpoints anciens à migrer explicitement |
| Board : sécurité HTTP, sessions et présentation | Conservées hors périmètre, adaptées aux nouveaux objets/scopes |

Aucune ancienne spec n’est silencieusement considérée déjà exécutée. La compatibilité SDK et les alias CLI de transition relèvent de S21.

## Critères d’acceptation

- S00-A1 : une même commande CLI et SDK produit les mêmes mutations/erreurs.
- S00-A2 : une mutation global est rejetée avant tout effet.
- S00-A3 : deux objets homonymes restent distingués par identité et scope.
- S00-A4 : une capacité non validée apparaît indisponible avec motif, sans résultat fabriqué.
- S00-A5 : un JSON de résultat contient version, contexte et révisions ; aucun secret.
- S00-A6 : un retry reprend le même ID ; un changement de payload avec cet ID est refusé.
- S00-A7 : l’adapter Board conserve sa sécurité en exposant les nouveaux contrats et leurs conflits.

## Sources

[Modèle](../../../research/01-modele-local.md), [design global](../../../research/06-design-global-branches-frame.md), [Board data](../2026-09-29-frame-board-data-design.md), [Board server](../2026-09-29-frame-board-server-design.md). Les liens Linear normatifs sont détaillés dans les specs métier.
