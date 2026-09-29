# Inventaire opérationnel de Linear

Date de consultation : **29 septembre 2026**. Sources : documentation officielle Linear et annonces officielles datées. Inventaire fonctionnel destiné à la comparaison avec Frame ; aucune action effectuée dans un workspace Linear. Il ne constitue pas un test de chaque fonctionnalité ni une garantie d'exhaustivité des intégrations ou réglages secondaires.

## Structure et planification

| Capacité | Fonctionnement vérifié | Source |
|---|---|---|
| Modèle général | Workspace → équipes ; les issues appartiennent à une équipe. Projets et initiatives structurent les résultats et objectifs. Cycles et vues représentent d'autres axes d'organisation. | [Concepts](https://linear.app/docs/conceptual-model) |
| Initiatives | Regroupement intentionnel de projets ; statut Proposed, Planned, Active, Completed ou Canceled ; priorité, labels, owner, lead team, target date, description, ressources et dernière update. | [Initiatives](https://linear.app/docs/initiatives) |
| Initiative d'équipe | Ownership par équipe ; initiative privée lorsqu'elle est portée par une équipe privée. Disponible Business/Enterprise. Vues d'initiatives enregistrées : Enterprise. | [Initiatives](https://linear.app/docs/initiatives) |
| Sous-initiatives | Jusqu'à cinq niveaux, plusieurs parents possibles ; agrégation des projets descendants dans la progression du parent ; affichage direct ou incluant descendants. Enterprise. | [Sub-initiatives](https://linear.app/docs/sub-initiatives) |
| Projets | Nom, résumé, description détaillée, statut, lead unique, équipes contributrices et équipe pilote, membres, labels, début, cible, icône/couleur, ressources et documents. | [Project overview](https://linear.app/docs/project-overview) |
| Priorité des projets | Aucune, low, medium, high, urgent ; ordre manuel au sein d'un niveau. | [Project priority](https://linear.app/docs/project-priority) |
| Statuts des projets | Noms, descriptions et couleurs configurables ; statuts du workspace sur tous les plans. Statuts par équipe et héritage : Business/Enterprise ; l'équipe pilote détermine les statuts disponibles. | [Project status](https://linear.app/docs/project-status) |
| Jalons | Objet interne au projet : titre, description, date optionnelle, issues associées et progression. Réordonnancement, déplacement temporel, conversion en projet. Aucun jalon partagé entre projets. | [Project milestones](https://linear.app/docs/project-milestones) |
| Dépendances de projets | Relations bloquant/bloqué, de fin vers début uniquement ; visualisation des violations de dates et déplacement coordonné sur la timeline. | [Project dependencies](https://linear.app/docs/project-dependencies) |
| Santé et updates | Publications historisées sur initiatives/projets avec santé on track / at risk / off track, texte, pièces jointes, changements depuis la précédente update, rappels et diffusion Slack. | [Initiative and Project updates](https://linear.app/docs/initiative-and-project-updates) |
| Graphe projet | Scope, vélocité, progression dans le temps et prédiction de fin. | [Project overview](https://linear.app/docs/project-overview) |
| Timeline | Projets regroupés, différentes résolutions temporelles, jalons, dépendances, santé et superposition des cycles ; pas de timeline d'issues. | [Timeline](https://linear.app/docs/timeline) |
| Modèles de projet | Projet préconfiguré avec équipes, lead, membres, statut, initiatives, jalons, issues et sous-issues ; modèles workspace ou équipe et défaut d'équipe. | [Project templates](https://linear.app/docs/project-templates) |

## Issues, propriétés et exécution

| Capacité | Fonctionnement vérifié | Source |
|---|---|---|
| Propriétés d'issue | ID, titre/description, équipe, statut, priorité, assignee, créateur, labels, estimation, projet, jalon, cycle, échéance ou SLA ; parents et liens ; timestamps de cycle de vie. | [Create issues](https://linear.app/docs/creating-issues), [Exporting data](https://linear.app/docs/exporting-data) |
| Données enrichies | Agent délégué, releases, clients/revenus, temps dans le statut, PR/commits, liens et incidents Sentry sont également exposés selon les fonctions connectées. | [Issue templates](https://linear.app/docs/issue-templates), [Display options](https://linear.app/docs/display-options) |
| Sous-issues | Décomposition, création en lot depuis liste/checklist/commentaire, héritage de certaines propriétés, changement de parent, duplication de l'arbre, conversion en projet. Automatisation optionnelle des clôtures parent/enfants. | [Parent and sub-issues](https://linear.app/docs/parent-and-sub-issues) |
| Relations | Bloque, bloqué par, lié, doublon ; résolution d'un blocage vers « related » ; doublon relié au canonique et statut système dédié. | [Issue relations](https://linear.app/docs/issue-relations) |
| Labels | Scope workspace/équipe, nom, couleur, description ; groupes à un niveau, un seul label d'un groupe par issue ; fusion, changement de scope, archivage et suppression. | [Issue labels](https://linear.app/docs/labels) |
| Estimations | Activation et échelle par équipe : linéaire, exponentielle, Fibonacci ou tailles de vêtements ; calcul d'effort pour cycles/projets. | [Estimates](https://linear.app/docs/estimates) |
| Échéances | Date, couleur selon urgence, filtres/tris et notifications proches/en retard. Une issue ne cumule pas due date et SLA. | [Due dates](https://linear.app/docs/due-dates) |
| SLA | Règles conditionnelles ordonnées, durées dont jours ouvrés, application manuelle, risque/dépassement/réussite/échec, alertes et analyse. Business/Enterprise. | [SLAs](https://linear.app/docs/sla) |
| Workflows | Statuts configurables par équipe, regroupés par catégories de cycle de vie ; statut par défaut ; fermeture des issues inactives et archivage automatiques. | [Issue status](https://linear.app/docs/configuring-workflows) |
| Suppression et restauration | Suppression avec récupération pendant 30 jours ; archivage automatique des éléments clos, restauration depuis les archives ; réouverture des issues auto-closes par changement de statut. | [Delete and archive issues](https://linear.app/docs/delete-archive-issues) |
| Modèles d'issue | Propriétés prédéfinies, description, placeholders, sous-issues ; modèles standard ou formulaires ; valeurs par défaut par équipe. | [Issue templates](https://linear.app/docs/issue-templates) |
| Formulaires | Texte, texte long, choix, cases à cocher, date et instructions ; champs obligatoires ; certains champs correspondent directement aux propriétés natives. | [Issue templates](https://linear.app/docs/issue-templates) |
| Récurrence | Génération selon cadence et échéance ; conversion d'une issue existante ; gestion dédiée par équipe. | [Create issues](https://linear.app/docs/creating-issues) |
| Création externe | Adresses email d'équipe/template et URL de création préremplies. | [Create issues](https://linear.app/docs/creating-issues) |
| Actions en lot et navigation | Sélection multiple ; propriétés visibles, tri, groupement, ordre manuel et affichage des sous-issues. | [Display options](https://linear.app/docs/display-options), [Linear Docs](https://linear.app/docs) |

**Champs personnalisés : non établi.** Les sources consultées confirment les champs natifs, groupes de labels et champs de formulaires. Elles ne permettent pas d'affirmer l'existence d'un moteur général de propriétés personnalisées typées arbitraires attachées aux issues/projets. Les réponses de formulaire inscrites dans une description ne doivent pas être assimilées à un tel moteur. Cette absence de preuve n'est pas une preuve d'absence. [Issue templates](https://linear.app/docs/issue-templates), [Issue labels](https://linear.app/docs/labels)

## Équipes, rythme et réception du travail

| Capacité | Fonctionnement vérifié | Source |
|---|---|---|
| Équipes | Membres, identifiant, timezone, workflows, labels, templates, cycles, triage, ressources ; projets multiéquipes et issue monoéquipe ; équipes privées et retraite en lecture seule. | [Teams](https://linear.app/docs/teams) |
| Sous-équipes | Héritage de membres, cycles, labels/templates et éventuellement statuts/estimations ; paramètres Git et récurrence indépendants. Business/Enterprise ; cinq niveaux sur Enterprise. | [Sub-teams](https://linear.app/docs/sub-teams) |
| Cycles | Cadence répétée de 1–8 semaines, cooldown, création des prochains cycles, changement de dates futures, report des issues ouvertes, ajout automatique des issues actives, capacité estimée et calendrier. | [Cycles](https://linear.app/docs/use-cycles) |
| Triage | File d'entrée, examen, traitement et snooze ; règles de routage/mise à jour ; responsabilité de triage. Règles/responsabilité/intelligence : Business/Enterprise. | [Triage](https://linear.app/docs/triage) |
| Triage Intelligence | Suggestions de team, projet, assignee, labels, doublons et relations ; explication, acceptation/refus, application automatique configurable et instructions de guidage. | [Triage Intelligence](https://linear.app/docs/triage-intelligence) |
| Asks | Intake interne Slack/email/formulaires transformé en issues, workflow de triage et réponse aux demandeurs. Business/Enterprise, capacités avancées Enterprise. | [Linear Asks](https://linear.app/docs/linear-asks) |
| Asks Slack | Création depuis message, emoji, commande ou agent ; formulaires ; fils synchronisés dans les deux sens, statut et assignee visibles au demandeur. | [Asks with Slack](https://linear.app/docs/linear-asks-slack) |
| Asks web | Formulaires d'employés sans compte Linear, authentification SAML, accusé de réception email et réponses synchronisées. Enterprise. | [Asks Web Forms](https://linear.app/docs/linear-asks-web-forms) |
| Clients et demandes | Entités client avec domaine, nom, logo, revenu, taille, statut, tier ; demandes reliées aux issues/projets avec contexte/source ; filtres d'impact, abonnements et export CSV. | [Customer Requests](https://linear.app/docs/customer-requests) |

## Pilotage et collaboration

| Capacité | Fonctionnement vérifié | Source |
|---|---|---|
| Vues enregistrées | Collections dynamiques d'issues/projets par filtres, à distinguer des initiatives dont les projets sont choisis explicitement. | [Custom Views](https://linear.app/docs/custom-views) |
| Filtres | Propriétés, dates et relations ; groupes AND/OR imbriqués ; filtres construits en langage naturel ; partage via URL. | [Filters](https://linear.app/docs/filters) |
| Recherche | Issues, projets, documents ; titres, descriptions/commentaires des issues ; filtres, recherche par identifiant et recherche locale à la vue. | [Search](https://linear.app/docs/search) |
| Travail personnel | Issues assignées, créées, suivies et activité récente ; organisation par urgence/blocages/cycles. | [My issues](https://linear.app/docs/my-issues) |
| Insights | Analyse des issues avec mesures et dimensions, tendances et recherche de blocages ; disponible Business/Enterprise. | [Insights](https://linear.app/docs/insights) |
| Dashboards | Plusieurs graphiques/tableaux/indicateurs, filtres globaux et locaux, exploration des issues sous-jacentes. Enterprise. | [Dashboards](https://linear.app/docs/dashboards) |
| Documents | Documents liés au travail, références croisées, commentaires inline/réponses/résolution, abonnements et notifications. | [Documents](https://linear.app/docs/documents) |
| Discussions | Commentaires, réponses en fils, résolution, pièces jointes, réactions, commentaires inline et conversion d'un commentaire en issue ; résumés IA selon le plan. | [Comments and reactions](https://linear.app/docs/comment-on-issues) |
| Notifications | Inbox, desktop, mobile, Slack, email ; abonnements aux issues et fils, préférences de canal, digests. | [Notifications](https://linear.app/docs/notifications) |

## Code, agents et automatisation

| Capacité | Fonctionnement vérifié | Source |
|---|---|---|
| GitHub | Liens branches/PR/commits, états de review, transitions de statut sur événements Git, règles par branche cible ; synchronisation d'issues et commentaires à un/deux sens avec restrictions. | [GitHub](https://linear.app/docs/github) |
| Releases | Pipelines continus ou planifiés, environnements/stages, issues livrées, commit SHA, report des issues ouvertes, transitions automatiques de statut, release notes/changelog. Business : 15 pipelines ; Enterprise : sans limite. | [Releases](https://linear.app/docs/releases) |
| Linear Agent | Chat contextualisé, recherche/synthèse, modifications du travail, rédaction, skills personnels/équipe, respect des permissions du demandeur. | [Linear Agent](https://linear.app/docs/linear-agent) |
| Coding sessions | Implémentation dans environnement de code, dépendances, exécution d'applications, vérification navigateur/captures ; lancement direct ou via triage. | [Coding sessions](https://linear.app/docs/coding-sessions) |
| Loops | Automatisations par calendrier ou événements d'issues, projets, initiatives, cycles et releases ; instructions, Slack et connecteurs MCP ; exécutions inspectables. | [Loops](https://linear.app/docs/loops) |
| Évolutions Loops 2026 | Depuis septembre : davantage d'événements projet/initiative/cycle, édition de documents et communication Slack. | [Annonce du 14 septembre 2026](https://linear.app/changelog/2026-09-14-loops-for-product-management) |
| Facturation IA | Crédits mutualisés prépayés, sessions de code et runs de Loops facturés à l'usage. | [AI Credits](https://linear.app/docs/ai-credits) |
| Agents tiers | Apps installables, mentions/délégation, commentaires, sessions et activités visibles, lifecycle d'exécution et webhooks dédiés. API agents en Developer Preview. | [Agents API](https://linear.app/developers/agents), [Agent Interaction](https://linear.app/developers/agent-interaction) |
| API publique | GraphQL avec introspection, requêtes/mutations, API keys/OAuth2 et SDK TypeScript. | [GraphQL](https://linear.app/developers/graphql) |
| Webhooks et MCP | Notifications externes sur événements et serveur MCP officiel pour connecter des assistants. | [Webhooks](https://linear.app/developers/webhooks), [MCP server](https://linear.app/docs/mcp) |
| Connecteurs opérationnels | Slack ; feedback/support via Intercom, Zendesk, Front, Salesforce ; synchronisation et possibilités variables selon connecteur/plan. | [Slack](https://linear.app/docs/slack), [Customer Requests](https://linear.app/docs/customer-requests) |

**Réserve sur les plans Loops :** la page Loops indique « paid plans », tandis que la page AI Credits et l'annonce de lancement citent Business/Enterprise. Ne pas figer une éligibilité Basic sur cette seule documentation contradictoire. [Loops](https://linear.app/docs/loops), [AI Credits](https://linear.app/docs/ai-credits)

## Administration et portabilité

| Capacité | Fonctionnement vérifié | Source |
|---|---|---|
| Gouvernance | Rôles, invités, ownership et permissions d'équipe : configuration, labels, templates, membres ; règles de visibilité. | [Members and roles](https://linear.app/docs/members-roles) |
| Identité | SAML, provisioning SCIM, domaines et gestion des méthodes de connexion. Enterprise. | [SAML](https://linear.app/docs/saml-and-access-control) |
| Audit | Événements d'accès/settings, conservation 90 jours, UI/API et export vers webhook/SIEM. Enterprise. | [Audit log](https://linear.app/docs/audit-log) |
| Import | Assistants Jira, GitHub, Asana, Shortcut, Linear et CLI ; mapping des utilisateurs/objets, capacités variables. | [Importing guidance](https://linear.app/docs/import-issues) |
| Export | Issues du workspace en CSV, export via API et événements via webhooks. Le CSV d'issues n'est pas un clone complet du workspace. | [Exporting Data](https://linear.app/docs/exporting-data) |
| Limite de migration | L'importateur CLI CSV importe moins d'objets que les assistants dédiés, notamment pas les projets/commentaires pris en charge par ceux-ci. | [CLI Importer](https://linear.app/docs/cli-importer) |

## Conséquence pour une comparaison « Linear local en Markdown »

L'inventaire distingue trois choses à comparer séparément : **les objets et propriétés**, **les règles qui les font évoluer**, et **les surfaces de consultation/collaboration**. Écrire une date, un owner ou une initiative dans du texte permet de conserver l'information ; cela ne démontre pas encore une relation validée, un filtrage, une agrégation, une notification ou une automatisation. Cette distinction est une grille d'analyse proposée pour Frame, pas une capacité supplémentaire attribuée à Linear.
