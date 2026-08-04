# Étape 4 — Jalon 1 : attaques de performance

Date : 3 août 2026

## Regroupement

Les notes MIDI sont triées par attaque, puis regroupées avec une fenêtre ancrée : une note appartient au groupe courant seulement si son attaque se situe dans la tolérance par rapport à la première attaque du groupe. Ce choix évite qu'une chaîne de petits écarts fusionne transitivement un arpège entier.

Dans chaque groupe, les notes sont virtuellement ordonnées du grave à l'aigu. La sortie conserve `onsetSeconds` original et ajoute `groupedOnsetSeconds` ainsi que `attackGroup`.

## Choix de la tolérance

Les accords PIG de 30 œuvres ont été désynchronisés de façon déterministe jusqu'à ±20 ms. Chaque tolérance a été testée sur la version intacte et la version bruitée :

| Tolérance | Conjoint intact | Conjoint désynchronisé | Main désynchronisée |
| ---: | ---: | ---: | ---: |
| 0 ms | 51,33 % | 48,02 % | 90,48 % |
| 10 ms | 51,33 % | 48,85 % | 90,97 % |
| 20 ms | 51,28 % | 49,22 % | 91,35 % |
| 30 ms | 51,28 % | 50,92 % | 92,20 % |
| **40 ms** | **51,29 %** | **51,33 %** | **92,29 %** |
| 50 ms | 51,29 % | 51,43 % | 92,24 % |

La valeur 40 ms est retenue : elle restaure la qualité conjointe originale et maximise la séparation des mains, sans prendre les 10 ms supplémentaires qui augmenteraient le risque de fusion de traits rapides pour un gain négligeable.

## Intégration MIDI

`separate:midi` et `finger:midi` appliquent désormais automatiquement cette préparation. La pédale, les notes tenues et les attaques roulées longues restent à traiter dans les jalons suivants.
