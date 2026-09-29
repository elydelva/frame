# S13 — Branches Frame et espaces de travail

Statut : cible proposée · Dépendance : [S11](11-stockage-transactions.md) · [Index](README.md).

## Objectif

Associer chaque contexte de travail de code à une branche de données isolée, lisible dans `.frame/`, sans confondre les deux historiques. La branche `frame/main` est racine de l’état accepté ; les travaux en descendent avec une identité stable.

Le mode non Git reste un realm local coordonné mais ne simule pas de branches. Le GitAdapter et le résolveur CLI/SDK décident explicitement quel mode est actif.

## Objets et références

- Workspace : workspaceId, codeRepositoryIdentity, acceptedRef, formatVersion.
- Work : workId, workspaceId, parentWorkId nullable, targetWorkId nullable, baseFrameOid, codeRefAtCreation, état, génération.
- Checkout : checkoutId, workId, codeRoot, dataRoot, rôle, identité du common directory.
- Époque : durée de vie d’un work ; `creating`, `active`, `finalizing`, `integrated`, `abandoned`, `needs-repair`.

Un nom de branche n’identifie pas un travail ; son renommage ne change pas workId. Une réutilisation du nom après clôture crée un autre workId. UUID indépendants pour les travaux créés dans deux clones, même si leurs branches de code portent le même nom.

`frame/main` commence par une racine Git indépendante de l’histoire du code. `frame/work/<workId>` part d’un commit Frame existant. Un travail empilé déclare son parent et sa cible ; un simple nom `feature/subfeature` n’établit pas la parenté.

## Disposition

```text
codeRoot/
  .git/ ou .git                  # géré par Git
  .gitignore                    # /.frame/ ignoré par le code
  .frame/                       # worktree données, pas copie de branche de code
    .git                        # liaison du worktree données
    workspace.md
    issues/
    projects/
    _frame/manifest.json
    _frame/works/<workId>.json
```

Le registre `<git-common-dir>/frame/registry.json` contient version, workspaceId et les liaisons checkout/code/data/work/ref. Il est publié atomiquement sous coordination. Les journaux, locks, snapshots et drafts sont à côté, avec leurs règles de rétention propres ; ils ne sont pas tous reconstruisibles.

Les chemins sont résolus par les commandes Git et realpath, pas par concaténation de `.git`. Les identités sont validées après déplacement ; un dossier homonyme n’est pas automatiquement adopté.

## Commandes et résolution

```sh
frame workspace init --mode paired-branches
frame workspace status --json
frame work status --json
frame work attach --work WORK-uuid
frame work refresh --work WORK-uuid
frame work abandon WORK-uuid
frame workspace repair --plan PLAN-id
```

La création via `frame issue worktree ENG-101` réutilise ce module et retourne codeRoot, dataRoot, workId, checkoutId et claimId si la réservation a réussi. Elle ne crée plus un deuxième realm métier branch-local non enregistré.

Lecture par défaut : espace associé au checkout courant. Première écriture Frame sur une branche sans association : création paresseuse coordonnée. Une association contradictoire, un dossier `.frame` inconnu ou un format ancien exige une migration, pas un fallback silencieux. L’override `FRAME_ROOT` existant est adapté par S21 ; il ne doit jamais réassocier implicitement une branche.

## Création et reprise

1. Vérifier dépôt, source Frame et absence de conflit de montage.
2. Réserver workId/ref/chemin sous verrou de registre et journaliser `creating`.
3. Créer référence et worktree avec base explicite, écrire le descripteur portable.
4. Vérifier Git HEAD, workspaceId, dataRoot et absence d’emboîtement erroné `.frame/.frame`.
5. Publier la liaison `active`, puis autoriser les mutations.

Un crash garde assez d’information pour adopter uniquement les artefacts identifiés par l’opération. Un chemin non vide non reconnu reste intact. Un échec de création de code après création de données, ou l’inverse, devient une réparation inspectable ; aucun nettoyage récursif aveugle.

## Changement de branche et montage unique

`post-checkout` demande une réconciliation ; chaque commande refait la vérification car le hook peut manquer. Le changement de code est déjà réalisé lorsque le hook intervient : l’erreur ne prétend pas l’avoir annulé.

Avant de monter l’autre branche Frame, préserver le montage précédent et ses drafts/mutations. Si leur état interdit un démontage propre, suspendre les nouvelles mutations avec `WORKSPACE_MISMATCH`. Une branche Frame n’a qu’un checkout écrivain propriétaire par clone ; ne pas forcer un second checkout avec les protections Git désactivées.

Si aucun checkout code n’héberge `frame/main`, un checkout technique dédié existe. Un autre appel résout cette autorité plutôt que créer une deuxième copie écrivain. Les chemins de montage peuvent être externes lorsque les outils du projet suppriment récursivement le parent.

## Lifecycle et maintenance

Suppression du worktree code : vérifier références/checkpoints, préserver drafts, démonter/archiver les données enfants, puis retirer le parent avec Git. Abandonner un travail ne signifie pas supprimer ses preuves. Déplacer un parent nécessite réparation des deux liaisons puis validation des identités.

`git worktree lock` protège la conservation administrative ; il n’est jamais présenté comme un verrou de contenu. Les commandes Git externes qui modifient une référence Frame sont détectées ; S11/S14 récupèrent ou exposent une réparation, sans reset automatique.

Detached HEAD : lecture possible, mutation refusée avant association explicite à un work retenu par référence. Un clone shallow sans base doit récupérer les objets nécessaires ou échouer, jamais inventer une base vide.

## Module

WorkspaceResolver expose `resolve`, `ensureWork`, `inspect`, `planRepair`, `applyRepair`. GitAdapter fournit les primitives Git ; MutationCoordinator et CheckpointCoordinator restent responsables de la persistance et des snapshots. Aucun hook ne duplique la logique de résolution.

## Critères d’acceptation

- S13-A1 : main et deux branches de code obtiennent trois espaces Frame distincts et le bon workspaceId.
- S13-A2 : deux créations concurrentes ne produisent pas une double liaison.
- S13-A3 : rename de branche conserve workId ; réutilisation après clôture en crée un nouveau.
- S13-A4 : dossier `.frame` non vide inconnu reste intact.
- S13-A5 : crash à chaque étape est repris sans adopter l’espace d’une autre opération.
- S13-A6 : hook checkout absent n’autorise pas une mutation dans le mauvais espace.
- S13-A7 : déplacement/suppression du parent préserve les données enfants et les drafts.
- S13-A8 : aucune opération de code ne stage les fichiers du worktree données.
- S13-A9 : perte du registre reconstruit les liaisons commitées, signale le runtime non reconstruisible.
- S13-A10 : un second clone ne reçoit pas une fausse garantie de réservation globale.

## Sources

[Design global](../../../research/06-design-global-branches-frame.md), [audit Git](../../../research/07-git-hooks-et-cas-limites.md), [git-worktree](https://git-scm.com/docs/git-worktree), [git-rev-parse](https://git-scm.com/docs/git-rev-parse).
