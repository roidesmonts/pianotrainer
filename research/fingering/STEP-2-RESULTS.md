# Étape 2 — Reproduction des HMM officiels à une main

Date : 3 août 2026

## Protocole

- Code C++ officiel `SourceCode_v190921` compilé sans modification.
- Entraînement : œuvres 031 à 150, soit 120 œuvres et 159 annotations du sous-ensemble miscellaneous.
- Test : œuvres 001 à 030, soit dix Bach, dix Mozart et dix Chopin avec plusieurs vérités terrain.
- Une inférence par œuvre et par modèle ; les quatre métriques sont calculées avec `Evaluate_MultipleGroundTruth`.
- Agrégation : moyenne non pondérée des 30 œuvres, conformément à l'article.
- Modèles : FHMM d'ordres 1, 2 et 3 et Chord HMM, avec les hyperparamètres publiés.

Commande avec les paramètres officiels :

```bash
npm run reproduce:hmm
```

Commande avec réentraînement local préalable :

```bash
npm run reproduce:hmm -- --train --run=retrained-v1.2
```

Les paramètres, estimations, listes, journaux et rapports JSON sont placés dans `research/fingering/artifacts/` et restent exclus de Git.

## Résultats

Toutes les valeurs sont des pourcentages.

| Modèle | Exécution | Général | Plus haut | Souple | Recombinaison |
| --- | --- | ---: | ---: | ---: | ---: |
| FHMM1 | Article 2020 | 61,70 | 68,30 | 82,80 | 74,00 |
| FHMM1 | Paramètres officiels sur PIG v1.2 | 62,34 | 68,99 | 83,70 | 74,88 |
| FHMM1 | Réentraîné sur PIG v1.2 | 62,31 | 68,96 | 83,67 | 74,86 |
| FHMM2 | Article 2020 | 64,30 | 70,80 | 85,30 | 77,60 |
| FHMM2 | Paramètres officiels sur PIG v1.2 | 64,88 | 71,45 | 86,09 | 78,24 |
| FHMM2 | Réentraîné sur PIG v1.2 | 64,89 | 71,46 | 86,11 | 78,28 |
| FHMM3 | Article 2020 | 64,50 | 71,00 | 85,50 | 77,80 |
| FHMM3 | Paramètres officiels sur PIG v1.2 | 65,01 | 71,57 | 86,29 | 78,58 |
| FHMM3 | Réentraîné sur PIG v1.2 | 64,99 | 71,53 | 86,24 | 78,54 |
| CHMM | Article 2020 | 61,20 | 67,70 | 81,70 | 73,80 |
| CHMM | Paramètres officiels sur PIG v1.2 | 61,98 | 68,69 | 82,64 | 74,74 |
| CHMM | Réentraîné sur PIG v1.2 | 61,97 | 68,65 | 82,63 | 74,75 |

Le classement publié est reproduit : FHMM3 est légèrement devant FHMM2, puis FHMM1 et CHMM. Le réentraînement local et les paramètres officiels diffèrent de moins de 0,05 point sur presque toutes les mesures, ce qui valide la préparation et l'apprentissage.

## Écart avec l'article

Les résultats sur PIG v1.2 sont systématiquement supérieurs de 0,51 à 0,99 point aux valeurs arrondies publiées. Cet écart est limité, cohérent entre modèles et explicable par la version du corpus :

- l'article décrit 100 044 annotations cumulées ; PIG v1.2 en contient 100 040 ;
- 24 annotations v1.2 ne partagent pas exactement la même identité hauteur/canal que la première annotation de leur œuvre ;
- les paramètres distribués ont été entraînés avec la version disponible lors de la publication.

La reproduction est considérée suffisamment proche pour exclure une erreur de découpage, d'inférence, d'apprentissage ou d'agrégation.

## Apprentissage reproduit

Le code officiel effectue un apprentissage supervisé séparé par main. Pour les FHMM, il compte et normalise les probabilités initiales, les transitions entre doigts et les déplacements sur la géométrie du clavier conditionnés par les doigts. Les ordres 2 et 3 ajoutent les dépendances aux deux ou trois notes précédentes. Le Chord HMM apprend séparément les relations verticales au sein d'un accord et horizontales entre accords successifs. Les compteurs sont initialisés par le lissage défini dans `SmoothInit`, puis normalisés.

Limite importante : ces modèles reçoivent déjà la main par le canal PIG. Ils constituent la baseline de doigté par main ; ils ne réalisent pas encore la séparation automatique des mains d'un MIDI ordinaire.
