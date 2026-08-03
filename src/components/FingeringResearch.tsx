import { useEffect, useMemo, useState } from 'react'

type ResearchPiece = { pieceId: string; title: string; pdf: string | null; annotations: string[] }
type ResearchNote = {
  noteId: string
  sourceId: string
  onsetSeconds: number
  offsetSeconds: number
  pitchSpelling: string
  midiPitch: number
  hand: 'left' | 'right'
  finger: number
  substitutions: number[]
  substitutionIncomplete: boolean
  source: { lineNumber: number; channel: number; fingerText: string }
}
type ResearchAnnotation = { annotationId: string; pieceId: string; annotatorId: string; notes: ResearchNote[] }
type HandFilter = 'all' | 'right' | 'left' | 'attention'
type ValidationState = { score: boolean; hands: boolean; fingers: boolean; chords: boolean; notes: string }

const emptyValidation: ValidationState = { score: false, hands: false, fingers: false, chords: false, notes: '' }
const storageKey = (annotation: string) => `piano-trainer:fingering-validation:${annotation}`
const formatTime = (seconds: number) => seconds.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

export function FingeringResearch() {
  const [pieces, setPieces] = useState<ResearchPiece[]>([])
  const [pieceId, setPieceId] = useState('001')
  const [annotationFile, setAnnotationFile] = useState('')
  const [annotation, setAnnotation] = useState<ResearchAnnotation | null>(null)
  const [filter, setFilter] = useState<HandFilter>('all')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [validation, setValidation] = useState<ValidationState>(emptyValidation)

  useEffect(() => {
    fetch('/api/fingering-research').then(async (response) => {
      const contentType = response.headers.get('content-type') ?? ''
      if (!contentType.includes('application/json')) {
        throw new Error('Le serveur Piano Trainer doit être redémarré pour activer les routes de recherche.')
      }
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'Données de recherche indisponibles.')
      setPieces(body)
      const first = body.find((piece: ResearchPiece) => piece.pieceId === '001') ?? body[0]
      if (first) { setPieceId(first.pieceId); setAnnotationFile(first.annotations[0]) }
    }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Données de recherche indisponibles.')).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!annotationFile) return
    setLoading(true); setError('')
    fetch(`/fingering-research/annotations/${encodeURIComponent(annotationFile)}`)
      .then((response) => { if (!response.ok) throw new Error('Annotation introuvable.'); return response.json() })
      .then(setAnnotation)
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Chargement impossible.'))
      .finally(() => setLoading(false))
    try { setValidation(JSON.parse(localStorage.getItem(storageKey(annotationFile)) ?? 'null') ?? emptyValidation) }
    catch { setValidation(emptyValidation) }
  }, [annotationFile])

  const piece = pieces.find((item) => item.pieceId === pieceId)
  const notes = useMemo(() => annotation?.notes.filter((note) => {
    const handMatches = filter === 'all' || filter === note.hand || (filter === 'attention' && (note.substitutions.length > 0 || note.substitutionIncomplete))
    const term = query.trim().toLocaleLowerCase('fr')
    return handMatches && (!term || note.pitchSpelling.toLocaleLowerCase('fr').includes(term) || note.sourceId.includes(term) || note.noteId.toLocaleLowerCase('fr').includes(term))
  }) ?? [], [annotation, filter, query])
  const rightCount = annotation?.notes.filter((note) => note.hand === 'right').length ?? 0
  const leftCount = (annotation?.notes.length ?? 0) - rightCount
  const attentionCount = annotation?.notes.filter((note) => note.substitutions.length > 0 || note.substitutionIncomplete).length ?? 0
  const complete = validation.score && validation.hands && validation.fingers && validation.chords

  function choosePiece(nextId: string) {
    setPieceId(nextId)
    const next = pieces.find((item) => item.pieceId === nextId)
    if (next) setAnnotationFile(next.annotations[0])
  }
  function updateValidation(patch: Partial<ValidationState>) {
    const next = { ...validation, ...patch }
    setValidation(next)
    if (annotationFile) localStorage.setItem(storageKey(annotationFile), JSON.stringify(next))
  }

  if (error && !annotation) return <section className="research-empty"><h2>Recherche des doigtés</h2><p>{error}</p><code>npm run convert:pig</code></section>
  return <div className="research-page">
    <header className="research-heading"><div><p className="eyebrow">Validation scientifique · Étape 1</p><h2>Séparation main droite / main gauche</h2><p>Comparez la partition originale aux annotations normalisées, puis consignez votre contrôle.</p></div><strong className={complete ? 'complete' : ''}>{complete ? 'Annotation validée' : 'Contrôle en cours'}</strong></header>
    <section className="research-toolbar">
      <label>Œuvre<select value={pieceId} onChange={(event) => choosePiece(event.target.value)}>{pieces.map((item) => <option key={item.pieceId} value={item.pieceId}>{item.pieceId} · {item.title}</option>)}</select></label>
      <label>Annotation<select value={annotationFile} onChange={(event) => setAnnotationFile(event.target.value)}>{piece?.annotations.map((file) => <option key={file} value={file}>{file.replace('.json', '')}</option>)}</select></label>
      <div className="research-summary"><span>{annotation?.notes.length.toLocaleString('fr-FR') ?? '—'} notes</span><b>{rightCount} droite</b><b>{leftCount} gauche</b><em>{attentionCount} à examiner</em></div>
    </section>
    {error && <p className="error">{error}</p>}
    <div className="research-workspace">
      <section className="score-viewer"><header><h3>Partition de référence</h3>{piece?.pdf && <a href={`/fingering-research/scores/${encodeURIComponent(piece.pdf)}`} target="_blank" rel="noreferrer">Ouvrir dans un onglet</a>}</header>{piece?.pdf ? <iframe title={`Partition ${piece.title}`} src={`/fingering-research/scores/${encodeURIComponent(piece.pdf)}#view=FitH`} /> : <p>Partition indisponible pour cette œuvre.</p>}</section>
      <section className="annotation-viewer"><header><div><h3>Annotation convertie</h3><small>{loading ? 'Chargement…' : `${notes.length.toLocaleString('fr-FR')} notes affichées`}</small></div><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Note, ID…" /></header>
        <nav className="research-filters">{([['all', 'Toutes'], ['right', 'Main droite'], ['left', 'Main gauche'], ['attention', 'À examiner']] as [HandFilter, string][]).map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</nav>
        <div className="research-table"><table><thead><tr><th>#</th><th>Temps</th><th>Note</th><th>Main</th><th>Doigt</th><th>Source</th></tr></thead><tbody>{notes.map((note) => <tr key={note.noteId} className={note.substitutionIncomplete ? 'warning' : note.substitutions.length ? 'substitution' : ''}><td>{note.sourceId}</td><td>{formatTime(note.onsetSeconds)}</td><td><strong>{note.pitchSpelling}</strong><small>MIDI {note.midiPitch}</small></td><td><span className={`hand-badge ${note.hand}`}>{note.hand === 'right' ? 'Droite' : 'Gauche'}</span></td><td><strong>{note.finger}</strong>{note.substitutions.length > 0 && <small>→ {note.substitutions.join(' → ')}</small>}{note.substitutionIncomplete && <small>Incomplet</small>}</td><td><code>{note.source.fingerText}</code><small>canal {note.source.channel}</small></td></tr>)}</tbody></table></div>
      </section>
    </div>
    <section className="validation-card"><header><div><h3>Checklist de validation</h3><p>Sauvegardée automatiquement dans ce navigateur pour l’annotation {annotationFile.replace('.json', '')}.</p></div><b>{[validation.score, validation.hands, validation.fingers, validation.chords].filter(Boolean).length}/4</b></header>
      <div className="validation-checks">
        <label><input type="checkbox" checked={validation.score} onChange={(event) => updateValidation({ score: event.target.checked })} /><span><strong>Partition concordante</strong><small>Hauteurs, ordre et attaques simultanées correspondent.</small></span></label>
        <label><input type="checkbox" checked={validation.hands} onChange={(event) => updateValidation({ hands: event.target.checked })} /><span><strong>Mains vérifiées</strong><small>Canal 0 à droite et canal 1 à gauche.</small></span></label>
        <label><input type="checkbox" checked={validation.fingers} onChange={(event) => updateValidation({ fingers: event.target.checked })} /><span><strong>Doigtés vérifiés</strong><small>Doigts 1–5 et substitutions correctement convertis.</small></span></label>
        <label><input type="checkbox" checked={validation.chords} onChange={(event) => updateValidation({ chords: event.target.checked })} /><span><strong>Accords vérifiés</strong><small>Les notes simultanées restent alignées et cohérentes.</small></span></label>
      </div>
      <label className="validation-notes">Notes de contrôle<textarea value={validation.notes} onChange={(event) => updateValidation({ notes: event.target.value })} placeholder="Mesures contrôlées, écarts observés, décisions…" /></label>
    </section>
  </div>
}
