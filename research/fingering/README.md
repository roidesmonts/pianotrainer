# Expériences de doigté

Cet espace est séparé de l’application React. Il sert à reproduire les modèles scientifiques, préparer PIG Dataset, entraîner les paramètres et mesurer les résultats avant toute intégration dans Piano Trainer.

## État de l’étape 0 — validée

- Les articles ISMIR 2014 et Information Sciences 2020 ont été lus et synthétisés.
- Le paquet officiel `SourceCode_v190921.zip` a été téléchargé, inspecté et compilé avec succès sous Linux avec `g++`.
- Le code est en C++ autonome et ne déclare pas de dépendance tierce.
- Le paquet ne contient aucun fichier `LICENSE`, `COPYING` ou mention de licence logicielle explicite. Il ne doit donc pas être copié dans le dépôt ni redistribué sans autorisation.
- PIG Dataset v1.2 a été obtenu par la procédure officielle. Il exige une inscription personnelle et autorise uniquement les usages académiques non lucratifs.
- Le corpus, le code tiers, les articles téléchargés et les modèles produits sont exclus de Git.

## Constat sur le code officiel de 2020

Le paquet contient :

- HMM à une main d’ordres 1, 2 et 3 ;
- Chord HMM ;
- entraînement et inférence ;
- paramètres préentraînés sur le sous-ensemble miscellaneous ;
- évaluation simple et avec plusieurs vérités terrain.

Il **ne contient pas** l’implémentation merged-output HMM à deux mains de l’article ISMIR 2014. Le Chord HMM sélectionne des notes dont la main est déjà indiquée par le canal : canal 0 pour la droite, canal 1 pour la gauche. Ce code sera donc la baseline de doigté par main, pas directement le séparateur de mains.

## Récupérer et compiler la référence

Depuis la racine du dépôt :

```bash
bash research/fingering/scripts/fetch-reference-code.sh
cd research/fingering/vendor/SourceCode
bash compile.sh
```

Les exécutables sont produits dans `research/fingering/vendor/SourceCode/Binary`.

Commandes principales :

```bash
./run_FHMM1.sh entree_fingering.txt sortie_fingering.txt
./run_FHMM2.sh entree_fingering.txt sortie_fingering.txt
./run_FHMM3.sh entree_fingering.txt sortie_fingering.txt
./run_CHMM.sh entree_fingering.txt sortie_fingering.txt
```

Entraînement :

```bash
./Binary/FingeringHMM1_Train list_train.txt DataFolder param
./Binary/FingeringHMM2_Train list_train.txt DataFolder param
./Binary/FingeringHMM3_Train list_train.txt DataFolder param
./Binary/CHMM_Train ./Code/ChordFinergingTemplates.txt list_train.txt DataFolder param
```

Évaluation :

```bash
./Binary/Evaluate_SimpleMatchRate verite.txt estimation.txt
./Binary/Evaluate_MultipleGroundTruth N verite_1.txt ... verite_N.txt estimation.txt
```

## Format d’entrée PIG

Chaque ligne utile contient huit champs :

```text
id  onset  offset  pitch-spelling  vélocité-on  vélocité-off  canal  doigt
```

Exemple conceptuel :

```text
0  0.000000  0.500000  C4  80  64  0  1
```

Le fichier accepte des métadonnées commençant par `//`, notamment :

```text
//Version: PianoFingering_v170101
//Piece: identifiant
//Performance: identifiant
//Fingering: identifiant
```

Conventions confirmées dans le code :

- canal `0` : main droite ;
- canal `1` : main gauche ;
- doigts droits positifs `1` à `5` ;
- doigts gauches écrits négativement `-1` à `-5` dans les annotations combinées ;
- les accords du Chord HMM regroupent par défaut les attaques séparées de moins de `0,03` seconde.

## Reproductibilité

Graine commune retenue : `20260803`.

Première reproduction : suivre exactement l’article 2020, avec le sous-ensemble miscellaneous pour l’entraînement et les ensembles Bach, Mozart et Chopin pour le test. Cette séparation sert uniquement à reproduire les résultats publiés.

Pour nos évaluations ultérieures, tous les doigtés d’une même œuvre devront rester dans le même groupe. Aucun découpage aléatoire note par note ou annotation par annotation ne sera accepté.

## Accès à PIG Dataset

Page officielle : https://beam.kisarazu.ac.jp/saito/research/PianoFingeringDataset/

La page d’inscription demande prénom, nom, pays, affiliation, fonction, téléphone, e-mail et motif d’utilisation. Elle envoie par e-mail une URL et un mot de passe valables une heure.

Motif proposé :

> Nonprofit personal research on reproducible HMM-based piano fingering estimation and left/right hand assignment for an educational piano application.

Après téléchargement, extraire le corpus dans :

```text
research/fingering/data/PianoFingeringDataset_v1.2/
```

Ce chemin est ignoré par Git. Ne pas versionner, publier ou transférer le corpus.

## Corpus local vérifié

Archive obtenue le 3 août 2026 :

- fichier : `PianoFingeringDataset_v1.2.zip` ;
- SHA-256 : `98a32026934cdaf9b23c07b0a8b71290621d9ff26b81b8a728d2d25a17d3c321` ;
- version déclarée : 1.2, datée du 12 mai 2022 ;
- 150 œuvres, 309 fichiers de doigté et 150 partitions PDF ;
- 100 040 annotations de notes cumulées dans les 309 fichiers.

Le README fourni précise que les temps et vélocités ont été synthétisés lors de l’édition des partitions : ils ne représentent pas une interprétation humaine enregistrée.

Une anomalie de donnée est conservée et signalée : `028-4_fingering.txt`, note 85, contient `4_`, soit un marqueur de substitution sans doigt final. Le parseur ne doit ni supprimer la note ni inventer la valeur manquante.

Analyser le corpus :

```bash
node research/fingering/scripts/analyze-pig.mjs
```

## Format interne v1

La conversion produit un fichier JSON par annotation et un manifeste. Les sorties restent locales et sont ignorées par Git :

```bash
npm run convert:pig
```

Chaque annotation contient `schemaVersion`, les identifiants d'œuvre et d'annotateur, les métadonnées PIG et la liste ordonnée des notes. Chaque note conserve les temps et vélocités, l'orthographe de hauteur source, le canal et le texte de doigté originaux. Elle ajoute une hauteur MIDI, une main `left` ou `right`, des doigts positifs et un `noteId` stable composé de l'œuvre, l'identifiant source, la hauteur et un index de doublon.

Les substitutions sont normalisées dans `substitutions`. Le booléen `substitutionIncomplete` conserve explicitement une terminaison incomplète telle que `4_` sans inventer de doigt final. Toute évolution incompatible devra incrémenter `schemaVersion`.

Les passages contrôlés couvrent les deux mains, les accords, les altérations, les substitutions et l'anomalie incomplète :

```bash
npm run test:fingering
```

Dans l'application, l'onglet **Recherche** fournit le poste de validation visuelle : partition PDF, annotation convertie, filtres par main ou anomalie et checklist persistante par annotateur. Cette interface dépend du serveur Vite local et des données privées présentes dans `data/` et `generated/` ; elle n'est pas destinée au déploiement public.

## Première baseline vérifiée

Une inférence complète a été exécutée sur `001-1_fingering.txt` avec les paramètres officiels. Match rate exact sur 469 notes :

| Modèle | Résultat |
| --- | ---: |
| FHMM ordre 1 | 55,44 % |
| FHMM ordre 2 | 69,51 % |
| FHMM ordre 3 | 68,44 % |
| Chord HMM | 54,37 % |

Ce contrôle valide la chaîne fichier PIG → inférence officielle → évaluateur officiel. Il ne constitue pas encore la reproduction des métriques globales publiées.

## Reproduction globale — étape 2 validée

Les quatre modèles officiels ont été entraînés et évalués sur le découpage de l'article. Les commandes, résultats, écarts à la publication et détails d'apprentissage sont consignés dans [`STEP-2-RESULTS.md`](STEP-2-RESULTS.md).

## Merged-output — étapes 3 et 4 validées

Le premier jalon implémente un Viterbi exact de séparation des mains, le compare aux coupures de registre et l'applique à un véritable fichier MIDI. Les résultats et limites sont consignés dans [`STEP-3-MILESTONE-1.md`](STEP-3-MILESTONE-1.md).

Le deuxième jalon ajoute les doigts dans l'état conjoint, mesure le compromis exact/beam et produit main plus doigt pour un MIDI ordinaire. Voir [`STEP-3-MILESTONE-2.md`](STEP-3-MILESTONE-2.md).

Le premier jalon de robustesse choisit automatiquement une fenêtre de 40 ms pour les attaques de performance désynchronisées. Voir [`STEP-4-MILESTONE-1.md`](STEP-4-MILESTONE-1.md).

Le deuxième jalon distingue occupation physique, résonance de pédale et vélocité sur deux MIDI réels. Voir [`STEP-4-MILESTONE-2.md`](STEP-4-MILESTONE-2.md).

Le troisième jalon mesure le moteur sur des MIDI court, dense et long, et clôt la robustesse par des critères automatiques reproductibles. Voir [`STEP-4-MILESTONE-3.md`](STEP-4-MILESTONE-3.md).


## Format portable — étape 5 validée

Le schéma JSON versionné, le chargeur et le Viterbi TypeScript sont opérationnels. Un modèle synthétique original CC0 valide la distribution et la parité navigateur ; les paramètres PIG restent locaux tant que leurs droits dérivés ne sont pas clarifiés. Les chemins et scores concordent avec le prototype sur trois fixtures. Voir [`STEP-5-PORTABLE-TYPESCRIPT.md`](STEP-5-PORTABLE-TYPESCRIPT.md).
