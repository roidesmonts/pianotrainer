# Décisions d’architecture — Piano Trainer

Dernière mise à jour : 3 août 2026

Ce document conserve les choix durables du projet et leur motivation. L’état d’avancement chronologique reste dans `avancement.md` et les instructions d’utilisation dans `README.md`.

## Expérience pédagogique

- L’application est un outil de travail au piano, pas un lecteur multimédia généraliste.
- La lecture repose sur un piano roll vertical et des couleurs stables par nom de note.
- Les dièses héritent de la couleur de la note naturelle précédente et sont signalés par une croix.
- La géométrie du piano roll suit la largeur et la position physiques des touches.
- Le Practice entraîne des noms de notes, pas la reconnaissance théorique d’accords. Les groupes aléatoires de 3 ou 5 éléments sont donc appelés « groupes de notes ».
- Un groupe ne contient jamais deux réponses portant le même nom naturel, par exemple Do et Do♯, car l’interface utilise sept boutons Do–Si.

## Modes de Practice

- Les tailles 1, 3 et 5 notes sont disponibles dans Série, Long Run et Contre-la-montre.
- La sélection de la dernière note requise valide automatiquement un groupe.
- Série propose un entraînement actif ou une observation passive avec un délai configurable.
- Long Run conserve trois vies et accélère par niveaux.
- Contre-la-montre utilise un temps global, n’impose aucun délai par groupe et disqualifie dès la première erreur.
- Les délais par défaut augmentent avec le nombre de notes afin de garder les épreuves lisibles.
- Les scores et records de configurations différentes ne doivent jamais être mélangés.

## Persistance locale

### Choix actuel

Les tentatives sont conservées dans IndexedDB avec une implémentation native, sans dépendance externe. Ce choix permet de développer et tester la méthode hors ligne, avec un seul utilisateur, sans créer prématurément de comptes ou de backend.

`localStorage` reste utilisé pour les anciens records afin de ne pas perdre les données existantes. Les nouvelles courbes sont calculées depuis l’historique IndexedDB et non depuis un record agrégé.

### Modèle `PracticeAttempt`

Une tentative contient :

```ts
type PracticeAttempt = {
  id: string
  playedAt: string
  experience: 'serie' | 'long' | 'chrono'
  noteCount: 1 | 3 | 5
  score: number
  correctAnswers: number
  totalQuestions: number
  accuracy: number
  durationSeconds: number
  configuredDuration: number | null
  reflectionDelay: number | null
  levelReached: number | null
  result: 'completed' | 'disqualified' | 'stopped'
}
```

- Série est comparée principalement par précision.
- Long Run et Contre-la-montre sont comparés principalement par score.
- Les tentatives interrompues sont enregistrées, mais exclues par défaut des courbes.
- Les comparaisons doivent filtrer au minimum l’expérience et le nombre de notes. La durée configurée devra également devenir un filtre lorsque suffisamment de données seront disponibles.

### Migration future

La cible envisagée pour une mise en ligne multi-utilisateur est Supabase Auth, PostgreSQL et Supabase Storage, avec le frontend hébergé sur Vercel.

La migration prévue est :

1. conserver le type `PracticeAttempt` comme contrat commun ;
2. introduire une interface de dépôt pour isoler IndexedDB ;
3. ajouter un dépôt Supabase utilisant le même contrat ;
4. rattacher chaque tentative à un `user_id` ;
5. protéger les lignes avec PostgreSQL Row Level Security ;
6. proposer un export/import JSON ou une synchronisation des données locales ;
7. stocker les fichiers MIDI dans Supabase Storage et seulement leurs métadonnées dans PostgreSQL.

Un classement public exigera une validation serveur des résultats. Les scores provenant uniquement du navigateur ne sont pas considérés comme infalsifiables.

## Bibliothèque MIDI

- La bibliothèque serveur actuelle est une facilité de développement fournie par Vite et le dossier `../midi`.
- Les fichiers locaux importés ne sont pas encore persistés comme bibliothèque complète.
- À terme, les MIDI personnels seront des objets de stockage, pas des données binaires PostgreSQL.
- Les métadonnées recherchables resteront en base : propriétaire, chemin de stockage, titre, taille, durée et visibilité.

## Séparation des mains et doigtés

- Le chantier est défini dans `plan-doigtes.md`.
- La cible est un merged-output HMM entraîné sur des annotations réelles et décodé par Viterbi.
- Une heuristique locale ou une simple frontière de registre ne constitue qu’une baseline, pas la solution finale.
- L’entraînement reste hors ligne ; seule l’inférence validée devra être portée en TypeScript.
- Aucun modèle ne sera intégré avant reproduction des références, évaluation sur des œuvres séparées et clarification des droits du corpus et des paramètres appris.

## Documentation

- `README.md` explique l’application, son lancement et ses fonctions visibles.
- `avancement.md` est la mémoire chronologique et décrit l’état réel de la réalisation.
- `DECISIONS.md` conserve les règles fonctionnelles et choix d’architecture qui doivent survivre aux changements d’implémentation.
- Les documents doivent être mis à jour après chaque fonctionnalité validée, sans dépendre de l’historique d’une conversation ou uniquement des commits Git.
