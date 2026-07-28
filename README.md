# Observatoire des transports du Val-d’Oise

Carte interactive des réseaux, de l'offre de transport et de l'accessibilité dans le Val-d'Oise.

## Données actualisées

- Offre et horaires théoriques : GTFS Île-de-France Mobilités.
- Circulation et événements routiers : flux Sytadin/DIRIF, reconstruits à chaque déploiement planifié.
- Points de vente : référentiel PRIM Île-de-France Mobilités.
- Routes et voies ferrées : BD TOPO/Géoplateforme.
- Aménagements cyclables : Base nationale des aménagements cyclables et Geovelo.

Le workflow GitHub Pages reconstruit le site toutes les cinq minutes. L'interface indique toujours l'heure de la donnée routière et distingue les horaires GTFS théoriques du temps réel.

Carte institutionnelle interactive consacrée à l’offre de transport, aux infrastructures et aux services de mobilité du Val-d’Oise.

## Développement local

```bash
npm install
npm run dev
```

## Vérification et publication

```bash
npm ci
npm run build
```

Le workflow GitHub Pages publie automatiquement la branche `main` sur `https://ddt95.github.io/transport95/`.

La carte peut également être ouverte directement en double-cliquant sur `index.html`. Une connexion internet reste nécessaire pour Leaflet et les services de données.

## Sources

- Point d’accès national aux données de transport (`transport.data.gouv.fr`) : catalogue national et accès aux ressources GTFS/NeTEx/SIRI.
- Géoplateforme IGN : fonds et couches transport, dont la BD TOPO.
- OpenStreetMap / Overpass : gares, stations, arrêts et services de mobilité affichés au chargement.
- Geovelo : accès au calculateur vélo ; son API complète est une offre partenaire nécessitant un accès dédié.
- Géoplateforme Navigation : isochrones piétonnes et automobiles calculées sur le réseau BD TOPO.
- Stationnement, recharge électrique, autopartage, covoiturage et espaces piétons : inventaire exploratoire OpenStreetMap.
- API Adresse et API Géo : recherche, géocodage inverse et contexte territorial.

Les données sont informatives. Les informations publiées par les autorités organisatrices, opérateurs et gestionnaires font foi.
