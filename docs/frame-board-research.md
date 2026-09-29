# Frame Board — recherche et proposition d’architecture

Date : 29 septembre 2026. Statut : recommandation à discuter, pas une spécification validée ni une implémentation. Sources web consultées et dépôt inspecté ; aucun benchmark du futur board exécuté.

Suite de cette recherche : les décisions retenues et leurs précisions normatives figurent dans la [conception Frame Board](superpowers/specs/2026-09-29-frame-board-design.md). En particulier, les préférences persistantes passent par un fichier local serveur afin de survivre aux changements de port.

## Objectif et décision proposée

Lancer `frame board` pour ouvrir une application personnelle locale dont les pages, la densité, les surfaces, la navigation clavier et les animations retrouvent le feeling de Linear. Hypothèse de départ : un utilisateur, un realm/worktree par serveur, plusieurs onglets possibles, et des modifications simultanées par CLI, agents et éditeur.

Choix recommandé : **React + Vite, TanStack Router, shadcn/ui sur Base UI, Tailwind et variables CSS, TanStack Query, TanStack Virtual, serveur Hono, tRPC/HTTP et événements SSE**. Frame reste propriétaire du domaine et des données Markdown. DnD et éditeur riche sont des modules spécialisés à choisir au moment de leurs parcours, chargés à la demande.

Les composants shadcn restent personnalisables dans le projet ; Base UI est devenu le choix par défaut en juillet 2026. Ces primitives ne fournissent pas à elles seules les écrans et interactions de Linear. Sources : [shadcn](https://ui.shadcn.com/docs), [Base UI par défaut](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default).

## État vérifié du dépôt

| Emplacement | Fait actuel | Conséquence pour Board |
| --- | --- | --- |
| `apps/cli/src/cli.ts` | Enregistrement explicite des commandes avec Commander | Ajouter une commande fine qui lance le serveur |
| `packages/sdk/src/frame.ts` | API `Frame`, queries et mutations, initialisation paresseuse | Le serveur appelle le SDK plutôt que parser la sortie CLI |
| `packages/sdk/src/options.ts` | Injection possible de `IRealmRepository` | Possibilité d’une projection de lecture reconstruisible |
| `packages/fs/src/realm.repository.ts` | Parcours de fichiers, lectures/parsing successifs ; écritures `writeFile` | Mesurer les scans et durcir les écritures concurrentes avant de multiplier les clients |
| `apps/cli/src/commands/shared.ts` | Sérialisation explicite des IDs et dates pour la CLI | Créer des DTO web sans importer les helpers de terminal |
| `docs/archi.md` | Worktrees, claims et lint coordonnés hors SDK | Les exposer demanderait un service partagé, pas des imports de commandes CLI |
| `apps/cli/package.json` | Build publié ciblant Node | Ne pas rendre le chemin npm dépendant de Bun par accident |
| `package.json` | Build binaire optionnel avec Bun | Prévoir et vérifier séparément le packaging des assets |

Le SDK conserve aussi sa configuration en mémoire après initialisation. Une modification externe de `.frameconfig` doit entraîner une stratégie explicite de rechargement du contexte.

## Design system

Le nom recherché est **Kumo**, bibliothèque React de Cloudflare, et **shadcn/ui**. Kumo peut être utilisé localement : son nom ne crée aucune obligation d’hébergement sur Workers. Sources : [Kumo](https://kumo-ui.com/), [dépôt Cloudflare](https://github.com/cloudflare/kumo).

| Option | Intérêt pour cet objectif | Coût / limite | Avis |
| --- | --- | --- | --- |
| Kumo | Base cohérente pour une application de gestion | Son identité de départ est celle de Cloudflare ; personnalisation à évaluer composant par composant | Bon candidat si son rendu plaît déjà |
| shadcn/ui + Base UI | Possession du code et personnalisation fine | Correctifs des composants copiés à suivre ; finitions à construire | Meilleur compromis proposé |
| Base UI directement + CSS | Contrôle maximal des surfaces et comportements | Plus de composants de présentation à écrire | Alternative si la fidélité prime sur la vitesse de construction |
| React + StyleX + primitives | CSS calculé au build, proche d’un choix technique actuel de Linear | Outillage et conventions supplémentaires ; pas de composants Linear fournis | À envisager si ce modèle de styles plaît, pas pour imiter une stack |

Cette comparaison est une appréciation d’adéquation, pas un classement mesuré de vitesse. Aucun benchmark comparable Kumo/shadcn/Base UI sur le même board n’a été établi ici.

La fidélité exige un inventaire visuel de la version de Linear visée : sidebar, toolbar, onglets, liste, board, détail d’issue, menus, recherche, états vides, focus, sélection, chargement et erreurs. Définir des tokens communs pour couleurs de surface, séparateurs, typo, espacements, rayons, ombres et durées. Tester les superpositions de menus et dialogues, la restauration du focus, le scroll et le clavier. Éviter de mélanger plusieurs familles de primitives pour le même usage.

## Rendu et transport

Le SSR s’exécuterait dans le serveur local ; le CSR dans le navigateur. Le lieu d’exécution du rendu et le protocole API sont deux décisions indépendantes.

| Architecture | Premier affichage | Interactions suivantes | Coût pour Frame |
| --- | --- | --- | --- |
| React SPA + assets compilés | Chargement JS puis données ; à optimiser et mesurer | Cache chaud, transitions locales et optimisme possibles | Recommandée |
| React avec SSR via Next/Start | Peut fournir le HTML initial plus tôt ; interactivité encore dépendante du JS/hydratation | Dépend toujours du cache et de l’état client | À justifier par une mesure du premier affichage |
| Svelte/Solid en SPA | Autres modèles de rendu à comparer sur le même parcours | Potentiel de réactivité fine, sans garantie globale de vitesse | Change l’écosystème UI ; pas un avantage démontré ici |

Une SPA ne garantit pas la rapidité, et le SSR n’empêche pas le cache ou les mutations optimistes. Pour cette application locale interactive, je privilégie une SPA pour réduire le nombre de mécanismes et concentrer le travail sur l’usage répété.

| Transport | Atout | Limite | Choix |
| --- | --- | --- | --- |
| tRPC sur HTTP JSON | Typage partagé dans le monorepo TS, validation runtime et intégration Query | Couplage TypeScript ; performance à mesurer | Recommandé |
| HTTP JSON avec OpenAPI | Contrat ouvert et clients variés | Génération/maintenance du contrat | Bon si l’API devient un produit public |
| ConnectRPC + Protobuf | Contrat explicite multilangage, JSON/binaire possibles | Génération, schémas et compatibilité du serveur à valider | Si Go/Swift/autres clients deviennent un besoin concret |
| gRPC-Web | Accès navigateur à un écosystème gRPC existant | Contraintes navigateur et éventuelle passerelle | Pas de besoin identifié ici |
| WebSocket | Flux bidirectionnel durable | Reconnexion et protocole applicatif à gérer | Réserver à présence/collaboration continue |

Le navigateur n’expose pas le gRPC natif comme un simple `fetch`. Connect et gRPC-Web répondent à ces contraintes ; le client web n’apporte pas un streaming bidirectionnel arbitraire. Un payload Protobuf plus petit ne démontre pas une interface plus rapide sur localhost. Sources : [Connect — protocoles web](https://connectrpc.com/docs/web/choosing-a-protocol/), [tRPC Fetch](https://trpc.io/docs/server/adapters/fetch), [tRPC Query](https://trpc.io/docs/client/tanstack-react-query/setup).

## Architecture proposée

```text
frame board
  └─ serveur local : assets compilés + API tRPC + SSE
       ├─ queries : projection de lecture en mémoire
       ├─ mutations : @frame/sdk → core → fs → Markdown
       └─ watchers + réconciliation → projection → événements SSE

Navigateur React
  ├─ Router : URL, filtres, navigation, détail d’issue
  ├─ Query : données serveur, mutations optimistes, réconciliation
  ├─ état UI local : sélection, menus, panneaux
  └─ Virtual : lignes/cartes visibles
```

Arborescence indicative, à garder petite :

```text
apps/cli/src/commands/board.ts    # lancement et arrêt
apps/board/src/                  # React, routes, features, UI et tokens
packages/board-server/src/       # HTTP, routeurs, DTO, projection, événements
packages/sdk/                   # façade métier existante
packages/core/                  # invariants et cas d’usage existants
packages/fs/                    # persistance et garanties communes d’écriture
```

Le client ne doit jamais importer le runtime filesystem du SDK. Les sorties réseau sont des DTO (IDs string, dates ISO), accompagnés d’un schéma de validation et d’erreurs métier stables. Le typage partagé ne remplace pas la validation des entrées.

Hono sert les assets et monte l’adapter Fetch tRPC ; les adaptateurs de démarrage préservent Node pour le paquet npm et Bun pour le binaire. Sources : [Hono Node](https://hono.dev/docs/getting-started/nodejs), [Hono Bun](https://hono.dev/docs/getting-started/bun). Le binaire doit embarquer le résultat du build frontend, y compris chunks, fontes et CSS ; vérifier qu’il fonctionne hors checkout et sans Internet. La capacité d’embarquement documentée par [Bun](https://bun.com/docs/bundler/executables) ne valide pas automatiquement notre futur pipeline Vite.

### Cycle de données

1. Démarrage : fixer la racine canonique et l’identité du realm/worktree ; scanner et produire une projection versionnée. Charger les résumés utiles à la vue, les corps Markdown au besoin.
2. Lecture : requêter la projection plutôt que relire tous les Markdown à chaque filtre. Conserver une seule propriété des données côté client dans Query ; les filtres et regroupements sont dérivés.
3. Mutation : appliquer immédiatement un état optimiste, puis envoyer la commande métier et sa révision attendue. Ne jamais contourner les gates ou transitions imposées par `@frame/core`.
4. Confirmation : répondre avec l’entité canonique et sa révision ; mettre à jour les listes et détails concernés. Identifier les mutations pour dédupliquer réponse et événement.
5. Changement CLI/éditeur : observer les fichiers, regrouper les notifications, reparser les changements stables et publier les deltas. Un watcher peut perdre des événements ; rescanner au retour de focus/reconnexion et après erreur.
6. Connexion SSE : snapshot et journal doivent partager un curseur cohérent pour éviter les trous entre chargement et abonnement. Utiliser un epoch serveur et un compteur ; si le curseur est inconnu ou expiré, renvoyer un snapshot.
7. Conflit : abandonner le patch devenu obsolète, recharger l’état canonique et afficher l’explication. Ne pas restaurer aveuglément un ancien snapshot si d’autres mutations ont réussi entre-temps.

La séquence SSE est un ordre de synchronisation UI, distinct des traces métier. Aucun besoin de promettre un CRDT ou une édition hors serveur au départ. IndexedDB reste optionnel pour une reprise instantanée ; le Markdown demeure la source d’autorité. Si l’index mémoire devient insuffisant, SQLite/FTS peut servir de projection reconstruisible, sans deuxième base métier.

### Écriture concurrente et fonctionnement local

Le board sera utilisé en parallèle de la CLI et des agents. Une file de mutations dans le seul serveur HTTP ne protège pas les autres processus. Proposer des garanties partagées dans la couche de persistance : verrou interprocessus pour les mutations coopérantes, contrôle de révision, remplacement atomique des fichiers et stratégie explicite pour la paire entité/trace et les compteurs. Les éditeurs externes ne respectent pas forcément le verrou : les conflits doivent rester détectables, sans prétendre offrir une transaction globale sur Git et Markdown.

Le serveur écoute sur loopback, sert UI/API à la même origine, valide Host/Origin et protège les mutations par une session locale. Les requêtes ne choisissent pas librement une racine filesystem. Les ports occupés et l’arrêt doivent être gérés proprement ; une fermeture doit libérer watchers et connexions. Les opérations Git/claims seront extraites des commandes CLI vers une coordination partagée seulement lorsqu’une page les consommera.

## Parité fonctionnelle avec Linear

| Surface | Réutilisation Frame | Travail supplémentaire |
| --- | --- | --- |
| Issues, liste/board, détail | Issue, labels, priorité, statut, assignation | Écrans, raccourcis, sélection multiple, tri et DnD |
| Projets, jalons, documents | Project, Milestone, Spec | Navigation, onglets, rendu Markdown |
| Activité | Trace | Présentation et filtres |
| Mes issues / vues enregistrées | Filtres existants | Identité locale et préférences persistantes |
| Inbox | Traces comme événements possibles | Abonnements, notifications, état lu, snooze |
| Cycles, équipes, initiatives | Pas d’entités correspondantes dans le modèle inspecté | Nouveaux concepts métier et migrations éventuelles |

Un milestone ne devient pas automatiquement un cycle et une trace ne suffit pas à créer une Inbox. L’[Inbox de Linear](https://linear.app/docs/inbox) illustre ces comportements propres. Conserver l’ambition de parité, mais livrer par parcours : shell et issue complète ; projets/vues ; puis les domaines manquants. Un simple thème ne remplit pas la demande « mêmes pages, mêmes onglets ».

## Performance : preuves, inférences et protocole de mesure

**Mesure publiée :** Linear rapporte, après sa migration de styled-components vers StyleX, une réduction d’environ 20–35 % du travail CPU du thread principal sur les pages chargées en vues et environ 30 % de gain dans ses tests sur une machine intermédiaire. Linear précise que l’impact global est difficile à isoler. Ce résultat n’est ni un benchmark Kumo/shadcn ni une promesse pour Frame. [Publication du 26 août 2026](https://linear.app/now/styling-linear-for-the-future-stylex).

**Architecture publiée :** Linear décrit une base locale client et une synchronisation par deltas/checkpoints. Cela motive le cache et les mises à jour incrémentales ; son infrastructure distribuée ne se justifie pas pour un seul utilisateur sur localhost. [Delta sync](https://linear.app/now/rebuilding-delta-sync-read-path), [présentation du sync engine](https://linear.app/now/scaling-the-linear-sync-engine).

**Comparaison raisonnée :**

| Levier | Ce qu’il peut améliorer | Ce qu’il ne résout pas |
| --- | --- | --- |
| Index mémoire | Scans/parsing répétés côté serveur | Premier indexage et invalidation |
| Cache + optimisme | Délai perçu au clic et navigation à chaud | Conflits et erreurs métier |
| Virtualisation | Nombre de nœuds DOM et travail de rendu | Calcul de filtres et mémoire des données |
| CSS statique | Travail de génération/injection de styles | Mauvaise structure React ou layout coûteux |
| Protobuf | Taille et coût de sérialisation selon payload | Rendu, lectures disque et scans |
| SSR | Apparition du contenu initial selon contexte | Réactivité du DnD et fluidité du scroll |

La [documentation TanStack Virtual](https://tanstack.com/virtual/latest/docs/api/virtualizer) décrit le mécanisme de virtualisation ; aucun gain chiffré n’est extrapolé ici.

Pour comparer réellement : mêmes écrans, mêmes données de 1 000 / 10 000 / 50 000 issues synthétiques (tailles des corps fixées), même navigateur et machine, build production, répétitions à froid et à chaud, p50/p95. Isoler temps lancement/scan, premier écran utilisable, ouverture d’issue, filtrage, drag, heap navigateur, RSS serveur et modification externe→affichage. Distinguer démarrage de processus à froid et cache disque réellement froid.

Cibles proposées, à valider : premier écran utile < 1 s à chaud ; navigation et recherche p95 < 100 ms ; mutation visible optimiste < 50 ms ; changement externe visible p95 < 300 ms après stabilisation du fichier ; travail par frame compatible avec 60 Hz (~16,7 ms, ou ~8,3 ms à 120 Hz). Mesurer la confirmation durable séparément du retour optimiste. Ces chiffres sont des budgets de conception, pas des résultats obtenus.

## Reddit : signaux qualitatifs uniquement

- [Kumo-UI, r/CloudFlare, février 2026](https://www.reddit.com/r/CloudFlare/comments/1r3kdf1/kumoui_from_cloudflare/) : intérêt pour les composants, mais peu de retours détaillés d’utilisation longue durée dans ce fil. Pas de conclusion de performance.
- [Shadcn over the longer term, décembre 2023](https://www.reddit.com/r/reactjs/comments/18968oq/any_experiences_good_or_bad_with_shadcn_ui_over/) : question de la maintenance des correctifs après copie/personnalisation. Retour ancien ; ne décrit pas précisément la version actuelle.
- [Is Shadcn Worth the Headaches?, février 2025](https://www.reddit.com/r/react/comments/1iyj8sk/is_shadcn_worth_the_headaches/) : expérience de conflits de dialogues/popups imbriqués, réponses contrastées. Motive un test des overlays ; ne démontre pas un défaut identique de Base UI aujourd’hui.
- [SSR pour un dashboard privé, mars 2024](https://www.reddit.com/r/webdev/comments/1bdqkm3/i_still_cant_see_the_point_of_ssr_looking_to/) : discussion des compromis entre SPA, chargement initial et SSR. Témoignages, pas expérience contrôlée ni consensus technique.

## Suite recommandée

Valider d’abord une tranche complète : liste virtualisée → détail d’issue → changement de statut optimiste → modification CLI visible dans le navigateur. Tester en même temps la fidélité visuelle, les conflits et le packaging npm/binaire. Cette tranche permettra de décider avec des mesures si une couche supplémentaire (SSR, SQLite, ConnectRPC ou cache persistant navigateur) apporte un bénéfice réel.
