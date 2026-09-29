# Frame Board — serveur, contrats et synchronisation

Parent : [architecture](2026-09-29-frame-board-design.md), C1–C11. Prérequis : [persistance](2026-09-29-frame-board-data-design.md). Package privé `@frame/board-server`, consommé par la CLI et ses tests, jamais publié séparément.

## API publique du package

```ts
type BoardServerOptions = {
  root: string;
  actor: string;
  port?: number; // défaut 0 : port libre attribué par l’OS
  assets: AssetProvider;
};
type BoardServerHandle = { url: string; close(): Promise<void> };
type AssetProvider = (path: string) => Promise<{
  body: Uint8Array; contentType: string; etag: string;
} | null>;
// startBoardServer(options: BoardServerOptions): Promise<BoardServerHandle>
```

Le handle expose l’URL de démarrage avec fragment bootstrap uniquement au lanceur ; les logs HTTP ne la consignent pas. `close` est idempotent et ferme HTTP, SSE, watcher, timers et index. L’application Hono est créée indépendamment de l’adapter Node/Bun pour être testée par `app.request`.

Fichiers propriétaires : `server.ts` (assemblage), `http/app.ts` (routes), `http/session.ts` (accès), `http/assets.ts` (assets), `runtime/{node,bun}.ts` (écoute/arrêt), `projection/index.ts` (snapshot), `sync/{watcher,journal}.ts`, `api/{router,schemas,dto,errors}.ts` et `api/commands.ts` (dispatch métier explicite). Le browser peut importer `AppRouter` avec `import type` ; aucun import runtime de ce package.

## Contrats de données

Types de référence dans `api/dto.ts`, schémas Zod dans `api/schemas.ts` :

```ts
type EntityKind = 'issue' | 'project' | 'milestone' | 'spec' | 'trace';
type EntityRef = { kind: EntityKind; id: string };
type Cursor = { epoch: string; seq: number };
type Versioned<T> = { data: T; revision: string };
type Diagnostic = { file: string; code: string; message: string };
type ChangeBatch = {
  cursor: Cursor;
  changed: EntityRef[];
  deleted: EntityRef[];
  configChanged: boolean;
  diagnostics: Diagnostic[];
};
```

DTO = forme JSON des entités SDK : IDs string, dates ISO, champs optionnels métier représentés comme null lorsque l’entité le fait, gates string[], rules conservées structurellement. `IssueSummary = Omit<IssueDTO, 'body' | 'rules'>`. Les résumés des projets/jalons/specs omettent aussi `body` et `rules` lorsqu’ils existent. Le détail contient le corps. Une révision d’entité est le SHA-256 du JSON canonique de la liste triée de ses fichiers `{path, hash}` ; aucune dépendance à `updatedAt` seul. Plusieurs fichiers pour le même ID donnent un diagnostic et interdisent la mutation de cet ID.

`BoardSnapshot` contient `realmKey`, `cursor`, `actor`, `config: Versioned<RealmConfigDTO>`, les quatre tableaux de résumés versionnés et `diagnostics`. Pas de corps ni de tableau de toutes les traces. La révision config est le hash des octets de `.frameconfig` ou la sentinelle `missing`.

`BoardQuery = { projectId?: string; milestoneId?: string; status?: string; assignee?: string; label?: string; priority?: string; q?: string }`. `q` cherche sans distinction de casse dans ID et titre, après normalisation Unicode NFC. Pas de recherche full-text des corps V1.

## Procédures tRPC

| Procédure | Entrée | Sortie |
| --- | --- | --- |
| `board.snapshot` | aucune | `BoardSnapshot` |
| `board.detail` | `EntityRef` | `Versioned<EntityDTO>` ou NOT_FOUND |
| `board.history` | `{projectId?, issueId?, specId?, cursor?:string, limit?:number}` | `{items: TraceDTO[], nextCursor: string|null}` |
| `board.events` | `{after: Cursor}` | subscription de `{type:'changes', batch:ChangeBatch}` ou `{type:'reset', cursor:Cursor}` |
| `board.execute` | `BoardCommand` | `CommandResult` |
| `board.preferences.get` | aucune | `Versioned<BoardPreferences>` |
| `board.preferences.set` | `{expectedRevision:string, value:BoardPreferences}` | `Versioned<BoardPreferences>` |

History : limit défaut 50, maximum 200 ; ordre descendant `(at, id)` ; curseur opaque encodant ces deux valeurs, validation stricte avant lecture.

`BoardCommand` est une union discriminée, pas un nom de méthode arbitraire : `{mutationId: UUID, epoch: string, expected?: {entity: EntityRef, revision: string}, operation, input}`. Operations exactes : `issue.create`, `issue.edit`, `issue.setStatus`, `issue.delete`, `project.create`, `project.setStatus`, `milestone.create`, `milestone.setStatus`, `spec.create`, `spec.setStatus`, `config.set`. Les inputs reprennent les paramètres SDK sous forme JSON, sans actor/actorType/author fournis par le navigateur. Le serveur renseigne actor/author avec son acteur local et actorType=`human`.

`expected` obligatoire pour édition, suppression et changement de statut, absent pour création. Pour `config.set`, utiliser `expectedConfigRevision: string` dans la variante correspondante, sans inventer une EntityKind config. Champs inconnus rejetés ; priorité libre mais validée contre les niveaux config courants ; titre après trim non vide et ≤ 500 caractères, corps ≤ 1 Mio UTF-8, payload HTTP ≤ 2 Mio.

`CommandResult = {mutationId: string; cursor: Cursor; changed: EntityRef[]; deleted: EntityRef[]; entity: Versioned<EntityDTO>|null; config?: Versioned<RealmConfigDTO>}`. Chaque résultat et événement est construit après commit et actualisation de la projection.

Revérification d’epoch, vérification de révision et appel au SDK dans **la même** `runRealmTransaction`. Composer `Frame({repository: createTransactionalRepository(root, files), config})` à l’intérieur du callback. L’adapter scoped ne reprend pas un verrou imbriqué. `config.set` utilise le writer de config transactionnel sur le même `files`, avec la validation extraite et partagée de ConfigApi, pas une copie de règles dans le serveur.

## Préférences personnelles locales

`BoardPreferences = {version:1;theme:'system'|'light'|'dark';density:'compact'|'comfortable';favorites:EntityRef[];views:SavedView[]}` ; `SavedView = {id:string;name:string;query:BoardQuery;layout:'list'|'board';sort:'priority'|'updated';direction:'asc'|'desc'}`. Défauts system/compact et tableaux vides ; UUID pour view.id, nom trim non vide ≤ 100 caractères, maximum 100 favoris et 100 vues, fichier ≤ 256 Kio. Type et schéma définis dans api/preferences.ts, consommables par import type côté browser.

Stocker sous le stateDir du realm, permissions 0600. get prend le verrou court pour une lecture cohérente, set compare la révision sous le même verrou et remplace le JSON atomiquement ; pas de trace métier ni de séquence SSE pour ces préférences. Révision SHA-256 des octets, `missing` avant création. JSON invalide : get renvoie defaults et diagnostic dans l’état de service, set échoue REALM_INVALID sans écraser. Préférences isolées par racine canonique, indépendantes du port et des sessions. Le client refetch au focus et après set ; conflit → recharger avant nouvelle sauvegarde.

## Erreurs, déduplication et délais

Codes stables : `INVALID_INPUT`, `NOT_FOUND`, `DOMAIN_REJECTED`, `REVISION_CONFLICT`, `REALM_BUSY`, `REALM_INVALID`, `WRITE_INDETERMINATE`, `RECOVERY_CONFLICT`, `SESSION_EXPIRED`, `INTERNAL`. Mapper sur les codes HTTP/tRPC pertinents, renvoyer un message explicite et un requestId ; ne pas exposer stack ou chemins absolus. Une transition refusée n’est pas un conflit réseau.

Déduplication en mémoire par `(epoch, mutationId)`, hash du payload ; conserver les résultats 10 minutes, plafond 10 000, LRU. Duplicata concurrent partage la même Promise ; même clé avec payload différent → INVALID_INPUT. `epoch` d’un ancien serveur → SESSION_EXPIRED avant mutation. Pas de garantie exactly-once après expiration/redémarrage : aucun retry automatique des mutations dans le client. Réponse perdue → afficher « Résultat à vérifier », resnapshot ; l’utilisateur peut contrôler les données avant une nouvelle action. Une mutation n’est pas abandonnée à mi-commit si HTTP se déconnecte.

## Projection et flux

`BoardProjection` expose `snapshot(): BoardSnapshot`, `detail(ref): Versioned<EntityDTO>|null`, `history(input): HistoryPage`, `reconcile(paths?: readonly string[]): Promise<ChangeBatch|null>`, `close(): Promise<void>`. Les types HistoryInput/HistoryPage sont les entrées/sorties de `board.history`. Un seul orchestrateur sérialise reconciliations et publications ; lectures filesystem sous verrou partagé avec les mutations (exclusif pour simplicité).

Installer le watcher avant scan initial ; bufferiser ses notifications pendant le scan ; drainer puis activer les endpoints. Scanner les fichiers de façon bornée (16 lectures simultanées maximum), construire l’index sans repasser par `issues.list` pour chaque filtre. Cache interne de détail autorisé, invalidé par hash ; garder les corps hors snapshot HTTP. Préserver les diagnostics de `scanRealmRaw` ; fichier temporairement invalide → dernière entité valide visible, marquée périmée via diagnostics, mutations interdites jusqu’à résolution. Au premier démarrage, fichier invalide sans valeur précédente → diagnostic seul.

Watcher : Chokidar, ignorer `.git`, `node_modules` et les fichiers temporaires Frame ; stabilité d’écriture 100 ms avec polling 25 ms, debounce de lot 50 ms. Reconcile complet toutes les 30 secondes et sur retour au premier plan signalé par resnapshot. Renommage de slug conserve l’identité métier. Changement config reconstruit les DTO et le contexte config ; changement manifest incompatible → lecture diagnostique et mutations bloquées. Observer explicitement le HEAD du worktree et la ref active résolus par Git, malgré l’exclusion générale .git. Changement HEAD/ref ou plus de 1 000 chemins dans un lot → nouveau snapshot et epoch, jamais mélange silencieux des branches. Un realm non Git fonctionne sans ces observers.

Journal mémoire : 1 000 batches maximum ou 5 minutes, première limite atteinte. `seq` croît uniquement pour un batch publié, epoch UUID au démarrage et reset de branche. L’inscription subscription et la lecture du journal sont atomiques dans la boucle de publication : replay des `seq > after.seq`, puis flux vivant sans intervalle perdu. Epoch inconnu, curseur futur ou expiré → reset ; client recharge snapshot et se réabonne. Pour un consommateur lent, queue bornée à 100 batches, puis reset et fermeture du flux. Un seul flux par onglet.

## Session locale et assets

Host accepté : `127.0.0.1:<port effectif>` exactement. Bootstrap 256 bits aléatoire dans le fragment `/#bootstrap=...`, jamais query string ; échange POST `/session` avec Origin exact contre un token mémoire navigateur utilisé en Authorization sur tRPC/SSE via fetch. Le fragment est retiré avec history.replaceState. Bootstrap valable pendant la vie du processus afin de permettre de nouveaux onglets ; aucun cookie ni token dans localStorage ou logs. Un reload retrouve le token en sessionStorage de l’onglet ; un token est propre à cet onglet, expiration au redémarrage. Révoquer tous les tokens sur arrêt.

API refuse l’absence de bearer valide et tout Origin présent autre que l’origine exacte ; pour POST/mutations et bootstrap, Origin exact obligatoire. Les lectures GET sans Origin restent autorisées avec bearer et Host exact (fetch same-origin peut omettre Origin). Pas de CORS wildcard. Même origine pour HTML et API. CSP limite scripts, styles, fontes et connexions au local ; styles inline autorisés pour les positions des éléments virtualisés, scripts inline interdits. Markdown : HTML brut désactivé, liens de protocoles dangereux rejetés, images distantes non chargées automatiquement.

Assets buildés servis par manifeste fermé ; aucun chemin filesystem fourni par le navigateur. Hash dans les URLs pour cache immutable ; index no-cache, fallback SPA uniquement pour navigation HTML hors `/trpc` et `/session`. URL inconnue API → 404 JSON, jamais HTML. Un fichier asset absent retourne 404, pas le shell.

## Acceptation

S1 contrats et DTO → B1 ; S2 projection/diagnostics → B2 ; S3 snapshot/replay/reset → B3 ; S4 mutations/version/conflit → B4 ; S5 session/limites/runtime → B5 ; S6 cycle CLI/arrêt/root → B6. Tous les tests réseau utilisent des ports éphémères et des realms temporaires ; aucun appel à Linear ni besoin de données personnelles.
