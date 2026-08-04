# Piano Trainer

Application web statique de lecture MIDI et d’entraînement à la reconnaissance des notes pour le travail du piano.

## Espaces

- **Bibliothèque** : recherche et ouverture de fichiers MIDI depuis la bibliothèque serveur ou un fichier local.
- **Entraînement** : exercices générés pour explorer le clavier, travailler une main puis coordonner les deux mains.
- **Practice** : mémorisation de l’association couleur–note, avec lecture simultanée de 1, 3 ou 5 notes.
- **Progression** : historique local et courbes de progression par type d’épreuve.

L’ancien espace Solfège a été supprimé : la navigation principale comporte désormais Bibliothèque, Entraînement, Practice et Progression.

## Practice

Le Practice combine deux dimensions indépendantes :

- une lecture de **1, 3 ou 5 notes** simultanées ;
- une expérience **Série**, **Long Run** ou **Contre-la-montre**.

Pour les groupes de 3 et 5 notes, chaque nom ne peut apparaître qu’une fois. Les réponses sont sélectionnées dans n’importe quel ordre et la dernière sélection valide automatiquement le groupe.

### Série

- Mode **Actif** sélectionné par défaut : réponse avec les boutons Do à Si, correction après le délai.
- Mode **Passif** : aucune réponse demandée, la solution apparaît automatiquement.
- Durée réglable : 30 secondes, 1 minute ou 3 minutes.
- Temps de réflexion adapté à la taille du groupe : 2 secondes par défaut pour 1 note, 5 secondes pour 3 notes et 8 secondes pour 5 notes.
- Notes naturelles seules ou gamme chromatique ; les solutions diésées sont écrites `Do#`, `Ré#`, etc.
- Une jauge verticale matérialise le temps restant.

### Long Run

- Trois vies et cadence accélérée toutes les 30 secondes.
- Délai initial adapté à la lecture : 3 secondes pour 1 note, 6 secondes pour 3 notes et 10 secondes pour 5 notes.
- Une bonne réponse rapporte un point ; une erreur ou une absence de réponse coûte une vie.
- La première réponse est verrouillée et la partie se termine à zéro vie.
- Toutes les 30 secondes, un niveau est gagné et le délai diminue jusqu’au minimum prévu pour la taille du groupe.
- Après avoir franchi 5 fois un niveau, les parties suivantes commencent directement au niveau supérieur. Le score de départ crédite, pour chaque niveau sauté, le nombre de questions correspondant à ses 30 secondes et à son délai ; cette progression est indépendante pour les formats 1, 3 et 5 notes.
- Un changement de niveau marque une courte pause et affiche `⚡ NX` à la place du nom de la note.
- Score, vies, niveau courant et record local sont affichés.
- Deux cartes successives ne peuvent pas représenter le même nom naturel, dièse compris.

### Contre-la-montre

- Durée globale de 1, 3 ou 5 minutes, sans limite de réflexion par groupe.
- La dernière note sélectionnée valide immédiatement la réponse et affiche brièvement `✓` ou `×`.
- Chaque groupe correct rapporte un point ; la première erreur disqualifie.
- Les records sont séparés par durée et par nombre de notes.

## Progression locale

Chaque partie de Practice est enregistrée dans IndexedDB, sans compte ni serveur. Une tentative conserve le mode, le nombre de notes, le score, la précision, la durée, le niveau atteint et la cause de fin.

L’onglet **Progression** permet de filtrer les épreuves comparables et affiche :

- la courbe des scores, ou de la précision pour les Séries ;
- le record et la moyenne ;
- les dernières tentatives terminées ou disqualifiées.

Les parties interrompues sont conservées mais masquées par défaut dans la courbe. Les anciens records `localStorage` restent disponibles. Le schéma et la migration future vers Supabase sont décrits dans `DECISIONS.md`.

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

## Serveur local persistant

L’application est servie par le service utilisateur systemd `pianotrainer.service` sur `0.0.0.0:5173`. Le mode `linger` de l’utilisateur `adrien-lhomme` est activé : le service continue sans session Codex ou terminal ouvert et redémarre avec la machine.

Le fichier de référence versionné est `ops/pianotrainer.service`. La copie active se trouve dans `~/.config/systemd/user/pianotrainer.service`.

Commandes courantes :

```bash
systemctl --user status pianotrainer.service
systemctl --user restart pianotrainer.service
journalctl --user -u pianotrainer.service -f
```

Le redémarrage exécute automatiquement `npm run build` avant de servir `dist`. Après une mise à jour du code, une seule commande est donc nécessaire :

```bash
systemctl --user restart pianotrainer.service
```

Pour réinstaller le service :

```bash
mkdir -p ~/.config/systemd/user
cp ops/pianotrainer.service ~/.config/systemd/user/
loginctl enable-linger "$USER"
systemctl --user daemon-reload
systemctl --user enable --now pianotrainer.service
```

Accès sur le réseau local : `http://192.168.0.25:5173/`.
