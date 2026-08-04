import { DragEvent, useEffect, useMemo, useRef, useState } from 'react'
import { analyserMidi } from './midi/analyserMidi'
import { SourceBibliothequeServeur } from './storage/SourceBibliothequeServeur'
import { SourceDossierLocal } from './storage/SourceDossierLocal'
import type { EntreeMorceau, MorceauMidi } from './types/midi'
import { PianoRollStatic } from './components/PianoRollStatic'
import { CatalogueEntrainement } from './components/CatalogueEntrainement'
import { Practice } from './components/Practice'
import { Progression } from './components/Progression'
import { FingeringResearch } from './components/FingeringResearch'
import type { Exercice } from './training/exercices'

const locale = new SourceDossierLocal(), serveur = new SourceBibliothequeServeur()
const sec = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const duree = (n: number) => `${Math.floor(n / 60)}:${Math.floor(n % 60).toString().padStart(2, '0')}.${Math.floor(n % 1 * 1000).toString().padStart(3, '0')}`

export default function App() {
  const input = useRef<HTMLInputElement>(null)
  const [morceau, setMorceau] = useState<MorceauMidi | null>(null), [fichier, setFichier] = useState(''), [vue, setVue] = useState<'bibliotheque' | 'entrainement' | 'practice' | 'progression' | 'recherche'>('bibliotheque')
  const [erreur, setErreur] = useState(''), [charge, setCharge] = useState(false), [survol, setSurvol] = useState(false)
  const [bibliotheque, setBibliotheque] = useState<EntreeMorceau[]>([]), [recherche, setRecherche] = useState('')
  const [dossierCourant, setDossierCourant] = useState('')
  const resultats = useMemo(() => {
    const termes = recherche.toLocaleLowerCase('fr').trim().split(/\s+/).filter(Boolean)
    const trouves = termes.length ? bibliotheque.filter(e => termes.every(terme => e.chemin.toLocaleLowerCase('fr').includes(terme))) : []
    return trouves.slice(0, 60)
  }, [bibliotheque, recherche])
  const contenuDossier = useMemo(() => {
    const prefixe = dossierCourant ? `${dossierCourant}/` : ''
    const dossiers = new Set<string>()
    const fichiers: EntreeMorceau[] = []
    bibliotheque.forEach(entree => {
      if (!entree.chemin.startsWith(prefixe)) return
      const reste = entree.chemin.slice(prefixe.length)
      const separation = reste.indexOf('/')
      if (separation === -1) fichiers.push(entree)
      else dossiers.add(reste.slice(0, separation))
    })
    return { dossiers: [...dossiers].sort((a, b) => a.localeCompare(b, 'fr')), fichiers }
  }, [bibliotheque, dossierCourant])
  useEffect(() => { serveur.lister().then(setBibliotheque).catch(e => setErreur(e instanceof Error ? e.message : 'Bibliothèque indisponible.')) }, [])

  async function analyser(donnees: ArrayBuffer, nom: string) {
    setCharge(true); setErreur('')
    try { setMorceau(await analyserMidi(donnees, nom)); setFichier(nom) }
    catch (e) { setMorceau(null); setErreur(e instanceof Error ? e.message : 'Analyse impossible.') }
    finally { setCharge(false) }
  }
  async function ouvrirLocal(file: File) { const entree = locale.ajouter(file); await analyser(await locale.chargerFichier(entree.id), file.name) }
  async function ouvrirBase(entree: EntreeMorceau) {
    setCharge(true); setErreur('')
    try { await analyser(await serveur.chargerFichier(entree.id), entree.nom) }
    catch (e) { setErreur(e instanceof Error ? e.message : 'Chargement impossible.'); setCharge(false) }
  }
  function ouvrirExercice(exercice: Exercice) { setMorceau(exercice.morceau); setFichier(exercice.titre); setErreur('') }
  function deposer(e: DragEvent<HTMLDivElement>) { e.preventDefault(); setSurvol(false); if (e.dataTransfer.files[0]) void ouvrirLocal(e.dataTransfer.files[0]) }

  return <main className="app-shell">
    <header className="app-header"><div><p className="eyebrow">Lecteur et apprentissage du piano</p><h1>Piano Trainer</h1></div>{morceau ? <button className="secondary" onClick={() => setMorceau(null)}>Quitter le morceau</button> : <nav className="main-tabs"><button className={vue === 'bibliotheque' ? 'active' : ''} onClick={() => setVue('bibliotheque')}>Bibliothèque</button><button className={vue === 'entrainement' ? 'active' : ''} onClick={() => setVue('entrainement')}>Entraînement</button><button className={vue === 'practice' ? 'active' : ''} onClick={() => setVue('practice')}>Practice</button><button className={vue === 'progression' ? 'active' : ''} onClick={() => setVue('progression')}>Progression</button><button className={vue === 'recherche' ? 'active' : ''} onClick={() => setVue('recherche')}>Recherche</button></nav>}</header>
    <input ref={input} className="hidden" type="file" accept=".mid,.midi,audio/midi,audio/x-midi" onChange={e => { if (e.target.files?.[0]) void ouvrirLocal(e.target.files[0]); e.target.value = '' }} />
    {!morceau && vue === 'bibliotheque' && <div className="sources">
      <section className="library-picker"><div className="library-heading"><span className="file-icon">BASE</span><div><h2>Bibliothèque du serveur</h2><p>{bibliotheque.length ? `${bibliotheque.length.toLocaleString('fr-FR')} fichiers MIDI disponibles` : 'Chargement de la bibliothèque…'}</p></div></div>
        <div className="search-box"><span aria-hidden="true">⌕</span><input type="search" value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher un titre, un compositeur, un dossier…" autoComplete="off" /></div>
        {recherche && <><div className="results-head"><span>{`${resultats.length}${resultats.length === 60 ? '+' : ''} résultat(s)`}</span><button onClick={() => setRecherche('')}>Effacer</button></div>
        <div className="search-results">{resultats.map(e => { const dossier = e.chemin.slice(0, -(e.nom.length + 1)); return <button className="result" key={e.id} onClick={() => void ouvrirBase(e)} disabled={charge}>
          <span className="result-mark">♪</span><span><strong>{e.nom.replace(/\.midi?$/i, '')}</strong><small>{dossier || 'Bibliothèque'}</small></span><em>Ouvrir</em></button> })}
          {!resultats.length && bibliotheque.length > 0 && <p className="empty-results">Aucun morceau ne correspond à cette recherche.</p>}</div></>}
        <div className="browser-title"><div><h3>Parcourir les dossiers</h3><p>{contenuDossier.dossiers.length} dossiers · {contenuDossier.fichiers.length} morceaux à ce niveau</p></div></div>
        <nav className="breadcrumbs" aria-label="Chemin du dossier"><button onClick={() => setDossierCourant('')}>Bibliothèque</button>
          {dossierCourant.split('/').filter(Boolean).map((partie, index, parties) => <span key={`${partie}-${index}`}><i>/</i><button onClick={() => setDossierCourant(parties.slice(0, index + 1).join('/'))}>{partie}</button></span>)}</nav>
        <div className="folder-browser">
          {dossierCourant && <button className="folder up" onClick={() => setDossierCourant(dossierCourant.split('/').slice(0, -1).join('/'))}><span>↰</span><strong>Dossier précédent</strong></button>}
          {contenuDossier.dossiers.map(dossier => <button className="folder" key={dossier} onClick={() => setDossierCourant(dossierCourant ? `${dossierCourant}/${dossier}` : dossier)}><span>▰</span><strong>{dossier}</strong></button>)}
          {contenuDossier.fichiers.map(entree => <button className="browser-file" key={entree.id} onClick={() => void ouvrirBase(entree)} disabled={charge}><span>♪</span><strong>{entree.nom.replace(/\.midi?$/i, '')}</strong><em>Ouvrir</em></button>)}
        </div></section>
      <section className={`drop-zone ${survol ? 'active' : ''}`} onDragEnter={e => { e.preventDefault(); setSurvol(true) }} onDragOver={e => e.preventDefault()} onDragLeave={() => setSurvol(false)} onDrop={deposer}>
        <span className="file-icon">MIDI</span><h2>{charge ? 'Analyse en cours…' : 'Ou déposez un fichier MIDI'}</h2><p>Fichier local au format .mid ou .midi</p><button disabled={charge} onClick={() => input.current?.click()}>Choisir sur cet ordinateur</button>
      </section></div>}
    {!morceau && vue === 'entrainement' && <CatalogueEntrainement ouvrir={ouvrirExercice} />}
    {!morceau && vue === 'practice' && <Practice />}
    {!morceau && vue === 'progression' && <Progression />}
    {!morceau && vue === 'recherche' && <FingeringResearch />}
    {erreur && <p className="error" role="alert">{erreur}</p>}
    {morceau && <><PianoRollStatic morceau={morceau} /><Inspecteur morceau={morceau} fichier={fichier} /></>}
  </main>
}

function Inspecteur({ morceau, fichier }: { morceau: MorceauMidi; fichier: string }) {
  return <div className="inspector"><section className="file-summary"><div><small>Fichier analysé</small><h2>{fichier}</h2>{morceau.nomInterne && <p>Nom interne : {morceau.nomInterne}</p>}</div><b>Données prêtes</b></section>
    <section className="metrics"><Metric label="Durée" value={duree(morceau.duree)} /><Metric label="Pistes" value={morceau.pistes.length} /><Metric label="Notes" value={morceau.notes.length.toLocaleString('fr-FR')} /><Metric label="Tempo initial" value={`${morceau.tempoInitial.toFixed(1)} BPM`} /><Metric label="Étendue" value={morceau.etendue ? `${morceau.etendue.nomMin} – ${morceau.etendue.nomMax}` : '—'} /><Metric label="Mesures" value={morceau.mesures.length} /></section>
    <div className="detail-grid"><section className="panel tracks"><h3>Pistes</h3>{morceau.pistes.map(p => <div className="row" key={p.id}><i>{p.index + 1}</i><span><strong>{p.nom}</strong><small>Canal {p.canal + 1} · {p.instrument}</small></span><em>{p.nombreNotes} notes</em></div>)}</section>
      <EventPanel titre="Changements de tempo" events={morceau.tempos.map(t => [sec(t.temps) + ' s', t.bpm.toFixed(2) + ' BPM'])} /><EventPanel titre="Signatures rythmiques" events={morceau.signaturesRythmiques.map(s => [sec(s.temps) + ' s', `${s.numerateur}/${s.denominateur}`])} /></div>
    <section className="panel"><div className="panel-title"><h3>30 premières notes</h3><small>Triées par date musicale</small></div><div className="table-wrap"><table><thead><tr><th>#</th><th>Note</th><th>MIDI</th><th>Début (s)</th><th>Durée (s)</th><th>Main</th><th>Doigt</th><th>Confiance</th><th>Piste</th></tr></thead><tbody>{morceau.notes.slice(0, 30).map((n, i) => <tr key={n.id}><td>{i + 1}</td><td><strong>{n.nom}</strong></td><td>{n.midi}</td><td>{sec(n.temps)}</td><td>{sec(n.duree)}</td><td>{n.main === 'right' ? 'Droite' : 'Gauche'}</td><td><strong>{n.doigt}</strong></td><td>{Math.round(n.confiance * 100)} %</td><td>{n.pisteIndex + 1}</td></tr>)}</tbody></table></div></section></div>
}
function Metric({ label, value }: { label: string; value: string | number }) { return <article><span>{label}</span><strong>{value}</strong></article> }
function EventPanel({ titre, events }: { titre: string; events: string[][] }) { return <section className="panel events"><h3>{titre}</h3>{events.map((e, i) => <div key={i}><span>{e[0]}</span><strong>{e[1]}</strong></div>)}</section> }
