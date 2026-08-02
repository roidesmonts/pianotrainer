import { useMemo, useState } from 'react'
import { exercices, type Exercice, type MainExercice } from '../training/exercices'

const libelles: Record<MainExercice, string> = { libre: 'Exploration', droite: 'Main droite', gauche: 'Main gauche', deux: 'Deux mains' }
const niveaux = [
  { numero: 1, titre: 'Explorer le clavier', texte: 'Parcourir toute l’étendue et construire ses repères.' },
  { numero: 2, titre: 'Travailler une main', texte: 'Positions simples et petits déplacements.' },
  { numero: 3, titre: 'Réunir les deux mains', texte: 'Coordination et premiers rythmes.' },
] as const

export function CatalogueEntrainement({ ouvrir }: { ouvrir: (exercice: Exercice) => void }) {
  const [main, setMain] = useState<MainExercice | 'toutes'>('toutes')
  const visibles = useMemo(() => exercices.filter(exercice => main === 'toutes' || exercice.main === main), [main])
  return <section className="training">
    <header className="training-intro"><div><p className="eyebrow">Parcours progressif</p><h2>Entraînement et apprentissage</h2><p>Travaillez chaque notion séparément, puis réunissez les deux mains à votre rythme.</p></div><strong>{exercices.length} exercices</strong></header>
    <nav className="hand-filters" aria-label="Filtrer les exercices">
      {([['toutes','Tous'],['libre','Exploration'],['droite','Main droite'],['gauche','Main gauche'],['deux','Deux mains']] as const).map(([id, label]) =>
        <button className={main === id ? 'active' : ''} key={id} onClick={() => setMain(id)}>{label}</button>)}
    </nav>
    <div className="training-levels">{niveaux.map(niveau => {
      const liste = visibles.filter(exercice => exercice.niveau === niveau.numero)
      if (!liste.length) return null
      return <section className="training-level" key={niveau.numero}><header><span>{niveau.numero}</span><div><h3>{niveau.titre}</h3><p>{niveau.texte}</p></div></header>
        <div className="exercise-grid">{liste.map(exercice => <article className="exercise" key={exercice.id}>
          <div className="exercise-top"><span>{libelles[exercice.main]}</span><small>{'●'.repeat(exercice.difficulte)}{'○'.repeat(5 - exercice.difficulte)}</small></div>
          <h4>{exercice.titre}</h4><p>{exercice.objectif}</p>
          <footer><span>{exercice.tempo} BPM</span><button onClick={() => ouvrir(exercice)}>Commencer <i>▶</i></button></footer>
        </article>)}</div>
      </section>
    })}</div>
  </section>
}
