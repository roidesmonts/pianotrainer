# Avancement — Piano Trainer

Dernière mise à jour : 8 août 2026

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

## Plan initial conservé comme historique

Les étapes ci-dessous décrivent le plan d’origine. Leur état réel et les évolutions plus récentes sont consignés dans les mises à jour datées qui suivent, en particulier celles des 1er et 3 août 2026.

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

### Recherche main droite / main gauche — étape 1

- Ajout d'un onglet Recherche réservé au développement local.
- Comparaison côte à côte de la partition PDF PIG et de l'annotation JSON convertie.
- Sélection des 150 œuvres et de leurs 309 annotations.
- Filtres main droite, main gauche et substitutions/anomalies.
- Checklist de validation et notes sauvegardées localement par annotation.
- Les routes Vite ne servent que les fichiers JSON et PDF situés dans les répertoires de recherche autorisés.
- Étape 1 validée par l'utilisateur le 3 août 2026 après contrôle visuel dans l'application.

### Recherche main droite / main gauche — étape 2 validée

- Reproduction globale des FHMM d'ordres 1, 2 et 3 et du Chord HMM sur les 30 œuvres de test.
- Réentraînement réussi sur les 159 annotations miscellaneous de PIG v1.2.
- Classement et métriques publiés reproduits avec un écart maximal inférieur à un point.
- Résultats détaillés dans `research/fingering/STEP-2-RESULTS.md`.

### Recherche main droite / main gauche — étape 3, jalon 3A

- Implémentation d'un Viterbi merged-output exact mémorisant la dernière hauteur de chaque main.
- Vérification du chemin exact contre l'énumération exhaustive sur une petite séquence.
- Entraînement des transitions de hauteurs sur les 159 annotations miscellaneous, sans fuite des œuvres de test.
- Exactitude sur 50 014 notes de test : 88,04 %, contre 84,55 % pour la meilleure coupure apprise et 81,39 % pour MIDI 60.
- Ajout de `npm run separate:midi -- entree.mid sortie.json` pour les véritables fichiers MIDI.
- Contrôle sur Clair de lune : 1 505 notes décodées depuis une piste unique.
- Résultats détaillés dans `research/fingering/STEP-3-MILESTONE-1.md`.
- Prochain jalon : intégrer les doigts des deux mains dans l'état et réutiliser les probabilités FHMM de l'étape 2.

### Recherche main droite / main gauche — étape 3, jalon 3B

- État conjoint mémorisant hauteur et doigt courants de chaque main.
- Apprentissage supervisé des transitions de doigts et des 93 déplacements géométriques officiels du clavier.
- Viterbi exact validé contre les `10^N` chemins possibles sur fixture ; beam explicite pour les séquences longues.
- Sur 10 225 notes : 91,98 % pour la main, 54,61 % pour le doigt et 50,79 % pour le couple exact avec beam 100.
- Beam 500 cinq fois plus coûteux sans gain mesuré ; beam 100 retenu provisoirement.
- Ajout de `npm run finger:midi -- entree.mid sortie.json` pour produire main et doigt depuis un MIDI ordinaire.
- Résultats détaillés dans `research/fingering/STEP-3-MILESTONE-2.md`.
- Restent à traiter avant validation : accords, analyse manuelle des erreurs et évaluation multi-vérités complète.

### Recherche main droite / main gauche — étape 3, accords et évaluation étendue

- Normalisation des attaques simultanées dans l'ordre virtuel grave→aigu de la référence.
- Contraintes de doigts distincts et d'ordre croissant à droite/décroissant à gauche au sein d'un accord.
- Sur 10 225 notes, amélioration du couple main+doigt de 50,72 % à 51,33 % et suppression de 4,15 % de configurations d'accord invalides.
- Évaluation sur les 150 annotations humaines, soit 50 014 notes : 91,98 % main, 55,34 % doigt, 51,70 % conjoint.
- Résultats séparés : 52,26 % conjoint sur les notes d'accord et 50,13 % en monodie ; aucune configuration d'accord invalide.
- L'analyse humaine note par note est écartée pour cette phase ; l'évaluation reste entièrement automatique et reproductible.
- Étape 3 validée le 3 août 2026 sur les métriques de main, doigt, accords/monodie et cohérence physique.
- Limite assumée : les métriques exactes ne reconnaissent pas un doigté alternatif musicalement plausible s'il n'apparaît pas dans l'annotation comparée.
- Prochaine étape : robustesse aux MIDI de performance, notamment attaques désynchronisées, pédale, notes tenues et regroupement d'accords.

### Recherche main droite / main gauche — étape 4, attaques de performance

- Regroupement ancré des attaques quasi simultanées, sans fusion transitive des arpèges.
- Étude automatique de tolérances de 0 à 50 ms sur données intactes et accords désynchronisés jusqu'à ±20 ms.
- Tolérance retenue : 40 ms, avec 51,33 % conjoint et 92,29 % main sur les séquences désynchronisées.
- Conservation dans la sortie MIDI de l'attaque originale, de l'attaque regroupée et de l'identifiant de groupe.
- Intégration automatique dans `separate:midi` et `finger:midi`.
- Restent ouverts : pédale, notes tenues, vélocités et mesures longues/denses.

### Recherche main droite / main gauche — étape 4, tenue et pédale

- Mémoire de l'occupation physique des dix doigts dans le beam ; réutilisation interdite avant note-off.
- Analyse séparée de la pédale CC64, avec seuil 0,5 pour les contrôleurs continus et binaires.
- La résonance sous pédale ne bloque jamais un doigt après son note-off.
- Vélocité conservée dans la sortie sans influence probabiliste non justifiée.
- Deux MIDI réels de Clair de lune, 2 991 notes cumulées : aucun conflit de doigt tenu.
- La version Disklavier valide les pédales continues ; 1 420 de ses 1 486 attaques surviennent pédale enfoncée.
- Les validations de performance et de stabilité sont consignées ci-dessous ; l'étape 4 est désormais terminée.

### Recherche main droite / main gauche — étape 4 validée

- Benchmark reproductible sur trois MIDI réels : 80, 1 325 et 18 774 notes.
- Temps respectifs : 0,26 s, 2,31 s et 32,93 s ; débit de 313 à 573 notes/s.
- Beam effectivement plafonné à 100 états dans chaque cas.
- Pics mémoire : 14,0 Mio, 51,7 Mio et 463,7 Mio ; les backpointers du cas long devront être surveillés lors du portage navigateur.
- Test explicite de déterminisme ajouté : mêmes affectations, score et nombre d'états explorés à paramètres identiques.
- Validation sans intervention humaine, conformément à la décision utilisateur : mains annotées de PIG, tests de jitter et d'invariants physiques, plus 2 991 notes de MIDI réels sans conflit de doigt tenu.
- Rapport méthodologique : `research/fingering/STEP-4-MILESTONE-3.md`.
- Prochaine étape : schéma portable et moteur TypeScript, avec parité stricte face au prototype JavaScript.

- Node actuel : `v18.19.1`.
- npm actuel : `9.2.0`.
- Vite actuel : branche 5, compatible avec ce Node.
- `npm audit` signale actuellement deux vulnérabilités de développement liées à Vite/esbuild, dont une élevée. La correction proposée par npm demande une version majeure récente de Vite, elle-même incompatible avec Node 18. Prévoir une migration vers Node 20 ou 22 avant le déploiement final, puis mettre Vite à jour sans utiliser `npm audit fix --force` aveuglément.
- Le build de production passe avec `npm run build`.
- Le serveur réseau doit être lancé avec `npm run dev -- --host 0.0.0.0`.
- L’accès au dossier `../midi` est uniquement configuré dans le serveur de développement Vite.
- Le dépôt Git est versionné sur GitHub, branche `main`.
- Les étapes 4 et 5 sont validées ; l’étape 6 reste à compléter.

## Principaux fichiers

- `src/App.tsx` : interface principale, bibliothèque et inspecteur.
- `src/midi/analyserMidi.ts` : conversion d’un fichier en modèle interne.
- `src/types/midi.ts` : contrats et structures musicales.
- `src/storage/SourceDossierLocal.ts` : fichiers choisis dans le navigateur.
- `src/storage/SourceBibliothequeServeur.ts` : bibliothèque présente sur le serveur.
- `src/components/PianoRollStatic.tsx` : piano roll actuel.
- `src/components/Practice.tsx` : exercices de reconnaissance de 1, 3 ou 5 notes.
- `src/components/Progression.tsx` : statistiques et courbes issues des tentatives locales.
- `src/storage/progression.ts` : contrat `PracticeAttempt` et persistance IndexedDB.
- `src/components/KeyboardComparison.tsx` : ancienne comparaison A/B conservée mais inactive.
- `src/styles.css` : styles de l’application.
- `vite.config.ts` : React et routes de développement de la bibliothèque MIDI.
- `package.json` : scripts et dépendances.
- `DECISIONS.md` : décisions fonctionnelles, architecture de persistance et migration future.
- `plan-doigtes.md` : plan expérimental pas à pas pour le merged-output HMM et les doigtés.

## Priorités de la prochaine session

1. Tester la qualité pédagogique des courbes avec un historique réel de tentatives.
2. Ajouter les filtres de durée et de paramètres lorsque plusieurs configurations possèdent assez de données.
3. Ajouter l’export/import JSON de la progression locale.
4. Finaliser les sauts de mesure, la boucle A–B et les raccourcis clavier du lecteur.
5. Préparer une interface de dépôt avant la future synchronisation Supabase.
6. Suivre `plan-doigtes.md` à partir de l’étape 1 pour le chantier mains et doigtés.

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

### Practice — SÉRIE ET LONG RUN VALIDÉS AU 1er AOÛT

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

À cette date, trois espaces étaient disponibles : Bibliothèque, Entraînement et Practice. Le build `tsc -b && vite build` passait. Le serveur local était accessible à `http://192.168.0.25:5173/` et consommait au repos environ 180 Mo avec très peu de CPU.

Composants principaux : `src/components/PianoRollStatic.tsx`, `src/components/CatalogueEntrainement.tsx` et `src/components/Practice.tsx`.

### Exploitation locale persistante — VALIDÉE

- Service utilisateur systemd `pianotrainer.service` activé et suivi dans `ops/pianotrainer.service`.
- `loginctl enable-linger adrien-lhomme` activé : le service reste disponible après fermeture du terminal ou de la session Codex et redémarre avec la machine.
- Build automatique via `npm run build` avant chaque démarrage, puis service de `dist` avec Vite Preview sur `0.0.0.0:5173`.
- Politique `Restart=on-failure` avec nouvelle tentative après 3 secondes.
- Commande de déploiement local après modification : `systemctl --user restart pianotrainer.service`.
- Validation HTTP 200 sur `http://127.0.0.1:5173/` et écoute réseau sur le port 5173.

## Mise à jour du 3 août 2026

### Practice — LECTURE MULTIPLE ET TROIS EXPÉRIENCES

- Ajout d’un sélecteur de lecture de 1, 3 ou 5 notes simultanées.
- Groupes générés sans doublon de nom naturel afin de rester compatibles avec les sept boutons Do–Si.
- Sélection et désélection des réponses dans n’importe quel ordre.
- Validation automatique dès que la dernière note requise est sélectionnée ; aucun bouton de validation supplémentaire.
- Mise en page compacte et responsive des groupes de carrés et des boutons.
- Délais Série par défaut : 2 secondes pour 1 note, 5 secondes pour 3 notes et 8 secondes pour 5 notes.
- Délais Long Run initiaux : 3, 6 et 10 secondes selon la taille, avec minimum adapté aux groupes.

### Contre-la-montre — AJOUTÉ

- Troisième expérience disponible pour les lectures de 1, 3 et 5 notes.
- Durée globale sélectionnable de 1, 3 ou 5 minutes, sans limite de réflexion par question.
- Passage immédiat au groupe suivant et retour visuel bref `✓` ou `×`.
- Un point par groupe entièrement correct.
- Mort subite : la première erreur disqualifie immédiatement.
- Records `localStorage` séparés par taille de groupe et durée.

### Historique et progression locale — PREMIÈRE VERSION

- Ajout de `src/storage/progression.ts` et d’une base IndexedDB `piano-trainer`.
- Enregistrement de chaque partie terminée, disqualifiée ou interrompue.
- Données conservées : date, expérience, taille du groupe, score, réponses correctes, nombre de questions, précision, durées, délai, niveau et cause de fin.
- Ajout de `src/components/Progression.tsx` et d’un quatrième onglet **Progression**.
- Filtres actuels par expérience et nombre de notes.
- Courbe par tentative : précision pour Série, score pour Long Run et Contre-la-montre.
- Affichage du record, de la moyenne et des huit dernières tentatives comparables.
- Tentatives interrompues conservées mais exclues par défaut de la courbe.
- Persistance entièrement locale, sans compte, serveur ou dépendance supplémentaire.

### Décisions de persistance et déploiement

- IndexedDB retenu pour développer la méthode avec un utilisateur unique.
- Supabase Auth, PostgreSQL et Storage envisagés seulement lors du passage multi-utilisateur et du déploiement Vercel.
- Le contrat `PracticeAttempt` doit rester la frontière de migration entre le dépôt local et un futur dépôt distant.
- Ajout de `DECISIONS.md` comme référence durable pour ces choix, le modèle de données et la stratégie de migration.

### Navigation actuelle

Quatre espaces : Bibliothèque, Entraînement, Practice et Progression.

### Validation technique

- `npm run build` validé après les ajouts.
- `npm run typecheck` validé.
- Aucune dépendance de stockage ou de graphique ajoutée : IndexedDB et SVG natifs sont utilisés.

### Doigtés — ÉTAPE 0 VALIDÉE, ÉTAPE 1 EN COURS

- Lecture des articles merged-output HMM 2014 et Statistical Fingering 2020.
- Téléchargement, inspection et compilation réussie du paquet C++ officiel `SourceCode_v190921.zip`.
- Confirmation que ce paquet contient les HMM à une main et le Chord HMM, mais pas le merged-output HMM à deux mains.
- Absence de licence logicielle explicite dans l’archive : code tiers maintenu hors du dépôt.
- PIG Dataset v1.2 obtenu légalement et conservé hors Git : 150 œuvres, 309 doigtés et 100 040 annotations de notes cumulées.
- Parseur d’inventaire ajouté ; les 309 fichiers sont lisibles sans perte. Une annotation atypique `4_` est conservée et signalée.
- Première baseline officielle exécutée sur la pièce 001 : FHMM2 atteint 69,51 % de correspondance exacte sur 469 notes.

### Point d’arrêt — 3 août 2026

- L’étape 0 du chantier mains/doigtés est terminée et documentée.
- L’étape 1 est engagée : inventaire et lecture sans perte du corpus validés sur les 309 fichiers.
- Le corpus PIG v1.2 et le code scientifique tiers restent exclusivement dans les dossiers ignorés par Git.
- Les sorties de la première expérience sont conservées dans `research/fingering/artifacts/baseline-001/`, également ignoré par Git.
- L’anomalie `028-4_fingering.txt`, note 85 (`4_`), doit rester explicitement représentée comme donnée incomplète ; ne pas inventer le doigt final.
- Les différences structurelles détectées entre certaines annotations d’une même œuvre devront être examinées avant l’évaluation multi-vérités terrain.
- Reprise prévue : définir le format interne sans perte, ajouter des fixtures et tests du parseur, puis contrôler visuellement plusieurs passages face aux partitions PDF.
- Ne pas commencer le merged-output HMM ni son intégration React avant la validation complète des étapes 1 et 2.
- Création de `research/fingering/` avec documentation, règles de reproductibilité et script de récupération vérifié par SHA-256.
- Graine expérimentale fixée à `20260803` et découpage de reproduction aligné sur l’article 2020.
- PIG v1.2 a ensuite été obtenu par inscription personnelle ; son usage publié reste limité à la recherche académique non lucrative et le corpus demeure hors Git.


## Mise à jour du 4 août 2026 — Doigtés étape 5

- Schéma JSON v1 et provenance de modèle versionnés.
- Moteur merged-output Viterbi porté dans `src/fingering/` pour le navigateur.
- Modèle synthétique CC0 distribué pour les tests ; paramètres PIG maintenus hors Git.
- Parité prototype/TypeScript validée sur chemins et scores numériques (tolérance 10⁻¹²).
- Beam search conservé à 100 états pour les longs MIDI, conformément aux mesures de robustesse.

## Mise à jour du 4 août 2026 — Doigtés étape 6

- Notes MIDI enrichies avec identité stable, main, doigt, confiance et origine.
- Modèle PIG local chargé à la demande, attaques regroupées à 40 ms et longs morceaux décodés par fenêtres chevauchantes.
- Doigts recalculés après séparation par FHMM3 réentraîné localement, plus performant que la composante doigt du modèle conjoint.
- Contrainte inter-main : aucune gauche au-dessus de la droite sur les attaques simultanées ou les notes opposées encore tenues.
- Piano-roll et audio filtrables ensemble par main droite ou gauche.
- Doigts affichables, estimations incertaines signalées et corrections manuelles restaurables.
- Corrections persistées séparément dans IndexedDB sans mutation des événements MIDI sources.
- Confiance de séparation issue de la marge des scores gauche/droite, à la place de l’ancien indicateur de registre.
- Évaluation de la chaîne finale sur 10 225 notes : 92,98 % pour la main, 54,14 % pour le couple exact, 0 croisement sur 2 297 accords mixtes et 12,24 % de notes signalées.
- Rapport détaillé : `research/fingering/STEP-6-INTERFACE.md`.


## Mise à jour du 4 août 2026 — Practice et progression Long Run

- Practice recentré sur deux expériences : **Long Run** et **Contre-la-montre** ; l’ancienne expérience Série et ses réglages associés sont retirés.
- Génération exhaustive des groupes possibles afin d’éviter exactement la répétition de deux groupes consécutifs.
- Records de Practice désormais relus depuis l’historique IndexedDB, avec génération d’identifiants compatible avec les navigateurs ne proposant pas `crypto.randomUUID`.
- Progression du Contre-la-montre filtrée par durée configurée (1, 3 ou 5 minutes), en plus du nombre de notes.
- Pour chaque format de Long Run (1, 3 ou 5 notes), un niveau ne compte pour le déblocage que s’il est terminé entièrement sans aucune faute.
- Après **5 réussites parfaites** d’un même niveau, les parties suivantes commencent directement au niveau supérieur. Une partie arrêtée conserve uniquement les niveaux déjà terminés sans faute.
- Le déblocage est recalculé au chargement de l’historique et immédiatement après l’enregistrement d’une partie, afin que le bouton **Rejouer** profite sans rechargement du nouveau niveau de départ.
- Le score de départ reproduit les points théoriquement gagnés par la voie régulière sur chaque niveau sauté : `plancher(30 secondes / délai du niveau)`, puis somme de tous les niveaux antérieurs.
- Exemples au premier niveau : 10 points pour 1 note à 3 secondes, 5 points pour 3 notes à 6 secondes et 3 points pour 5 notes à 10 secondes.
- Le niveau, le délai et le total des points acquis sont affichés avant le démarrage de la partie.
- Validation technique : `npm run build` réussi après l’implémentation.

## Mise à jour du 6 août 2026 — Interface mobile de Practice

- La carte de jeu mobile de **Long Run** regroupe désormais, sans défilement vers le panneau inférieur, le score, le niveau courant, les vies et le record.
- En mode une note, ces informations sont centrées à gauche du carré coloré, tandis que les boutons de réponse restent à droite. Leur bord supérieur est aligné avec celui du carré.
- Le carré coloré et sa jauge sont légèrement réduits sous 600 px afin de conserver les trois zones sur une seule largeur de téléphone.
- Pour les formats 3 et 5 notes, le tableau de bord devient une ligne compacte au-dessus des cartes dans le même encart.
- Les doublons du score, du niveau, des vies et du record sont masqués dans le panneau inférieur mobile, tout en restant disponibles dans la vue bureau.
- Le texte sous **Démarrer** ne répète plus le nombre de vies en Long Run.
- Le **Contre-la-montre** reprend la même logique mobile avec le score et le record à gauche du carré ; leurs doublons sont également masqués sur mobile.
- Le panneau Contre-la-montre indique un objectif personnel situé un point au-dessus du record, puis l’écart restant, l’égalité ou le nouveau record pendant la partie.
- La page **Progression** utilise des boutons segmentés pour l’épreuve, le nombre de notes et la durée, et affiche l’avancement vers le prochain niveau Long Run.
- Un niveau Long Run ne contribue désormais au déblocage que s’il est terminé sans faute ; cinq réussites parfaites débloquent le suivant, indépendamment pour 1, 3 et 5 notes.
- Dans les formats 3 et 5 notes, les cartes sont présentées dans un ordre réellement aléatoire, sans tri du grave vers l’aigu, afin de représenter une ligne de notes plutôt qu’un accord toujours ascendant.
- L’ordre d’affichage des cartes reste indépendant de l’ordre de sélection des boutons et un même ensemble de notes n’est pas répété immédiatement.
- Référence graphique et contraintes à préserver : `plan-interface.md`.
- Validation technique : `npm run build`, `npm run typecheck` et contrôle du diff réussis.

## Mise à jour du 8 août 2026 — Lecteur MIDI et mode travail

- Les doigtés sont désormais masqués par défaut et restent affichables à la demande.
- Les noms Do/Ré/Mi, susceptibles de fausser le travail de lecture, ont été retirés des rectangles de notes ; les repères du clavier sont conservés.
- La sélection main droite/main gauche ne masque plus les notes de l’autre main : toutes les notes restent visibles, la main non travaillée est seulement atténuée et l’audio reste ciblé.
- Un contour blanc des notes de main gauche reste disponible comme option, désactivée par défaut.
- Ajout d’une ligne optionnelle de séparation des mains, calculée localement dans le temps puis stabilisée sur la chronologie absolue du morceau pour suivre les déplacements sans vibrer pendant la lecture.
- Ajout du **mode travail** : lecture en boucle d’une fenêtre de 1, 2, 4 ou 8 mesures, avec 4 mesures par défaut.
- Navigation précédente/suivante par pas d’une mesure, même lorsque la fenêtre en contient plusieurs.
- Le planificateur audio est borné à la fenêtre de travail et coupe proprement les notes à son extrémité avant la reprise.
- Une ligne orange lumineuse `↻ REPRISE`, dessinée au-dessus des notes, matérialise précisément l’instant où la boucle revient à son début.
- Validation technique : `npm run build` et contrôle du diff réussis.
