# Recherche — Éditions concurrentes et stockage Markdown

**Application à la nouvelle cible :** le [design global 06](06-design-global-branches-frame.md) applique ce protocole d’écriture dans chaque branche Frame et ajoute une intégration sémantique entre branches. La racine partagée unique décrite ici correspond à l’option initiale ; les exigences de concurrence locale restent valables.

Date : 2026-09-29. État inspecté : `451914f`. Statut : recherche et proposition, sans implémentation du protocole décrit ci-dessous.

Cette étude complète [les worktrees et l’état partagé](04-worktrees-et-etat-partage.md), le [modèle local](01-modele-local.md) et les [services actifs](03-services-actifs.md). Les commandes de la cible sont illustratives et ne sont pas disponibles aujourd’hui.

## Conclusion

Conserver les `.md` comme source de vérité est compatible avec plusieurs agents et un humain. En revanche, **plusieurs programmes qui réécrivent librement ces fichiers ne constituent pas un stockage concurrent sûr**. Il faut un protocole commun à tous les écrivains.

Je recommande un stockage canonique partagé, des mutations courtes sérialisées par realm, une révision attendue et des brouillons pour les éditions longues. L’utilisateur garde son éditeur et lit des fichiers ordinaires. La publication d’une modification passe par Frame, qui peut refuser une sauvegarde obsolète et présenter un conflit sans perdre le brouillon.

Le brouillon ne réserve pas l’issue : pendant sa rédaction, un autre acteur peut changer son statut. Le claim de travail réserve une tentative d’exécution ; il ne verrouille pas le contenu métier.

Ne pas utiliser une base de données rend les données faciles à lire et versionner. Cela ne simplifie pas automatiquement les transactions : nous devons alors en assumer une partie dans l’adaptateur de fichiers. La documentation de [SQLite sur l’atomicité](https://sqlite.org/atomiccommit.html) illustre notamment le rôle du journal et de la reprise après interruption. Il n’est pas nécessaire de remplacer les Markdown par SQLite pour appliquer ces principes.

## 1. Ce qui existe et ce qui manque réellement

| Point inspecté | Comportement actuel | Conséquence |
|---|---|---|
| [`EditIssueUseCase`](../../packages/core/src/use-cases/edit-issue/edit-issue.ts) | Lit une issue, copie son état, modifie les champs demandés, sauvegarde l’objet complet | Un patch CLI devient une réécriture basée sur une lecture potentiellement ancienne |
| [`SetIssueStatusUseCase`](../../packages/core/src/use-cases/set-issue-status/set-issue-status.ts) | Même séquence lecture, validation, sauvegarde, puis trace | Validation et publication ne sont pas une transaction |
| [`FsRealmRepository`](../../packages/fs/src/realm.repository.ts) | Écriture directe des fichiers sérialisés ; trace séparée ; staging Git | Ni précondition de version, ni publication atomique de toute une mutation métier |
| [`IRealmRepository`](../../packages/core/src/ports/realm-repository/realm.repository.ts) | `saveIssue(issue): Promise<void>` | Le contrat ne permet pas d’exprimer « seulement si la version est toujours celle-ci » |
| [`StateManager`](../../packages/fs/src/config/state.manager.ts) | Lecture/incrément/écriture de `.state` | Collision ou perte d’incrément possible entre processus ; constat statique |
| [`WorktreeClaimStore`](../../apps/cli/src/worktrees/claim-store.ts) | Verrou et publication protégée des claims dans le Git common directory | Cette protection ne couvre pas les fichiers métier |

Le repository absorbe aussi certaines erreurs de lecture/parsing et retourne des absences. Dans la cible concurrente, un fichier invalide doit produire un diagnostic identifiable, pas une disparition silencieuse de l’objet.

### Reproduction exécutée : une modification humaine perdue

Une expérience isolée dans un répertoire temporaire a utilisé le véritable `FsRealmRepository`, `EditIssueUseCase` et `SetIssueStatusUseCase`. Un adaptateur de test impose cet entrelacement :

1. L’issue initiale a `status: not-started` et `priority: none`.
2. Les deux use cases lisent cette même version, avant toute sauvegarde.
3. L’humain enregistre `status: in-progress`.
4. L’agent enregistre `priority: high` à partir de sa copie initiale.

Résultat observé :

```json
{
  "final": { "status": "not-started", "priority": "high" },
  "lostHumanStatus": true
}
```

Deux traces sont présentes, dont une portant `to: in-progress`, alors que le fichier final a perdu ce statut. L’écriture d’un historique séparé n’empêche donc pas la perte de mise à jour.

Il s’agit d’un ordonnancement déterministe de deux use cases réels dans un processus, pas d’un test de charge multiprocessus. Le répertoire temporaire a été supprimé ; aucune donnée du realm de travail n’a été modifiée. Cette expérience prouve le défaut actuel, pas la fiabilité de la solution proposée.

## 2. Comparaison des approches

| Approche | Intérêt | Limite déterminante | Décision proposée |
|---|---|---|---|
| Écriture libre puis surveillance des fichiers | Compatible avec tous les éditeurs | Le watcher observe après coup ; impossible de récupérer systématiquement une version déjà écrasée | Lecture libre, mais pas garantie d’écriture concurrente |
| Git commit/merge pour chaque édition | Historique et fusion à trois versions | Des écrivains dans un même checkout peuvent se perdre avant le commit ; le merge ne valide pas le métier | Git conserve l’historique, pas le rôle de verrou métier |
| Verrou tenu pendant l’ouverture de l’éditeur | Raisonnement simple | Bloque les agents pendant des minutes/heures ; abandon et crash pénibles | Réservé aux opérations de maintenance |
| Verrou seulement autour de `writeFile` | Évite certaines collisions physiques | Une copie obsolète peut toujours écraser un changement récent | Insuffisant |
| Révision attendue sans verrou | Détecte une partie des divergences | Un autre écrivain peut intervenir entre la comparaison et l’écriture | Insuffisant sur des fichiers ordinaires |
| Verrou court + révision + brouillon | Édition longue sans bloquer ; conflit explicite | Protocole et reprise à développer | Choix recommandé |
| Service local seul écrivain | File d’attente, abonnements et cache centralisés | Cycle de vie du service, disponibilité et compatibilité clients | Évolution possible du même protocole |
| CRDT pour tous les champs | Collaboration textuelle en direct | Ne résout pas à lui seul transitions de statut, unicité et contraintes entre objets | Disproportionné pour le besoin initial |

L’approche proposée n’exige pas immédiatement un démon permanent. Une bibliothèque commune peut coordonner les processus CLI par un verrou interprocessus. Un futur service ne doit pas créer une seconde voie d’écriture non coordonnée.

## 3. Contrat de concurrence proposé

### Une frontière de mutation commune

```text
CLI / SDK / interface / synchronisation Linear
                    │
            commande métier + préconditions
                    │
          coordinateur de mutations du realm
          verrou court → relire → valider → publier
                    │
              Markdown canonique
                    │
          index reconstruisible / abonnements
```

La protection doit englober **lecture fraîche, vérification, contraintes métier, publication et journalisation**. L’ajouter uniquement dans le CLI laisserait le SDK, l’interface ou le connecteur contourner la garantie.

Commencer avec un verrou par realm simplifie les mutations portant sur plusieurs objets : déplacer une issue, supprimer un milestone, allouer un identifiant, vérifier des dépendances. Des verrous par objet introduiraient un ordre d’acquisition et des risques d’interblocage avant que nous ayons démontré un besoin de débit. Aucun benchmark n’a encore établi que le verrou global serait un problème pour Frame.

Le verrou est un fichier/objet de coordination stable hors des fichiers remplacés et commun à tous les worktrees. Son mécanisme précis doit être validé sur les OS supportés. Ne pas considérer un PID, un délai expiré ou un dossier `mkdir` comme une preuve suffisante qu’un propriétaire est mort : suspension, réutilisation de PID et récupération concurrente demandent un protocole. Périmètre initial recommandé : disque local et processus d’une même machine ; pas de promesse sur un partage réseau.

### Une révision attendue

Chaque lecture structurée retourne une révision opaque, distincte du statut métier et du commit Git. Proposition : empreinte forte des octets canoniques et génération gérée par Frame. La génération permet de distinguer une modification puis un retour au contenu précédent. Les importations doivent aussi incrémenter cette génération ; les modifications externes non observées restent hors garantie.

Le client renvoie `expectedRevision`. Sous verrou, Frame compare à la version actuelle et refuse la mutation si elle est obsolète. Une date `mtime` ou `updatedAt` seule n’est pas une précondition suffisante. L’analogie est celle de [`If-Match` dans HTTP](https://www.rfc-editor.org/rfc/rfc9110.html#name-if-match), destiné notamment à éviter les mises à jour perdues ; ici, la comparaison et l’écriture doivent en plus partager la même section critique filesystem.

Pour une commande interactive instantanée, Frame peut lire puis appliquer l’intention à la version fraîche dans cette section critique. Pour une décision d’agent prise après une lecture antérieure, conserver la révision attendue est essentiel : relire automatiquement puis appliquer aveuglément une ancienne décision masquerait son obsolescence.

Contrat d’API illustratif :

```ts
mutate({
  operationId: "unique-request-id",
  expected: [{ id: "ISSUE-0042", revision: "opaque-revision" }],
  command: { type: "SetIssueStatus", id: "ISSUE-0042", to: "in-progress" }
})
// => committed { revisions, operationId }
// => conflict { expected, actual, changedFields }
// => invalid { violations }
```

Les révisions portent sur les objets concernés, pas uniquement celui affiché. Les invariants impliquant d’autres objets sont revérifiés sous verrou. Un retry avec le même `operationId` retourne le résultat enregistré et ne crée pas une seconde trace. Une suppression conserve assez d’information pour refuser la résurrection par un brouillon ancien.

## 4. Éditer avec son éditeur, publier avec Frame

La proposition de copie éditable est adaptée. Je la traiterais comme une session d’édition durable et récupérable.

```bash
# Interface proposée, pas des commandes existantes.
frame edit begin --document DOC-0012 --json
# => editId, draftPath, baseRevision

$EDITOR /chemin/runtime/edits/EDIT-123/draft.md
frame edit diff EDIT-123
frame edit save EDIT-123 --json
# => committed, ou conflict avec chemins base/current/draft

frame edit resolve EDIT-123
frame edit save EDIT-123 --json
```

Une commande pratique `frame document edit DOC-0012` peut enchaîner ouverture de l’éditeur et sauvegarde. Le même mécanisme s’applique à une description d’issue ou de projet. Les commandes de propriétés restent plus rapides pour un changement de statut ou d’assignation.

| Élément de session | Rôle |
|---|---|
| `base.md` et révision de base | Version effectivement lue ; le client ne la réécrit pas |
| `draft.md` | Texte librement modifiable par l’utilisateur ou l’agent |
| Métadonnées de session | ID cible, auteur, opération, format, dates, état |
| `current.md` lors d’un conflit | Instantané du canonique au moment de la comparaison |
| Résolution proposée | Candidat de fusion encore non publié |

Les sessions résident dans l’espace local de fonctionnement du clone, hors des fichiers canoniques et de leur staging Git. Une interruption de l’éditeur ne supprime pas le brouillon. Le nettoyage doit distinguer sessions publiées et brouillons non sauvegardés ; pas d’expiration destructive automatique des seconds.

### Politique de fusion

Première version : une révision divergente provoque un conflit explicite. Une étape suivante peut proposer une fusion à trois versions : base, canonique courant, brouillon. [`git merge-file`](https://git-scm.com/docs/git-merge-file) fournit cette primitive textuelle ; il ne valide pas les propriétés du domaine.

| Situation | Résultat souhaité |
|---|---|
| Humain modifie le statut, agent modifie un paragraphe | Proposition conservant les deux, après validation |
| Deux acteurs changent le même statut différemment | Conflit explicite ; pas de priorité implicite à l’agent ou au dernier écrivain |
| Deux paragraphes indépendants changent | Fusion textuelle proposée, relue avant publication |
| Un champ change de part et d’autre vers la même valeur | Résolution possible après validation et gestion de l’idempotence |
| Projet de l’issue et milestone changent séparément | Revérifier que le milestone appartient au projet ; champs distincts ne signifie pas intentions compatibles |
| L’objet a été supprimé | Refus ; recréation uniquement comme action explicite |

Pour le frontmatter, comparer les champs parsés ; ne pas dépendre d’une fusion YAML ligne à ligne. Pour le corps, préserver le texte et proposer la fusion. Les marqueurs de conflit restent dans les brouillons : jamais dans le canonique. La résolution reste conditionnelle à la révision courante ; un troisième acteur peut intervenir pendant qu’on la prépare.

Les champs techniques (identité, révision, mapping distant) ne sont pas modifiables par simple changement du brouillon. Frame calcule un patch autorisé, puis applique ses règles métier.

## 5. Publication, crash et historique : trois garanties différentes

La documentation [Node filesystem](https://nodejs.org/api/fs.html) signale les risques d’appels concurrents à `writeFile` sur un même fichier. Elle décrit aussi les limites de `fs.watch`, notamment après remplacement d’un inode. `await` dans un processus ne coordonne pas les autres processus ; un watcher n’est pas un verrou.

Pour publier **un fichier**, écrire un temporaire voisin, le synchroniser selon le niveau de durabilité choisi, puis remplacer la destination évite d’exposer un fichier à moitié écrit. Le comportement Linux de [`rename`](https://man7.org/linux/man-pages/man2/rename.2.html) garantit le remplacement atomique dans son périmètre ; il ne constitue ni un compare-and-swap métier, ni une transaction multi-fichiers. Le temporaire doit rester sur le même filesystem. Les garanties de crash et synchronisation des répertoires doivent être vérifiées sur chaque OS supporté, pas extrapolées de Linux à macOS/Windows.

Une opération Frame peut toucher issue, trace et compteur. Trois renommages atomiques ne les rendent pas collectivement atomiques.

Protocole cible à détailler avant implémentation :

1. Acquérir le verrou du realm et terminer toute reprise inachevée.
2. Relire les objets, comparer les préconditions et valider l’ensemble des contraintes.
3. Préparer les nouvelles représentations et un journal de transaction durable contenant opération, versions et résultats attendus.
4. Publier les fichiers préparés ; enregistrer le point de commit selon le protocole de reprise choisi.
5. Enregistrer les nouvelles révisions et le résultat idempotent ; libérer le verrou après finalisation cohérente.
6. Invalider l’index et notifier les lecteurs après commit. Traiter le snapshot Git comme une étape explicitement suivie.

Le journal doit permettre une reprise déterministe après chaque interruption : terminer ou annuler, sans mélange accepté comme résultat final. L’ordre précis des écritures, flush et points de commit reste à spécifier et tester. Ce document ne prétend pas qu’un simple journal JSON résout la durabilité.

Pour la première version, les lectures structurées participent au protocole afin de ne pas observer une transaction partielle. Un lecteur externe qui parcourt directement plusieurs `.md` pendant leur remplacement peut voir deux instants différents : **aucune promesse de snapshot multi-fichiers pour les lecteurs libres**. Une publication par générations et bascule de manifeste pourrait fournir un snapshot aux lecteurs qui suivent ce manifeste, au prix d’une structure moins directe. Ce coût n’est pas justifié initialement.

Le journal est un mécanisme de reprise, pas une seconde base métier à maintenir en parallèle : après récupération, les `.md` restent la référence lisible. Un index mémoire suffit initialement ; un cache SQLite éventuel doit rester entièrement reconstruisible.

Un échec du commit Git après la publication ne doit pas faire croire que la mutation métier n’a pas eu lieu. Retourner son résultat et signaler le snapshot en retard, puis le reprendre sans rejouer la mutation. Dans le worktree de données dédié, seul le coordinateur possède l’index ; aucun staging général d’un checkout de développement.

## 6. Peut-on encore éditer directement le fichier canonique ?

Oui pour un usage manuel hors concurrence, mais il faut distinguer deux contrats.

- **Mode normal coordonné** : lecture libre, mutations via commandes/SDK, édition longue via brouillon. C’est le mode bénéficiant des garanties annoncées.
- **Mode maintenance** : arrêter les écrivains, obtenir une réservation exclusive du realm, éditer/importer les fichiers, valider tout le graphe et renouveler les révisions avant reprise. Cela couvre aussi les resets/restaurations Git et migrations du stock.

Si un éditeur externe ignore ce contrat pendant une sauvegarde, ni le verrou coopératif ni le watcher ne peuvent empêcher tous les écrasements. Le watcher peut détecter une divergence, suspendre les nouvelles mutations, conserver les versions connues et demander une réconciliation ; il ne peut pas promettre de retrouver des octets jamais observés.

Des permissions en lecture seule peuvent éviter des accidents, mais ne constituent pas une frontière absolue entre programmes utilisant le même compte système. Le produit doit expliquer le contrat ; il ne doit pas annoncer « Markdown librement éditable en parallèle et sans perte ».

Pour le watcher, surveiller les répertoires, invalider puis rescanner les objets concernés, et réconcilier périodiquement. Ne pas transformer les notifications filesystem en journal exhaustif d’événements métier.

## 7. Intégration dans Frame et ordre de réalisation

| Étape | Travail concret | Valeur apportée |
|---|---|---|
| 1 — Contrat | Introduire commande transactionnelle, préconditions, erreurs de conflit et identifiant d’opération dans les ports core | Tous les transports partagent la même règle |
| 2 — Stock local sûr | Verrou interprocessus du realm, allocation d’ID protégée, publication/reprise, révisions, suppression protégée | Élimine les pertes silencieuses pour les écrivains coordonnés |
| 3 — Brouillons | Sessions persistantes, `$EDITOR`, diff, save conditionnel, résolution | Permet l’édition humaine longue sans geler les agents |
| 4 — Lecture et suivi | Index reconstruisible, diagnostics de parsing, abonnements après commit | Suivi vivant et erreurs visibles |
| 5 — Service facultatif | Même protocole derrière un processus local si le besoin de réactivité le justifie | Mutualise cache et notifications sans changer le modèle |
| 6 — Connecteurs | Appliquer les changements distants comme commandes avec mapping et préconditions | La synchronisation Linear bénéficie des mêmes protections |

Les anciennes versions du CLI doivent refuser l’écriture d’un format de realm qu’elles ne savent pas protéger. Un nouveau coordinateur ne sécurise pas un ancien binaire qui continue à écrire directement : la migration doit traiter ce cas.

## 8. Vérifications nécessaires avant d’annoncer la garantie

| Test à construire | Résultat attendu |
|---|---|
| Deux processus, modifications sur champs différents | Les deux intentions sont conservées ou l’une reçoit un conflit explicite |
| Deux processus, même propriété | Aucune réussite silencieuse fondée sur une version obsolète |
| Sauvegarde d’un brouillon après plusieurs changements | Base et brouillon conservés ; comparaison avec le vrai état courant |
| Suppression puis ancien save | Pas de résurrection involontaire |
| Allocation simultanée de plusieurs IDs | Unicité et références cohérentes |
| Interruption à chaque phase de publication | Reprise déterministe avant lecture/mutation structurée suivante |
| Réponse perdue puis retry | Une seule mutation et une seule trace métier |
| Contrainte impliquant deux objets modifiés | Validation portant sur un état cohérent |
| Écriture externe / Markdown invalide | Diagnostic explicite, pas disparition silencieuse |
| Crash éditeur / redémarrage CLI | Brouillon récupérable |
| Échec Git après publication | Résultat métier conservé, snapshot en retard identifiable |
| macOS/Linux/Windows ciblés | Garanties filesystem et verrou vérifiées séparément |

Ces tests de la cible n’ont pas été exécutés : aucun de ces mécanismes n’a été implémenté dans cette recherche. Seul le scénario déterministe de perte de mise à jour sur le code actuel a été exécuté. Les essais d’arrêt de processus ne remplacent pas des essais de coupure machine pour une promesse de durabilité après perte d’alimentation.

## Décision conseillée

Adopter la combinaison **Markdown canonique partagé + protocole de mutation + brouillons**. Refuser les sauvegardes obsolètes par défaut, puis ajouter une aide à la fusion. Conserver Git pour l’historique et le transport des snapshots ; conserver les worktrees pour isoler le code. Cela répond au besoin sans imposer une base de données canonique, mais suppose d’investir explicitement dans un petit moteur transactionnel de fichiers.
