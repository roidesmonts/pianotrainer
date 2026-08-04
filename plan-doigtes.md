# Plan — Séparation des mains et estimation des doigtés

Dernière mise à jour : 3 août 2026

## Objectif

À partir d’un morceau MIDI pour piano dont les mains ne sont pas nécessairement séparées, produire pour chaque note :

```ts
type FingeredNote = {
  noteId: string
  hand: 'left' | 'right'
  finger: 1 | 2 | 3 | 4 | 5
  confidence: number
  source: 'midi' | 'hmm' | 'user'
}
```

La convention de doigté est la convention pianistique habituelle : pouce 1, index 2, majeur 3, annulaire 4 et auriculaire 5 pour les deux mains.

Le résultat doit être une proposition de doigté plausible et cohérente sur l’ensemble du passage. Il ne doit pas être présenté comme l’unique doigté possible. La morphologie, le niveau, le tempo et l’interprétation peuvent justifier plusieurs solutions.

## Décision centrale

Ne pas développer un séparateur fondé uniquement sur des heuristiques locales ou une frontière de hauteur.

Le modèle de référence sera un **merged-output Hidden Markov Model** pour les deux mains, décodé par **Viterbi**. Les paramètres devront être appris sur des annotations réelles plutôt que choisis arbitrairement.

Références principales :

- Eita Nakamura, Nobutaka Ono et Shigeki Sagayama, *Merged-Output HMM for Piano Fingering of Both Hands*, ISMIR 2014 : https://eita-nakamura.github.io/articles/Nakamura_etal_MergedOutputHMMForPianoFingering_ISMIR2014.pdf
- Eita Nakamura, Yasuyuki Saito et Kazuyoshi Yoshii, *Statistical Learning and Estimation of Piano Fingering*, Information Sciences 2020 : https://arxiv.org/abs/1904.10237
- Code et résultats HMM officiels : https://statpianofingering.github.io/demo.html
- PIG Dataset : https://beam.kisarazu.ac.jp/saito/research/PianoFingeringDataset/

`PianoHands.jl` pourra servir de comparaison expérimentale, mais ne constitue pas la base retenue. Son réseau Bi-GRU est moins explicable et son environnement Julia est moins naturel pour une application React/Vercel.

## Principe du merged-output HMM

Deux modèles de main évoluent en parallèle. À chaque note observée, une seule main émet la note et change d’état ; l’état de l’autre main reste mémorisé.

Un état conceptuel contient au minimum :

```ts
type HmmState = {
  emittingHand: 'left' | 'right'
  leftFinger: 1 | 2 | 3 | 4 | 5
  leftPitch: number
  rightFinger: 1 | 2 | 3 | 4 | 5
  rightPitch: number
}
```

Cette structure conserve la continuité de chaque main même lorsque les notes des deux mains sont entrelacées dans le flux MIDI.

Les probabilités principales sont :

```text
P(doigt suivant | doigt précédent, main)
P(déplacement de hauteur | doigts précédent et suivant, main)
P(main émettrice | état précédent)
P(configuration de doigté | accord et main)
```

Les déplacements doivent utiliser la géométrie réelle du clavier, en distinguant touches blanches et noires, conformément aux modèles de référence.

## Données d’apprentissage

Le corpus de départ est PIG Dataset v1.2 :

- 150 morceaux classiques ;
- 309 doigtés produits par plusieurs pianistes ;
- environ 100 000 annotations de notes ;
- début, fin, hauteur et doigt pour chaque note ;
- plusieurs annotations pour certains morceaux de Bach, Mozart et Chopin.

### Point de contrôle juridique

PIG autorise uniquement un usage académique non lucratif. Son utilisation convient à la phase personnelle de recherche, mais les conditions suivantes devront être vérifiées avant toute diffusion :

- droit de distribuer des paramètres ou poids appris ;
- droit d’utiliser le modèle dans une application publique ;
- compatibilité avec une éventuelle exploitation commerciale.

Aucun fichier PIG ne doit être ajouté au dépôt tant que ses conditions de redistribution ne l’autorisent pas explicitement.

## Architecture cible

L’entraînement et l’inférence dans l’application doivent être séparés :

```text
PIG Dataset
  → préparation et validation des annotations
  → entraînement HMM hors ligne
  → paramètres versionnés dans un format portable
  → moteur Viterbi TypeScript
  → Piano Trainer dans le navigateur
```

Le format cible des paramètres est JSON, accompagné d’une version de modèle et des informations nécessaires à sa reproduction : corpus, découpage, lissage et métriques.

Le navigateur ne doit ni entraîner le modèle ni dépendre de Julia ou Python. Il charge les paramètres puis exécute uniquement le décodage.

## Traitement du MIDI

Avant le HMM :

1. conserver l’identité stable de chaque note ;
2. utiliser directement les pistes ou métadonnées gauche/droite lorsqu’elles sont explicites et fiables ;
3. normaliser les hauteurs, débuts et fins ;
4. regrouper les attaques quasi simultanées ;
5. préserver les notes tenues et les accords ;
6. ordonner virtuellement les notes d’un accord lorsque le modèle l’exige.

Identité minimale proposée :

```text
piste + ticks de début + hauteur MIDI + index de doublon
```

Le temps flottant en secondes ne suffit pas pour conserver des corrections de manière stable.

## Accords et polyphonie

Une version solide ne peut pas traiter naïvement un accord comme une suite mélodique ordinaire. Elle doit prendre en compte :

- l’utilisation de doigts distincts pour des notes simultanées d’une même main ;
- l’ordre physique des doigts sur le clavier ;
- les croisements impossibles ou très improbables dans un accord ;
- les notes encore tenues lors de l’accord suivant ;
- les accords roulés ou légèrement désynchronisés ;
- la possibilité de répartir un accord entre les deux mains.

Le Chord HMM publié avec les travaux de Nakamura servira de référence avant toute extension locale.

## Décodage

Viterbi recherche la séquence d’états la plus probable pour toutes les notes du passage.

Contraintes d’implémentation :

- calculs en log-probabilités ;
- lissage explicite des transitions non observées ;
- élimination précoce des états impossibles ;
- backpointers pour reconstruire le chemin complet ;
- résultats déterministes à paramètres identiques ;
- beam search seulement si le décodage exact devient trop coûteux ;
- métriques de temps et de mémoire sur de longs fichiers MIDI.

La confiance d’une affectation ne devra pas être inventée à partir de la seule probabilité du meilleur chemin. Elle pourra être dérivée de l’écart entre hypothèses, de probabilités marginales ou d’une méthode calibrée sur le jeu de validation.

## Apprentissage et évaluation

Les partitions doivent être séparées entre entraînement, validation et test **par œuvre**, jamais par note ni par fichier de doigté. Plusieurs annotations du même passage ne doivent pas se retrouver de part et d’autre du découpage.

Mesures minimales :

- précision de l’affectation gauche/droite ;
- précision exacte du doigt ;
- précision acceptant plusieurs doigtés humains annotés ;
- résultats séparés pour monodie, accords et polyphonie ;
- résultats par compositeur ou style ;
- taux de configurations physiquement incohérentes ;
- temps de calcul et mémoire ;
- appréciation humaine sur des passages connus.

Les résultats doivent toujours être comparés à des baselines :

- coupure fixe de registre ;
- séparation par pistes lorsqu’elle existe ;
- HMM officiel reproduit sans modification ;
- éventuellement PianoHands.jl.

## Intégration future dans Piano Trainer

Après validation du modèle seulement :

- afficher ou masquer les numéros de doigts sur les notes ;
- distinguer les mains sans modifier les couleurs pédagogiques Do–Si, par exemple avec un contour ou une luminosité ;
- écouter et travailler une seule main ;
- signaler visuellement les propositions incertaines ;
- permettre de corriger une main ou un doigt ;
- conserver les corrections avec le morceau ;
- donner toujours priorité aux corrections utilisateur ;
- éventuellement recalculer localement autour d’une contrainte.

Trois niveaux visuels sont envisagés : proposition fiable, proposition incertaine et choix utilisateur verrouillé.

## Déroulement pas à pas

### Étape 0 — Cadre et reproductibilité — VALIDÉE

- [x] Lire intégralement les deux articles de référence.
- [x] Télécharger et examiner le code HMM officiel.
- [x] Documenter son langage, sa licence, ses formats et ses commandes.
- [x] Obtenir PIG v1.2 selon sa procédure officielle.
- [x] Documenter les droits publiés et les incertitudes de redistribution à clarifier.
- [x] Créer un espace expérimental séparé du code React.
- [x] Fixer les graines aléatoires et le découpage initial des œuvres.

**Critère de validation :** environnement reproductible, données non versionnées, une commande documentée pour lancer une expérience.

### Étape 1 — Compréhension et conversion de PIG — VALIDÉE

- [x] Parser le format d’annotation PIG sans perte.
- [x] Vérifier les conventions main/doigt et les accords.
- [x] Produire des statistiques initiales du corpus.
- [x] Détecter annotations multiples et données invalides.
- [x] Convertir vers un format interne documenté.
- [x] Écrire des tests sur quelques passages contrôlés manuellement.

**Critère de validation :** toutes les annotations attendues sont chargées et plusieurs partitions concordent visuellement avec leurs fichiers de doigté.

Validation visuelle confirmée par l'utilisateur le 3 août 2026 depuis la section Recherche de Piano Trainer.

### Étape 2 — Reproduction du HMM officiel à une main — VALIDÉE

- [x] Exécuter les modèles officiels d’ordre 1, 2 et 3.
- [x] Reproduire leurs métriques sur le découpage de référence.
- [x] Comprendre l’apprentissage des transitions et déplacements.
- [x] Reproduire le Chord HMM.
- [x] Enregistrer paramètres, métriques et journaux d’expérience.

**Critère de validation :** résultats suffisamment proches des valeurs publiées pour exclure une erreur de préparation ou d’évaluation.

Validation obtenue le 3 août 2026 sur PIG v1.2. L'écart maximal aux valeurs publiées est inférieur à un point de pourcentage et le réentraînement local reproduit les paramètres officiels à moins de 0,05 point sur presque toutes les métriques.

### Étape 3 — Merged-output HMM à deux mains — VALIDÉE

Jalon 3A — séparation des mains par hauteurs :

- [x] Implémenter la baseline de coupure fixe de registre.
- [x] Apprendre une coupure de registre uniquement sur l'entraînement.
- [x] Implémenter le Viterbi merged-output exact mémorisant la dernière hauteur de chaque main.
- [x] Vérifier Viterbi contre une recherche exhaustive sur une fixture.
- [x] Dépasser les baselines de registre sur les 30 œuvres de test.
- [x] Exécuter le séparateur sur un fichier MIDI ordinaire avec identité stable des notes.

Jalon 3B — modèle conjoint mains et doigts :

- [x] Reproduire l’état fusionné des deux modèles de main.
- [x] Implémenter l’apprentissage supervisé des paramètres.
- [x] Implémenter Viterbi exact en log-probabilités.
- [x] Gérer l'ordre virtuel, les doigts distincts et l'ordre physique des accords selon la méthode de référence.
- [x] Comparer l’affectation des mains et des doigts aux annotations PIG.
- [x] Analyser automatiquement les erreurs par œuvre, monodie, accords et cohérence physique.

**Critère de validation :** meilleure séparation des mains qu’une coupure fixe et doigtés comparables à la référence scientifique.

Validation obtenue le 3 août 2026 : 91,98 % d'exactitude pour la main sur les 150 annotations de test, contre 84,55 % pour la meilleure coupure de registre apprise ; 55,34 % pour le doigt et 51,70 % pour le couple main+doigt. L'analyse humaine de plausibilité musicale est explicitement écartée à ce stade au profit de mesures automatiques reproductibles.

### Étape 4 — Robustesse aux MIDI de performance — VALIDÉE

- [x] Tester les attaques légèrement désynchronisées.
- [x] Tester pédale, notes tenues et vélocités variables.
- [x] Définir une tolérance de regroupement fondée sur les données.
- [x] Tester des séquences quantifiées et désynchronisées de façon contrôlée.
- [x] Mesurer les performances sur des morceaux courts, longs et denses.
- [x] Comparer aux mains connues de PIG et aux invariants physiques sur des MIDI réels.

**Critère de validation :** sorties stables et musicalement plausibles sur les fichiers réellement utilisés par Piano Trainer.

Validation automatique obtenue le 3 août 2026 : de 313 à 573 notes/s sur 80, 1 325 et 18 774 notes, beam plafonné à 100 états, décodage déterministe et aucun conflit de doigt tenu sur 2 991 notes de performance. La comparaison aux mains annotées de PIG remplace le corpus personnel et l'appréciation humaine écartée par l'utilisateur. Le cas long atteint 463,7 Mio, point de vigilance explicite pour le portage navigateur.

### Étape 5 — Format portable et moteur TypeScript — VALIDÉE

- [x] Définir et versionner le schéma JSON des paramètres.
- [x] Exporter un modèle entraîné autorisé à être distribué.
- [x] Porter l’inférence Viterbi en TypeScript.
- [x] Créer les mêmes fixtures dans le prototype et dans TypeScript.
- [x] Vérifier l’égalité des chemins et scores numériques.
- [x] Ajouter beam search uniquement si les mesures le justifient.

**Critère de validation :** mêmes affectations dans l’outil de référence et dans le navigateur sur le jeu de fixtures.

Validation obtenue le 4 août 2026 : parité exacte des chemins, des états explorés et de l’élagage sur trois fixtures ; écart de score inférieur à 10⁻¹². Le modèle PIG reste local faute de droits de redistribution clarifiés ; l’artefact versionné est entraîné sur des fixtures synthétiques originales CC0 et sert uniquement à valider la chaîne portable.

### Étape 6 — Interface Piano Trainer — VALIDÉE

- [x] Étendre le modèle interne des notes avec main, doigt, confiance et origine.
- [x] Ajouter l’affichage optionnel des doigts.
- [x] Ajouter le filtrage gauche/droite pour l’affichage et le son.
- [x] Afficher les zones incertaines.
- [x] Permettre les corrections manuelles.
- [x] Persister les corrections avec une identité stable du morceau et des notes.

**Critère de validation :** un morceau peut être séparé, travaillé par main et corrigé sans altérer le MIDI original.

Validation technique obtenue le 4 août 2026 et renforcée après essai utilisateur : les notes portent une identité déterministe liée au contenu MIDI, les corrections sont appliquées sur des copies puis stockées séparément dans IndexedDB, et le filtre de main pilote simultanément le piano-roll et le son. L’application locale utilise les paramètres PIG entraînés pour séparer les mains, regroupe les attaques à 40 ms et interdit les croisements lorsque les deux mains jouent simultanément ou tiennent encore leurs notes. Les doigts sont ensuite recalculés séparément par main avec FHMM3 réentraîné localement, plus performant que la composante doigt du modèle conjoint. La confiance de main provient de la marge des scores gauche/droite.

Sur une annotation de chacune des 30 œuvres PIG de test, soit 10 225 notes, la chaîne finale atteint 92,98 % pour la main et 54,14 % pour le couple main-doigt exact face à cette annotation unique. Elle ne produit aucun croisement sur 2 297 accords mixtes. 12,24 % des notes sont signalées comme incertaines ; les autres atteignent 96,58 % de mains correctes. Sur les MIDI de contrôle, elle élimine les 16 croisements sur 16 observés initialement dans Westminster Chimes et n’en produit aucun sur les 254 accords mixtes de Flight of the Bumble Bee.

## Prochaine action

Continuer la validation ergonomique sur les morceaux réellement travaillés et consigner les corrections résiduelles pour guider les prochains raffinements du modèle local.
