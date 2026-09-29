# Design global — Branches Frame associées au code et intégration automatique

2026-09-29 · Proposition d’architecture pour revue · Code inspecté : `451914f`.

Ce document fixe la cible issue de la discussion : une branche Frame principale, des branches Frame associées aux travaux de code, des checkpoints liés aux commits de code et une intégration automatique lorsqu’elle est déterministe. Les conflits restants sont présentés avec leur contexte et résolus par la même API, pour un humain ou un agent.

**Aucun mécanisme décrit ici n’est annoncé comme implémenté.** Les syntaxes CLI sont proposées. Cette cible remplace la recommandation de stockage métier unique de [04](04-worktrees-et-etat-partage.md). Elle conserve les protections d’écriture de [05](05-concurrence-et-edition-markdown.md), appliquées à chaque espace de travail. L’[audit Git](07-git-hooks-et-cas-limites.md) détaille les contraintes des hooks. Le modèle métier reste celui de [01](01-modele-local.md).

## 1. Décision d’ensemble

Traiter le dépôt comme deux historiques coordonnés : code et données. `frame/main` commence par un commit racine indépendant du code. Les branches `frame/work/<workId>` descendent de `frame/main`, ou d’une branche Frame parente pour un travail empilé. Une branche de travail Frame n’est donc pas une nouvelle branche orpheline.

Chaque checkout de code dispose d’un dossier `.frame/` qui est le checkout de sa branche Frame associée. Les lectures locales voient cette branche. La vue globale agrège les différences de toutes les branches connues, sans les faire passer pour des décisions acceptées.

Le fonctionnement automatique repose sur un coordinateur reprenable : les hooks l’informent, les règles métier valident, Git conserve les snapshots. Les hooks ne sont pas le seul endroit où vit la logique.

| Alternative | Bénéfice | Motif du choix |
|---|---|---|
| Un seul état partagé | Suivi simple et immédiatement accepté | Ne répond plus au besoin d’isoler les propositions par travail |
| Branches Frame + simple merge Markdown Git | Isolation et historique | Ne protège ni la sémantique métier ni l’association exacte avec le code |
| Branches Frame + intégration métier coordonnée | Isolation, provenance, automatisation vérifiable | **Cible retenue**, avec davantage de métadonnées et de reprise |

Le modèle fonctionne en solo et avec plusieurs agents. Il ne promet pas une transaction atomique entre un commit Git réalisé librement par l’utilisateur, un second commit et une publication distante.

## 2. Règles qui ne doivent jamais être violées

1. Un objet métier conserve son identité dans toutes les branches ; son chemin n’est pas son identité.
2. `frame/main` représente l’état accepté localement. Le statut de synchronisation distante est distinct.
3. Une branche de travail représente une proposition, même si son statut local indique Done.
4. Un checkpoint lie un commit de code observé à un instantané Frame précisément identifié ; sinon le lien est explicitement non vérifié.
5. Une sauvegarde Frame ne doit perdre aucune mutation d’un autre écrivain coordonné dans le même espace.
6. Une intégration publie tout son résultat validé ou reste en attente ; aucun marqueur de conflit dans le stockage accepté.
7. Les retries retrouvent le résultat d’une opération ; ils ne créent pas une nouvelle décision métier.
8. Une branche distante avancée n’est jamais écrasée automatiquement par force-push.
9. Ni l’ordre des timestamps ni le nom d’une branche ne déterminent seuls l’intention gagnante.
10. Toute intégration automatique laisse un reçu expliquant les sources, les règles et les décisions appliquées.

## 3. Fichiers, branches et identités

```text
projet/                                  # checkout de code main
├── .git/
│   └── frame/
│       ├── registry.json                # découverte et chemins du clone
│       ├── locks/                       # coordination interprocessus
│       ├── operations/                  # transactions / jobs à reprendre
│       ├── snapshots/                   # instantanés scellés non encore publiés
│       ├── drafts/                      # textes humains/agents en cours
│       ├── conflicts/                   # dossiers de résolution locaux
│       └── cache/                       # projection globale reconstruisible
├── .gitignore                           # /.frame/ ignoré par le code
├── src/
└── .frame/                              # worktree Git : frame/main
    ├── .git                             # liaison Git, pas un nouveau dépôt
    ├── workspace.md
    ├── teams/
    ├── initiatives/
    ├── projects/<id>/milestones/
    ├── issues/<id>.md
    ├── documents/<id>.md
    ├── updates/
    └── _frame/                          # métadonnées portables et versionnées
        ├── manifest.json
        ├── works/<workId>.json
        ├── checkpoints/<checkpointId>.json
        ├── integrations/<integrationId>.json
        ├── operations/<operationId>.json
        └── tombstones/<entityId>.json

projet-connexion/                        # checkout code codex/connexion
├── src/
└── .frame/                              # worktree : frame/work/<workId>
    ├── issues/
    ├── documents/
    └── _frame/
```

Les `.md` restent la représentation métier canonique de chaque branche. `_frame/` décrit identité, provenance et décisions techniques ; il n’est pas un second stockage concurrent de leurs propriétés. Le journal de reprise local peut temporairement contenir les octets nécessaires à une réparation, sans devenir une base métier alternative.

Le registre est sous le chemin retourné par Git pour son **common directory**, pas sous `cwd/.git` : `.git` peut être un fichier. Les worktrees ont leurs propres index et HEAD, avec une partie administrative commune. [Documentation Git worktree](https://git-scm.com/docs/git-worktree).

| Identifiant | Stabilité et contenu |
|---|---|
| `workspaceId` | Stable pour le realm, indépendant du clone |
| `workId` | UUID d’un travail/époque ; stable malgré renommage de branche |
| `checkoutId` | Identité locale d’un montage code/données |
| `entityId` | UUID stable des objets ; références entre Markdown |
| `operationId` | Identité d’une mutation ou d’un job, pour la reprise |
| `snapshotId` | Instantané immuable pris avant un commit de code |
| `checkpointId` | Association publiée entre instantané, code et branche Frame |
| `integrationId` | Décision d’acceptation d’un ensemble précis de changements |

Les noms humains des branches restent libres. La référence Frame utilise `workId` pour éviter les collisions lors des renommages et réutilisations de noms. Les exemples `frame/*` désignent le namespace fonctionnel futur du produit ; ils ne créent aucune branche dans ce dépôt pendant cette étude.

Le registre contient chemins absolus locaux, références, identités et états de montage. Il est reconstruit à partir de `git worktree list`, des références et de `_frame/works`. Les brouillons, opérations non terminées et conflits non sauvegardés ne sont **pas** un cache : les perdre n’est pas réparable à partir du seul registre. Aucun chemin absolu local ni secret de connexion dans les métadonnées portables.

### Numérotation des issues

Les compteurs indépendants par branche ne peuvent pas attribuer sûrement le même prochain `ENG-123`. Les identités internes sont des UUID. Un nouvel objet de branche reçoit un alias provisoire explicite (`ENG-draft-<suffixe>`). L’autorité d’intégration attribue le numéro définitif et conserve la redirection d’alias. Les références internes ne changent pas.

En mode connecté à Linear, l’attribution définitive respecte l’autorité du connecteur configuré. En mode distribué sans coordinateur, on ne promet pas une numérotation globale séquentielle pendant le travail hors ligne. C’est une règle de stockage Frame, pas un nouveau concept métier Linear.

## 4. Création et changement d’espace

Pour une commande Frame qui veut écrire depuis une branche de code sans association :

1. Identifier le dépôt, le checkout, la branche réelle et le workspace. Vérifier le format.
2. Sous réservation de création, créer `workId`, le descripteur portable et un journal `creating`.
3. Choisir la base Frame : `frame/main` par défaut ; branche du parent seulement si le travail empilé est déclaré.
4. Créer la branche et le worktree `.frame/`, puis enregistrer la liaison. Vérifier le montage avant la première mutation.
5. En cas d’interruption, reprendre les étapes déjà réalisées ; préserver un chemin non vide ou non reconnu pour inspection.

La simple lecture peut rester sans effet de bord. La création paresseuse s’applique aux écritures via Frame. Elle ne peut pas précéder magiquement une écriture arbitraire dans un éditeur externe : celui-ci passe par une session d’édition ou une initialisation explicite.

Un même nom de branche repris après clôture donne un nouveau `workId`. Deux clones ayant créé des travaux distincts sur une branche de code homonyme ne fusionnent pas leurs identités par hasard.

Si l’utilisateur change de branche de code dans un même dossier, Frame vérifie la liaison avant toute opération. Un hook de checkout déclenche la réconciliation ; en son absence, la commande suivante la fait. Le montage de données précédent est conservé/démonté proprement puis le bon montage est activé. Si des données ou sessions sont en cours, le changement Frame reste bloqué avec diagnostic : aucune écriture vers une branche déduite seulement du chemin `.frame/`.

`frame/main` n’est monté qu’une fois par clone. Si aucun checkout de code principal ne l’héberge, un checkout technique dédié l’héberge ; un second checkout ne force pas le montage concurrent de la même branche. La CLI résout ce chemin canonique. Le besoin de `.frame/` imbriqué impose aussi de préserver/déplacer le worktree enfant avant de supprimer le parent.

## 5. Sauvegarde, checkpoint et envoi : trois événements distincts

| Événement | Déclencheur proposé | Garantie / effet |
|---|---|---|
| Mutation Frame | Commande, save de brouillon, API | Markdown local validé, révision et opération durables ; visible dans le suivi local |
| Checkpoint associé | Commit de code réussi | Commit Frame lié à l’instantané scellé pour ce commit de code |
| Checkpoint autonome | `frame checkpoint` | Enregistre du travail Frame sans prétendre à une modification de code |
| Publication | `frame sync`, ou politique d’envoi activée | Transmet les références autorisées ; état local et distant distingués |
| Intégration | Preuve d’intégration du code ou acceptation explicite d’un travail documentaire | Fusion métier validée vers la cible Frame |

**Décision : ne pas créer un commit Git à chaque frappe ni à chaque sauvegarde.** Chaque mutation possède un identifiant et une trace ; les commits suivent les commits de code ou les checkpoints autonomes. Cela répond au dernier choix exprimé et évite deux règles de commit concurrentes.

Le snapshot est le contexte Frame de la branche : il ne prouve pas que chaque modification documentaire correspond aux seules lignes sélectionnées dans un commit partiel de code.

Un commit de code sans changement métier crée quand même un checkpoint de liaison : son seul changement peut être `_frame/checkpoints/<id>.json`. Cela rend la couverture explicite. Les opérations purement documentaires ont un checkpoint autonome avec un code SHA de contexte facultatif, jamais une fausse causalité.

## 6. Protocole du commit associé

### Pourquoi le simple post-commit ne suffit pas

Si Frame lit les fichiers après le commit, une autre mutation peut déjà être arrivée. Le snapshot associé ne serait pas celui préparé avec le travail de code. De plus, `post-commit` intervient après le succès et ne peut pas annuler ce succès. Les hooks reçoivent aussi un environnement Git qui peut cibler le mauvais worktree si on le transmet tel quel à une commande sur les données. [Documentation Git hooks](https://git-scm.com/docs/githooks).

### Association exacte proposée

Le dispatcher ignore les commits des worktrees de données, vérifie leur rôle réel et empêche sa propre récursion. Il reconstruit l’environnement Git pour chaque cible, notamment l’index, sans hériter aveuglément des variables `GIT_*` du commit de code.

L’installation Frame compose ses hooks avec ceux du dépôt, notamment Husky, au lieu de les remplacer. L’ajout d’un trailer technique au message de commit fait partie du mode de liaison activé pour le workspace.

1. `prepare-commit-msg` demande au coordinateur de sceller un snapshot Frame : branche, révision, opérations incluses et contenu exact. Le verrou de données est court et libéré avant la rédaction du message.
2. Le hook ajoute/remplace un trailer réservé `Frame-Snapshot: <snapshotId>` dans le message de **cette invocation**. Le snapshot est durable avant retour du hook ; aucune sélection « dernier snapshot en attente ».
3. Le commit de code se termine. `post-commit` lit le commit effectivement créé et son trailer ; il vérifie l’existence et le contexte du snapshot.
4. Le coordinateur produit un commit Frame à partir du contenu scellé et d’un checkpoint contenant le SHA complet de code. Il ne capture pas les mutations arrivées après le snapshot.
5. Les mutations ultérieures restent présentes dans l’état de travail et attendent un autre checkpoint. Le job est marqué terminé avec son résultat.

Le trailer ne contient pas le SHA du commit Frame : cela éviterait une dépendance circulaire entre deux hashes. Le commit Frame contient le SHA du code ; le code contient seulement un identifiant stable de snapshot. Les signatures sont produites sur les contenus définitifs ; on ne réécrit pas après coup un commit signé pour ajouter le lien.

Le snapshot qualifie un instant de préparation, pas « tout ce qui existait à la microseconde de création du commit ». La fenêtre est définie et vérifiable. Si un hook de validation exige des changements après scellement, le commit doit être relancé pour les inclure.

### Contenu minimal d’un checkpoint portable

```json
{
  "formatVersion": 1,
  "checkpointId": "CP-uuid",
  "workId": "WORK-uuid",
  "snapshotId": "SNAP-uuid",
  "code": { "oid": "full-code-oid", "refAtCapture": "refs/heads/codex/connexion" },
  "frameParentOid": "previous-frame-oid",
  "domainTreeDigest": "digest-of-business-files",
  "operationIds": ["OP-uuid"],
  "association": "sealed",
  "reason": "code-commit"
}
```

Un checkpoint peut aussi porter `snapshotCommitOid` lorsqu’un instantané historique est conservé séparément, et `publicationMode: history-only` lorsque sa publication ne modifie pas l’état métier courant.

Le SHA du commit contenant ce fichier est obtenu depuis Git ; il n’est pas inscrit dans le fichier lui-même. Les formats ne supposent pas des hashes toujours longs de 40 caractères. L’identité déclarée de l’acteur est une provenance ; ce n’est pas une authentification cryptographique.

### Échecs et couverture incomplète

- Commit de code refusé/abandonné : snapshot conservé comme préparé non associé ; aucun commit métier n’est révoqué. Le nettoyage ne le détruit pas avant vérification de sa non-utilisation.
- Trailer retiré, hooks absents, token copié d’un autre travail : ne pas deviner. Créer un diagnostic `association-unverified` ; permettre un checkpoint de rattrapage marqué `observed-after`.
- `--no-verify` n’équivaut pas à « tous les hooks sont désactivés ». Le protocole vérifie le trailer réel, quelle que soit la manière dont le commit a été produit.
- Crash après commit code : la réconciliation parcourt les commits connus et leurs tokens, puis reprend le job manquant. Les commits déjà supprimés et non conservés par une référence ne sont pas garantis récupérables indéfiniment.
- Crash après commit Frame avant acquittement : retrouver le checkpoint par son identité, retourner le résultat existant.
- Deux commits rapides : sérialiser leurs checkpoints par espace et vérifier la filiation attendue ; ne pas publier le second devant le premier. Deux producteurs non coordonnés ambigus donnent un diagnostic, pas une association arbitraire.
- Commits créés par rebase/amend/cherry-pick : nouvelle association ou événement de réécriture explicite ; ne jamais réutiliser silencieusement un token copié. L’historique de provenance reste append-only.

### Instantané ancien et branche déjà avancée

Une file de publication par branche ordonne checkpoints, rafraîchissements et intégrations, avec préconditions sur leurs bases. Un snapshot préparé pendant une longue édition du message ne verrouille pas cette file indéfiniment. Si sa branche avance avant sa publication, **ne jamais reprendre son ancien arbre complet comme nouvel état courant**.

Dans ce cas, Frame conserve l’instantané scellé dans un commit d’archive sous une référence de rétention et ajoute sur la branche courante un checkpoint `history-only` contenant sa liaison au code et son `snapshotCommitOid`. Les fichiers métier actuels restent identiques. L’association au snapshot est exacte, mais l’interface indique que ce snapshot est historique : le commit de liaison lui-même ne représente pas cet ancien état métier. Le push doit inclure la référence de rétention nécessaire, pas seulement son SHA dans un JSON.

Ce parcours s’applique aussi à un checkpoint tardif d’une époque clôturée : ajouter la provenance à l’autorité désignée, sans rouvrir le travail ni rejouer ses anciennes propriétés. Si la publication ordinaire reste possible sur la tête attendue, son arbre métier correspond directement au snapshot. Un retry trouve le même résultat dans les deux modes.

Le wrapper `frame commit` peut faciliter la garantie de bout en bout, mais n’est pas obligatoire pour travailler avec Git. Les commits produits hors du protocole restent valides comme commits de code ; ils n’obtiennent pas artificiellement le label `sealed`.

### Pas de pull dans un hook de commit

Les hooks sont locaux, rapides et reprenables. Ils ne lancent ni fetch, ni résolution interactive, ni push. Une panne réseau ne bloque donc pas un commit local. La récupération distante et la réconciliation se font dans un job `sync`, avec retry borné et arrêt explicite en cas de conflit.

## 7. Écritures concurrentes et publication Git locale

Le protocole de [05](05-concurrence-et-edition-markdown.md) reste nécessaire à l’intérieur d’une branche Frame : verrou court, révision attendue, brouillon pour édition longue, validation et reprise après crash. Les claims d’agent ne remplacent pas ce verrou. Une édition brute hors protocole est importée après comparaison, ou met l’espace en anomalie si son intention ne peut pas être reconstruite.

Le coordinateur possède le staging de données. Les agents possèdent leur staging de code. Pour un checkpoint, un index Git temporaire est construit à partir du snapshot scellé ; jamais `git add -A` dans le checkout de code. Une anomalie dans l’index normal de données est signalée avant réconciliation, sans l’écraser silencieusement.

Le candidat de commit est construit hors de la section critique longue. Au moment de publier : vérifier la référence attendue, journaliser les anciens/nouveaux états, avancer la référence, réconcilier index et fichiers de travail en conservant les mutations postérieures, finaliser le journal. Les lecteurs API attendent la fin de cette publication/reprise. Un lecteur brut de plusieurs fichiers n’a pas de garantie de snapshot atomique.

`git update-ref` permet de conditionner l’avancement d’une référence à son ancien OID. Cette primitive protège la référence ; elle ne met pas atomiquement à jour les fichiers de travail, le journal ou les autres services. Le protocole de reprise doit couvrir ces étapes. [Documentation Git update-ref](https://git-scm.com/docs/git-update-ref).

Un verrou de coordination du clone sérialise les publications Git Frame et les modifications du registre. Des verrous d’espace protègent les mutations locales. Ordre imposé lorsqu’il faut les deux : coordination, puis espaces triés par ID. Aucun appel réseau ni attente d’utilisateur sous verrou. Les workers préparent leurs propositions sans verrou, puis revérifient les révisions avant publication.

## 8. Vue globale : montrer l’activité sans inventer un état accepté

Trois vues partagent les mêmes identités et donnent des réponses différentes :

| Vue | Signification |
|---|---|
| `accepted` | État validé de `frame/main`, y compris ses mutations locales durables non encore checkpointées ; ces dernières sont signalées |
| `work` | État local de la branche courante, avec divergence vis-à-vis de la cible |
| `global` | État accepté + propositions actives + conflits + provenance |

```text
ENG-101 — Connexion
  Accepté : Todo
  Travail connexion : In Progress · agent backend · 2 opérations non commitées
  Travail audit : proposition de priorité Urgent
  Intégration : non demandée
```

Chaque branche contribue son **delta par rapport à sa base**, pas sa copie entière du projet. Les objets et opérations hérités sont dédupliqués par identité et attribués à leur travail d’origine. Les reçus de la cible retirent les propositions déjà acceptées ; un enfant archivé et son parent actif ne contribuent pas deux fois la même opération. Les tombstones et les résolutions font partie du calcul, pas seulement les objets encore présents. Un même objet vu dans cinq branches ne devient pas cinq issues dans les métriques.

Pour un champ modifié de façon compatible, la vue peut proposer un résultat combiné, marqué prévisionnel. Si deux branches donnent des valeurs différentes, elle affiche les candidats et un conflit potentiel. Les indicateurs officiels utilisent `accepted`. Les simulations ont un périmètre nommé ; pas de pourcentage d’avancement mélangeant des hypothèses incompatibles.

La projection capture un vecteur de versions : OID accepté et génération locale de main, OID et génération locale de chaque travail, fraîcheur de chaque remote. Elle peut être rafraîchie progressivement ; elle ne prétend pas observer un instant atomique de plusieurs machines. Une branche inaccessible est marquée inconnue/ancienne, jamais considérée vide ou terminée.

Un agent qui demande la prochaine issue consulte aussi les claims partagés et les travaux actifs, même si `accepted` la montre Todo. Les claims restent locaux au clone tant qu’un coordinateur distant n’existe pas. Une annulation acceptée ou un changement de contrainte apparaît comme alerte dans les branches ; aucune ancienne proposition Done ne l’écrase automatiquement.

## 9. Moteur de fusion métier

### Entrées figées

Toute préparation d’intégration fixe : `workId`, base commune Frame `B`, tête source `S`, tête cible `T`, version de schéma et de politique, preuve d’intégration du code et opérations proposées. Le plan et chaque conflit référencent ces versions. Si source ou cible changent, le plan devient périmé.

Le merge ne se résume pas à appliquer les vieux événements un par un. Les opérations expliquent l’intention ; le résultat compare les états base/source/cible et vérifie le graphe final. Un aller-retour de propriété dans la branche ne réapplique pas une intention devenue sans effet.

### Règles automatiques autorisées

| Situation | Décision automatique |
|---|---|
| Champ inchangé côté source | Conserver la cible |
| Champ inchangé côté cible | Prendre la source, sous réserve des règles métier actuelles |
| Même valeur finale des deux côtés | Conserver une seule valeur, réunir la provenance |
| Propriétés indépendantes modifiées | Combiner puis valider l’objet et ses références |
| Ajout de deux objets à UUID différents | Conserver les deux ; vérifier unicité métier/alias |
| Ensemble sans ordre, membres distincts | Fusion à trois versions des ajouts/retraits par identité |
| Commentaires/événements à ID distinct | Réunir sans duplication ; même ID et payload différent = anomalie |
| Paragraphe modifié sur une seule branche | Conserver cette modification si parsing/validation passent |
| Renommage de fichier à identité constante | Résoudre par ID, puis produire le chemin canonique |
| Champ technique dérivé | Recalculer selon la règle documentée ; jamais l’utiliser comme arbitrage métier |

Pour les ensembles, un retrait et un ajout concurrent du même membre après réajout constituent un conflit d’intention si les événements le démontrent. Les listes ordonnées, labels exclusifs et parentages ne sont pas traités comme des unions libres.

### Cas qui exigent un conflit contextualisé

| Conflit | Pourquoi l’automatisme s’arrête |
|---|---|
| Deux statuts, priorités, responsables ou dates différents | Pas de gagnant universel |
| Annulation acceptée contre achèvement proposé | Décision métier contradictoire |
| Suppression contre modification | Ne pas ressusciter ni supprimer du travail silencieusement |
| Déplacement de projet contre changement de milestone | Références potentiellement incompatibles |
| Réordonnancement concurrent | L’ordre exprime une intention |
| Corps Markdown modifié des deux côtés | Même sans conflit de lignes, le sens peut diverger |
| Workflow/équipe modifié depuis la base | Les anciens statuts et labels doivent être remappés |
| Dépendances ou parentages créant un cycle interdit | Les changements isolés peuvent former un graphe invalide |
| Champ inconnu ou format plus récent | Aucun écrivain ne doit effacer ce qu’il ne comprend pas |
| Objet distant supprimé ou permission perdue | Une absence ne prouve pas une suppression autorisée |

Par défaut, une fusion textuelle à trois versions sans chevauchement des lignes est une **suggestion** lorsque les deux côtés ont changé le corps. Une politique par type de document peut autoriser son acceptation automatique ; ce n’est pas une preuve de compatibilité sémantique.

Le résultat est validé selon le modèle métier retenu, sans ajouter des contraintes étrangères à Linear. L’existence d’une dépendance bloquante, par exemple, ne devient pas automatiquement une interdiction universelle de transition si le workflow ne le prévoit pas.

## 10. Dossier de conflit commun aux humains et aux agents

Un conflit n’est pas seulement `<<<<<<<`. Il contient l’objet, les versions, les intentions, la règle violée, les décisions possibles et leur impact.

```json
{
  "conflictId": "CF-uuid",
  "integrationId": "INT-uuid",
  "kind": "concurrent-status-change",
  "entityId": "ISSUE-uuid",
  "field": "statusId",
  "versions": { "base": "B", "source": "S", "target": "T" },
  "values": { "base": "todo", "source": "done", "target": "canceled" },
  "context": {
    "sourceWorkId": "WORK-uuid",
    "sourceCodeCommit": "code-oid",
    "sourceOperationIds": ["OP-a"],
    "targetOperationIds": ["OP-b"],
    "reason": "Une annulation acceptée contredit la clôture proposée."
  },
  "allowedChoices": ["keep-target", "take-source", "custom", "defer"],
  "resolutionRevision": "opaque-revision"
}
```

Les IDs de statuts de cet exemple sont des raccourcis illustratifs ; les vraies valeurs sont les IDs du workflow d’équipe. Les notes, auteurs, preuves de test et dépendances utiles sont ajoutés au contexte, avec indication explicite lorsqu’ils sont absents.

Le dossier local contient `context.json`, `base.md`, `source.md`, `target.md`, `proposal.md` et `resolution.json`. Un humain utilise son éditeur ; un agent reçoit le même JSON et propose un patch structuré. Le choix `take-source` reste soumis aux validations ; il ne contourne pas une référence invalide ou un format incompatible.

```sh
# Contrat CLI proposé
frame conflicts list --work WORK-uuid --json
frame conflicts show CF-uuid --json
frame conflicts open CF-uuid
frame conflicts resolve CF-uuid --choice keep-target --expected-revision REV --reason "Annulation maintenue"
frame integration check INT-uuid
frame integration apply INT-uuid
```

Une résolution porte sur des révisions exactes. Si la cible a changé, elle ne s’applique pas aveuglément : Frame recalcule le contexte et peut réutiliser une décision uniquement si ses entrées pertinentes et les contraintes restent identiques. Deux résolveurs simultanés sont départagés par précondition de révision, pas par dernier écrivain.

Le mode automatique emploie seulement des règles déterministes préconfigurées. Un agent peut proposer davantage, mais son score de confiance ne suffit pas à accepter une décision métier. Une politique explicite peut lui déléguer certaines classes de conflits ; défaut : décision humaine pour statuts contradictoires, suppressions et changements de portée. Le refus ou report conserve les propositions et ne bloque que l’intégration concernée.

Les résolutions acceptées et leurs motifs sont conservés dans le reçu portable. Les brouillons locaux non publiés ne sont pas envoyés automatiquement à un autre clone ; un paquet de résolution peut être explicitement exporté/importé avec ses versions.

## 11. Intégration de bout en bout

### Déclenchement

Un commit sur une branche de travail déclenche son checkpoint, **pas** son intégration dans `frame/main`. Une intégration automatique exige : source scellée, absence de mutations non incluses, preuve du rattachement au bon travail, code intégré vers la cible attendue, politique active et validations réussies.

Une simple égalité de nom de branche ou présence d’un SHA ancêtre ne suffit pas à prouver que toutes les propositions Frame ont été acceptées. Les merges distants par squash/rebase nécessitent une preuve explicite du fournisseur ou un reçu du parcours Frame. Un événement indique de vérifier l’état courant ; il n’est pas appliqué aveuglément ni plusieurs fois.

Les travaux sans code s’intègrent par une demande explicite `frame integration request --kind data-only`. Une politique peut autoriser ce parcours sans revue, mais ne prétend pas qu’un merge de code l’a déclenché.

### Algorithme

1. Terminer ou classer les jobs de checkpoint source déjà en attente, puis fermer temporairement l’époque source aux nouvelles mutations pour la finalisation ; refuser si elle contient des modifications non checkpointées. Les drafts restent récupérables, mais ne sont pas intégrés.
2. Préparer la cible : ses mutations locales déjà validées sont sauvegardées dans un checkpoint autonome `integration-target` avant de fixer T. Un fichier brut, un index extérieur ou un état invalide bloque cette préparation ; aucun nettoyage forcé. Fixer ensuite B/S/T et les preuves ; calculer le delta sémantique.
3. Construire le candidat dans un espace de préparation, jamais dans le checkout accepté.
4. Appliquer les règles automatiques, produire les conflits restants et valider l’ensemble du graphe.
5. Si conflit, libérer les verrous et attendre une résolution contextualisée. Les autres travaux restent disponibles.
6. Avant publication, revérifier les têtes, les générations de travail source/cible (donc aussi les modifications non commitées), schéma, politique et preuves. Replanifier si nécessaire, avec retries bornés pour éviter une boucle infinie.
7. Produire un commit d’intégration contenant résultat et reçu ; avancer la cible sous précondition puis finaliser les fichiers de travail via le protocole de reprise.
8. Marquer l’époque source intégrée via le reçu faisant autorité, réconcilier les caches et notifier le suivi. Un échec de notification ne réapplique pas le merge.

Une finalisation peut être reportée en restant gelée, ou annulée via `frame integration abort INT-uuid`. L’annulation libère la réservation logique et conserve les dossiers de conflit/brouillons. Toute nouvelle mutation invalide les plans et résolutions dépendant de l’ancienne source. Le gel concerne tous les écrivains, y compris un checkpoint ou une intégration d’enfant vers le parent ; ceux-ci attendent ou imposent l’annulation du plan. Il n’est jamais réalisé par un verrou système tenu pendant la décision humaine.

Une intégration métier est globale sur son ensemble de changements : pas d’intégration silencieuse de 90 % en laissant 10 % contradictoires. Un utilisateur peut demander un découpage explicite en unités indépendantes, après validation de fermeture des dépendances et nouveaux reçus ; le découpage automatique est différé.

### Squash final et mises à jour de la base

Choix par défaut : **un squash final par époque de travail**, puis clôture. Le reçu conserve workId, B/S/T, snapshot source, checkpoint de code, opération IDs, décisions, empreinte du résultat et preuve du merge de code. Le commit cible contenant le reçu donne son OID de résultat, sans référence circulaire dans son propre contenu.

Git squash ne conserve pas le second parent d’un merge ordinaire. Il ne suffit donc pas à reconnaître de futures intégrations de la même branche. [Documentation Git merge](https://git-scm.com/docs/git-merge).

Le reçu sur la cible fait autorité pour la clôture ; le registre local en est une projection. La source reste immuable à S : aucun commit de clôture n’y est ajouté après l’intégration. Une association historique arrivée tardivement suit le parcours `history-only` vers l’autorité cible, avec preuve de son origine, sans écrire sur la source fermée.

Après squash, une poursuite de travail crée une nouvelle époque/branche Frame depuis la cible à jour ; l’ancienne reste consultable. Ne pas continuer à réintégrer aveuglément la branche déjà squashée. Les têtes sources à conserver sont épinglées sous des références d’archive gérées ; un SHA écrit dans un JSON ne protège pas à lui seul un objet Git contre le nettoyage. La publication/rétention de ces références est explicite ; ne pas supprimer les dernières sources avant confirmation des sauvegardes nécessaires.

Pour rafraîchir une branche active depuis sa cible, utiliser le même moteur sémantique, puis un vrai commit de merge à deux parents dans la branche Frame. Pas de rebase automatique des commits Frame partagés. En cas de bases multiples ambiguës après des merges manuels complexes, demander une base vérifiée plutôt que choisir arbitrairement la première.

### Travail empilé et sous-agents

Un enfant créé depuis un travail parent possède `parentWorkId` et une base Frame correspondante. Il s’intègre vers ce parent, pas directement vers `frame/main`. Son reçu et ses changements deviennent ensuite une partie du travail parent. Les identités d’opérations évitent le double comptage.

Si le code d’un enfant est intégré directement dans main, le ciblage Frame est recalculé explicitement avec les dépendances héritées ; Frame n’accepte pas implicitement tout le travail du parent. Si le parent est abandonné, les enfants sont suspendus pour retarget/rebase métier explicite, pas supprimés.

## 12. Pilotage automatique et publication distante

Le pilotage est une machine à états persistée, pas une succession de hooks avec des effets cachés.

```text
Mutation : accepted-local → waiting-checkpoint → checkpointed
Pairing  : snapshot-sealed → code-observed → frame-published → complete
Merge    : requested → prepared → conflicts | ready → applied → synced
Échec    : étape courante → retryable | needs-resolution | needs-repair
```

Chaque job conserve identifiant, entrées figées, tentatives, erreur exploitable et prochaine action. Au redémarrage ou lors de `frame reconcile`, le coordinateur inspecte le résultat avant de réessayer. Les notifications différées ne sont pas la source de vérité.

| Automatisme par défaut dans le mode activé | Limite |
|---|---|
| Découvrir/créer la liaison lors d’une première mutation | Ne pas adopter un dossier inconnu non vide |
| Produire le checkpoint après commit associé | Aucun réseau, aucune suppression de mutation tardive |
| Actualiser le suivi global | Provenance et fraîcheur toujours visibles |
| Préparer une intégration après merge de code vérifié | Ne pas accepter une source différente de celle prouvée |
| Accepter les fusions déterministes validées | Ne pas choisir un statut contradictoire |
| Reprendre une étape interrompue | Identité d’opération et préconditions conservées |
| Nettoyer les caches reconstructibles | Pas les drafts, sources uniques ou décisions non publiées |

Le push automatique est un réglage explicite, désactivé initialement. Une fois activé, il concerne des références et destinations déclarées, après checkpoint/intégration, avec temporisation et retry réseau borné. Un hook de commit ne l’exécute jamais en ligne.

`frame sync` effectue fetch, comparaison des références, plan de réconciliation puis push. Un push refusé pour avance distante déclenche une nouvelle lecture et une fusion métier ; aucun `pull` aveugle sur des fichiers sales, aucun force-push de confort. Si le serveur le supporte et les droits le permettent, un push atomique peut publier plusieurs références ensemble ; ce n’est pas une garantie disponible partout. [Documentation Git push](https://git-scm.com/docs/git-push).

Le mode distribué conseillé utilise une file d’intégration et un écrivain désigné pour le `frame/main` distant. Les clones publient leurs branches de proposition ; les changements effectués directement sur leur main local sont réconciliés comme propositions en cas de divergence. Un non-fast-forward protège le remote contre la perte de commits, mais pas contre une décision métier contradictoire : le moteur doit toujours intervenir.

Une PR de code peut être fusionnée sur GitHub avant la synchronisation Frame. Afficher `code-integrated / frame-pending`, puis réparer. Aucun hook local ne peut garantir l’atomicité de cette action distante. Une politique CI peut demander la présence d’un checkpoint source avant merge, sans prétendre atomiser les deux historiques.

La synchronisation Linear importe vers l’autorité Frame acceptée via les mêmes règles. Les branches de travail ne publient pas indépendamment leurs propositions vers Linear. Les changements Linear apparus pendant un travail deviennent des changements de cible à résoudre à l’intégration.

## 13. Catalogue des cas limites et décisions

| Problème | Solution retenue / résultat visible |
|---|---|
| Travail direct sur main | Checkpoint vers frame/main ; serialisation locale, pas de branche artificielle obligatoire |
| Aucun changement Frame pendant un commit code | Checkpoint de liaison uniquement, avec même état métier |
| Modification Frame après scellement | Conservée hors du checkpoint courant ; génération suivante |
| Fichier brut invalide | Diagnostic et espace à réparer ; aucun objet silencieusement ignoré |
| Éditeur humain + agent dans la même branche | Brouillon/révision/verrou court ; conflit local explicite |
| Deux branches éditent le même objet | Isolation pendant le travail ; fusion métier à l’intégration |
| Création simultanée d’issues | UUID internes + alias provisoires, attribution finale par autorité |
| Suppression puis ancienne édition | Tombstone ; résolution explicite, pas résurrection |
| Hook absent/binaire indisponible | Code commité possible ; couverture manquante signalée et rattrapage non mensonger |
| Hook échoue après code commité | Job en attente, retry idempotent ; code jamais annoncé annulé |
| Signature Git refusée | État pending, aucune publication de remplacement non signé automatique |
| Commit amendé/rebase | Événement de correspondance ancien/nouveau ; provenance historique préservée |
| Cherry-pick partiel | Aucun transfert automatique de toutes les données de la branche source |
| Fast-forward / merge GitHub | Réconciliation indépendante du seul post-commit ; preuve de cible nécessaire |
| Squash code | Mapping fournisseur/reçu ; pas de comparaison SHA source = SHA résultat |
| Revert de code | Nouveau travail de correction Frame proposé ; pas d’annulation automatique des décisions humaines ultérieures |
| Reset/force-push externe | Détection de réécriture, suspension de l’automatisme concerné ; réparation explicite |
| Branche renommée | Liaison stable par workId, alias de ref mis à jour |
| Nom de branche réutilisé | Nouvelle époque ; aucune réutilisation des reçus anciens |
| Detached HEAD | Lecture possible ; mutation nécessite une association explicite ou branche créée |
| Même branche forcée dans deux worktrees | Refus d’un second écrivain propriétaire ; pas de contournement `--force` |
| Changement de branche avec .frame déjà monté | Vérification identité, sauvegarde/montage coordonné avant nouvelle mutation |
| Suppression d’un worktree parent | Préserver/démonter l’enfant données d’abord ; références et drafts conservés |
| Anciennes branches contenant .frame suivi | Migration/refus de montage sur ces chemins ; jamais absorber le stock dans le commit code |
| Registre perdu | Reconstruction des liaisons à partir de Git et métadonnées ; runtime non commité distingué |
| Branche source disparue après squash | Reçu + référence d’archive ; alerte si la dernière copie n’est plus disponible |
| Cible change pendant résolution | Plan invalidé ; reprise sur nouvelles versions |
| Deux intégrations simultanées | Publication cible sérialisée/CAS ; seconde replanifiée |
| Crash entre référence et checkout | Reprise depuis journal avant accès API ; fichiers bruts peuvent être temporairement incohérents |
| Espace disque plein | Arrêt explicite, état antérieur ou reprise ; aucune fausse réussite |
| Pas de réseau | Mutations/checkpoints locaux ; statut non synchronisé visible |
| Deux clones intégrateurs | Publication distante conditionnelle ; file/autorité recommandée, conflits conservés |
| Clone shallow/objets de base absents | Récupération des objets autorisés ou blocage contextualisé ; jamais base vide inventée |
| Version de schéma incompatible | Écriture et intégration suspendues jusqu’à migration compatible |
| Politique change pendant attente | Revalidation sous nouvelle politique, trace de son identité |
| Permissions distantes retirées | Pending/rejected distinct d’un objet supprimé ; pas de suppression locale automatique |
| Import Linear pendant travail | Mise à jour de la cible puis revalidation des branches |
| Sous-agents sur une même issue | Claims/exécutions distincts du statut ; parent responsable de l’intégration |
| Montage réseau / OS non validé | Garantie limitée aux environnements explicitement testés |

Ce catalogue couvre les scénarios identifiés, pas une preuve d’absence de tout cas inconnu. Un état non reconnu doit arrêter l’opération concernée avec contexte récupérable, sans choisir une résolution par défaut destructrice.

## 14. CLI et responsabilités d’implémentation

```sh
# Syntaxes proposées ; aucune n’est installée par cette étude.
frame workspace init --mode paired-branches
frame workspace status --json
frame work status --json
frame checkpoint --message "Clarification du besoin"
frame reconcile --json
frame view global --json
frame integration plan --work WORK-uuid --json
frame integration request --work WORK-uuid
frame conflicts list --json
frame sync --json
frame doctor --json
```

`frame sync` est un point d’entrée de transport à préciser pour distinguer Git et Linear ; ne pas livrer deux commandes homonymes ambiguës. Par exemple `frame sync git` et `frame sync linear` peuvent partager le même moteur de mutation. Les options finales devront être harmonisées avec la CLI existante.

| Module / port proposé | Responsabilité | Ne possède pas |
|---|---|---|
| WorkspaceResolver | Résoudre codeRoot, dataRoot, commonDir, workId | Les décisions métier de merge |
| MutationCoordinator | CAS, validation, journal et publication de mutations | Le réseau et l’éditeur |
| CheckpointCoordinator | Sceller, associer, publier et reprendre les checkpoints | L’acceptation du travail dans main |
| GitAdapter étendu | Worktrees, objets/refs/index privés, hooks et preuves Git | La résolution de statuts |
| SemanticMergeService | Comparer B/S/T, produire candidat et conflits | Les écritures disque directes |
| IntegrationCoordinator | Preuves, politique, reprise, reçu et publication | Une interprétation libre des conflits |
| ConflictService | Contexte, décisions conditionnelles, validation | Une préférence implicite humain/agent |
| GlobalProjection | Dédupliquer, agréger, afficher provenance et fraîcheur | Les mutations et choix de gagnants |
| SyncWorker | Fetch/push/connecteurs, retries, suivi distant | Une voie de contournement des règles métier |

Les chemins existants à faire évoluer sont le [conteneur CLI](../../apps/cli/src/container.ts), la [création des worktrees](../../apps/cli/src/commands/issue/worktree.ts), le [claim store](../../apps/cli/src/worktrees/claim-store.ts), le [repository filesystem](../../packages/fs/src/realm.repository.ts), les [compteurs](../../packages/fs/src/config/state.manager.ts), les ports core et le [GitAdapter](../../packages/git/src/git.adapter.ts). L’état actuel stage les entités en best effort et ne fournit ni checkpoint associé, ni transaction de fusion sémantique.

## 15. Migration et critères d’acceptation

Migration proposée : inventorier toutes les copies `.frame` et leurs divergences ; fixer l’état accepté par comparaison explicite ; sauvegarder les sources ; initialiser l’historique Frame indépendant ; retirer le suivi des anciens chemins dans le code ; monter les branches de données et enregistrer les liaisons ; installer les hooks composés ; vérifier que chaque branche ancienne est reconnue comme ancienne avant autorisation d’écriture. Ne pas déployer les hooks avant la compatibilité du format et la reprise de transactions.

Ordre de réalisation recommandé :

1. Identités, résolution des racines et mutations sûres dans un espace.
2. Branches associées, registre, montage et suivi local/global avec provenance.
3. Snapshots scellés, checkpoints, hooks et reprise après échec.
4. Merge sémantique, dossiers de conflit et squash terminal avec reçus.
5. Preuves d’intégration code, worker automatique, synchronisation distante.

Avant toute annonce de fiabilité, exécuter des tests d’acceptation réels :

- Deux processus écrivent dans la même branche sans perte ; deux branches restent isolées et visibles globalement.
- Une mutation entre snapshot et post-commit reste en attente et n’entre pas dans le mauvais checkpoint.
- Commit annulé, `--no-verify`, trailer retiré/copié, hooks absents, amend et rebase ne produisent aucune association exacte inventée.
- Interruption à chaque étape : scellement, commit code, commit Frame, avancement de ref, mise à jour du checkout, reçu, notification et push.
- Modification de cible pendant une résolution ; deux intégrations concurrentes ; retry après acquittement perdu.
- Conflits de statut, suppression, milestone/projet, dépendances, Markdown et format inconnu produisent un dossier exploitable identique en CLI humaine et JSON agent.
- Squash terminal suivi d’un nouveau travail ne réapplique pas les opérations anciennes ; archives réellement récupérables après clone/nettoyage contrôlé.
- Merge GitHub squash/rebase, fast-forward et événements redélivrés sont vérifiés sans simple comparaison de noms.
- Référence distante avancée, permissions insuffisantes et mode hors ligne conservent le travail et donnent un état exact.
- Les commandes depuis un worktree lié, les chemins avec espaces, changements de branche et suppression du parent conservent le bon montage.

Cette étude a vérifié les points d’entrée et les limites du code actuel ainsi que les primitives Git dans leur documentation officielle. **Le protocole proposé n’a pas été implémenté ni soumis à ces tests.** Les expériences isolées rapportées dans 04/05 démontrent des comportements existants, pas les garanties de cette cible.

## Proposition finale

Adopter les branches Frame associées, avec un suivi global fondé sur les deltas et leur provenance. Sceller les données avant le commit de code, publier un checkpoint lié après son succès, puis intégrer automatiquement les changements déterministes lorsqu’une preuve de merge est disponible. Pour tout conflit d’intention, conserver base/source/cible, expliquer l’impact et recevoir une décision conditionnelle par la même interface humaine ou agent. Ce système automatise la coordination ; il ne prétend pas deviner les décisions métier ambiguës.
