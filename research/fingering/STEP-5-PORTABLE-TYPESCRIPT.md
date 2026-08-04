# Étape 5 — Format portable et moteur TypeScript

Date : 4 août 2026

## Format et droits

Le schéma JSON v1 est défini dans `model/merged-output-model.schema.json`. Il versionne le type de modèle, sa provenance, son statut de redistribution, les lissages, la géométrie du clavier et toutes les tables en log-probabilités. Le chargeur TypeScript contrôle également les dimensions et rejette un JSON incomplet avant décodage.

Les paramètres appris sur PIG ne sont **pas publiés** : les droits de redistribution des paramètres dérivés restent à clarifier. `npm run export:fingering-model:local` produit un export local marqué `not-cleared`, dans le répertoire `artifacts/` ignoré par Git. L'exporteur refuse explicitement de le marquer public.

Pour disposer d'un artefact distribuable et tester la chaîne complète, `npm run export:fingering-model` entraîne de façon déterministe un modèle sur trois séquences synthétiques originales du projet, placées sous CC0. Ce modèle de fixture ne prétend pas remplacer le modèle PIG pour la qualité musicale.

## Port TypeScript et parité

Le moteur navigateur se trouve dans `src/fingering/viterbi.ts` et son chargeur dans `src/fingering/model.ts`. Il conserve les calculs en log-probabilités, les backpointers, les contraintes d'accord, l'occupation des doigts tenus et le beam déterministe du prototype.

La fixture `test/fixtures/portable-viterbi-v1.json` est consommée simultanément par le prototype JavaScript et le TypeScript compilé. Les tests comparent :

- le chemin complet main/doigt ;
- le score numérique avec une tolérance de `10⁻¹²` ;
- le nombre d'états explorés ;
- l'activation de l'élagage.

Les trois scénarios couvrent un passage entrelacé, un accord avec notes tenues et un beam étroit. Les 18 tests de recherche passent. Le beam reste configurable et n'est utilisé que lorsque les mesures de l'étape 4 le justifient (100 états pour les MIDI longs).

## Commandes

```bash
npm run export:fingering-model
npm run test:fingering
npm run build
```

Le critère de validation est atteint : les affectations et scores du prototype et du moteur destiné au navigateur sont identiques sur toutes les fixtures portables.
