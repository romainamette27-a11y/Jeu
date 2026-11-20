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

- [x] **Phase 1 — Fondations 3D mobile** : ville (routes, marquages, immeubles, collision),
      voiture de police (physique arcade, gyrophares), caméra de poursuite,
      contrôles tactiles, HUD (horloge de shift, compteur), PWA installable
- [ ] **Phase 2 — Système de patrouille** : trafic IA, radio (appels DCT qui tombent),
      markers d'intervention, jour/nuit dynamique
- [ ] **Phase 3 — Interventions variées** : contrôle routier, excès de vitesse, accidents,
      vols, arrestations — menus d'action (verbaliser, fouiller, menotter, renforts)
- [ ] **Phase 4 — Progression réalistique** : fin de shift + bilan, XP, grades,
      déblocages, sauvegarde locale
- [ ] **Phase 5 — Polish** : éclairage nocturne (lampadaires, feux), sons (sirène, radio,
      moteur), optimisation mobile avancée

## CI

GitHub Actions : `npm ci && npm run build` sur chaque push / PR.
