import type { NoteMidi } from '../types/midi'
import { parsePortableFingeringModel, type Finger, type PortableFingeringModel } from './model'
import { decodeMergedFingering, type FingeringAssignment } from './viterbi'
import { groupAndOrderNotes, type OrderedNote } from './preprocessing'

const ATTACK_TOLERANCE = .04
const CHUNK_SIZE = 2000
const CONTEXT_NOTES = 64
let modelPromise: Promise<PortableFingeringModel> | null = null

function loadLocalModel() {
  modelPromise ??= fetch('/api/fingering-model').then(async (response) => {
    if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? 'Modèle de doigtés local indisponible')
    return parsePortableFingeringModel(await response.json())
  })
  return modelPromise
}

async function estimateLocalFingers(ordered: OrderedNote[], assignments: FingeringAssignment[]): Promise<Finger[]> {
  const response = await fetch('/api/fingering-fhmm3', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes: ordered.map(({ note }, index) => ({ midi: note.midi, onset: note.temps, offset: note.temps + note.duree, hand: assignments[index].hand })) }) })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !Array.isArray(payload?.fingers) || payload.fingers.length !== ordered.length) throw new Error(payload?.error ?? 'Moteur FHMM3 local indisponible')
  return payload.fingers.map((finger: number) => {
    if (!Number.isInteger(finger) || finger < 1 || finger > 5) throw new Error('Doigt FHMM3 invalide')
    return finger as Finger
  })
}

function decodeWindow(ordered: OrderedNote[], model: PortableFingeringModel) {
  return decodeMergedFingering(ordered.map(({ note, groupedOnset }) => ({
    midiPitch: note.midi,
    onsetSeconds: groupedOnset,
    originalOnsetSeconds: note.temps,
    offsetSeconds: note.temps + note.duree,
    durationSeconds: note.duree,
  })), model, { beamWidth: 100, chordToleranceSeconds: ATTACK_TOLERANCE, enforceChordConstraints: true, enforceHeldFingerConstraints: true, enforceHandOrder: true })
}

/** Décode le modèle PIG local par fenêtres chevauchantes, sans modifier les notes sources. */
export async function assignerDoigtes(notes: NoteMidi[]): Promise<NoteMidi[]> {
  if (notes.length === 0) return []
  const model = await loadLocalModel()
  const ordered = groupAndOrderNotes(notes, ATTACK_TOLERANCE)
  const assignments = Array<FingeringAssignment>(ordered.length)
  const confidences = Array<number>(ordered.length)
  for (let start = 0; start < ordered.length; start += CHUNK_SIZE) {
    const contextStart = Math.max(0, start - CONTEXT_NOTES)
    const end = Math.min(ordered.length, start + CHUNK_SIZE)
    const windowNotes = ordered.slice(contextStart, end)
    let decoded
    try { decoded = decodeWindow(windowNotes, model) }
    catch {
      decoded = decodeMergedFingering(windowNotes.map(({ note, groupedOnset }) => ({ midiPitch: note.midi, onsetSeconds: groupedOnset, originalOnsetSeconds: note.temps, offsetSeconds: note.temps + note.duree })), model, { beamWidth: 100, chordToleranceSeconds: ATTACK_TOLERANCE, enforceChordConstraints: true, enforceHandOrder: true })
    }
    for (let index = start; index < end; index += 1) {
      const local = index - contextStart
      assignments[index] = decoded.assignments[local]
      confidences[index] = decoded.handConfidences[local]
    }
    if (end < ordered.length) await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
  }
  const fingers = await estimateLocalFingers(ordered, assignments)
  const enriched = Array<NoteMidi>(notes.length)
  ordered.forEach(({ note, sourceIndex }, index) => {
    enriched[sourceIndex] = { ...note, main: assignments[index].hand, doigt: fingers[index], confiance: confidences[index], origineDoigte: 'model' }
  })
  return enriched
}
