# Audit Git — branches Frame jumelées et cas limites

2026-09-29. Recherche documentaire ; **aucune implémentation ni validation expérimentale du protocole proposé**. Ce document accompagne le [design global 06](06-design-global-branches-frame.md). Il prend comme nouvelle direction des branches Frame isolées par travail, avec une vue globale des propositions. Il remplace donc, pour ce choix, la recommandation de stockage unique du [document 04](04-worktrees-et-etat-partage.md). Les protections d’écriture du [document 05](05-concurrence-et-edition-markdown.md) restent nécessaires dans chaque checkout.

## Conclusion de l’audit

Le jumelage est réalisable. Les conditions de fiabilité sont : des identités stables, des opérations reprenables, une association explicite aux commits de code, une fusion métier avant publication et une distinction visible entre données intégrées et propositions.

Deux points interdisent de promettre une synchronisation parfaite par simple hook : un commit de code peut réussir alors que son checkpoint Frame échoue ; après un hook absent, l’état Frame historique exact n’est pas reconstructible à partir du seul état courant. Ces situations deviennent des états documentés et réparables, jamais des succès silencieux.

Les sections « solution » ci-dessous sont des décisions de conception proposées pour Frame, pas des propriétés fournies par Git.

## 1. Socle Git vérifié

| Propriété documentée | Conséquence pour Frame |
|---|---|
| Worktrees : HEAD/index propres, nombreuses références communes ; configuration partagée par défaut | Une branche de données par travail ; pas de second checkout forcé d’une branche déjà utilisée |
| `worktree add --orphan` crée une branche non née avec arbre/index vides | Seule la racine `frame/main` commence sans parent ; ses branches de travail en descendent |
| `worktree list --porcelain -z`, `repair`, `lock` existent | Inventorier/réparer via Git ; le verrou worktree protège sa conservation, pas les écritures métier |
| `rev-parse --git-common-dir`, `--git-path`, `--local-env-vars` résolvent l’administration et l’environnement | Ne jamais déduire l’administration de `codeRoot/.git`, qui peut être un fichier |

Sources : [git-worktree](https://git-scm.com/docs/git-worktree), [git-rev-parse](https://git-scm.com/docs/git-rev-parse).

Un hook `post-commit` intervient après le commit et ne peut en changer le résultat. `pre-commit` peut être contourné. `post-rewrite` transmet les correspondances amend/rebase ; il ne couvre pas tous les outils de réécriture. `post-merge` peut signaler un squash avant qu’un commit enregistre son résultat. Un hook invoquant Git dans un autre worktree doit neutraliser les variables locales Git héritées. `core.hooksPath` modifie l’emplacement des hooks. Source : [githooks](https://git-scm.com/docs/githooks).

Un fast-forward ne crée aucun commit ; un squash prépare un résultat sans enregistrer la parenté d’une fusion ordinaire. Source : [git-merge](https://git-scm.com/docs/git-merge).

## 2. Identités et historique : ne pas identifier un travail par son nom de branche

Proposition :

```text
workspaceId : identité portable du workspace métier
workId      : identité durable du travail
checkpointId : identité d’un appariement à un commit
operationId : identité idempotente d’une opération Frame
codeRef     : emplacement observé, modifiable
codeOid     : commit précis, éventuellement remplacé
frameRef    : frame/work/<workId>
frameOid    : checkpoint précis
```

Le nom lisible de branche peut changer ; un SHA peut disparaître après rebase. Ni l’un ni l’autre ne remplace `workId`. Une nouvelle branche qui réutilise un ancien nom doit recevoir un nouveau travail, sauf rattachement explicite.

Les associations portables et reçus d’intégration appartiennent à des fichiers versionnés de la branche Frame. Le registre dans le Git common directory contient chemins, caches, verrous et opérations locales en cours. Il est reconstructible pour les associations **commitées** ; il ne remplace pas les brouillons et opérations non publiées, qui doivent être conservés séparément et récupérés avant reconstruction destructive.

Ne pas dépendre uniquement du reflog, d’une configuration locale ou de chemins absolus pour retrouver l’histoire sur une autre machine. Conserver également les commits nécessaires sous des références de rétention jusqu’à leur politique d’archivage, afin qu’un SHA mentionné dans un document ne soit pas la seule protection de l’objet.

## 3. Checkpoint couplé au commit : protocole et limites

### Séquence proposée

1. Dans `prepare-commit-msg`, créer un `attemptId` propre à la tentative et inscrire un trailer réservé `Frame-Snapshot: <token>` dans le message. Cette instrumentation est activée explicitement à l’installation ; un lanceur Frame peut fournir une identité d’invocation supplémentaire.
2. Sous verrou court de la branche Frame, valider et sceller un snapshot immuable avec ses révisions ; persister l’intention de jumelage. Libérer le verrou : un éditeur ne doit pas bloquer les autres pendant toute la rédaction du message Git.
3. Laisser Git créer le commit de code, avec son index et ses conventions habituelles.
4. Après succès, lire le token dans le message du commit réellement créé, valider son contexte et associer son snapshot scellé au SHA de code vérifié, puis publier un checkpoint Frame. La branche Frame est avancée sous contrôle de sa tête attendue.
5. Enregistrer la complétion. Une relance reconnaît le même `checkpointId` et ne crée pas de doublon.

Les éditions Frame arrivées après le scellement restent des changements en attente pour le prochain checkpoint. Le checkpoint ne doit ni les absorber arbitrairement, ni les effacer en réécrivant le checkout avec l’ancien snapshot.

### Difficulté à ne pas masquer : relier deux hooks à la même invocation

Les hooks ne constituent pas à eux seuls un identifiant d’opération durable. Une tentative peut échouer après `pre-commit`, une autre commencer, un hook être absent, et les outils Git employer des index temporaires. Déduire « prendre le dernier snapshot en attente » est insuffisant.

Solution retenue pour les commits instrumentés : le trailer référence un snapshot durable et protégé contre la collecte, avec `workId`, identité du worktree, tête de contexte et révisions. Le post-hook lit le message effectif, jamais le dernier token en attente. Un validateur contrôle que le trailer n’a pas été supprimé ou remplacé. `prepare-commit-msg` n’est pas désactivé par `--no-verify`, mais son installation peut manquer et le message peut être modifié : le post-hook vérifie toujours. Un lanceur Frame demeure utile pour suivre les échecs et fournir un identifiant d’invocation. Aucun de ces mécanismes n’est encore validé par des tests dans Frame. Un PID seul, un délai ou un SHA précédent ne prouvent pas l’association.

Un token déjà consommé, copié depuis un autre commit, ne devient pas une preuve nouvelle. Amend et cherry-pick remplacent le trailer Frame par un token neuf lorsque l’instrumentation s’exécute. Lors d’un rebase, les correspondances de réécriture conservent la provenance des anciens snapshots ; un snapshot courant ne doit pas être présenté comme l’état historique de chaque commit rejoué. Un token absent, inconnu ou contradictoire entraîne une liaison en attente ou explicitement tardive.

Une liaison `observed-after` signifie : « ces données ont été observées après ce commit ». Elle ne signifie pas : « ces données étaient exactement celles présentes au moment du commit ». Le rattrapage conserve cette distinction.

### Cas d’échec

| Problème | Solution proposée |
|---|---|
| Validation ou signature du code échoue | Snapshot scellé conservé comme tentative abandonnée ; aucun faux checkpoint associé à un commit inexistant |
| Code commité, Frame indisponible | État `pairing-pending`, reprise depuis snapshot ; ne pas annuler le code par reset |
| Publication Frame réussie, accusé local perdu | Reconnaissance du `checkpointId` déjà publié ; terminer le journal |
| Crash avant preuve du SHA | Réconciliation vérifiant le commit réel et l’identité de tentative ; sinon association incertaine à résoudre |
| Données inchangées | Checkpoint contenant une liaison nouvelle, sans inventer une mutation métier |
| Travail documentaire sans commit de code | Checkpoint autonome lié au `workId`, avec SHA de contexte facultatif et marqué comme tel |
| Historique intermédiaire manquant | Associer explicitement un intervalle observé ; ne pas fabriquer un snapshot par commit ancien |
| Clé de signature indisponible | Opération en attente et diagnostic ; aucune désactivation automatique des exigences de signature |

Un snapshot associé décrit l’état Frame de la branche à un instant. Un commit de code partiel ne prouve pas que tous les changements Frame concernent uniquement les lignes sélectionnées. Cette portée doit être présentée comme contexte de branche, sauf déclaration métier plus précise.

## 4. Hooks, index et checkout : éviter les interférences

Les recommandations suivantes découlent de la frontière de responsabilité choisie pour Frame :

- Le hook ne réalise aucune opération réseau et ne déclenche pas de résolution interactive longue.
- Filtrer le rôle du worktree : les commits sur `frame/*` ne relancent pas le checkpoint de code. Ajouter un marqueur interne de réentrance, sans en faire une autorisation de contourner les validations métier.
- Exécuter Git avec un environnement reconstruit pour la cible. Neutraliser notamment l’index hérité avant d’appliquer l’index propre à Frame. Ne pas modifier l’index de code pour ajouter des données métier.
- Frame possède les opérations d’index de ses worktrees de données. Une manipulation Git extérieure détectée suspend l’automatisation jusqu’à diagnostic ; elle n’est pas écrasée par un `reset --hard` de rattrapage.
- Construire un checkpoint scellé avec un index temporaire dédié permet de conserver les éditions plus récentes dans le checkout. La mise à jour de l’index normal et de la vue disque nécessite un protocole de reprise ; changer la ref seule n’actualise pas les fichiers.
- Installer un dispatcher compatible avec les hooks existants. Ne jamais remplacer silencieusement Husky, un `core.hooksPath` existant ou les hooks du projet. Vérifier à chaque diagnostic que l’intégration reste active.
- Pour `reference-transaction`, garder une observation minimale : ne pas lancer une cascade de mutations Git pendant que Git détient ses verrous de références. Le traitement métier est différé et idempotent.

La documentation de [git-commit](https://git-scm.com/docs/git-commit) décrit notamment les commits partiels et l’amend ; ils imposent de ne pas supposer que l’index visible avant l’invocation est toujours le contenu exact finalement commité.

## 5. Tableau des opérations Git

| Opération de code | Comportement Frame proposé | Condition de publication sur `frame/main` |
|---|---|---|
| Commit ordinaire | Checkpoint apparié au commit observé | Aucune intégration de travail implicite |
| Commit direct sur main | Checkpoint de la branche Frame principale | Validation métier, précondition de tête ; aucun réseau requis |
| Amend | Nouvel appariement et relation ancien SHA → nouveau SHA ; ancien reçu conservé | Ne pas réécrire automatiquement les checkpoints publiés |
| Rebase interactif / autosquash | Enregistrer une relation plusieurs anciens → nouveaux commits ; réconcilier après fin | Vérifier le nouvel ensemble retenu, pas l’ancienne topologie |
| Rebase interrompu/abandonné | État Git en cours ; pas d’intégration automatique | Reprise/abandon confirmé avant classification définitive |
| Cherry-pick | Nouveau commit sur un autre travail ; transfert Frame explicite du sous-ensemble pertinent | L’équivalence d’un patch ne prouve pas l’intégration de tout le travail |
| Merge classique | Preuve d’ascendance et périmètre source identifié | Vérifier head source, cible et reçu déjà intégré |
| Fast-forward | Détecter l’avancement de ref ; pas attendre un nouveau commit | Périmètre effectivement introduit prouvé |
| Squash | Relier head source et commit final via preuve explicite | Pas de simple comparaison de nom/message ; reçu terminal |
| Merge/rebase effectué sur GitHub | Réconcilier à la synchronisation via événement/API et objets récupérés | Vérifier dépôt, base, source et résultat effectif |
| Reset ou force-push du code | Marquer les associations devenues hors histoire courante | Ne pas supprimer rétroactivement les données validées |
| Revert | Nouvelle opération à analyser | Ne pas réouvrir automatiquement des issues ou ressusciter des objets |
| Detached HEAD | Travail explicite détaché, conservé par référence de rétention | Rattachement et destination explicites |

GitHub expose l’état d’intégration et `merge_commit_sha`, dont le sens dépend de la méthode d’intégration ; l’adaptateur doit interpréter ces informations, pas considérer chaque valeur comme un merge à deux parents. Source : [API Pull Requests GitHub](https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request).

Un connecteur absent implique une preuve fournie explicitement ou un état `integration-unverified`. L’automatisation maximale ne doit pas être une inférence fragile sur un message « Merge PR… ».

## 6. Fusion Frame et squash terminal

Proposition : actualiser une branche de travail depuis `frame/main` par fusion sémantique à trois versions, puis enregistrer les deux parents si l’on conserve cette relation de fusion. Le moteur compare les identités d’objets et valide le résultat global, pas seulement les lignes Markdown.

À l’intégration finale, produire un squash de la proposition acceptée sur `frame/main`, accompagné d’un reçu indiquant : `workId`, base examinée, source examinée, cible examinée, opérations incluses, preuve d’intégration de code et décisions de conflit.

**Fermer ensuite cette branche de travail pour les nouvelles mutations.** Un travail poursuivi repart de la nouvelle tête de `frame/main` avec une nouvelle époque/identité de branche. Cela évite de tenter de re-fusionner automatiquement une branche dont la parenté Git ne décrit pas son squash déjà intégré.

Si des modifications arrivent après le head source examiné, elles ne font pas partie du squash. Les préserver dans un nouveau travail lié, ou refuser la clôture jusqu’au choix de l’utilisateur ; ne jamais les marquer intégrées par proximité temporelle.

Ne pas fusionner dans un checkout sale de la cible. Construire le candidat dans une zone d’intégration indépendante ; publier après validation et vérification des heads inchangés. Si la cible avance, recalculer les décisions impactées.

`update-ref <ref> <new> <old>` permet une précondition sur la valeur de la référence ; ses transactions permettent plusieurs changements de références coordonnés. Cela ne rend pas atomiques les deux commits indépendants, le filesystem et les services distants. Source : [git-update-ref](https://git-scm.com/docs/git-update-ref).

## 7. Plusieurs machines et publication

Un verrou dans `.git` protège un clone local, pas les autres clones. Chaque travail doit avoir une identité de branche globalement distincte ; si plusieurs machines travaillent sur le même `workId`, il faut un transfert explicite de propriété ou un mode de collaboration avec réconciliation.

Politique proposée : aucune réécriture automatique de l’histoire publiée de `frame/main`. Au push refusé, fetch, construire une fusion sémantique contre la nouvelle cible, valider puis republier. Nombre de reprises borné ; au-delà, état en attente pour éviter une boucle active sans fin.

Git refuse normalement les mises à jour non fast-forward ; `push --atomic` peut publier plusieurs références ensemble si le serveur le supporte. Source : [git-push](https://git-scm.com/docs/git-push). Frame peut exploiter cette capacité lors d’une publication couplée explicitement demandée, mais doit vérifier le support ; aucune retombée silencieuse vers une publication partielle.

Une fusion du code faite sur GitHub et une fusion Frame locale ne forment pas une transaction distribuée. Conserver un état lisible : `code-integrated / frame-pending`, puis reprendre. Un refus de permission ou une protection de branche devient une demande d’intégration conforme aux règles du dépôt, pas un contournement.

Le registre local agrège les éditions non commitées de cette machine. Pour les autres machines, la vue ne connaît que les checkpoints publiés et récupérés ; afficher leur fraîcheur. Ne pas afficher un agent distant comme inactif sur la seule absence de modification Git.

## 8. `.frame/` imbriqué : possible, mais cycle de vie explicite

Organisation proposée : le `.frame/` d’un worktree de code contient les fichiers racine du worktree de données, sans second `.frame/.frame`. La branche de code ignore ce chemin ; la branche de données versionne ses propres fichiers. La résolution des chemins doit distinguer `codeRoot` et `dataRoot`.

La possibilité générale de choisir le chemin ne vaut pas validation de tous les outils qui déplacent ou suppriment le dossier parent. Matrice d’acceptation obligatoire sur les plateformes supportées :

| Situation | Solution Frame |
|---|---|
| `.frame/` existe avant rattachement | Inspecter et migrer dans une opération reprenable ; jamais écraser |
| Changement de branche dans le même worktree de code | Détecter le nouveau contexte avant mutation ; suspendre si liaison incohérente, préserver les données précédentes |
| Déplacement du parent | Réparer les deux rattachements et reconstruire les chemins ; vérifier les identités |
| Suppression du worktree de code | Préserver/checkpointer le travail Frame puis retirer proprement l’enfant avant le parent |
| `git clean` externe ou suppression manuelle | Hors protocole : récupération depuis checkpoints/rétention ; ne pas promettre récupération des octets jamais sauvegardés |
| Nettoyage/prune administratif | Respecter les travaux en cours ; registre orphelin signalé, aucune suppression automatique par simple absence temporaire |
| Branche Frame déjà checkout ailleurs | Rattacher au checkout existant validé ou créer un autre travail ; ne pas forcer une seconde copie écrivain |
| Plusieurs dépôts avec le même nom | Vérifier workspaceId et identité de dépôt, pas le basename du dossier |

Une liaison vers un emplacement externe géré peut être proposée aux environnements où les outils de worktree suppriment récursivement le parent sans connaître Frame. Le choix du dossier n’altère pas le protocole métier.

## 9. Tests d’acceptation avant de promettre le pilotage automatique

1. Deux processus committent dans deux worktrees : associations exactes, aucun staging croisé, pas de récursion.
2. Échec à chaque étape entre scellement, commit code, checkpoint et accusé : reprise idempotente et modifications ultérieures préservées.
3. Deux tentatives sur le même worktree, premier commit échoué, second réussi : aucun ancien snapshot attribué au second par erreur.
4. Commit partiel, GUI, amend, rebase interactif avec squash/drop et abandon : correspondances correctes ou ambiguïté explicitement marquée.
5. Hook absent, remplacé, non exécutable ou contourné ; trailer retiré, falsifié, copié par amend/cherry-pick ou conservé lors de replay : rattrapage distinguant une observation tardive d’un snapshot exact, sans réutilisation abusive du token.
6. Merge, fast-forward, squash local non commité, squash GitHub et cherry-pick partiel : seul le périmètre prouvé est intégré.
7. Cible distante avancée pendant publication : réconciliation sans force-push ni répétition d’une opération déjà acceptée.
8. Mutation Frame après scellement et après calcul d’intégration : octets et opérations non inclus conservés.
9. Suppression/édition d’un même objet et invariants entre objets : arrêt contextualisé avant publication, même si Git n’aurait aucun conflit textuel.
10. Déplacement/suppression du parent avec `.frame/` imbriqué ; registry perdu ; clonage neuf : reconstruction des données commitées et diagnostic du reste.
11. Source continuée après squash : nouvelle époque, aucune intégration répétée ni modification tardive perdue.
12. Lecture pendant publication multifichier : API cohérente ou état temporairement indisponible explicite ; les lecteurs bruts de plusieurs fichiers n’obtiennent pas une transaction magique.

Ces tests sont un contrat proposé. Aucun n’a été exécuté pour cette architecture pendant cet audit. Les recherches précédentes prouvent seulement certains comportements existants et un cas actuel de perte de mise à jour.
