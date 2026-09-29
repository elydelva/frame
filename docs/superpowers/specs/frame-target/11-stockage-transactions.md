# S11 — Markdown et mutations coordonnées

Statut : cible proposée · Dépendance : [S00](00-contrats-transverses.md) · [Index](README.md).

## Objectif et périmètre

Garantir l’absence de perte silencieuse entre écrivains Frame coopérants d’un même espace, en conservant les `.md` comme données canoniques. Une transaction couvre objets, historique, révisions, aliases et résultat idempotent. Git reste géré par S14, pas par chaque `saveIssue`.

Le code actuel lit puis réécrit les entités et leurs traces séparément. Les compteurs `.state` ne sont pas protégés. La reproduction dans la recherche 05 démontre qu’une ancienne copie peut effacer un statut humain. Le contrat ci-dessous remplace ce comportement pour tous les écrivains cibles.

## Stockage

`dataRoot` est directement la racine du worktree de données : `issues/<uuid>.md`, `projects/<uuid>/project.md`, `projects/<uuid>/milestones/<uuid>.md`, `documents/<uuid>.md`, etc. Ne pas ajouter `.frame/.frame`. Les aliases/slugs sont des attributs, pas une identité de fichier ; un renommage ne crée pas d’objet.

Frontmatter structuré et validé, corps Markdown préservé. La sérialisation conserve les extensions inconnues supportables ; une limite de format interdit l’écriture concernée. `_frame/manifest.json` porte version, workspaceId et capacités du protocole. `_frame/operations/<id>.json` et tombstones sont des métadonnées portables. Pas d’état de verrou dans Git.

État local durable dans `<commonDir>/frame/operations/<transactionId>/` : intention, résultat, versions avant/après et payload nécessaire à la reprise. Pour un realm non Git, un dossier privé stable associé à workspaceId remplit ce rôle ; aucun mécanisme de branches n’est promis dans ce mode. Les permissions locales restreignent l’accès aux autres comptes sans prétendre isoler deux programmes du même utilisateur.

## Interface du module

```ts
interface MutationCoordinator {
  execute(request: MutationRequest): Promise<MutationResult>;
  inspect(operationId: string): Promise<OperationState>;
  recover(workId: string | null): Promise<RecoveryResult>;
  snapshot(scope: 'accepted' | 'work'): Promise<ReadSnapshot>;
}
```

Les mutations sont une union métier, pas une liste arbitraire de chemins fournie par le client. L’adapter fs met les lectures/écritures en overlay, puis les publie ensemble selon le protocole. Les tests traversent cette interface avec plusieurs processus réels ; les primitives disque restent internes.

## Coordination et révisions

Verrou court par espace pour lecture fraîche → préconditions → validation → journal → publication. Le registre/publication Git dispose d’un verrou de coordination de clone ; si les deux sont nécessaires, prendre coordination puis espaces triés par ID. Aucun réseau, éditeur ou décision utilisateur sous verrou.

Une révision opaque combine empreinte de contenu et génération gérée. Une modification puis retour au contenu précédent ne valide pas un ancien éditeur. L’absence attendue est distincte d’une révision manquante. La génération doit survivre à une reprise ; la restauration/migration renouvelle l’époque des versions pour invalider les vieux clients.

Une bibliothèque de verrou éprouvée peut fournir l’implémentation. Le format de protocole fige ses paramètres pour tous les écrivains. Timeout, expiration ou PID seul n’autorisent pas une reprise destructive : perte de propriété implique `LOCK_COMPROMISED`, arrêt avant publication ou récupération du journal déjà publié. Support initial : disque local, plateformes validées par les tests S21 ; partage réseau non garanti.

## Transaction et point de commit

1. Acquérir la coordination et récupérer tout journal inachevé de l’espace.
2. Vérifier operationId et empreinte de requête. Retourner le résultat existant si déjà appliqué ; refuser payload différent.
3. Lire les objets et listes nécessaires, comparer les révisions, appliquer l’intention en overlay.
4. Valider le graphe et les listes lues ; détecter un changement externe avant publication.
5. Persister un journal complet de roll-forward : versions avant/après, opérations ordonnées, objets et résultat attendu. Synchroniser selon les garanties de la plateforme. **La publication durable du journal décide le commit.**
6. Pour chaque fichier : écrire un temporaire voisin, synchroniser, remplacer ; pour une suppression conserver le tombstone et appliquer l’absence attendue.
7. Vérifier le résultat, rendre durable le résultat idempotent et finaliser le journal. Notifier après commit ; aucune notification n’est une preuve de commit.

Après le point de commit, une erreur est `WRITE_INDETERMINATE`, jamais « rollback réussi ». La commande suivante récupère avant d’écrire. Un callback ne doit pas réaliser d’effet externe pendant la préparation.

Reprise par opération : hash courant égal à après → déjà appliqué ; égal à avant → appliquer ; autre → `RECOVERY_CONFLICT`, garder toutes les preuves et arrêter. Un lecteur API prend la même coordination et ne voit pas un mélange. Un lecteur brut de plusieurs `.md` peut voir plusieurs instants ; aucune atomicité multifichier universelle annoncée.

La résistance à une coupure machine nécessite des tests de durabilité par OS/filesystem. La publication atomique d’un seul fichier ne suffit pas à prouver celle du realm.

La décision décrite ici concerne une mutation directe du stockage de travail. Pour une intégration ou un checkpoint Git, S14 distingue un journal préparatoire de la décision de publication par référence Git ; ne pas publier un journal de mutation métier engageant la cible avant le CAS qui accepte l’intégration. La matérialisation après ce CAS réutilise les mécanismes de fichiers et de reprise sans recréer une opération métier déjà reçue.

## Idempotence et historique

`operationId` unique dans le workspace, payload normalisé et résultat enregistrés durablement. Une réponse perdue peut être inspectée puis rejouée sans duplication d’événement. Les reçus intégrés conservent ces IDs après squash. Si une rétention archive les détails, garder la preuve suffisante pour refuser un ancien retry ou retourner son résultat ; ne jamais expirer silencieusement puis rejouer.

Les événements consignent auteur déclaré/authentifié, origine, causalité, objet, anciennes/nouvelles valeurs pertinentes et révisions. Une correction produit un nouvel événement ; elle ne réécrit pas une preuve historique. Les contenus sensibles ne sont pas dupliqués sans nécessité dans les traces.

## Accès externe et réparation

Pas de `writeFile` concurrent indépendant dans un connecteur/serveur. Un éditeur utilise S12. Une modification brute est détectée par scan/empreinte ; elle passe par import contrôlé ou provoque un diagnostic. Le watcher invalide l’index, il ne protège pas les écritures.

Rejeter traversée de chemin, chemin absolu fourni comme objet, symlink sortant du stockage et fichier géré d’identité incohérente. Un fichier invalide est signalé ; une projection peut montrer la dernière version valide marquée périmée, jamais transformer l’erreur en absence silencieuse.

`frame doctor` inspecte journaux/format/identités ; `--fix` ne supprime aucun journal conflictuel ni données inconnues sans plan de réparation concret. L’import d’une restauration se fait en maintenance exclusive, avec validation et nouvelle époque.

## Erreurs

REALM_BUSY, LOCK_COMPROMISED, REVISION_CONFLICT, EXTERNAL_CHANGE, REALM_INVALID, WRITE_INDETERMINATE, RECOVERY_CONFLICT, OPERATION_ID_REUSED et FORMAT_UNSUPPORTED distinguent les causes. Seules les opérations explicitement retryable reprennent le même ID, après inspection si le résultat est incertain.

## Critères d’acceptation

- S11-A1 : deux processus changent statut/priorité depuis la même base ; conservation des deux intentions ou conflit, jamais perte silencieuse.
- S11-A2 : crash avant journal ne publie rien ; crash après journal est repris sans duplication.
- S11-A3 : un troisième contenu pendant récupération reste intact avec RECOVERY_CONFLICT.
- S11-A4 : trace et objet appartiennent au même résultat ; aucune trace de succès pour un overlay refusé.
- S11-A5 : retry après réponse perdue retourne le même résultat ; payload différent refusé.
- S11-A6 : suppression puis vieille sauvegarde ne ressuscite pas l’objet.
- S11-A7 : perte de verrou invalide la publication ; test suspension/reprise et compétition réelle.
- S11-A8 : lire pendant publication retourne ancien/nouveau snapshot API ou attente, jamais mélange.
- S11-A9 : format inconnu, fichier invalide et symlink produisent des diagnostics précis.
- S11-A10 : aucune mutation métier ne stage les fichiers de code.

## Sources

[Recherche concurrence](../../../research/05-concurrence-et-edition-markdown.md), [design global](../../../research/06-design-global-branches-frame.md), [Node fs](https://nodejs.org/api/fs.html), [rename](https://man7.org/linux/man-pages/man2/rename.2.html), [SQLite atomic commit](https://sqlite.org/atomiccommit.html). Les garanties Linux ne sont pas présumées identiques sur les autres OS.
