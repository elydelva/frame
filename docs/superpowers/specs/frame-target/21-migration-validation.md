# S21 — Migration, compatibilité et réception

Statut : cible proposée · Dépendances de réception : S00–S20 · [Index](README.md).

## Objectif

Passer du Frame actuel à la cible sans perdre les données, les tentatives d’agents ou les modifications de branches anciennes. Définir les preuves nécessaires avant d’annoncer qu’une fonctionnalité est livrée. Cette spec est utilisée dès les premières tranches, pas seulement à la fin.

## Baseline et incompatibilités

À `451914f`, les issues appartiennent à un projet, Spec est un type distinct, les worktrees démarrent l’issue dans leur copie locale, les claims résident dans le Git common directory, et les entités sont sauvegardées sans le protocole cible de concurrence. Les propositions de ce dossier ne sont pas des capacités actuelles.

| Source existante | Transformation obligatoire |
|---|---|
| IDs séquentiels locaux et références par identifiant historique | Attribuer UUID stables ; conserver alias et table de redirection, ne pas générer deux IDs pour le même objet reconnu |
| Compteurs de branches divergentes | Détecter collisions ; attribution finale coordonnée, aucun compteur fusionné par max seulement |
| Projet obligatoire d’une issue | Préserver projet existant ; ajouter équipe choisie et permettre l’absence de projet pour les nouvelles issues |
| Statuts fixes et priorité libre | Plan de mapping vers workflow/valeurs cibles ; valeur inconnue explicitement à résoudre |
| Estimations historiques en heures | Conserver unité/provenance ; aucune conversion implicite heures→points |
| Spec et son workflow | Document + métadonnées legacy, corps et références préservés ; pas de faux statut distant de Document |
| Gates obligatoires | Relations communes + politique locale legacy explicite lorsqu’encore nécessaire ; pas de changement de sens silencieux |
| Milestone à état manuel | Préserver legacy ; nouvelle progression calculée séparée, sans rétrocalcul fabriqué |
| Acteurs texte libres | Identités locales mappées ; auteur historique conservé sans prétendre à une authentification |
| `.frame` suivi dans les branches de code | Export/sauvegarde, historique de données indépendant, retrait explicite du suivi puis montage des worktrees données |
| Ancien stateDir Board | Lire et récupérer les journaux avant migration vers le runtime identifié ; ne pas traiter pending.json comme cache |

## Plan de migration inspectable

```sh
frame migrate plan --to paired-branches --json
frame migrate inspect PLAN-id
frame migrate apply PLAN-id
frame migrate status PLAN-id --json
frame migrate resume PLAN-id
```

Plan : ID, format source/cible, checkout/refs inventoriés, empreintes, mappings, divergences, chemins de sauvegarde, objets non représentables, étapes et préconditions. Le plan ne crée pas de branches tant qu’il n’est pas appliqué. Apply refuse les bases modifiées ; il ne reprend pas silencieusement une vieille sélection.

Inventorier les worktrees enregistrés, branches pertinentes connues, copies non commitées et `.frame` configurés hors dépôt. Ne pas scanner arbitrairement tout le disque. Une branche distante non récupérée est signalée comme non inventoriée.

## Exécution reprenable

1. Passer l’espace en maintenance et refuser les écrivains incompatibles ; l’opérateur doit arrêter les anciens clients non coopérants.
2. Résoudre les journaux existants, puis sauvegarder données commitées et non commitées ainsi que drafts/opérations nécessaires.
3. Valider mappings et divergences ; choisir explicitement la base acceptée. Ne pas sélectionner « dernier horodatage gagne ».
4. Initialiser la racine Frame indépendante et importer les objets avec provenance.
5. Recréer les travaux nécessaires depuis leurs bases connues ou marquer la filiation non établie pour résolution.
6. Retirer le suivi des chemins de données du code, puis installer les montages et le registre ; préserver toute collision de dossier.
7. Valider les graphes, correspondances et rapports de pertes avant d’activer les écritures cibles.
8. Installer/composer les hooks et effectuer les diagnostics, puis sortir de maintenance.

Chaque étape a un reçu et une précondition ; une relance reconnaît ce qui est fait. Les chemins de code sales restent préservés. Aucun reset, clean, push ou destruction des sources n’est implicite dans la migration.

Avant activation et sans nouvelles mutations cibles, un retour au snapshot source peut être proposé. Après nouvelles mutations, « rollback » devient un plan d’export/réconciliation ; on ne rembobine pas le travail récent. Les sauvegardes ne sont supprimées qu’après réception et rétention explicites.

## Compatibilité des clients

Le manifeste expose une version minimum de writer et les capacités nécessaires. Un ancien client qui ne comprend pas le protocole est refusé par les points d’entrée mis à jour. Un binaire historique ignorant le manifeste ne peut pas être contrôlé magiquement : son arrêt ou l’isolation des droits fait partie de l’exploitation.

Les aliases CLI existants peuvent rediriger une commande lorsque la sémantique est identique, en avertissant. Un ancien `spec status` ne devient pas automatiquement un statut de Document. Les endpoints Board doivent migrer DTO, erreurs, idempotence, révisions et scopes ; les sessions HTTP et protections d’accès restent en vigueur.

Le plan d’implémentation doit annoncer les ruptures SDK ; aucune interface non transactionnelle n’est étiquetée sûre par défaut. Les adapters custom conservent leur périmètre de garantie déclaré.

## Matrice de preuves

| Niveau | Preuves requises |
|---|---|
| Modèle | Fixtures des champs/relations, refus des invariants, mapping legacy explicite |
| CLI/SDK | Même résultat métier, schémas JSON et codes de sortie, options et aliases documentés |
| Transactions | Deux processus, conflits réels, interruptions à chaque étape et reprise idempotente |
| Git | Dépôts jetables avec hooks, code partiel, amend/rebase/ff/squash, refs retardées et nettoyage contrôlé |
| Projection | Provenance, déduplication, générations, stale/missing et reconstruction de cache |
| Connecteurs | Contrat fournisseur vérifié par opération ; fixtures/replays plus test autorisé isolé quand nécessaire |
| Durabilité | Crash processus testé ; coupure machine annoncée seulement si effectivement validée par OS/filesystem |
| Service partagé | Authentification/autorisation réelles, concurrence interclients, visibilité et offline |

Les tests distants nécessitant création/publication réelle restent une étape distincte avec ressources et autorisation appropriées. Un test mock ne prouve ni permission API ni parité runtime.

## Corpus de conformité obligatoire

Le corpus comprend : issue sans projet, plusieurs équipes, labels homonymes/exclusifs, réouverture et doublon, graphes multiparents, projet vu par deux chemins, milestone vide, cycle DST/cooldown, null/zero/estimations désactivées, Document avec tableaux/mentions/liens, suppression vs permission perdue, corps concurrent, source/cible sale, code merged/frame pending et clone sans bases.

Chaque scénario conserve inputs, versions de paramètres, résultat attendu, source normative et statut de validation. Pour un coefficient ou une capacité Linear non établi, le résultat attendu est une capacité refusée avec `CAPABILITY_UNAVAILABLE`, ou un rapport valide dont la mesure vaut null, `status: unavailable` et `reason: FORMULA_UNVERIFIED` selon S08, jusqu’à l’obtention d’une preuve ; on ne remplace pas le test par une formule supposée.

## Critères de réception transverses

- S21-A1 : migration rejouée conserve les IDs/aliases et ne duplique aucun objet.
- S21-A2 : toutes les différences entre copies sont présentées avant choix d’accepted.
- S21-A3 : chaque Spec conserve son texte et ses métadonnées sans faux mapping Linear.
- S21-A4 : perte réseau/disque plein/crash entre étapes reste reprenable et diagnostiquerable.
- S21-A5 : ancien writer incompatible est identifié ; aucun récit de garantie globale avec écrivain non coopérant actif.
- S21-A6 : les critères S00–S20 sont liés à des tests ou preuves nommées dans le rapport de livraison.
- S21-A7 : `bun run typecheck`, `bun run lint`, `bun test` et `bun run build` réussissent pour les tranches implémentées, ou leurs échecs de base sont explicitement distingués.
- S21-A8 : la documentation et `--help` n’annoncent aucune commande non enregistrée comme disponible.
- S21-A9 : critères non exécutés, plateformes non testées et capacités unverified restent visibles.
- S21-A10 : restauration/export préserve les nouveaux travaux ou refuse un retour arrière destructif.

## Sources et statut de preuve

[Recherches 01](../../../research/01-modele-local.md), [05](../../../research/05-concurrence-et-edition-markdown.md), [06](../../../research/06-design-global-branches-frame.md), [07](../../../research/07-git-hooks-et-cas-limites.md), [spec Board data existante](../2026-09-29-frame-board-data-design.md). Ce dossier a été relu et ses liens vérifiés ; les scénarios ci-dessus ne sont pas présentés comme exécutés par la rédaction des specs.
