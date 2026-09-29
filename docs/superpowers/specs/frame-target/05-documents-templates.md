# S05 — Documents et templates

Statut : cible proposée au 2026-09-29 ; remplacement de modèle, pas livraison attestée.
Dépendances : [S01](01-workspace-equipes-workflows.md), [S03](03-projets-milestones.md), [S04](04-initiatives.md).
Édition et migration : [S12](12-brouillons-edition.md), [S21](21-migration-validation.md).

Les champs communs `kind`, identité, provenance et les enveloppes JSON suivent [S00](00-contrats-transverses.md).
Les raisons métier détaillées complètent ses codes d’erreur communs, sans créer une autre enveloppe.

## Objectif et périmètre

Document est l'objet commun pour specs, briefs, notes, investigations et runbooks.
Une spec est un document créé éventuellement depuis un template, jamais une seconde entité obligatoire.
Les templates matérialisent des données et relations cohérentes, sans devenir un moteur de scripts.
Inclure rattachements, auteur, contenu, ressources et modèles réutilisables pour les objets cible.
Exclure coédition CRDT, stockage binaire collaboratif et annotations inline avancées.
La baseline possède une entité `Spec` avec statut, règles et liens de remplacement propres à Frame.

## Document et rattachement

| Champ | Contrat |
|---|---|
| `id`, `identifier`, `revision` | UUID stable, alias DOC-…, révision S11 |
| `title`, `body` | Titre obligatoire, Markdown vide par défaut |
| `creatorId`, `createdAt`, `updatedAt` | Auteur/provenance et instants UTC ; pas de falsification d'auteur distant |
| `attachment` | Exactement `{type, id}` ; type project, initiative, team, issue ou cycle |
| `templateOrigin` | UUID template et révision appliquée, ou null |
| `resourceRefs[]` | Références de liens/pièces jointes et provenance ; vide par défaut |
| `deletedAt`, `archivedAt` | Lifecycle distinct du contenu, null par défaut |
| `extensions.frame` | Métadonnées locales conservées explicitement |

Le rattachement local unique donne une propriété claire ; les autres liens sont des références de contenu.
Un document ne possède pas simultanément plusieurs champs propriétaires contradictoires.
Le stockage canonique est `documents/<id>.md`, indépendant du chemin de son propriétaire.
Déplacer le rattachement conserve UUID, auteur et historique, sans recopier le corps.
Les cinq types locaux sont disponibles ; leur synchronisation exige une capacité API vérifiée par type.
Un rattachement non accepté par Linear rend l'export indisponible, avec motif et données préservées.
Aucun document orphelin n'est créé implicitement lors de la suppression de son propriétaire.
Le plan de suppression doit préserver sa référence historique ou proposer son rattachement explicitement.
Il n'existe aucun workflow de décision documentaire obligatoire.
Importer une note de réunion ne lui attribue pas le sens « décision acceptée ».

## Fidélité du contenu et migration de Spec

Titre, Markdown, liens et références de ressources sont conservés sans exécuter leur contenu.
Une conversion d'éditeur riche annonce ses éléments pris en charge et ses limites.
Tableaux, mentions, liens internes, pièces jointes et blocs non représentables font partie du rapport de conversion.
Un élément non représentable conserve sa source ou bloque la publication ; il n'est jamais supprimé silencieusement.
Les URLs et pièces jointes externes ne sont pas téléchargées ou publiées automatiquement.
Les métadonnées d'auteur et dates distantes constituent une provenance, pas une permission de les réécrire.
Les anciens `status`, `supersedes`, `supersededBy`, `relatedTo`, `tags` et `rules` vont dans `extensions.frame`.
Les références de remplacement sont remappées vers les UUID Document au cours de S21.
Le corps et les métadonnées non mappées sont conservés avec rapport inspectable.
Un ancien alias `frame spec` peut être transitoire, mais pointe sur le même magasin Document.
Une règle importée reste une donnée ; seule une configuration d'agent explicitement autorisée peut l'activer.
Publier une métadonnée lisiblement dans le corps n'en fait pas une propriété native Linear.
Réimporter uniquement Linear ne reconstitue pas les extensions locales non exportées.

## Template et types couverts

Un template contient UUID, alias, revision, name, targetType, scope, defaults, body et graph facultatif.
`scope` vaut workspace ou team avec teamId ; un template d'équipe respecte les règles d'accès locales S01.
`targetType` accepte issue, project, milestone, initiative, document, cycle, team et view ; les variantes `comment-body` et `update-body` matérialisent seulement un corps selon S17, sans créer de publication seules.
Workspace utilise un profil d'initialisation ; les utilisateurs sont des identités, pas des copies depuis template.
Comments et updates réutilisent des modèles de corps sous S17 sans copier auteur ni date de publication.
Relations, labels et configurations peuvent être déclarés dans le graphe d'un template autorisé.
Cette généralisation est une facilité locale Frame ; la parité Linear n'est revendiquée que pour types vérifiés.
Les templates d'issue et projet reprennent les usages documentés de Linear.
Un template cycle ne programme aucune récurrence ; la création d'occurrences dépend de S18.
Un template Document `project-spec` structure problème, résultat attendu, périmètre, solution et validation.
Le template n'impose aucun statut de spec ni permission d'exécution.
Les modèles de vue contiennent une query S07 validée, sans langage de programmation additionnel.

## Application d'un template

L'ordre est : defaults du type, valeurs du template, valeurs explicites de l'appelant.
Une valeur explicite null retire un champ facultatif ; omission signifie absence d'override.
Un template ne peut pas contourner une contrainte de scope, d'équipe ou d'identité.
Les IDs d'objets créés, dates, révisions, aliases et auteurs ne sont jamais copiés depuis le modèle.
Le graphe d'un template projet utilise des clés symboliques locales pour jalons, issues et documents.
L'application alloue de nouveaux UUID et remappe les liens internes vers ces nouveaux objets.
Les références externes sont déclarées comme telles et doivent être résolues avant publication.
Une référence symbolique manquante, un cycle interdit ou un owner inaccessible invalide toute l'application.
Le graphe entier passe par une transaction S11 ; aucune moitié de projet n'est publiée.
Le résultat conserve `templateOrigin` pour audit, sans abonnement aux futures modifications du modèle.
Modifier un template ne modifie aucun objet déjà matérialisé.
Un template ne contient ni secret, ni hook shell, ni expression évaluée comme code.

## Commandes et résultat

```sh
frame document new --project PROJ-0001 --title "Spec — invitations" --template project-spec
frame document new --issue ENG-101 --title "Investigation"
frame document edit DOC-0001 --body-file ./spec-revisee.md
frame document show DOC-0001 --scope global --json
frame document attach DOC-0001 --initiative INIT-0001
frame template new --type issue --team ENG --name bug --file ./bug-template.md
frame template show bug --scope work
frame issue add --team ENG --template bug --title "Invitation expirée"
frame project new --team ENG --template customer-rollout --title "Déploiement Acme"
frame document delete DOC-0001
frame document restore DOC-0001
```

Le corps peut venir d'un fichier ou stdin ; le SDK reçoit directement le contenu validé.
Les lectures acceptent accepted/work/global ; global n'est jamais une cible d'écriture.
Les mutations exposent `operationId`, révisions attendues, UUID créés et mapping des clés du template.
Les mises à jour du corps utilisent le protocole d'édition S12, sans dernier écrivain gagnant.
Les suppressions sont réversibles selon S11/S21 et préservent les liens historiques.

## Concurrence et propriété des modules

Le plan d'application est lié à la révision du template et des références consultées.
Un template modifié après préparation invalide ce plan ; son ancienne version n'est pas utilisée à l'insu de l'appelant.
Le rejeu d'un même `operationId` retrouve les UUID déjà alloués au lieu de produire un second projet.
Les conflits sur corps sont des conflits de contenu S12/S15, pas des arbitrages par date.
`packages/core/src/entities/spec/spec.ts` constitue la baseline à migrer vers Document et Template.
Les services core valident types de rattachement, defaults et remapping de graphe.
`packages/fs/src/realm.repository.ts` porte codecs et publication via S11.
Le lint contrôle aussi templates non appliqués, références symboliques et extensions préservées.
Le SDK expose les opérations ; les adaptateurs S19 portent la conversion d'éditeur riche.

## Critères d'acceptation

1. S05-A01 — Une ancienne Spec migre en un Document unique avec corps et toutes ses extensions.
2. S05-A02 — Deux applications d'un template projet créent des UUID distincts et des liens internes corrects.
3. S05-A03 — Rejouer la même opération retourne les mêmes objets sans duplication.
4. S05-A04 — Un champ explicite remplace le default du template ; null retire uniquement un champ facultatif.
5. S05-A05 — Un document cycle non exportable reste local et reçoit un motif de capacité indisponible.
6. S05-A06 — Une règle contenue dans un document importé ne déclenche aucune exécution.
7. S05-A07 — Un bloc riche non représentable bloque ou conserve sa source, sans perte silencieuse.
8. S05-A08 — Modifier un template ne change aucun document ou projet déjà créé.
9. S05-A09 — Un conflit concurrent de corps conserve les deux versions jusqu'à résolution S12/S15.

## Sources

[Modèle local, documents et templates](../../../research/01-modele-local.md), [synchroniser une spec](../../../research/03-services-actifs.md).
[Documents](https://linear.app/docs/documents), [issue templates](https://linear.app/docs/issue-templates), [project templates](https://linear.app/docs/project-templates).
La cardinalité et les types de rattachement API sont des capacités S19 ; les contrats locaux ne prouvent pas leur parité distante.
