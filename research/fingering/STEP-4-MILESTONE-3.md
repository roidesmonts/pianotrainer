# Étape 4 — jalon 3 : performances et validation automatique

Date : 3 août 2026.

## Protocole

Le moteur conjoint a été exécuté avec un beam de 100 états, la fenêtre d'attaque de 40 ms et la contrainte de non-réutilisation des doigts encore tenus. Trois MIDI réels de la bibliothèque Piano Trainer ont été choisis pour couvrir un morceau court, un passage dense et une œuvre longue.

Commande reproductible :

```bash
npm run benchmark:fingering
```

Le rapport machine local est écrit dans `artifacts/performance-benchmark-v1/report.json`. Les artefacts et les MIDI restent hors Git.

## Résultats

| Profil | Notes | Durée musicale | Densité | Calcul | Débit | Pic mémoire |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Court — Westminster Chimes | 80 | 15,45 s | 5,18 notes/s | 0,26 s | 313 notes/s | 14,0 Mio |
| Dense — Flight of the Bumble Bee | 1 325 | 62,33 s | 21,26 notes/s | 2,31 s | 573 notes/s | 51,7 Mio |
| Long — Sonate D960 | 18 774 | 2 417,03 s | 7,77 notes/s | 32,93 s | 570 notes/s | 463,7 Mio |

Le beam atteint au plus 100 états dans les trois cas. Le débit des deux charges significatives reste voisin de 570 notes/s. La mémoire augmente avec la longueur parce que les backpointers du chemin complet sont conservés ; 463,7 Mio constitue donc la limite observée à surveiller lors du portage navigateur.

## Stabilité et plausibilité automatisées

- Un test exécute deux fois le même décodage et exige l'égalité des affectations, du score et du nombre d'états explorés.
- Les tests de jitter contrôlé confirment qu'une fenêtre de 40 ms conserve les groupes d'attaque attendus.
- Les contraintes d'accord interdisent les doigts dupliqués et les ordres physiquement incohérents pour une même main.
- Les tests de notes tenues interdisent la réutilisation prématurée d'un doigt, tandis que la pédale ne prolonge que la résonance.
- Sur 2 991 notes de deux interprétations réelles de Clair de lune, aucun conflit de doigt tenu n'a été détecté.
- Sur PIG, dont les mains sont annotées, la séparation atteint 91,98 % et le couple main-doigt 51,70 % sur le test ; cette évaluation automatique remplace le corpus personnel et l'appréciation humaine initialement envisagés.

## Décision

L'étape 4 est validée automatiquement. Le modèle est stable, respecte les invariants physiques testés et traite des MIDI réels courts, denses et longs à un débit compatible avec un calcul hors ligne. Le portage TypeScript devra mesurer et, si nécessaire, réduire la mémoire des backpointers avant une exécution directement dans le navigateur.
