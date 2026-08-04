# Étape 4 — Jalon 2 : notes tenues, pédale et vélocité

Date : 3 août 2026

## Occupation physique des doigts

Le beam transporte désormais, pour chacun des cinq doigts de chaque main, la date de note-off de la touche occupée. Une transition qui réutiliserait un doigt avant cette date est éliminée. Dans un groupe d'attaques, l'occupation commence à l'attaque regroupée monotone et se termine au note-off original.

Cette contrainte est activée pour `finger:midi`. Elle reste optionnelle dans le décodeur afin de ne pas modifier rétroactivement les évaluations PIG synthétiques dont les durées ne représentent pas une performance humaine.

## Pédale

Les événements MIDI CC64 continus ou binaires sont convertis en intervalles avec un seuil de `0,5`. Chaque note indique si la pédale est enfoncée à son attaque et la prochaine date de relâchement.

La pédale prolonge la résonance, mais pas l'occupation du doigt : seule la durée note-on → note-off bloque un doigt. Cette distinction évite de rendre injouables les passages fortement pédalisés.

## Contrôles réels

| Fichier | Notes | Attaques sous pédale | Plage de vélocité | Conflits de doigts tenus |
| --- | ---: | ---: | --- | ---: |
| Clair de lune, MIDI principal | 1 505 | 1 350 | 0,016–0,874 | **0** |
| Clair de lune, Disklavier | 1 486 | 1 420 | 0,142–0,780 | **0** |

La vélocité est conservée dans la sortie, mais n'influence pas encore les probabilités de main ou de doigt. C'est volontaire : aucune justification expérimentale ne montre encore qu'elle améliore le modèle.
