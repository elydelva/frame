# S14 — Checkpoints associés aux commits de code

Statut : cible proposée · Dépendance : [S13](13-branches-workspaces.md) · [Index](README.md).

## Objectif

Enregistrer un lien exact entre un instantané Frame préparé et le commit de code qui l’accompagne, sans dépendre de la présence permanente d’un hook ni effacer les changements intervenus ensuite. Les deux commits sont des étapes reprenables, pas une transaction atomique.

Une mutation S11 n’est pas automatiquement un commit Git. Le mode normal produit un checkpoint par commit code réussi, y compris un checkpoint de liaison seule si aucun objet métier n’a changé. Un checkpoint autonome couvre la documentation et le rattrapage.

## Données

Snapshot local durable : snapshotId, workspaceId, workId, checkoutId, parentFrameOid, génération, empreinte du contenu métier, contenu figé, operationIds, contexte de préparation, état.

Checkpoint portable `_frame/checkpoints/<id>.json` : checkpointId, snapshotId, workId, codeOid nullable, codeRefAtCapture, frameParentOid, domainTreeDigest, operationIds, reason, association, publicationMode et éventuellement snapshotCommitOid.

`association = sealed | observed-after | standalone | rewrite-derived`. `publicationMode = current | history-only`. Le SHA du commit contenant le checkpoint n’est pas stocké dans son propre fichier. Les OID restent opaques ; aucune longueur SHA-1 codée en dur.

## Séquence instrumentée

1. L’initialisation installe un dispatcher composé avec les hooks existants. Vérifier core.hooksPath/Husky ; ne pas les remplacer silencieusement.
2. `prepare-commit-msg` scelle le snapshot sous verrou court, puis insère le trailer réservé `Frame-Snapshot: <snapshotId>` dans le message de cette invocation.
3. Le client édite son message sans verrou de données. Un validateur peut vérifier le token ; le post-hook vérifie toujours sa présence effective.
4. Après réussite, lire le commit réel et son token. Vérifier snapshot immuable, identité, contexte et absence de consommation incompatible.
5. Publier le checkpoint et sa liaison au SHA exact. Conserver les mutations plus récentes pour le prochain checkpoint.
6. Finaliser l’opération durable ; retry reconnaît checkpointId et résultat.

Le trailer lie le code à une identité de snapshot, et le checkpoint lie celui-ci au SHA de code. Pas de dépendance circulaire entre hashes. Les exigences de signature sont respectées ; pas de publication non signée de secours implicite.

Le contexte décrit l’état Frame d’une branche à la préparation ; il ne prouve pas que chaque paragraphe concerne les seules lignes d’un commit partiel de code.

## Publication et retard

Construire le candidat avec un index Git privé à partir du snapshot. Ne pas hériter GIT_INDEX_FILE/GIT_DIR/GIT_WORK_TREE du hook vers le worktree données. Le dispatcher vérifie le rôle réel du worktree et interdit les boucles sur ses propres commits Frame.

Le journal de préparation Git est distinct de la décision de mutation fichier S11 : un candidat préparé n’est pas une intégration acceptée. Sous coordination, vérifier parent/génération puis avancer la référence par CAS ; le reçu/checkpoint atteignable depuis la référence cible constitue la décision de publication Git. Si le CAS échoue, garder le candidat et replanifier, sans appliquer son arbre au checkout. Après CAS réussi, la matérialisation index/fichiers est une reprise vers l’arbre décidé, avec préconditions et préservation des mutations locales postérieures. Aucun nouvel événement métier n’est émis pour cette seule matérialisation. Les API attendent la fin de reprise ; une référence déplacée extérieurement ou des octets inattendus déclenchent RECOVERY_CONFLICT, sans reset aveugle. Une comparaison de référence seule ne répare pas les fichiers. Les modifications non incluses restent dans l’état de travail.

Si la tête a avancé depuis la préparation, ne jamais reparent l’ancien arbre complet sur la nouvelle tête. Conserver le snapshot en commit d’archive sous référence retenue, puis ajouter un checkpoint `history-only` sur l’autorité courante, sans modifier son état métier. Il pointe vers snapshotCommitOid ; la vue annonce la différence entre commit de liaison et snapshot historique.

Une source déjà clôturée reste immuable. Une liaison retardée y est enregistrée par reçu sur sa cible autorisée, sans rouvrir le work. La publication distante doit inclure les refs qui rendent les snapshots accessibles ; le SHA dans un JSON seul ne garantit pas leur conservation.

## Jobs et couverture

États : `prepared`, `code-observed`, `publishing`, `complete`, `unverified`, `needs-repair`. Un commit annulé laisse une tentative préparée non consommée. Un autre commit obtient son propre token ; jamais « prendre le dernier snapshot en attente ».

Token supprimé/inconnu/copied, hook absent ou producteur Git non couvert : association unverified. `frame reconcile` retrouve les commits/tokens connus ; sinon un rattrapage observed-after qualifie seulement l’observation tardive. Il ne reconstitue pas un état historique inventé.

Amend/cherry-pick instrumentés créent un nouveau token. Rebase : conserver les relations de réécriture ancien→nouveau, parfois plusieurs→un ; ne pas prétendre que l’état courant était celui de chaque commit rejoué. Un token consommé copié n’est pas une nouvelle preuve.

Les jobs de publication sont sérialisés par espace. Ils inspectent l’état réel avant retry. Un snapshot préparé pendant une édition longue ne bloque pas indéfiniment la branche : le parcours history-only couvre sa publication tardive.

## CLI

```sh
frame checkpoint --message "Précisions sur les invitations"
frame checkpoint show CP-id --json
frame checkpoint list --work WORK-id --json
frame reconcile --json
frame hooks status --json
frame hooks install
```

`checkpoint show` expose association, publicationMode, codeOid, snapshotCommitOid, état et causalité. `hooks install` vérifie/combine la configuration avec un diff concret ; aucune commande externe ni code de hook importé n’est exécuté comme instruction de document. Un wrapper futur `frame commit` peut renforcer l’identification d’invocation sans rendre Git direct illégal.

Aucun fetch/pull/push dans les hooks. Un push code manuel n’est pas automatiquement un push Frame garanti ; S20 affiche cette différence et peut gérer la publication explicitement couplée.

## Erreurs et responsabilité

CheckpointCoordinator possède les snapshots, jobs et associations. GitAdapter construit objets/refs/index ; WorkspaceResolver fournit l’identité. ASSOCIATION_UNVERIFIED, SNAPSHOT_MISSING, TOKEN_REUSED, CHECKPOINT_PENDING, FRAME_REF_MOVED et SIGNING_FAILED donnent une prochaine action. Un échec après le commit code ne le présente jamais comme annulé.

## Critères d’acceptation

- S14-A1 : une mutation entre préparation et post-commit n’entre pas dans le snapshot associé.
- S14-A2 : commit sans mutation métier crée seulement la nouvelle liaison.
- S14-A3 : commit annulé puis retry ne consomme pas le token d’une autre tentative.
- S14-A4 : trailer absent/copié/altéré ne produit pas sealed à tort.
- S14-A5 : interruption après code puis après Frame est reprise une seule fois.
- S14-A6 : autre checkpoint/intégration avant publication tardive → history-only, aucune régression métier.
- S14-A7 : amend/rebase/squash conservent la provenance sans reconstruire un faux passé.
- S14-A8 : indexes de code/données indépendants, pas de récursion, hooks existants conservés.
- S14-A9 : signature indisponible donne pending sans affaiblissement de politique.
- S14-A10 : code commité hors ligne fonctionne, aucun réseau dans les hooks.
- S14-A11 : clonage/publication des refs retenues permet d’ouvrir les snapshots référencés.

## Sources

[Design global](../../../research/06-design-global-branches-frame.md), [audit Git](../../../research/07-git-hooks-et-cas-limites.md), [githooks](https://git-scm.com/docs/githooks), [git-update-ref](https://git-scm.com/docs/git-update-ref).
