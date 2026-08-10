**Source visual truth**

- `/var/folders/3h/px_6bwl96w50x8y34bkz_k_80000gn/T/TemporaryItems/NSIRD_screencaptureui_y1oY1B/Capture d’écran 2026-07-28 à 09.57.04.png`
- Source pixels: 3200 × 1542, desktop state, bus stops enabled.

**Implementation evidence**

- `implementation-transport-markers.png`
- Implementation pixels and CSS viewport: 1280 × 720 at device scale factor 1.
- Combined comparison: `design-qa-comparison.png`.
- Browser-rendered local Vite preview, stations and bus stops enabled, three zoom steps from the departmental view.
- Primary interactions tested: station toggle, bus-stop toggle, map zoom and marker redraw.
- Browser console: no errors or warnings.

**Full-view comparison evidence**

- The source showed white marker discs whose transport pictograms disappeared into their raster padding. The revised view shows a readable dark transport glyph in every marker, with red station borders and blue bus-stop borders.
- The Préfet lockup now occupies its grid slot from the same top edge as the title block, with a reduced horizontal gap.

**Focused region comparison evidence**

- Map markers were checked at departmental and local zooms. Compact zoom uses colored geometric markers; local zoom uses the recropped official IDFM pictograms.
- Header alignment was checked in the same full desktop viewport. No additional crop was needed.

**Findings**

- Earlier P1: official raster assets contained too much white padding and became visually blank at map size. Fixed with dedicated map crops plus explicit image sizing.
- Earlier P2: station and bus markers were not sufficiently distinguishable. Fixed with IDFM red for rail/stations and deep blue for bus stops.
- Earlier P2: the Préfet logo appeared detached from the title. Fixed by aligning the logo wrapper to the top of the header grid and tightening the first-column gap.
- Fonts and typography: Marianne files, hierarchy and wrapping remain unchanged and consistent.
- Spacing and layout rhythm: header alignment improved; map and sidebar proportions remain stable.
- Colors and visual tokens: existing DSFR blue is preserved; rail red and bus blue are now semantic.
- Image quality and asset fidelity: official IDFM raster pictograms are used from dedicated crops; no placeholder icon remains.
- Copy and content: unchanged.

**Comparison history**

- Pass 1: blank white pictogram discs remained because Leaflet’s image rule overrode marker dimensions.
- Fix: forced marker-image width and height, recropped the IDFM assets, and differentiated rail/bus border colors.
- Pass 2: markers and header are readable and aligned at the tested desktop state; no actionable P0/P1/P2 finding remains.

**Implementation Checklist**

- [x] Make station pictograms visible.
- [x] Make bus-stop pictograms visible.
- [x] Keep compact markers readable at departmental zoom.
- [x] Recalibrate the Préfet logo/title alignment.
- [x] Build and inspect the page in the browser.

**Follow-up Polish**

- None required for this correction.

final result: passed

---

## Validation du sélecteur Bus / Train — 10 août 2026

**Source visual truth**

- Capture de la section « Comprendre le territoire » fournie par l’utilisateur : 4054 × 1268 px.
- Cartes fonctionnelles de référence inspectées dans le navigateur : `valdoise_bus_trains`, `train_idf` et la carte IDFM ferroviaire temps réel.

**Implementation evidence**

- `implementation-network-selector.png`
- Capture navigateur : 2147 × 917 px, viewport desktop à densité 1, état « Train · RER / Temps réel ».
- Interactions testées : Bus → Train, activation du temps réel, chargement différé de l’iframe IDFM et lien plein écran.
- Vérification fonctionnelle complémentaire : côté bus, le bouton temps réel reste désactivé et les couches GTFS bus sont activées ; côté train théorique, les gares et tracés ferrés sont activés.
- Console navigateur : aucune erreur et aucun avertissement.

**Full-view comparison evidence**

- La page conserve les standards de l’atlas existant : Marianne, bleu institutionnel, cartes blanches arrondies, hiérarchie titre/sous-titre et pastilles de statut.
- Le sélecteur en deux étapes se lit avant la recherche et ne réduit pas la surface cartographique utile ; la carte temps réel occupe toute la zone principale.
- L’intégration Atlas a été rendue localement : six cartes sont présentes dans « Comprendre », la nouvelle carte suit immédiatement « Sécurité · secours » et son lien cible `transport95`.

**Focused region comparison evidence**

- Zone sélecteur : états actif, inactif et désactivé contrôlés visuellement et sémantiquement (`aria-pressed`, `disabled`).
- Zone temps réel : bandeau bleu, indicateur vert, source IDFM et sortie plein écran restent lisibles au-dessus de l’iframe.

**Findings**

- Aucun écart P0/P1/P2 restant.
- Typographie : Marianne, poids et hiérarchie cohérents avec l’application et la section « Comprendre ».
- Espacement et rythme : contrôle compact, alignement stable, aucune commande principale masquée au viewport testé.
- Couleurs et tokens : bleu DSFR, vert de disponibilité et fonds clairs conservés.
- Images et icônes : pictogrammes SVG train/bus existants réutilisés ; logo Préfet inchangé et net.
- Contenu : distinction explicite entre offre GTFS théorique et temps réel ferroviaire ; aucune promesse de temps réel bus.

**Comparison history**

- Premier rendu : sélecteur et iframe fonctionnels, aucune correction visuelle P0/P1/P2 nécessaire.

**Implementation Checklist**

- [x] Sélection Bus / Train.
- [x] Sélection Théorique / Temps réel.
- [x] Temps réel limité au train et explicité.
- [x] Carte IDFM temps réel intégrée avec accès plein écran.
- [x] Sixième carte ajoutée après « Comprendre ».
- [x] Builds et console navigateur vérifiés.

**Follow-up Polish**

- Aucun requis avant publication.

final result: passed
