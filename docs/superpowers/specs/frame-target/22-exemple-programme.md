# Exemple — Programme Enterprise et travaux parallèles

Compagnon illustratif de S00–S21, non format déjà implémenté. Les IDs courts facilitent la lecture ; les fichiers réels utilisent les UUID du contrat. Les frontmatters ci-dessous sont des extraits partiels : champs communs, dates et métadonnées de révision/provenance sont omis ; ils ne constituent pas des fixtures directement importables. L’exemple ne fixe aucun mapping API Linear supplémentaire.

## Dans le dépôt de code et sur GitHub

```text
checkout humain : enterprise/                 branche code main
├── .git/
│   └── frame/
│       ├── registry.json
│       ├── operations/                       reprise, pas cache jetable
│       ├── snapshots/                        snapshots avant checkpoint
│       ├── drafts/                           textes non publiés
│       ├── conflicts/
│       └── cache/                            reconstruisible
├── .gitignore                                contient /.frame/
├── apps/
├── packages/
└── .frame/                                   worktree branche frame/main
    ├── .git                                  fichier de liaison Git
    ├── workspace.md
    ├── users/USER-ELY.md
    ├── teams/
    │   ├── TEAM-PLATFORM.md
    │   └── TEAM-PRODUCT.md
    ├── workflows/
    │   ├── TEAM-PLATFORM.json
    │   └── TEAM-PRODUCT.json
    ├── initiatives/
    │   ├── INIT-ENTERPRISE.md
    │   ├── INIT-SECURITY.md
    │   └── INIT-ONBOARDING.md
    ├── projects/
    │   ├── PROJ-SSO/
    │   │   ├── project.md
    │   │   └── milestones/
    │   │       ├── MILE-DESIGN.md
    │   │       ├── MILE-PILOT.md
    │   │       └── MILE-GA.md
    │   └── PROJ-INVITATIONS/
    │       ├── project.md
    │       └── milestones/
    │           ├── MILE-ALPHA.md
    │           └── MILE-BETA.md
    ├── issues/
    │   ├── ISSUE-SAML.md                      alias PLAT-101
    │   ├── ISSUE-SAML-TESTS.md                sous-issue PLAT-102
    │   ├── ISSUE-INVITE.md                    alias PROD-81
    │   └── ISSUE-TRIAGE.md                    sans projet
    ├── cycles/
    │   ├── CYCLE-PLATFORM-21.md
    │   └── CYCLE-PRODUCT-17.md
    ├── documents/
    │   ├── DOC-SSO-SPEC.md
    │   ├── DOC-SSO-DECISIONS.md
    │   └── DOC-INVITE-DESIGN.md
    ├── comments/COMMENT-1.md
    ├── updates/UPDATE-SSO-1.md
    ├── views/VIEW-MY-URGENT.md
    ├── templates/TEMPLATE-SPEC.md
    └── _frame/
        ├── manifest.json
        ├── works/WORK-SSO.json
        ├── checkpoints/CP-1.json
        ├── integrations/INT-1.json
        ├── operations/OP-1.json
        └── tombstones/

checkout agent : enterprise-saml/             branche code codex/saml
├── apps/
├── packages/
└── .frame/                                   branche frame/work/<WORK-SSO>
    ├── issues/ISSUE-SAML.md                   proposition locale
    ├── documents/DOC-SSO-SPEC.md              proposition locale
    └── …                                    snapshot complet + métadonnées
```

Les sous-dossiers métier sont la racine de la branche Frame sur GitHub : en sélectionnant `frame/main`, on voit `issues/`, `projects/`, etc., sans niveau `.frame/` supplémentaire. Le dépôt `main` n’inclut pas le contenu du worktree imbriqué.

## Où se trouvent les milestones ?

Chaque milestone appartient à un projet et réside dans son dossier `milestones/`. Une issue référence le jalon par ID ; elle n’est pas copiée sous ce dossier. Les cycles restent au niveau workspace, avec une équipe propriétaire : ils ne sont ni des milestones ni des sous-projets.

```yaml
# issues/ISSUE-SAML.md — IDs illustratifs
---
id: ISSUE-SAML
kind: issue
identifier: PLAT-101
title: Permettre la connexion SAML
teamId: TEAM-PLATFORM
projectId: PROJ-SSO
milestoneId: MILE-PILOT
cycleId: CYCLE-PLATFORM-21
statusId: STATE-IN-PROGRESS
assigneeId: USER-ELY
parentId: null
---
```

Le corps qui suit le frontmatter contient le besoin et les critères de l’issue. Les relations bloqué/liée/doublon sont des références structurées selon S02 ; on ne crée pas de chemins relatifs vers des copies d’issue.

```yaml
# projects/PROJ-SSO/milestones/MILE-PILOT.md
---
id: MILE-PILOT
kind: milestone
projectId: PROJ-SSO
title: Pilote auprès de deux organisations
position: 2
---
```

La progression du pilote est calculée à partir des issues rattachées et de la définition vérifiée, jamais stockée comme un pourcentage arbitraire à corriger manuellement.

## Où se trouve la spec ?

```yaml
# documents/DOC-SSO-SPEC.md
---
id: DOC-SSO-SPEC
kind: document
title: Spec — Authentification Enterprise
attachment:
  type: project
  id: PROJ-SSO
---
```

Le document référence le projet selon le contrat de rattachement S05. Le template organise son corps en problème, comportement, erreurs et critères d’acceptation ; il ne crée pas un type `Spec` distinct. Un mapping Linear relie ce document à un document distant seulement lorsque cette capacité est validée.

## Comment le programme est relié

INIT-ENTERPRISE regroupe INIT-SECURITY et INIT-ONBOARDING. PROJ-SSO contribue à la sécurité ; PROJ-INVITATIONS contribue à l’onboarding. Si PROJ-SSO est également rattaché directement à INIT-ENTERPRISE, la synthèse consolidée le compte une seule fois.

Les documents et issues sont référencés, pas dupliqués selon la navigation. Les fichiers d’updates contiennent une santé publiée et un message ; ils restent distincts des événements techniques et de la progression calculée.

## Exemple de parcours

1. L’humain prépare l’issue PLAT-101 dans accepted.
2. L’agent crée son worktree code et sa branche Frame associée ; sa modification devient visible dans global comme proposition.
3. Un commit code porte un snapshot ID ; le checkpoint Frame conserve son code SHA.
4. L’humain annule entre-temps l’issue sur accepted. La proposition Done de l’agent n’écrase pas cette décision.
5. À l’intégration, le dossier de conflit montre Todo/base, Done/source, Canceled/cible et leurs motifs.
6. Une résolution conserve l’annulation et peut accepter séparément les précisions documentaires dans le même résultat validé.
7. Le squash publié inclut le reçu ; la source est clôturée. La suite du travail démarre dans une nouvelle époque.

Ces étapes illustrent les contrats ; aucun fichier métier, branche Git ni issue réelle n’est créé par ce compagnon.
