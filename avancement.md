# Avancement — Piano Trainer

Dernière mise à jour : 1er août 2026

## Références et emplacement

- Projet : `ch-pianotrainer`
- Cahier des charges : `../plan-developpement-lecteur-midi-piano.md`
- Bibliothèque source : `../midi`
- Application distante en développement : `http://192.168.0.25:5173/`
- Stack retenue : Vite, React, TypeScript, Canvas 2D et `@tonejs/midi`

## Décisions validées

- Application conçue comme outil de travail au piano, pas comme lecteur musical classique.
- Piano roll vertical, notes descendant vers un clavier fixe.
- Aucune portée ni notation musicale traditionnelle.
- Couleurs pédagogiques par nom de note, avec les dièses héritant de la couleur naturelle précédente.
- Les dièses sont signalés par une croix.
- Géométrie **A validée** : chaque couloir est exactement aligné sur la touche réelle du piano. Les touches noires ont donc des couloirs plus étroits et décalés.
- Le développement reste découpé en étapes validées visuellement avant de poursuivre.

## Étape 0 — Socle — VALIDÉE

Travail effectué :

- Initialisation d’une application Vite + React + TypeScript.
- Ajout des configurations TypeScript pour le navigateur et Node.
- Ajout des scripts `dev`, `build`, `preview` et `typecheck`.
- Création de la page HTML, du point d’entrée React et des styles globaux.
- Ajout d’un README et d’un `.gitignore`.
- Initialisation d’un dépôt Git local sur la branche `main`.
- Vérification du serveur local et du build de production.
- Exposition du serveur Vite sur `0.0.0.0` pour un accès depuis le réseau local.

Commandes utiles :

```bash
npm install
npm run dev -- --host 0.0.0.0
npm run build
```

## Étape 1 — Lecture MIDI et inspecteur — VALIDÉE

Travail effectué :

- Installation et utilisation de `@tonejs/midi`.
- Création d’un modèle musical interne typé dans `src/types/midi.ts` :
  - notes ;
  - pistes ;
  - changements de tempo ;
  - signatures rythmiques ;
  - mesures ;
  - étendue des hauteurs ;
  - informations globales du morceau.
- Création de l’analyseur `src/midi/analyserMidi.ts`.
- Conversion des hauteurs MIDI en noms français (`Do4`, `Do♯4`, etc.).
- Fusion et tri chronologique des notes de toutes les pistes.
- Calcul des débuts de mesures à partir du PPQ et des signatures rythmiques.
- Tempo par défaut à 120 BPM et signature par défaut à 4/4 si le fichier ne les fournit pas.
- Création de l’interface `SourceBibliotheque` pour abstraire l’origine des fichiers.
- Création de `SourceDossierLocal` pour les fichiers sélectionnés ou déposés dans le navigateur.
- Création de `SourceBibliothequeServeur` pour accéder à la collection présente sur le serveur.
- Ajout dans Vite d’un accès de développement en lecture seule au dossier `../midi` :
  - `/api/midi-library` inventorie les fichiers ;
  - `/midi-library/...` sert un fichier MIDI précis ;
  - protection contre les sorties du dossier et refus des extensions non MIDI.
- Détection de **11 909 fichiers MIDI** dans la bibliothèque existante.
- Création d’une interface de bibliothèque avec :
  - recherche instantanée par plusieurs mots ;
  - recherche sur le titre et le chemin ;
  - résultats limités à 60 pour protéger les performances ;
  - explorateur hiérarchique de dossiers ;
  - fil d’Ariane ;
  - retour au dossier précédent ;
  - ouverture directe d’un morceau ;
  - import local toujours disponible.
- Suppression de la sélection automatique « Une sélection pour commencer » : aucun résultat de recherche n’apparaît tant que rien n’est saisi.
- Création de l’inspecteur affichant :
  - durée totale ;
  - nombre et noms des pistes ;
  - canal et instrument de chaque piste ;
  - nombre de notes ;
  - tempo initial ;
  - changements de tempo ;
  - signatures rythmiques ;
  - étendue des hauteurs ;
  - nombre de mesures calculées ;
  - tableau des 30 premières notes avec début, durée, hauteur, vélocité et piste.
- Test réel avec `Bests/classics/079-Debussy - Clair de lune.mid` : 1 piste, 1 505 notes, durée d’environ 271,919 secondes, étendue MIDI 27–97.

## Étape 2 — Clavier — VALIDÉE

Travail effectué :

- Création d’un clavier de piano sur canvas avec géométrie physique réelle.
- Création temporaire des deux variantes demandées :
  - A : alignement exact sur les touches réelles ;
  - B : douze couloirs chromatiques de largeur égale.
- Comparaison côte à côte avec plage de départ et nombre d’octaves réglables.
- Choix utilisateur validé : **variante A**.
- La comparaison A/B a ensuite été retirée de l’interface active pour laisser place à l’étape 3.

Le fichier `src/components/KeyboardComparison.tsx` est encore présent comme trace et outil de comparaison, mais il n’est plus importé dans l’application.

## Étape 3 — Piano roll statique — VALIDÉE

Travail effectué dans `src/components/PianoRollStatic.tsx` :

- Rendu entièrement sur canvas 2D.
- Détection automatique de la plage utile à partir des notes du morceau.
- Extension de la plage sur des limites d’octave et garantie d’une largeur minimale de deux octaves.
- Utilisation de la géométrie A pour les couloirs et le clavier.
- Dessin des notes sous forme de rectangles :
  - position horizontale correspondant à la touche réelle ;
  - longueur proportionnelle à la durée en secondes ;
  - couleur par nom de note ;
  - croix sur les dièses ;
  - nom de note si le rectangle est suffisamment grand.
- Couleurs actuelles :
  - Do : rouge ;
  - Ré : orange ;
  - Mi : jaune ;
  - Fa : vert ;
  - Sol : turquoise ;
  - La : bleu-violet ;
  - Si : magenta.
- Dessin des lignes de mesure et interpolation des lignes de temps.
- Affichage du numéro de mesure.
- Ligne de frappe lumineuse au-dessus du clavier.
- Illumination des touches dont une note est active à la position affichée.
- Curseur de déplacement libre dans le morceau.
- Réglage de l’échelle temporelle de 45 à 220 pixels par seconde.
- Canvas responsive et rendu adapté à la densité de pixels de l’écran.
- L’inspecteur reste disponible sous le piano roll.
- Build TypeScript et Vite validé après l’implémentation.

Validation visuelle effectuée par l’utilisateur le 1er août 2026.

Tests ayant servi de critères de validation :

1. Charger une gamme chromatique à notes égales et contrôler l’escalier, les couleurs et les croix.
2. Charger une suite d’accords et contrôler l’alignement horizontal exact des attaques simultanées.
3. Charger un fichier comportant plusieurs durées et vérifier leurs rapports visuels.
4. Comparer un passage connu d’un vrai morceau avec sa partition.
5. Vérifier la lisibilité des notes très courtes, des accords denses et des très grands fichiers.
6. Ajuster si nécessaire la vitesse visuelle par défaut, les contrastes ou l’affichage des noms.

## Suite prévue

### Étape 4 — Défilement sans son

- Créer un `AudioContext` silencieux après interaction utilisateur.
- Utiliser exclusivement `audioContext.currentTime` comme horloge maîtresse.
- Ajouter lecture et pause visuelles.
- Calculer la position depuis une ancre audio et une ancre musicale, sans compteur d’images.
- Utiliser `requestAnimationFrame` uniquement pour relire l’heure et redessiner.
- Faire défiler le piano roll vers la ligne de frappe.
- Mettre à jour l’illumination des touches au passage des notes.
- Ajouter les tests de dérive sur cinq minutes et après passage de l’onglet en arrière-plan.
- Mesurer les performances sur un passage dense.

### Étape 5 — Son

- Ajouter un synthétiseur polyphonique avec Web Audio API brute.
- Oscillateur, enveloppe d’attaque/extinction et vélocité.
- Ajouter un ordonnanceur périodique d’environ 25 ms avec anticipation d’environ 150 ms.
- Programmer les notes à leur date audio exacte.
- Ajouter activation du son et volume.
- Couper proprement toutes les voix à la pause ou lors d’un déplacement.
- Lire et compenser `outputLatency` pour aligner image et son.
- Vérifier attaques espacées, accords denses, saturation, clics et notes fantômes.

### Étape 6 — Transport et navigation

- Lecture, pause et retour au début.
- Déplacement par molette et glisser sur le canvas.
- Barre de progression cliquable.
- Sauts de mesure.
- Vitesse continue de 25 % à 150 %, sans modification de hauteur.
- Changement de vitesse en cours de lecture sans saut.
- Boucle A–B et raccourcis clavier : espace, flèches, `A`, `B`.

### Étape 7 — Pistes et plage de clavier

- Panneau de pistes.
- Activation séparée de l’affichage et du son pour chaque piste.
- Liseré ou luminosité pour distinguer les pistes sans détourner les couleurs des notes.
- Cadrage automatique et réglage manuel de la plage du clavier.

### Étape 8 — Bibliothèque locale complète

- Sélection récursive d’un dossier depuis le navigateur.
- Indexation progressive sans bloquer l’interface.
- Métadonnées : titre, chemin, durée, notes, tempo et étendue.
- Persistance IndexedDB.
- Recherche, tri et favoris.
- Restauration de la bibliothèque sans nouvelle analyse.
- Conserver exactement le schéma de `SourceBibliotheque` pour préparer une source distante.

L’explorateur actuel du serveur sert à travailler et valider l’application à distance. Il repose sur le serveur de développement Vite et ne constitue pas encore la bibliothèque statique/déployable définitive de l’étape 8.

### Étape 9 — Finition et déploiement

- Passe visuelle complète.
- Disparition discrète des commandes pendant la lecture.
- Préférence système de mouvement réduit.
- Accessibilité clavier et focus visibles.
- Responsive portable et grand écran.
- Profilage des fichiers les plus lourds.
- Mise à niveau de l’environnement Node puis mise à jour de Vite.
- Déploiement Vercel final et séance réelle de validation.

## Points techniques importants pour la reprise

- Node actuel : `v18.19.1`.
- npm actuel : `9.2.0`.
- Vite actuel : branche 5, compatible avec ce Node.
- `npm audit` signale actuellement deux vulnérabilités de développement liées à Vite/esbuild, dont une élevée. La correction proposée par npm demande une version majeure récente de Vite, elle-même incompatible avec Node 18. Prévoir une migration vers Node 20 ou 22 avant le déploiement final, puis mettre Vite à jour sans utiliser `npm audit fix --force` aveuglément.
- Le build de production passe avec `npm run build`.
- Le serveur réseau doit être lancé avec `npm run dev -- --host 0.0.0.0`.
- L’accès au dossier `../midi` est uniquement configuré dans le serveur de développement Vite.
- Le dépôt Git a été initialisé mais aucun commit n’a encore été créé.
- Les étapes 4 et 5 sont validées ; l’étape 6 reste à compléter.

## Principaux fichiers

- `src/App.tsx` : interface principale, bibliothèque et inspecteur.
- `src/midi/analyserMidi.ts` : conversion d’un fichier en modèle interne.
- `src/types/midi.ts` : contrats et structures musicales.
- `src/storage/SourceDossierLocal.ts` : fichiers choisis dans le navigateur.
- `src/storage/SourceBibliothequeServeur.ts` : bibliothèque présente sur le serveur.
- `src/components/PianoRollStatic.tsx` : piano roll actuel.
- `src/components/KeyboardComparison.tsx` : ancienne comparaison A/B conservée mais inactive.
- `src/styles.css` : styles de l’application.
- `vite.config.ts` : React et routes de développement de la bibliothèque MIDI.
- `package.json` : scripts et dépendances.

## Priorités de la prochaine session

1. Finaliser les sauts de mesure, la boucle A–B et les raccourcis clavier.
2. Ajouter scores et suivi de progression aux exercices.
3. Étendre progressivement la section Solfège.

## Mise à jour du 1er août 2026

### Étape 4 — Défilement sans son — VALIDÉE

- Lecture/pause visuelles fondées sur `AudioContext.currentTime` et rendu par `requestAnimationFrame`.
- Position calculée depuis des ancres audio et musicales, arrêt en fin de morceau et déplacement sans dérive observée.
- Fluidité et reprise après arrière-plan validées.

### Étape 5 — Son — VALIDÉE POUR LA VERSION ACTUELLE

- Synthétiseur polyphonique Web Audio au timbre percussif de piano, harmoniques et renforcement des graves.
- Enveloppes, vélocité et limiteur pour les accords denses.
- Ordonnanceur toutes les 25 ms avec 150 ms d’anticipation.
- Activation du son, volume et coupure des voix à la pause, à l’arrêt ou au déplacement.
- Timbre et graves validés. La compensation explicite de `outputLatency` reste à mesurer si un décalage apparaît.

### Étape 6 — Transport et navigation — PARTIELLEMENT VALIDÉE

Disponibles : lecture, pause, arrêt, progression cliquable, vitesse 25–150 % sans changement de hauteur, molette, glisser souris/tactile sans défilement simultané de la page, cadrage automatique ou clavier complet de 88 touches.

Restent : sauts de mesure, boucle A–B et raccourcis clavier.

### Entraînement — PREMIÈRE VERSION

- 13 activités en trois blocs : explorer le clavier, travailler une main, réunir les deux mains.
- Traversées du clavier, repères, chromatisme et chasse aux notes.
- Exercices générés en interne, filtres et ouverture directe dans le lecteur.

### Practice — SÉRIE ET LONG RUN VALIDÉS

- Deux expériences : Série pour l’entraînement réglable et Long Run pour le jeu d’endurance.
- Série en mode Actif par défaut ou Passif sans interaction, durée par défaut de 1 minute et temps de réflexion réglable de 0,8 à 5 secondes.
- Jauge verticale stable dans les deux modes, emplacement réservé même lorsqu’elle est vide afin d’éviter les décalages sur téléphone.
- Solutions diésées explicites (`Do#`, `Ré#`, etc.) et interdiction de deux notes naturelles identiques à la suite, dièse compris.
- Long Run : 3 vies, +1 point par bonne réponse, perte d’une vie sur erreur ou temps écoulé, première réponse verrouillée.
- Progression toutes les 30 secondes de 3,0 à 0,2 seconde par pas de 0,2, soit 15 niveaux.
- Changement de niveau signalé par une courte pause et un encart compact `⚡ NX` à la place du nom de la note.
- Score, vies, niveau et record local persisté avec `localStorage`.
- Interface mobile stabilisée : boutons agrandis et espace permanent réservé aux messages de correction.

### Solfège — SUPPRIMÉ

L’espace Solfège, son onglet, son composant et ses styles ont été retirés : il ne faisait pas partie du parcours utile retenu.

### Navigation et validation

Trois espaces : Bibliothèque, Entraînement et Practice. Le build `tsc -b && vite build` passe. Le serveur local est accessible à `http://192.168.0.25:5173/` et consomme au repos environ 180 Mo avec très peu de CPU.

Composants principaux : `src/components/PianoRollStatic.tsx`, `src/components/CatalogueEntrainement.tsx` et `src/components/Practice.tsx`.
