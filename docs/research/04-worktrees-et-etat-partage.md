# Worktrees et agents : un état opérationnel partagé, du code isolé

**Évolution de la décision :** le [design global 06](06-design-global-branches-frame.md) retient désormais des branches Frame par travail et une vue globale des propositions. La recommandation de stock unique ci-dessous est conservée comme analyse de l’alternative antérieure, pas comme cible actuelle.

29 septembre 2026 — recherche sur le checkout `451914f`, documentation officielle Git et vérification locale ciblée. Les commandes et formats de la cible sont des propositions. Ce document complète [le modèle Linear local](01-modele-local.md) et [les services actifs](03-services-actifs.md), sans implémentation.

## Conclusion

**Oui aux worktrees pour isoler le code ; un seul stockage Markdown canonique pour suivre le travail de tous les agents.** Un agent lit les mêmes issues, projets, jalons et documents que l'utilisateur, depuis son propre checkout de code. Ses changements opérationnels deviennent visibles dès leur acceptation, sans attendre un commit, une PR ou un merge du code.

Je recommande, pour le mode multiagent, un **worktree de données dédié, sur une branche dédiée du même dépôt Git**, contenant les `.md` canoniques. Un coordinateur de mutations commun protège toutes les écritures ; les brouillons restent hors du stockage canonique, l'index de lecture reste reconstructible. Le détail des conflits d'édition appartient au [document sur la concurrence](05-concurrence-et-edition-markdown.md). Le coordinateur peut commencer comme une bibliothèque commune avec un verrou court du realm et une vérification des révisions ; un daemon permanent est facultatif. Il ne garde aucun verrou pendant que l'humain rédige son brouillon.

C'est une évolution réelle du design : les fichiers restent dans le dépôt Git, mais leur historique suit la vie du travail, indépendamment des branches de code. Si « dans le repository » signifie obligatoirement « dans chaque branche de code et dans chaque PR », cette recommandation ne satisfait pas cette interprétation : il faut alors accepter des snapshots de données et leur désynchronisation. On ne peut pas avoir simultanément une seule copie vivante et des copies de branche toutes autonomes faisant autorité.

## 1. Ce qui existe réellement dans Frame

| Point | Constat dans le code courant | Conséquence |
|---|---|---|
| Root de données | La CLI prend `FRAME_ROOT`, sinon le répertoire courant | Aucun routage canonique persistant commun aux worktrees |
| Création du worktree | `runIssueWorktree` crée la branche, puis `createContainerAt(targetPath)` et démarre l'issue dans ce nouveau root | L'état `in-progress` appartient à la copie de la branche |
| Instructions à l'agent | La commande imprime `export FRAME_ROOT=<worktree>` | La suite du travail continue sur cette copie |
| Claims | `WorktreeClaimStore` écrit sous le Git common dir, `frame/claims`, avec un `claimId` | Réservation visible aux worktrees du même clone |
| Concurrence des claims | Verrou par issue et publication du fichier complet par lien ; release peut vérifier le `claimId` attendu | Protection spécialisée, qui ne verrouille pas les mutations métier |
| Données métier | `FsRealmRepository` lit/écrit les `.md` sous `realmRoot/.frame` | Aucun partage automatique entre racines |
| Git staging | `GitAdapter` utilise le realm root ; le repository stage les chemins en best effort | Pointer tous les agents vers le checkout principal leur fait partager son index |
| Fin du claim | `issue release` enlève la réservation et laisse le worktree en place | Libération, fin d'exécution et statut d'issue sont déjà des notions distinctes |

Sources locales : [cli.ts](../../apps/cli/src/cli.ts), [container.ts](../../apps/cli/src/container.ts), [issue/worktree.ts](../../apps/cli/src/commands/issue/worktree.ts), [claim-store.ts](../../apps/cli/src/worktrees/claim-store.ts), [realm.repository.ts](../../packages/fs/src/realm.repository.ts), [git.adapter.ts](../../packages/git/src/git.adapter.ts), [issue/release.ts](../../apps/cli/src/commands/issue/release.ts). Le test [worktree.test.ts](../../apps/cli/src/commands/issue/worktree.test.ts) attend explicitement un appelant inchangé et une issue démarrée dans le worktree.

**Donc, en l'état, le tracking partagé est partiel : on peut savoir qu'une issue est réservée, sans lire depuis le checkout principal son état métier actualisé.** Le claim ne réconcilie pas les versions Markdown et ne protège pas contre une édition humaine concurrente.

## 2. Ce que les worktrees Git garantissent, et ce qu'ils ne donnent pas

Git fournit plusieurs répertoires de travail pour un même dépôt, avec notamment des `HEAD` et index distincts. Certaines données administratives et références sont communes. Le Git common dir est donc un bon point de découverte local, pas un mécanisme de synchronisation des fichiers de travail. `git worktree lock` protège la conservation du worktree ; ce n'est pas un verrou d'écriture sur les issues. Sources : [git-worktree](https://git-scm.com/docs/git-worktree), [gitrepository-layout](https://git-scm.com/docs/gitrepository-layout).

Une fusion Git intègre des historiques de branches ; elle ne diffuse pas continuellement leurs éditions non commitées. Elle ne connaît pas la signification métier « cet agent a terminé son implémentation mais sa PR n'est pas intégrée ». Source : [git-merge](https://git-scm.com/docs/git-merge). La seconde partie est notre conclusion de conception : cette sémantique doit appartenir à Frame.

### Vérification locale exécutée

Expérience dans un dépôt temporaire jetable, avec Git `2.54.0 (Apple Git-156)` : initialiser un Markdown `status: todo`, créer un worktree, modifier ce fichier dans le worktree, comparer les racines et chemins administratifs.

```text
worker_local_change_visible_in_main: False
git_common_dir_shared: True
git_indexes_distinct: True
reading_explicit_shared_root: status: blocked
```

La dernière ligne vient d'une modification dans la racine commune choisie, relue directement par chemin absolu. Cette expérience confirme le comportement de base de Git et du système de fichiers. **Elle ne valide pas un coordinateur Frame ni une synchronisation distante**, qui n'existent pas dans cette proposition. Le dépôt temporaire a été supprimé ; aucune branche du dépôt Frame n'a été créée.

## 3. Les cinq options, réellement challengées

| Organisation | Tracking avant merge | Atout | Coût ou risque | Avis |
|---|---|---|---|---|
| `.frame` indépendant par branche ; merge à la fin | Non, sauf lecteur agrégeant toutes les branches | Données liées à la version du code ; simplicité Git | Statuts divergents, créations concurrentes, suivis invisibles, fusion sémantique tardive | À réserver aux snapshots et expériences isolées |
| Répliques locales avec synchronisation continue | Oui, avec délai et conflits | Autonomie hors ligne, plusieurs machines possibles | Versions, journal d'opérations, tombstones, déduplication, conflits, reprise : un protocole distribué complet | Trop de complexité pour des agents sur une machine |
| Tous les agents pointent vers `.frame` du checkout principal | Oui | Déploiement conceptuellement simple ; fichiers visibles au même endroit | Index partagé avec l'humain, changements de branche, merges/reset susceptibles de modifier les données | Mode de transition si règles d'exploitation strictes |
| Un worktree de données dédié dans le même dépôt | Oui, immédiatement après mutation acceptée | `.md` lisibles, historique Git, index isolé du code | Branche de données à gérer ; clonage/rattachement et sauvegarde explicites | **Cible recommandée pour plusieurs agents locaux** |
| Dépôt Git de données séparé | Oui | Cycle de vie indépendant ; plusieurs dépôts de code pour un workspace | Second dépôt, droits et sauvegardes ; ne répond pas au souhait du même dépôt | Évolution pour organisation multi-repo, pas défaut initial |

Ces avis sont des recommandations Frame, pas des recommandations officielles Git.

### Pourquoi ne pas ajouter simplement une synchronisation entre worktrees ?

Sur une machine, les agents peuvent déjà accéder à la même racine. Répliquer ajoute des conflits que l'isolation du code n'exige pas. Par exemple : l'humain annule l'issue ; une copie hors ligne termine ensuite l'implémentation et pousse son ancien document `done`. Aucun ordre de timestamps ne permet de décider correctement si la clôture était autorisée. Il faut reprendre les changements sur une base commune et valider les transitions, comme dans le protocole d'édition concurrente.

Une copie de brief, en revanche, est utile : l'agent démarre avec un contexte borné et identifié par des révisions. Ce brief est un snapshot d'entrée, pas une seconde autorité sur l'issue. Au moment d'agir, l'agent relit l'état canonique ou fournit sa révision attendue.

### Pourquoi le checkout principal partagé ne suffit pas toujours ?

Git stage le contenu pour préparer le prochain commit ; `git add` ne réalise pas une transaction métier. Source : [git-add](https://git-scm.com/docs/git-add). Dans Frame aujourd'hui, une mutation peut donc ajouter un fichier au staging de l'humain. Plusieurs agents utilisant ce même root alimenteraient le même index, même si leur code est isolé ailleurs.

En mode de transition, supprimer le staging implicite des mutations, prévoir un checkpoint explicite et interdire les opérations Git de remplacement du root canonique pendant une écriture. Mais les conventions ne neutralisent pas un `git reset` ou une édition manuelle qui contourne le coordinateur. Un checkout de données réservé réduit fortement cette interférence.

## 4. Organisation recommandée et sens de « même dépôt »

Exemple conceptuel : le code est sur `main` et ses branches de travail ; les données sont sur `frame-data`, branche réservée du même dépôt. Le nom est une proposition, pas un nom imposé par Git. Une histoire initiale indépendante peut éviter de recopier le code dans cette branche ; l'initialisation et la migration restent à implémenter.

```text
~/dev/frame/                         # checkout de code humain, main
├── .git/
│   └── frame/                      # état technique local non versionné
│       ├── workspace.json          # workspaceId et chemin canonique
│       ├── claims/                 # réservations locales
│       ├── drafts/                 # éditions en cours, pas l'autorité
│       └── runtime/                # coordination, reprise, index reconstructible
├── .frameconfig                    # configuration de liaison portable si nécessaire
└── packages/

~/dev/frame-data/                    # worktree dédié, branche frame-data
├── .frameconfig                    # configuration du workspace métier
└── .frame/                         # source de vérité lisible et versionnée
    ├── workspace.md
    ├── teams/
    ├── initiatives/
    ├── projects/
    │   └── onboarding/
    │       ├── project.md
    │       └── milestones/
    │           ├── alpha.md
    │           └── beta.md
    ├── issues/
    │   └── issue-101.md
    ├── documents/
    ├── updates/
    └── executions/                 # extension locale : historique utile, pas heartbeat

~/dev/frame-agent-101/               # worktree de code agent A
└── packages/
~/dev/frame-agent-102/               # worktree de code agent B
└── packages/
```

Tous appartiennent au même dépôt Git. Le chemin absolu `~/dev/frame-data` est une liaison locale, jamais une valeur supposée portable entre machines. Dans un linked worktree, `.git` peut être un fichier : employer les commandes Git de résolution, pas concaténer naïvement `codeRoot/.git`. Le Git common dir partagé permet de retrouver la liaison locale. Source : [gitrepository-layout](https://git-scm.com/docs/gitrepository-layout).

Deux responsabilités distinctes :

| Notion | Usage |
|---|---|
| `codeRoot` | Code, commandes de build/test, diff, branche, commit et PR de l'agent |
| `realmRoot` | Objets métier canoniques, documents, statuts, calcul du pilotage |
| `workspaceId` | Identité stable du workspace, indépendante des chemins et des branches |
| `executionId` | Identité d'une tentative concrète de travail, liée au code et aux révisions d'entrée |

La branche `frame-data` **n'est pas fusionnée dans les branches de fonctionnalités**. Les sauvegardes/pushs de données sont explicites et indépendants des PR de code. Une vue du repository sur `main` n'affichera donc pas automatiquement le contenu courant de `.frame` : pour l'obtenir, ouvrir le checkout de données, sa branche distante, ou utiliser la CLI. C'est le compromis principal à accepter.

Si l'on veut des copies dans le code pour l'archivage d'une release, produire un export déclaré en lecture seule, lié à un commit de données. Ne jamais réimporter cet export au merge comme remplacement de l'état opérationnel courant.

## 5. Résolution de la racine : ne pas se reposer uniquement sur FRAME_ROOT

Le conteneur actuel possède déjà une séparation partielle : Git pour les données part du realm root ; les worktrees/claims peuvent partir du répertoire d'invocation lorsque `FRAME_ROOT` est défini. Mais `issue worktree` recrée un conteneur au chemin du nouveau worktree et y démarre l'issue. **Changer seulement la variable d'environnement ne corrige donc pas le parcours complet.** Source : [container.ts](../../apps/cli/src/container.ts), [issue/worktree.ts](../../apps/cli/src/commands/issue/worktree.ts).

Proposition : un résolveur partagé CLI/SDK découvre `codeRoot`, le Git common dir et la liaison vers `workspaceId/realmRoot`. Un override explicite reste possible mais est validé ; si sa cible contredit une liaison existante, afficher le conflit et demander un rattachement explicite au lieu de choisir silencieusement. Si le root canonique manque, échouer clairement, sans retomber sur une copie `.frame` de branche.

Chaque commande JSON expose les racines résolues et l'identité du workspace. `issue worktree` garde le même realm root après création ; seuls `codeRoot`, la branche et l'exécution changent. Le SDK, les imports et la synchronisation Linear passent par le même résolveur et le même coordinateur de mutations. Les clés de réservation devront associer `workspaceId` et ID interne d'issue : le claim store actuel est indexé par `ISSUE-0001` dans un clone, ce qui ne suffit pas pour plusieurs realms ou des identifiants Linear importés.

```sh
# Parcours cible ; ces commandes/options ne sont pas disponibles actuellement.
frame workspace attach --data-root ../frame-data
frame workspace show --json
frame issue worktree ENG-101 --actor agent:backend
# Le résultat contient codeRoot, realmRoot, executionId et claimId.

cd ../frame-agent-101
frame issue show ENG-101 --json       # même état canonique que chez l'humain
frame execution update RUN-1 --phase implementation
frame execution submit RUN-1 --commit <sha-verifie>
frame worktree list --json
```

## 6. Claim, exécution et statut d'issue : ne pas les confondre

Le modèle Linear des équipes/issues/projets reste l'autorité métier. Le worktree et l'exécution sont des extensions locales techniques ; ils ne doivent pas inventer des statuts obligatoires qui cassent l'alignement.

| Information | Durée et rôle | Exemple |
|---|---|---|
| Claim | Réservation locale actuelle ; propriété vérifiée par token | Agent A travaille sur ENG-101 |
| Exécution | Tentative durable, résultat, branche, commits, preuves et erreurs | RUN-1 échoue ; RUN-2 propose une PR |
| Statut de l'issue | État métier dans le workflow de son équipe | In Progress, In Review, Done |
| Heartbeat | Présence technique éphémère | Dernier signal du processus agent |

Un claim expiré ou un processus mort ne signifie ni issue abandonnée ni code perdu. Avant réattribution, inspecter le worktree et les artefacts, conserver l'exécution, invalider l'ancien token. Les commandes émises par l'ancien propriétaire après reprise doivent être refusées pour les actions réservées. Un claim n'est pas un verrou global empêchant l'humain de corriger le titre ou de changer le statut.

Plusieurs sub-agents peuvent participer à une même issue : une exécution coordinatrice peut réserver l'issue, et des tentatives enfants porter chacune une branche ou un worktree. Le parent est le seul responsable de soumettre le résultat intégré. Créer des sous-issues uniquement lorsque le découpage représente un vrai travail planifiable ; ne pas transformer chaque processus en ticket Linear.

## 7. Du démarrage au merge : scénario concret

1. L'orchestrateur sélectionne ENG-101 dans l'état canonique et demande sa réservation avec une identité d'opération réutilisable en cas de retry.
2. Il prépare le worktree de code et enregistre une exécution. La création Git et la mutation Markdown ne forment pas une transaction atomique commune : prévoir des étapes de préparation/reprise, avec diagnostic des chemins orphelins.
3. Une mutation validée fait avancer l'issue selon le workflow retenu. L'humain la voit immédiatement depuis le même root.
4. L'agent modifie le code local, publie des points d'avancement dans le store canonique et conserve les résultats de tests avec leur commit de référence.
5. Il soumet une PR ou un candidat d'intégration. L'exécution passe à une phase d'attente ; l'issue peut passer en revue selon la politique de l'équipe. Le travail n'est pas automatiquement terminé parce que le processus s'arrête.
6. Le responsable d'intégration résout les conflits de code et vérifie le résultat final. Un événement de merge vérifié déclenche, si configurée, la transition métier adéquate. Linear propose lui-même des automatisations liées aux événements de PR ; les règles sont configurables, pas une identité universelle entre « merge » et « Done ». Source : [intégration GitHub de Linear](https://linear.app/docs/github-integration).
7. Le claim est libéré, l'exécution conserve ses preuves et le worktree peut être nettoyé lorsqu'il n'est plus utile. La conservation des données métier ne dépend pas de sa présence.

Si l'utilisateur annule l'issue à l'étape 4, la tentative de soumission doit relire son état courant et signaler cette décision ; elle ne restaure pas implicitement `in-progress` depuis un vieux brief. Le code de l'agent peut rester disponible sans changer le statut métier.

## 8. Qui possède Git pour les données ?

Le coordinateur de mutations possède les opérations d'écriture sur le checkout de données. Un mécanisme explicite de checkpoint possède son staging et ses commits. Les agents ne lancent pas `git add/commit/reset/merge` dans ce checkout ; leurs opérations Git portent sur `codeRoot`.

Une mutation acceptée est visible avant le prochain checkpoint Git. L'absence de commit immédiat ne doit pas rendre son résultat ambigu ; la persistance/reprise locale suit les garanties définies dans le document de concurrence. Un checkpoint utilise la même coordination pour capturer un état cohérent, enregistre les acteurs et peut être déclenché manuellement ou selon une politique choisie. Les lectures cohérentes de plusieurs fichiers doivent elles aussi suivre le protocole ; un lecteur brut parcourant le disque pendant une mutation peut voir un état partiel. Il ne doit pas absorber le staging de code de l'humain.

Le merge d'une PR de code ne touche jamais le store canonique. Pendant la migration, des branches anciennes contiendront encore `.frame` : leur merge peut réintroduire cette copie dans le checkout de code. La CLI doit refuser d'en faire une autorité lorsqu'une liaison existe, et un contrôle de PR doit signaler toute écriture opérationnelle sur une branche de code. Nettoyer ensuite ces copies par une migration explicite, après inventaire de leurs divergences.

Ces règles sont applicatives et coopératives. Un utilisateur ayant les droits d'écriture sur les fichiers peut les contourner ; une garantie forte nécessite des droits/une identité système réservés au writer, ou l'arrêt des écritures concurrentes pour toute intervention manuelle.

## 9. Plusieurs clones, machines, agents distants et offline

Le Git common dir relie les worktrees **d'un clone**. Un autre clone a son propre état technique : les claims actuels n'empêchent donc pas deux machines de réserver la même issue. Source du comportement Frame : [claim-store.ts](../../apps/cli/src/worktrees/claim-store.ts) et [worktree.adapter.ts](../../packages/git/src/worktree.adapter.ts).

Pour des agents sur plusieurs machines, choisir explicitement l'un des deux modes :

- **Autorité partagée joignable** : les agents appellent un coordinateur distant, qui persiste les `.md`. C'est le prolongement le plus simple du modèle local ; l'exécution du code reste distante.
- **Travail déconnecté** : les machines lisent un snapshot identifié et accumulent des propositions d'opérations. Leur application ultérieure doit vérifier les révisions, conflits et droits. Une écriture offline n'est pas un changement canonique confirmé, ni une réservation globale.

Un push/pull de la branche de données seul ne fournit pas l'exclusion mutuelle mondiale ou une résolution sémantique. Ne pas promettre des écritures distribuées sûres sur un partage réseau en transposant les verrous locaux sans validation du protocole et du système de fichiers.

La synchronisation Linear se branche à cette même autorité : elle applique des changements via les mêmes révisions et le même coordinateur. Chaque agent ne doit pas synchroniser indépendamment sa copie du workspace.

## 10. Changements à prévoir avant de déclarer le design adapté

| Chantier | Où intervenir | Critère de validation |
|---|---|---|
| Identité et routage | Résolveur CLI/SDK, conteneur | Même workspace depuis tous les worktrees ; root absent explicite |
| Création de worktree | Commande `issue/worktree.ts` | Démarrage canonique, aucune mutation métier dans le checkout de code |
| Mutations partagées | Ports/repository/cas d'usage | CLI, SDK, import et sync utilisent les mêmes garanties de concurrence |
| Tracking d'exécution | Objets et stockage proposés | Plusieurs tentatives sans falsifier le statut d'issue |
| Réservation | Claim store et reprise | Une réservation valide ; anciennes commandes rejetées après reprise |
| Versionnement des données | Checkpoints dédiés | Aucun staging humain absorbé, aucun merge de code écrasant l'état |
| Migration | Inventaire de toutes les copies existantes | Divergences explicites ; jamais de sélection « dernière date gagne » |
| Lecture et pilotage | Index reconstructible et publication cohérente | État visible après mutation ; pas d'avancement fondé sur des copies obsolètes |
| Multi-clone | Protocole distant ultérieur | Limite affichée tant qu'aucune autorité distante ne coordonne les claims |

Scénarios de réception à exécuter lors de l'implémentation : démarrer deux agents sur deux issues puis lire leurs changements depuis l'humain ; tenter simultanément la même réservation ; reprendre après crash entre création Git et écriture métier ; annuler une issue pendant son exécution ; fusionner une vieille branche contenant `.frame` ; renommer le checkout de données ; effacer et reconstruire l'index de lecture ; vérifier qu'un deuxième clone ne reçoit pas une fausse garantie de réservation globale.

## 11. Portée des conclusions

Le code de routage, le stockage et les claims ont été inspectés ; l'expérience Git minimale a été exécutée. La suite de tests Frame n'a pas été relancée pour ce document, et le design proposé n'a pas été prototypé. L'organisation recommandée est une conclusion d'architecture à partir de ces faits, avec un coût explicite : **un checkout de données dédié et un protocole d'écriture commun, en échange d'un suivi immédiat et d'un historique qui ne dépend plus des merges de code**.
