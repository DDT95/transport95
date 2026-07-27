# Design QA — Observatoire des transports

- Source visual truth: `source-agriculture95.png` (site public DDT95/agriculture95)
- Implementation: `implementation-desktop.png`
- Viewport: 1280 × 720 CSS px, density 1
- State: carte initiale puis analyse locale et isochrone piétonne 10 minutes

## Full-view comparison

La composition institutionnelle est fidèle au modèle : bandeau préfectoral, titrage Marianne, colonne métier gauche, carte principale, état des sources en haut à droite, cartes KPI et pied de page. La déclinaison transport conserve les proportions, rayons, ombres, palette bleu France et densité de l’observatoire de référence.

## Focused comparison

Le panneau d’analyse a été contrôlé séparément car il contient les interactions propres au transport. La hiérarchie, les métriques, les sélecteurs et les liens externes restent lisibles sans masquer les commandes principales. L’isochrone IGN s’affiche sur la carte après calcul.

## Fidelity surfaces

- Typography: Marianne locale, hiérarchie et graisses conformes.
- Spacing/layout: grille, panneau, carte et tiroir cohérents avec le modèle ; aucune commande persistante masquée au viewport testé.
- Colors/tokens: bleu France, états vert/orange et fond cartographique neutralisé conformes.
- Images/assets: logo préfectoral original réutilisé, net et correctement dimensionné.
- Copy/content: vocabulaire métier transport, sources et limites clairement identifiés.

## Interaction checks

- chargement de la carte et des couches IGN ;
- clic cartographique et ouverture du tiroir ;
- calcul d’une isochrone piétonne de 10 minutes ;
- présence des liens PAN et Geovelo ;
- console navigateur : aucune erreur ni alerte observée pendant ces tests.

## Findings

Aucun P0, P1 ou P2 restant. Le flux Overpass peut répondre lentement ou partiellement ; l’interface signale cet état et conserve les couches IGN ainsi que l’analyse par clic.

## Comparison history

- Première passe : le tiroir d’accessibilité et l’isochrone ont été ajoutés puis testés sur le service Géoplateforme.
- Passe finale : géométrie visible, état de succès affiché, aucune erreur console.

final result: passed
