# Étape 6 — Interface Piano Trainer

Date : 4 août 2026

## Intégration

Chaque `NoteMidi` possède désormais un identifiant stable, une main, un doigt, une confiance et une origine. Pour un fichier importé, l’identité du morceau est dérivée de ses octets par un hash FNV-1a versionné ; l’identité d’une note combine ce hash, sa piste, ses ticks, sa hauteur et son index de doublon. Renommer un fichier ne casse donc pas ses corrections.

Le modèle PIG entraîné localement est servi par Vite depuis le répertoire `artifacts/` ignoré par Git. Le décodage utilise un beam de 100 états, regroupe les attaques dans une fenêtre ancrée de 40 ms et les ordonne du grave vers l’aigu. Une contrainte inter-main interdit que la gauche passe au-dessus de la droite lorsque les attaques sont simultanées ou que la note opposée est encore tenue. Les morceaux longs sont décodés par fenêtres de 2 000 notes avec 64 notes de contexte, sans repli vers une coupure de registre grossière.

Une fois les mains séparées, les doigts sont recalculés par le binaire officiel FHMM3 avec les paramètres réentraînés localement sur PIG v1.2. Cette seconde étape remplace les doigts du merged-output HMM : FHMM3 est la meilleure baseline reproduite du projet (64,99 % général et 86,24 % souple avec les mains de référence).

La confiance affichée concerne la séparation de main. Elle est dérivée de la marge entre les meilleurs scores gauche et droite conservés à chaque étape, puis transformée de façon monotone. Elle sert à attirer l’attention ; elle ne prétend pas mesurer la plausibilité d’un doigté alternatif.

## Travail par main et corrections

Le piano-roll peut afficher les deux mains, la droite ou la gauche. Le même ensemble filtré alimente le moteur audio : une main masquée est également muette. Les numéros de doigts sont optionnels ; un contour orange et un point d’interrogation signalent les estimations sous 60 % de confiance.

L’éditeur montre les attaques des quatre secondes suivant la tête de lecture. La main et le doigt peuvent être remplacés séparément, puis restaurés. Les corrections sont enregistrées dans la base IndexedDB dédiée `piano-trainer-fingering`, avec la paire `(pieceId, noteId)` comme clé. Elles s’appliquent à une copie des notes et ne modifient jamais les événements MIDI analysés. Un contour vert distingue les corrections humaines.

## Validation

```bash
npm run test:fingering
npm run evaluate:interface-fingering
npm run build
```

Les tests couvrent aussi l’application immuable des corrections, le regroupement ancré des attaques et l’interdiction des croisements dans un accord. Le build de production réussit et le modèle local n’est pas inclus dans les ressources publiées.

Sur Westminster Chimes, le modèle PIG sans contrainte produisait 16 accords croisés sur 16 ; le décodeur renforcé en produit 0, avec 14 notes sur 80 sous le seuil de confiance de 60 %. Sur Flight of the Bumble Bee, il produit 0 croisement sur 254 accords mixtes et 13,2 % de notes sous le seuil, avec une confiance médiane de 92,7 %.

Sur une annotation de chacune des 30 œuvres PIG de test, soit 10 225 notes, la chaîne finale atteint 92,98 % pour la main et 54,14 % pour le couple main-doigt exact face à cette annotation unique. Elle ne produit aucun croisement sur 2 297 accords mixtes. 12,24 % des notes sont signalées ; les 87,76 % restantes atteignent 96,58 % de mains correctes.
