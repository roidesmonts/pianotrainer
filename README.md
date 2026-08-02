# Piano Trainer

Application web statique de lecture MIDI et d’entraînement à la reconnaissance des notes pour le travail du piano.

## Espaces

- **Bibliothèque** : recherche et ouverture de fichiers MIDI depuis la bibliothèque serveur ou un fichier local.
- **Entraînement** : exercices générés pour explorer le clavier, travailler une main puis coordonner les deux mains.
- **Practice** : mémorisation de l’association couleur–note, utilisable sans piano.

L’ancien espace Solfège a été supprimé : la navigation principale comporte volontairement trois espaces.

## Practice

Le Practice possède deux expériences.

### Série

- Mode **Actif** sélectionné par défaut : réponse avec les boutons Do à Si, correction après le délai.
- Mode **Passif** : aucune réponse demandée, la solution apparaît automatiquement.
- Durée par défaut : **1 minute** ; autres choix : 10 secondes, 30 secondes et 3 minutes.
- Temps de réflexion réglable de 0,8 à 5 secondes.
- Notes naturelles seules ou gamme chromatique ; les solutions diésées sont écrites `Do#`, `Ré#`, etc.
- Une jauge verticale matérialise le temps restant.

### Long Run

- Départ au niveau 1 avec 3 secondes de réflexion et 3 vies.
- Une bonne réponse rapporte un point ; une erreur ou une absence de réponse coûte une vie.
- La première réponse est verrouillée et la partie se termine à zéro vie.
- Toutes les 30 secondes, un niveau est gagné et le délai diminue de 0,2 seconde.
- Niveau maximal : niveau 15 à 0,2 seconde.
- Un changement de niveau marque une courte pause et affiche `⚡ NX` à la place du nom de la note.
- Score, vies, niveau courant et record local sont affichés ; le record est conservé dans `localStorage`.
- Deux cartes successives ne peuvent pas représenter le même nom naturel, dièse compris.

## Développement

```bash
npm install
npm run dev -- --host 0.0.0.0
```

Le serveur Vite utilise par défaut le port 5173.

## Validation et production

```bash
npm run build
npm run preview
```

Le build de référence exécute `tsc -b && vite build`.
