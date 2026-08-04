# Étape 3 — Jalon 1 : séparation merged-output des mains

Date : 3 août 2026

## Portée du jalon

Ce jalon implémente le modèle de séparation de voix de la section 2.3 de Nakamura, Ono et Sagayama (ISMIR 2014). Il ne contient pas encore les doigts dans l'état caché et ne constitue donc pas encore le merged-output HMM complet de doigté.

L'observation est une suite ordonnée de hauteurs MIDI. L'état dynamique mémorise la dernière note attribuée à chaque main :

```text
(index dernière note gauche, index dernière note droite)
```

À chaque observation, une seule main émet et met à jour sa hauteur ; l'autre hauteur reste mémorisée. Le score d'une transition est la somme en log-probabilités de la probabilité de choisir la main et de la transition de hauteur propre à cette main. Les matrices gauche et droite sont apprises sur les annotations PIG `031–150`, avec un lissage uniforme de `0,1`.

Le Viterbi est exact. Après la note `n`, seules les configurations dont l'un des deux derniers indices vaut `n` sont conservées. Les tests comparent le chemin obtenu à l'énumération exhaustive des `2^N` affectations sur une petite fixture.

## Baselines et résultat

Évaluation sur les 150 annotations des œuvres `001–030`, soit 50 014 notes :

| Méthode | Exactitude main | Erreurs |
| --- | ---: | ---: |
| Coupure fixe à MIDI 60 | 81,39 % | 9 309 |
| Coupure MIDI 62 apprise uniquement sur l'entraînement | 84,55 % | 7 725 |
| Viterbi merged-output sur transitions de hauteurs | **87,89 %** | **6 057** |

Commande reproductible :

```bash
npm run evaluate:hands
```

Une première variante fondée uniquement sur les intervalles obtenait 77,42 %. Elle perdait l'information de registre après l'initialisation des deux mains. L'utilisation des matrices absolues `aᶫₚₚ′` et `aʳₚₚ′` de l'article corrige ce défaut. La valeur 87,89 % utilise désormais l'ordre virtuel grave→aigu des attaques simultanées, commun au modèle conjoint.

## Entrée MIDI réelle

Le CLI lit un `.mid` ordinaire avec `@tonejs/midi`, fusionne les pistes, trie par ticks puis par hauteur, et attribue une identité stable :

```text
piste : ticks de début : hauteur MIDI : index de doublon
```

Utilisation :

```bash
npm run separate:midi -- entree.mid sortie.json
```

Contrôle effectué sur `079-Debussy - Clair de lune.mid` : 1 505 notes provenant d'une seule piste ont été décodées, dont 665 à gauche et 840 à droite.

## Limites avant le jalon suivant

- les doigts ne font pas encore partie de l'état ;
- les accords de performance légèrement désynchronisés ne sont pas encore regroupés ;
- aucune contrainte verticale de largeur ou de doigts distincts dans un accord n'est appliquée ;
- la confiance n'est pas calibrée ;
- la matrice absolue est sensible aux hauteurs peu observées ;
- les résultats doivent être analysés par œuvre, densité et type de texture.

Le prochain jalon ajoutera les états de doigts gauche/droite et les probabilités FHMM déjà reproduites à l'étape 2, tout en conservant ce séparateur comme baseline mesurée.
