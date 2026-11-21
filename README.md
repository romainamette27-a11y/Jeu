# PatrolOps — Police Simulator (mobile 3D)

Simulateur de patrouille de police en 3D, jouable sur mobile dans le navigateur
(installable comme application via PWA) et sur ordinateur.

## Stack technique

- **TypeScript** + **Vite** (build rapide, ES2022)
- **Three.js** (rendu 3D : éclairage physique, ombres, tone mapping ACES)
- **PWA** : installable sur l'écran d'accueil, mode plein écran paysage

## Lancer le jeu

```bash
npm install
npm run dev        # serveur local + accès réseau (téléphone sur le même Wi-Fi)
```

Build de production :

```bash
npm run build      # sortie dans dist/
npm run preview    # prévisualise le build
```

## Commandes

| Action | Mobile | Ordinateur |
|---|---|---|
| Volant | glisser le curseur (bas-gauche) | Q / D ou ← / → |
| Gaz | bouton GAZ (bas-droite) | Z / ↑ |
| Frein | bouton FREIN | S / ↓ |
| Marche arrière | FREIN à l'arrêt | S / ↓ à l'arrêt |
| Frein à main | bouton FREIN À MAIN | Espace |
| Gyrophares + sirène | bouton 🚨 (en haut à droite) | F |

## Feuille de route

- [x] **Phase 1 — Fondations 3D mobile** : ville (routes, marquages de voies, immeubles, collision),
      voiture de police (physique arcade, gyrophares + sirène), caméra de poursuite,
      contrôles tactiles, HUD, PWA installable, hébergement GitHub Pages
- [x] **Phase 2 — Système de patrouille** : trafic IA (conduite à droite, freinage),
      radio DCT (appels variés avec bips), colonne + anneau d'intervention, GPS,
      cycle jour/nuit (soleil, nuit bleutée, 98 lampadaires avec halos), XP d'intervention
- [x] **Phase 3 — Interventions variées** : contrôle routier, excès de vitesse, accidents,
      vols, arrestations — menus d'action (verbaliser, fouiller, menotter, renforts)
- [x] **Phase 4 — Progression réalistique** : fin de shift + bilan, XP, grades,
      déblocages, sauvegarde locale
- [x] **Phase 5 — Polish** : éclairage nocturne (lampadaires, feux), sons (sirène, radio,
      moteur), optimisation mobile avancée
- [x] **Lot A — Ville vivante** : 40 piétons membres articulés (marche animée, cheveux et visages variés)
      qui déambulent sur les trottoirs (détour quand la voiture approche),
      livrée « POLICE » nationale (bande bleue + typographie), flotte française (berlines, breaks, utilitaires blancs) avec feux avant/arrière
- [x] **Lot B — Scènes d'intervention réelles** : PNJ posés en scène (blessé allongé, blessé assis,
      conducteur debout, témoins), épave endommagée, roue d'actions radiale avec durées réelles
      (barre de progression) et actions enchaînées par type d'appel
- [x] **Lot C — Patrouille à pied & interceptions** : sortie du véhicule libre avec commandes de marche,
      remontée près du véhicule, excès de vitesse dynamiques (marqueur jaune, poursuite, interception
      générant un contrôle routier sur place)
- [x] **Lot C — Contrôles de zone** : appel « Contrôle de zone » (barrage routier) avec scène complète
      (cônes, panneaux rayés, panneau POLICE, véhicules arrêtés, conducteurs) et chaîne d'actions :
      déploiement du barrage, contrôle des conducteurs, PV, interpellation sur mandat