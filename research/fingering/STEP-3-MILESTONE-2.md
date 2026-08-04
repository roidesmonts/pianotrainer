# Étape 3 — Jalon 2 : modèle conjoint mains et doigts

Date : 3 août 2026

## Modèle

L'état merged-output mémorise pour chaque main la dernière hauteur et le dernier doigt. À chaque note, une seule main émet avec l'un des cinq doigts ; l'état de l'autre main reste inchangé.

Le score conjoint additionne en log-probabilités : choix de la main, transition absolue de hauteur, transition de doigt et déplacement géométrique du clavier conditionné par les deux doigts. La géométrie reprend les 93 catégories officielles : `C4=(0,0)`, `D4=(1,0)`, `Eb4=(1,1)`, déplacement horizontal borné à ±15 et trois valeurs verticales.

Les paramètres sont appris de façon supervisée sur les 159 annotations miscellaneous avec lissage `10⁻³` pour les doigts/déplacements. Le Viterbi exact est vérifié face aux `10^N` configurations mains×doigts sur une fixture.

## Mesure exploratoire et accords

Une annotation de référence pour chacune des 30 œuvres de test, soit 10 225 notes :

| Configuration, beam 100 | Main | Doigt | Main + doigt | Accords | Monodie | Accords invalides |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Sans contraintes | 91,78 % | 54,30 % | 50,72 % | 51,43 % | 48,81 % | 4,15 % |
| Ordre et doigts d'accord contraints | **92,25 %** | **54,86 %** | **51,33 %** | **52,24 %** | **48,92 %** | **0 %** |

Les notes d'une attaque simultanée sont virtuellement ordonnées du grave à l'aigu. Pour une même main, les doigts doivent être distincts et croître à droite ou décroître à gauche. Ces contraintes éliminent 75 configurations physiquement incohérentes et améliorent toutes les métriques. Un essai antérieur a montré que le beam 500 multiplie le coût par cinq sans gain ; le beam 100 reste donc retenu pour les évaluations longues.

L'évaluation étendue aux 150 annotations humaines contient 50 014 notes. Elle obtient 91,98 % pour la main, 55,34 % pour le doigt et 51,70 % pour le couple exact. L'exactitude conjointe est de 52,26 % sur les notes d'accord et de 50,13 % en monodie, sans configuration d'accord invalide.

Les résultats faibles se concentrent notamment sur `023`, `012`, `028`, `016` et `021`. La validation retenue reste automatique : résultats par œuvre, séparation accords/monodie et taux de configurations physiques invalides. Aucun jugement humain note par note n'est exigé pour clore l'étape 3.

Cette décision laisse une limite connue : un doigté alternatif peut être musicalement acceptable tout en étant compté comme faux s'il ne correspond pas à l'annotation humaine comparée.

## Entrée MIDI

Après génération locale du modèle avec `npm run evaluate:joint` :

```bash
npm run finger:midi -- entree.mid sortie.json
```

Chaque note reçoit un `noteId`, une main `left/right` et un doigt `1–5`. Cette sortie est expérimentale : elle ne contient pas encore de confiance calibrée et ne regroupe pas les attaques de performance quasi simultanées.
