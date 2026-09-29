# Index des spécifications — Cible Frame

2026-09-29 · Statut : spécifications proposées, à relire avant implémentation. Aucun des nouveaux contrats ci-dessous n’est présenté comme livré. Base de code inspectée : `451914f`.

## Objectif et autorité

Reprendre les usages Linear utiles dans une CLI locale, avec des objets Markdown lisibles, un historique Git de données indépendant, des branches Frame liées aux travaux de code, un suivi global et une intégration automatique contrôlée. Les changements de propriété, textes et conflits sont accessibles aux humains comme aux agents via les mêmes contrats.

Cet index est créé avant la rédaction des specs. Chaque ligne correspond à un document à rédiger dans ce dossier ; l’état final est renseigné après vérification. Les documents de recherche restent des sources et une trace de raisonnement, pas des contrats concurrents. En cas de divergence, les présentes specs définissent la cible proposée. Les anciennes specs Board/CLI restent applicables à leurs sujets non modifiés ; aucun nouveau Board graphique n’est commandé ici.

## Catalogue complet

| ID | Spécification | Fonctionnalités couvertes | Dépendances de conception | État |
|---|---|---|---|---|
| S00 | [Contrats transverses](00-contrats-transverses.md) | Glossaire, identités, CLI/SDK, erreurs, provenance, scopes, conformité Linear | — | Rédigée |
| S01 | [Workspace, équipes et workflows](01-workspace-equipes-workflows.md) | Membres, équipes, statuts, priorités, labels, estimations | S00, S11 | Rédigée |
| S02 | [Issues et relations](02-issues-relations-cycle-de-vie.md) | CRUD, sous-issues, transferts, relations, doublons, suppression/restauration/archives | S01, S03 | Rédigée |
| S03 | [Projets et milestones](03-projets-milestones.md) | Propriétés, membres, dates, jalons, dépendances et ressources | S01 | Rédigée |
| S04 | [Initiatives](04-initiatives.md) | Composition, sous-initiatives multiparents, navigation et validation du graphe | S03 | Rédigée |
| S05 | [Documents et templates](05-documents-templates.md) | Document commun, migration Spec, contenu, attachements, templates de création | S01, S03, S04 | Rédigée |
| S06 | [Cycles](06-cycles.md) | Périodes d’équipe, affectations, cooldown, historique et règles de report | S02 | Rédigée |
| S07 | [Vues et recherche](07-vues-recherche.md) | Filtres structurés, vues sauvegardées, ordre, me, recherche et index | S02, S03, S04, S05, S06 | Rédigée |
| S08 | [Pilotage et progression](08-pilotage-progression.md) | Projet, milestone, initiative, cycle, santé publiée et explication des mesures | S07, S17 | Rédigée |
| S09 | [Historique, insights et prévisions](09-historique-insights-previsions.md) | Événements fiables, scope, métriques de flux, prévisions et confiance | S08 | Rédigée |
| S10 | [Agents, claims et exécutions](10-agents-claims-executions.md) | next, brief, réservation, tentatives, sous-agents, artefacts et reprise | S02, S07, S13 | Rédigée |
| S11 | [Stockage et mutations sûres](11-stockage-transactions.md) | Markdown, révisions, journal, verrou, publication, reprise et idempotence | S00 | Rédigée |
| S12 | [Brouillons et édition](12-brouillons-edition.md) | begin/diff/save, éditeur, patch, conflit local et maintenance | S11 | Rédigée |
| S13 | [Branches et espaces de travail](13-branches-workspaces.md) | Racine orpheline, branches associées, .frame imbriqué, registre et lifecycle | S11 | Rédigée |
| S14 | [Checkpoints et hooks](14-checkpoints-hooks.md) | Snapshot scellé, trailer, commit associé, checkpoint autonome, replay et reprise | S13 | Rédigée |
| S15 | [Intégration et conflits](15-integration-conflits.md) | Merge sémantique, contextualisation, résolution, squash terminal et reçus | S02, S03, S12, S14 | Rédigée |
| S16 | [Vue globale des travaux](16-projection-globale.md) | accepted/work/global, deltas, provenance, fraîcheur et déduplication | S07, S10, S15 | Rédigée |
| S17 | [Collaboration et notifications](17-collaboration-notifications.md) | Comments, fils, mentions, updates de santé, abonnements et inbox personnelle | S02, S03, S04, S05, S11 | Rédigée |
| S18 | [Automatisations et admission](18-automatisations-admission.md) | Runner, récurrence, rappels, triage, intake, événements PR et règles de statut | S06, S10, S15, S17 | Rédigée |
| S19 | [Synchronisation Linear](19-synchronisation-linear.md) | Capacités vérifiées, mapping, import, push/bidirectionnel, base et conflits | S01–S06, S15, S17 | Rédigée |
| S20 | [Synchronisation Git et service partagé](20-synchronisation-git-service.md) | Fetch/push, refs retenues, autorité distante, multiclone, droits et offline | S14, S15 | Rédigée |
| S21 | [Migration et réception](21-migration-validation.md) | Format, anciens Spec/gates/compteurs, rollout, sauvegarde, corpus et tests transverses | S00–S20 | Rédigée |

Compagnon concret : [arborescence d’un programme complet](22-exemple-programme.md), avec emplacement des milestones, documents, issues et métadonnées Git. Ce compagnon illustre les contrats ; il n’ajoute pas de fonctionnalité.

## Convention commune de rédaction

Chaque spec indique objectif, inclus/exclus, données et invariants, commandes/contrat de résultat, comportement nominal, erreurs et concurrence, responsabilité des modules, critères d’acceptation identifiés et sources. Les exigences sont normatives pour la cible, pas une preuve de fonctionnement actuel. Les commandes proposées peuvent remplacer les interfaces actuelles : leur migration relève de S21.

Les décisions techniques réversibles peuvent être prises pendant l’implémentation si elles préservent ces contrats. Les coefficients ou capacités Linear non établis ne sont pas inventés : une fonctionnalité précise reste indisponible avec un motif explicite jusqu’à réussite du scénario de conformité associé. Cela constitue un comportement spécifié, pas une promesse de parité non vérifiée.

## Contrats communs à respecter dans chaque lot

- Commandes singulières (`frame issue`, `frame project`, etc.) ; transport explicite `frame sync git …` et `frame sync linear …`.
- `--scope accepted|work|global` pour les lectures ; listes/détails utilisent work, rapports officiels et next utilisent accepted selon S00 ; `global` n’est jamais une cible de mutation. Écriture sur work courant par défaut ; autorité accepted explicitement résolue.
- Identité métier UUID stable, aliases humains ; état non estimé distinct de zéro ; Spec devient Document avec métadonnées locales préservées.
- Mutations CLI/SDK : même coordinateur, `operationId` et révisions attendues, validation puis publication ; pas d’écriture directe indépendante par les connecteurs.
- `frame/main` indépendant du code ; `frame/work/<workId>` issu d’une branche Frame ; un `.frame/` de données par travail, registre dans le common dir Git.
- Commits Frame indexés sur snapshots scellés pour les commits code ; aucun réseau dans les hooks ; association tardive explicitement distinguée.
- Squash terminal avec reçu, source immuable, nouvelle époque pour poursuivre. Aucun dernier écrivain gagnant implicite.
- Seul l’état accepté déclenche des effets externes par défaut. Claims, exécutions et présence technique restent distincts du statut métier Linear.
- Credentials et état personnel privé hors Git ; autorisations d’un service distant non simulées par des fichiers distribués.

## Couverture des recherches

| Source | Specs correspondantes |
|---|---|
| [Modèle local](../../../research/01-modele-local.md) | S00–S06, S17, S21, exemple |
| [Pilotage calculé](../../../research/02-pilotage-calcule.md) | S07–S10, S16 |
| [Services actifs](../../../research/03-services-actifs.md) | S10, S17–S20 |
| [Worktrees](../../../research/04-worktrees-et-etat-partage.md) | S10, S13, S16, S20 ; alternative unique remplacée |
| [Édition concurrente](../../../research/05-concurrence-et-edition-markdown.md) | S11, S12, S15 |
| [Design global](../../../research/06-design-global-branches-frame.md) | S11–S16, S20, S21 |
| [Audit Git](../../../research/07-git-hooks-et-cas-limites.md) | S13–S15, S20, S21 |

## Extensions explicitement différées

SLA, Customer Requests, releases métier, SSO/SCIM, gouvernance Enterprise, présence et coédition CRDT, reproduction des Loops, annotations inline avancées et stockage binaire collaboratif ne sont pas des engagements de cette cible. Les références/valeurs importées sont conservées ou leur exclusion est annoncée avant application. Leur activation exigera une spec supplémentaire motivée par un usage, sans imitation partielle présentée comme une parité Linear.

## Ordre de réalisation permis

S00/S11 → modèle et édition → branches/checkpoints → fusion/projection → lectures métier et collaboration → automatisation/synchronisation. Certaines tranches du modèle et de l’infrastructure peuvent être développées indépendamment, mais aucune écriture connecteur n’est livrée avant les garanties de mutation. S21 fournit les critères transverses dès le début, puis sert de réception finale. Ce dossier est un ensemble de specs, pas un plan d’exécution ni une autorisation de lancement automatique de travaux.

## État de rédaction et vérifications

Les 22 specs S00–S21 et le compagnon S22 sont rédigés. Les lots ont été relus avec vérification croisée des scopes, autorités, jobs, point de commit Git, horodatages d’updates et règles de cycles. Les liens locaux et blocs Markdown ont été contrôlés ; 213 critères d’acceptation identifiés couvrent les comportements à valider.

« Rédigée » signifie document complet pour revue, pas fonctionnalité implémentée ni critère passé. Aucun test produit, effet distant, branche de données ou migration n’a été exécuté par cette rédaction. Les dépendances du tableau sont les prérequis de conception ; les raccordements optionnels entre modules sont expliqués dans chaque spec et ne créent pas de cycle de livraison obligatoire.
