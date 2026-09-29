# Collaboration et automatisation : reprendre les usages Linear depuis la CLI

29 septembre 2026. Cible : **mêmes usages et mêmes objets que Linear pour le périmètre utile à Frame**, avec accès CLI et stockage local. Code inspecté : `451914f`. Cette révision remplace les propositions précédentes ; aucune connexion, automation ou synchronisation n'est exécutée ici.

Les commandes proposées prolongent [le modèle commun](01-modele-local.md) et [les lectures de pilotage](02-pilotage-calcule.md). Un nom de commande est une proposition d'interface Frame, pas une commande native Linear.

## 1. Périmètre utile et fidélité attendue

| Usage Linear | Cible CLI Frame | Ce qui manque aujourd'hui | Valeur |
|---|---|---|---|
| Commenter et suivre du travail | Commentaires, fils, mentions, abonnements | Notes dans les traces seulement | Garder les échanges avec les objets |
| Inbox et notifications | Lire, marquer lu, suivre, consulter les rappels | Pas d'inbox | Ne pas devoir rescanner toutes les issues |
| Cycles et travail récurrent | Cadence, report, occurrences et rappels | Pas de scheduler | Reprendre le rythme d'équipe |
| Triage et demandes | Accepter, différer, assigner et router | Pas de file d'admission | Organiser le travail avant sa planification |
| Liens PR et transitions Git | Connecter les événements aux objets et workflows | Git/worktrees locaux uniquement | Réduire la double saisie |
| Synchronisation | Import, lecture distante et échange de modifications | Intégration annoncée mais non livrée | Utiliser Linear et Frame sur le même travail |
| Agents | Délégation et exécution traçable | Contexte et claims, pas de runner d'agent | Exécuter depuis la CLI avec un résultat vérifiable |
| Fonctionnement partagé | Identité, permissions et révisions | Acteurs déclaratifs et fichiers | Coordonner plusieurs machines si nécessaire |

SLA, Customer Requests, releases et automatisations avancées sont des extensions du périmètre, pas des concepts à réinventer. Présence, édition simultanée, SSO/SCIM et administration Enterprise ne sont pas requis pour une première CLI locale ; leur absence reste déclarée. Sources fonctionnelles : [Comments](https://linear.app/docs/comment-on-issues), [Notifications](https://linear.app/docs/notifications), [Cycles](https://linear.app/docs/use-cycles), [Triage](https://linear.app/docs/triage), [GitHub](https://linear.app/docs/github).

## 2. Synchronisation Linear ↔ Frame : un modèle commun d'abord

La synchronisation n'est plus une option ajoutée après un modèle différent. Les objets retenus doivent avoir une correspondance connue dès leur définition.

| Linear | Frame cible | Politique |
|---|---|---|
| Workspace, users, teams | Realm/workspace, users, teams | Mapping d'identité ; pas de mapping par nom seul |
| Workflow states, labels, estimates | Configuration et identités du modèle local | Préserver scopes, catégories et réglages |
| Initiatives et parents | Initiatives et relations de parents | Préserver parents multiples ; signaler restrictions du plan distant |
| Projects / milestones | Projects / milestones | Un jalon reste dans son projet |
| Issues / relations / cycles | Mêmes concepts locaux | Importer sans imposer les anciennes gates strictes de Frame |
| Documents | Documents Markdown | Titre, corps, rattachement et identité ; valider fidélité de l'éditeur |
| Project/initiative updates | Updates | Santé et publication distinctes du statut métier |
| Comments | Comments et fils | Conserver auteur distant et identité de la source |
| Archives/suppressions | Métadonnées de cycle de vie | Ne pas interpréter l'absence d'un résultat comme suppression |

Source technique : [API GraphQL Linear](https://linear.app/developers/graphql). Cette table fixe l'objectif de mapping, pas la preuve que chaque champ est modifiable par API. Avant implémentation, établir pour chaque objet une matrice lecture/création/édition/suppression, permissions, pagination et événements réellement disponibles.

### Parcours CLI cible

```sh
frame linear connect --name company
frame linear capabilities --connection company
frame sync plan --connection company --direction pull
frame sync apply --plan sync-plan-001
frame sync status --connection company
frame sync plan --connection company --direction bidirectional
frame sync conflicts list
frame sync conflicts resolve CONFLICT-001 --take linear
```

`connect` associe des identités et des credentials stockés hors Git. Le plan est lié à une connexion, un realm et des révisions ; son application refuse les bases devenues obsolètes. Le mode bidirectionnel n'est proposé que pour les objets dont le contrat est validé. `capabilities` montre ce qui est disponible, interdit ou non implémenté.

L'import initial puis les lectures incrémentales constituent une première livraison possible. L'objectif final reste le même modèle ; ce découpage ne justifie pas de perdre les champs non encore éditables. Un mode lecture seule les conserve et explique ses limites.

### Conflits, reprise et source d'autorité

Conserver pour chaque paire d'objets une base de synchronisation. Une modification d'un seul côté peut être propagée ; deux modifications concurrentes d'un même champ produisent un conflit inspectable. Ne pas fusionner les corps Markdown avec un simple « dernier horodatage gagne ».

La source d'autorité est explicite par type/champ lorsque le mode est unidirectionnel. Importer les références avant de résoudre les relations. Garder les checkpoints de pagination et les identifiants d'opération pour reprendre sans duplication. Les suppressions, restrictions d'accès et erreurs temporaires sont des situations différentes.

La CLI doit montrer les champs non représentables et l'impact du mapping. Un export ne supprime jamais une information distante parce qu'elle n'était pas présente dans une réponse partielle.

**Preuve attendue :** import puis réimport sans doublon ; aller-retour sans perte sur le périmètre validé ; conflit simultané ; changement d'équipe ; permissions réduites ; reprise après interruption.

## 3. Synchroniser une spec en tant que document

```sh
frame document new --project PROJ-0001 --title "Spec — onboarding" --template project-spec
frame sync plan --connection company --direction push --type document --id DOC-0001
frame document show DOC-0001 --source
frame sync plan --connection company --direction pull --type document
```

Un document Linear importé devient un document Frame, qu'il s'agisse d'une spec, de notes ou d'un runbook. Le template ne crée pas un nouveau type d'entité distant. Source : [Documents](https://linear.app/docs/documents).

| Donnée | Synchronisation cible |
|---|---|
| Titre, contenu, rattachement | Champs communs, conversion vérifiée |
| ID, auteur, dates | Provenance/mapping ; ne pas prétendre pouvoir réécrire l'auteur ou l'historique distant |
| Ancien statut de Spec | Extension Frame préservée ; pas de faux statut de document Linear |
| Anciennes relations de remplacement | Extension et éventuellement liens lisibles, sans sémantique distante inventée |
| Règles exécutables/prompt Frame | Configuration locale explicite ; aucune activation automatique à l'import |
| Commentaires, pièces jointes, versions | Capacités distinctes ; couverture annoncée, pas supposée par le seul transfert du corps |

Si les métadonnées propres à Frame restent locales, un nouveau clone qui importe seulement Linear ne les récupère pas : ce n'est pas une sauvegarde complète de Frame. Une publication lisible de ces métadonnées peut être choisie, mais elle n'est pas un aller-retour structuré garanti. La capacité à préserver tableaux, mentions, pièces jointes et liens doit être testée ; ne pas annoncer une conversion sans perte de tout l'éditeur riche à partir d'un exemple Markdown simple.

**Valeur.** La spec trouve sa place dans les deux outils sans imposer un workflow différent aux utilisateurs Linear.

## 4. Commentaires, mentions, abonnements et inbox

```sh
frame comment add --issue ENG-101 --body-file ./question.md
frame comment list --issue ENG-101
frame comment reply COMMENT-001 --body "Le problème est reproduit sur le tenant de test."
frame comment resolve COMMENT-001
frame issue subscribe ENG-101
frame inbox list --unread
frame inbox read NOTIFICATION-001
```

Reprendre fils, résolution, mentions et abonnements comme usages distincts. Une note de trace ne devient pas un commentaire éditable. Les notifications personnelles ne sont pas stockées dans un fichier commun marquant l'objet « lu pour tout le monde ». Sources : [Comments](https://linear.app/docs/comment-on-issues), [Notifications](https://linear.app/docs/notifications).

En mode synchronisé, définir si l'inbox affichée est locale ou distante et si son état de lecture peut être propagé via l'API. Ne pas annoncer la synchronisation d'une inbox distante avant vérification du contrat. Éviter d'émettre deux notifications pour la même mention locale ensuite réimportée.

Les pièces jointes, annotations inline et historique documentaire peuvent être livrés plus tard ; leur contenu doit rester accessible ou référencé sans perte silencieuse. Le rendu CLI n'a pas besoin de curseurs collaboratifs pour rendre commentaires et réponses utiles.

**Preuve attendue :** réponse importée dans le bon fil, auteur conservé comme provenance, mention répétée non redélivrée, visibilité respectée.

## 5. Cycles, récurrence, rappels et archivage

```sh
frame team cycles configure ENG --duration-weeks 2 --timezone Europe/Paris
frame cycle current --team ENG
frame issue recurring create --team ENG --template weekly-review --schedule weekly
frame update reminders configure --project PROJ-0001 --schedule weekly
frame automation run --due --dry-run
frame automation run --due
frame automation status
```

La syntaxe de cadence reste à détailler : jour/heure, début de cycle, cooldown et politique de rattrapage doivent être visibles, pas cachés dans un défaut ambigu. Un runner local reprend les règles retenues de Linear pour cycles/report, récurrence, rappels et éligibilité à l'archivage. Sources : [Cycles](https://linear.app/docs/use-cycles), [Create issues](https://linear.app/docs/creating-issues), [Updates](https://linear.app/docs/initiative-and-project-updates), [Delete and archive](https://linear.app/docs/delete-archive-issues).

La reprise après arrêt est une contrainte locale Frame : elle ne justifie pas de changer la date d'occurrence ou de dupliquer les issues. Définir ce qui est dû et ce qui doit être rattrapé ; reprendre l'occurrence logique, pas la date de redémarrage.

**Un seul exécuteur par règle.** Si Linear crée les cycles ou les issues récurrentes, Frame importe les résultats et ne les recrée pas. Si Frame est propriétaire de l'automatisation, il publie les mutations autorisées. Cette responsabilité est enregistrée et visible dans `automation status`.

Archivage automatique conforme ; commandes de consultation/restauration côté CLI. Ne pas faire d'une commande manuelle `archive` un raccourci vers un comportement que Linear ne propose pas. La clôture immédiate parent/enfants peut rester dans le cas d'usage local lorsque configurée ; elle ne nécessite pas toujours un processus permanent.

**Valeur.** Même rythme de travail dans les deux environnements, sans tâches répétées en double. **Preuve attendue :** fuseau, heure d'été/hiver, cooldown, arrêt prolongé, deux runners et changement de propriétaire d'automatisation.

## 6. Triage et collecte des demandes

```sh
frame issue list --team ENG --status-category triage
frame triage accept ENG-104 --status Todo --assignee USER-ELY
frame triage snooze ENG-104 --until 2026-10-07
frame triage duplicate ENG-104 --of ENG-101
frame intake list --source slack
```

L'entrée est une issue d'équipe avant d'être un travail de projet. Le routage, le snooze et le traitement des doublons suivent les usages Linear retenus. Les actions et mutations API exactes restent à confirmer. Sources : [Triage](https://linear.app/docs/triage), [Linear Asks](https://linear.app/docs/linear-asks).

Pour un connecteur, conserver l'ID du message, sa source et son auteur rapporté. Le titre n'est pas une clé de déduplication ; un message modifié ne crée pas une seconde issue. Si Linear Asks collecte déjà la demande, importer son résultat au lieu de déployer un second intake concurrent.

Customer Requests et SLA restent différés jusqu'à un usage réel de support/feedback. Leur activation doit reprendre les objets et comportements Linear, pas encoder un client dans un label ad hoc. Une réponse à l'extérieur est une action configurée distincte de la simple ingestion.

**Valeur.** Retrouver le flux d'admission du travail depuis un terminal, sans imposer un projet « Divers ».

## 7. PR, commits et releases

```sh
frame issue links ENG-101
frame integration status --provider github
frame integration events --issue ENG-101
frame automation explain --event EVENT-001
```

La cible reprend les liens Git et les automatismes de statut configurés, avec prise en compte de la branche cible. Ne pas imposer partout « PR fusionnée = issue terminée ». Les refus ou ambiguïtés de mapping restent visibles. Source : [GitHub](https://linear.app/docs/github).

Si Linear reçoit déjà les événements Git, Frame peut synchroniser les statuts et liens résultants. Si le connecteur Frame les traite, désigner cet acteur comme propriétaire de la règle pour éviter les boucles. Une référence de PR inclut fournisseur et dépôt ; son numéro seul ne suffit pas.

Les releases peuvent être ajoutées lorsque le suivi de livraison est utile, avec reprise des concepts Linear et raccordement CI/CD. Elles ne sont pas assimilées aux milestones ni aux releases du binaire Frame. Source : [Releases](https://linear.app/docs/releases).

**Preuve attendue :** plusieurs PR, fermeture sans merge, événement répété/hors ordre, changement de branche cible et propagation via Linear sans double mutation.

## 8. Agents et automatisations avancées

```sh
frame brief --issue ENG-101
frame issue worktree ENG-101
frame agent run --issue ENG-101 --executor configured-agent
frame agent runs --issue ENG-101
```

Briefs, worktrees et claims restent des facilités locales spécifiques à Frame ; ils ne deviennent ni de nouveaux statuts ni des projets artificiels dans Linear. L'exécution doit être identifiable séparément de l'issue, avec état, tentatives, résultat et artefacts. Une fin de processus n'est pas une validation métier.

La délégation native à des agents et les Loops Linear sont des références possibles si ce besoin est retenu. Ne pas prétendre reproduire ces produits avec quelques commandes de shell ; commencer par une action concrète et un exécuteur explicite. Sources : [Agents API](https://linear.app/developers/agents), [Loops](https://linear.app/docs/loops).

Le résultat peut être publié comme commentaire/lien ou via une session d'agent si le contrat distant le permet. Les instructions Frame locales ne doivent pas se glisser dans le document synchronisé comme une autorisation distante implicite.

**Valeur.** Préserver l'avantage local de Frame tout en gardant Linear compréhensible pour une équipe qui n'utilise pas l'agent.

## 9. Exécution fiable : adaptation au local, pas nouveau modèle métier

| Mode | Usage | Limite explicite |
|---|---|---|
| Commande ponctuelle | Synchroniser/traiter les actions dues à la demande | Rien ne s'exécute entre deux appels |
| Runner local | Surveiller et exécuter sur une machine | Arrêt de la machine → reprise ultérieure |
| Service partagé | État canonique et exécution continue | Identité, droits, exploitation et coordination nécessaires |

Recommandation d'intégration : une opération ponctuelle rejouable, puis son ordonnanceur. Un serveur Board ne devient pas implicitement un service toujours actif. Le mode CLI reste utilisable sans hébergement.

Les [cas d'usage actuels](../../packages/core/src/use-cases/record-trace.ts) ne garantissent pas une transaction entre objet et trace. Avant effets externes : journal durable d'intention, révision attendue, événement identifié et reprise après crash. Une écriture atomique d'un fichier n'est pas une transaction multi-fichiers.

Chaque événement conserve source, origine et causalité pour éviter les boucles. Une clé d'idempotence identifie l'occurrence d'une action. Si un fournisseur reçoit l'effet mais que sa réponse est perdue, enregistrer un résultat incertain et réconcilier avant renvoi ; la garantie dépend du connecteur. Pas de promesse universelle « exactement une fois ».

Un watcher constate un changement de fichier, pas une intention métier. Changement de branche, migration et import ne doivent pas déclencher une nouvelle rafale de notifications. Les effets sortants ciblent un realm et une révision opérationnelle désignés.

## 10. Stockage et frontières d'intégration

| Données / responsabilité | Emplacement cible |
|---|---|
| Objets partagés : documents, commentaires, updates, relations | Markdown versionné dans le realm, comme dans [l'exemple](01-modele-local.md) |
| Configurations d'équipe et règles partageables | Données versionnées avec IDs et paramètres explicites |
| Mapping d'identité distant | Métadonnées de liaison sans secret ; partage contrôlé entre clients du même realm |
| Checkpoints, bases de sync, tentatives et livraisons | Stockage runtime privé durable, lié au realm/connexion ; protocole de récupération |
| Credentials et tokens | Stockage de secrets hors Git et hors traces |
| Cache de lecture | Reconstruisible, jamais source des objets métier |
| Mutations | SDK → core → fs ; le connecteur ne réécrit pas directement les Markdown |
| Transport/API fournisseurs | Adaptateurs concrets, hors core |
| CLI | Plan, application, statut, inspection de conflits et reprise |

Les writers CLI, SDK et serveur doivent partager les garanties de concurrence. Une queue uniquement dans le serveur ne protège pas des écritures d'un autre processus. Les claims actuels sont propres à un clone ; ils ne représentent pas une attribution globale entre machines.

Une équipe privée Linear importée dans un dépôt lisible par tous perdrait sa confidentialité. Limiter le périmètre d'import ou séparer les stockages ; ne pas prétendre reproduire les permissions d'un service dans une copie intégrale Git distribuée à tous.

## 11. Critères de livraison et périmètres différés

Chaque tranche doit indiquer : usage Linear reproduit, commandes CLI, objets synchronisés, autorité de chaque action, pertes éventuelles et preuves de rejeu/conflit. Un champ non supporté doit être conservé ou explicitement exclu avant application, jamais supprimé silencieusement.

Ordre de dépendance suggéré, sans imposer une roadmap : modèle commun et Document ; import/lecture ; mutations synchronisées ; commentaires/updates ; cadence et notifications ; connecteurs et agents selon les besoins. Les fonctionnalités spécialisées et la coédition temps réel restent à justifier par un usage.

Le contrat d'alignement vient de la demande utilisateur ; le protocole, les commandes et le format exact restent à valider avant implémentation. Aucun test runtime Linear, envoi ou déploiement n'a été effectué pour cette révision.
