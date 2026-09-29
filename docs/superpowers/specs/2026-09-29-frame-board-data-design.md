# Frame Board — persistance coordonnée

Parent normatif : [architecture](2026-09-29-frame-board-design.md), contraintes C1–C11. Livrable indépendant : CLI/SDK fiables entre processus coopérants, sans serveur web requis.

## État actuel et frontière

`FsRealmRepository` écrit directement les entités ; les cas d’usage écrivent ensuite la trace. `incrementCounter` lit puis réécrit `.frame/.state`. `MutationApi` appelle les cas d’usage ; `ConfigApi` conserve une configuration chargée. `doctor --fix` supprime directement des fichiers. Aucun de ces chemins n’est actuellement une transaction interprocessus.

La transaction reste une capacité optionnelle du port repository, pas une dépendance filesystem du core. Les adapters externes existants restent compilables et gardent leurs garanties propres. Les garanties ci-dessous s’appliquent à `FsRealmRepository` et aux écrivains Frame actualisés.

## Interfaces fixées

Dans `packages/core/src/ports/realm-repository/realm.repository.ts` :

```ts
interface IRealmRepository {
  // Méthodes actuelles conservées.
  withTransaction?<T>(operation: (repository: IRealmRepository) => Promise<T>): Promise<T>;
}
```

Dans `packages/fs/src/transactions/types.ts` :

```ts
type FileRevision = string; // sha256 des octets ; null représente l’absence
interface RealmFileTransaction {
  read(relativePath: string): Promise<string | null>;
  list(relativeDirectory: string): Promise<string[]>;
  write(relativePath: string, contents: string): Promise<void>;
  remove(relativePath: string): Promise<void>;
  revision(relativePath: string): Promise<FileRevision | null>;
}
type RealmTransactionOptions = { lockTimeoutMs?: number };
// runRealmTransaction(root, operation, options?): Promise<T>
// operation: (files: RealmFileTransaction) => Promise<T>
```

`runRealmTransaction<T>(root: string, operation: (files: RealmFileTransaction) => Promise<T>, options?: RealmTransactionOptions): Promise<T>` est l’unique composition verrou/journal/fichiers. Pas de contexte global implicite ni AsyncLocalStorage.

`createTransactionalRepository(root: string, files: RealmFileTransaction): IRealmRepository` crée l’adapter scoped qui lit son overlay et ne possède pas `withTransaction`. Les méthodes mutatrices de `FsRealmRepository` utilisent une transaction courte lorsqu’elles sont appelées directement ; sa méthode `withTransaction` fournit un adapter scoped pour grouper un cas d’usage entier. Le staging Git existant intervient une fois le commit terminé, une fois par chemin final, en best-effort comme aujourd’hui.

`MutationApi` centralise ses appels via `runMutation<T>(operation: (repository: IRealmRepository) => Promise<T>): Promise<T>` : appeler `withTransaction` si disponible, sinon le callback directement. Tous les read/modify/write de `addGate` et `removeGate` sont à l’intérieur du callback. Une transaction ne se transmet jamais par mutation temporaire d’un champ partagé de `Frame`.

## Identité et verrou

`realmKey = sha256(await realpath(root))`. Chaque worktree a une racine distincte ; ce verrou ne remplace pas les claims dans le Git common directory.

État local sous `path.join(os.homedir(), '.frame', 'state', realmKey)` : répertoire `0700`, fichiers `0600`, pas dans Git. Contenu : `pending.json` et répertoire temporaire de commit ; aucun secret de session HTTP. Ce dossier n’est pas un cache jetable tant qu’un journal est présent.

Utiliser proper-lockfile sur le répertoire d’état existant : `stale: 30000`, `update: 10000`, timeout total 5000 ms par défaut. Réessayer l’acquisition par intervalles de 100 ms jusqu’au timeout ; conserver les paramètres identiques dans tous les processus. `onCompromised` invalide le contexte, interdit les prochains commits et remonte `LOCK_COMPROMISED`. Ne pas voler un verrou vivant sur le seul constat d’un long calcul. Prévoir le risque d’expiration après suspension machine ; tester et documenter la limite d’un verrou à bail.

`REALM_BUSY` après timeout ; aucune écriture avant acquisition. Libérer avec la fonction retournée par la bibliothèque, y compris sur exception. Une compromission après publication du journal laisse celui-ci récupérable ; ne pas effacer les preuves en `finally`.

## Transaction et récupération

1. Acquérir le verrou ; récupérer un éventuel journal avant toute nouvelle opération.
2. Lire via `RealmFileTransaction`. Enregistrer les hashes de fichiers et les listes de répertoires lus. Les écritures restent en overlay ; les lectures suivantes voient les changements de l’overlay.
3. Exécuter le cas d’usage. Une exception métier abandonne l’overlay sans modifier les fichiers ni consommer un compteur.
4. Revérifier sous verrou les fichiers et répertoires lus. Si un éditeur externe les a changés, retourner `EXTERNAL_CHANGE` et abandonner avant journalisation.
5. Écrire atomiquement et synchroniser `pending.json` : version 1, UUID de transaction, racine canonique, opérations ordonnées, hashes avant/après et contenu après. Les octets avant ne sont pas nécessaires au roll-forward ; conserver leur hash. La publication du journal est la décision de commit.
6. Appliquer chaque remplacement par fichier temporaire voisin puis rename ; supprimer les anciens slugs après création du nouveau fichier ; synchroniser les fichiers et les répertoires lorsque l’OS le supporte.
7. Vérifier les hashes finaux, effacer le journal et synchroniser son répertoire ; retourner le résultat. Stager ensuite les chemins si un adapter Git a été fourni.

Récupération : pour chaque opération, état courant = hash après → déjà appliquée ; état courant = hash avant → appliquer ; autre hash → `RECOVERY_CONFLICT`, conserver le journal, ne pas écraser. Opérations de création/suppression utilisent `null` pour l’absence. Un crash après application complète mais avant suppression du journal est donc idempotent ; les IDs de traces ont été figés dans le contenu journalisé.

Un appel échoué après décision de commit retourne `WRITE_INDETERMINATE`, jamais un faux rollback ; récupérer puis relire avant une autre commande. Il n’existe pas d’atomicité multi-fichiers pour un lecteur externe brut. Les snapshots du board prennent ce même verrou et ne publient jamais un état partiellement committé. La résistance à une panne électrique dépend aussi du filesystem et de l’OS ; les tests couvrent au minimum les crashs de processus.

Chemins acceptés par la transaction : `.frame/projects/**`, `.frame/.state`, `.frame/manifest.json`, `.frame/templates/**`, `.frameconfig`. Rejeter chemin absolu, `..`, octet nul, et symlink intermédiaire ou final dans les chemins gérés. L’accès à un fichier ne suit pas un lien vers l’extérieur. La racine elle-même peut être un symlink résolu avant calcul d’identité. Aucun outil de réparation automatique ne supprime un journal conflictuel.

## Config, initialisation, réparation

`updateRealmConfig(root: string, update: (current: RealmConfig) => RealmConfig): Promise<RealmConfig>` prend le même verrou et utilise la transaction de fichiers ; recharger le config courant à l’intérieur de celle-ci. `ConfigApi.set` appelle cette fonction, puis rafraîchit son contexte. Un échec ne met pas à jour le cache SDK. `readRealmConfig` conserve son comportement public défensif ; le board expose séparément un diagnostic de config invalide.

`initializeRealm` prend le même verrou et groupe ses créations sans écraser de fichier existant. `doctor --fix` rescane et décide ses suppressions dans le callback transactionnel ; le mode lecture reste sans mutation. Les templates et le manifeste existants gardent leur format.

Le SDK ne promet pas un cache de config vivant pour tous les consommateurs. Le serveur construit un nouveau contexte `Frame` après changement de config ; l’API de mutation revalide les valeurs sous transaction avant de les appliquer.

## Compteurs et données préexistantes

Avant allocation, lire strictement le state dans la transaction : valeurs finies, entières et non négatives. Fichier malformé ou absent dans un realm contenant déjà des entités → REALM_INVALID, aucune remise à zéro silencieuse. Pour un state valide mais en retard, allouer `max(counter, plus grand suffixe numérique des IDs du type existants) + 1` sous verrou. Le scan nécessaire fait partie du read-set. Init ne réinitialise pas un state manquant d’un realm non vide ; une réparation explicite reste hors du board. Cette règle durcit les écritures tout en conservant la lecture publique défensive existante.

## Corps des issues

Ajouter `body?: string` à `EditIssuePatch` ; l’appliquer seulement si présent, y compris chaîne vide. Aucun traitement de Markdown, aucune normalisation des retours à la ligne à ce niveau. La trace reste `issue_edited`. C’est le seul ajout de capacité métier requis par l’éditeur V1.

## Tests d’acceptation

| Exigence | Cas obligatoire | Plan |
| --- | --- | --- |
| D1 — Verrou | Deux processus, timeout, libération après exception, lease compromis | A1 |
| D2 — Journal | Crash avant/après journal, à chaque rename, avant nettoyage ; récupération deux fois | A2 |
| D3 — Cas d’usage atomique | Trace en erreur → aucun fichier/compteur changé avant commit ; dix créations concurrentes → IDs distincts | A3 |
| D4 — Config et maintenance | Deux configs concurrentes préservent leurs clés ; init idempotent ; doctor coordonné | A4 |
| D5 — Révisions | Fichier changé/renommé/supprimé par un écrivain brut ; aucune écriture silencieuse sur conflit détecté | A2/A3 |
| D6 — Compatibilité | Repository externe sans withTransaction ; staging Git inchangé ; formats existants | A3/A5 |
| D7 — Body | Non fourni conservé, vide effacé, Markdown Unicode exact | A5 |

Aucune ancienne CLI ne peut être rendue coopérante par ce changement. L’aide Board rappelle d’utiliser la même version de Frame dans les terminaux/agents et de fermer les processus avant un changement de branche massif.
