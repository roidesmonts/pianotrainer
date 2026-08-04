import type { Finger, Hand, PortableFingeringModel } from './model'

export interface FingeringNote {
  midiPitch: number
  onsetSeconds?: number
  originalOnsetSeconds?: number
  offsetSeconds?: number
  durationSeconds?: number
}
export interface FingeringAssignment { hand: Hand; finger: Finger }
export interface DecodeOptions {
  beamWidth?: number
  enforceChordConstraints?: boolean
  chordToleranceSeconds?: number
  enforceHeldFingerConstraints?: boolean
  enforceHandOrder?: boolean
  onStep?: (progress: { index: number; stateCount: number; exploredStates: number }) => void
}
export interface DecodeResult { assignments: FingeringAssignment[]; handConfidences: number[]; handMargins: number[]; score: number; exploredStates: number; pruned: boolean }

const hands: Hand[] = ['left', 'right']
const keyboardPosition = (pitch: number) => {
  const pitchClass = ((pitch % 12) + 12) % 12
  const xInOctave = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6][pitchClass]
  const y = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0][pitchClass]
  return { x: xInOctave + 7 * (Math.floor(pitch / 12) - 5), y }
}
const outputIndex = (previousPitch: number, pitch: number, widthX: number) => {
  const previous = keyboardPosition(previousPitch)
  const current = keyboardPosition(pitch)
  const dx = Math.max(-widthX, Math.min(widthX, current.x - previous.x))
  return 3 * (dx + widthX) + current.y - previous.y + 1
}
const emissionScore = (model: PortableFingeringModel, hand: Hand, previous: { midiPitch: number; finger: Finger } | null, note: FingeringNote, finger: Finger) => {
  if (previous === null) return model.handSeparation.logInitialPitch[hand][note.midiPitch] + model.logInitialFinger[hand][finger - 1]
  return model.handSeparation.logPitchTransition[hand][previous.midiPitch][note.midiPitch]
    + model.logFingerTransition[hand][previous.finger - 1][finger - 1]
    + model.logKeyOutput[hand][previous.finger - 1][finger - 1][outputIndex(previous.midiPitch, note.midiPitch, model.widthX)]
}
const validChordContinuation = (hand: Hand, previous: { midiPitch: number; onsetSeconds?: number; finger: Finger } | null, note: FingeringNote, finger: Finger, tolerance: number) => {
  if (previous === null || !Number.isFinite(previous.onsetSeconds) || !Number.isFinite(note.onsetSeconds)) return true
  if (Math.abs(note.onsetSeconds! - previous.onsetSeconds!) > tolerance) return true
  if (note.midiPitch === previous.midiPitch || finger === previous.finger) return false
  return hand === 'right' ? finger > previous.finger : finger < previous.finger
}
type State = { score: number; leftIndex: number; leftFinger: number; rightIndex: number; rightFinger: number; leftHeld: number[]; rightHeld: number[] }
type Pointer = { previousKey: string; hand: Hand; finger: Finger }

const validHandOrder = (notes: FingeringNote[], state: State, index: number, hand: Hand, tolerance: number) => {
  const oppositeIndex = hand === 'left' ? state.rightIndex : state.leftIndex
  if (oppositeIndex < 0) return true
  const note = notes[index], opposite = notes[oppositeIndex]
  const onset = note.onsetSeconds ?? 0, oppositeOnset = opposite.onsetSeconds ?? 0
  const oppositeOriginalOnset = opposite.originalOnsetSeconds ?? oppositeOnset
  const oppositeEnd = opposite.offsetSeconds ?? (oppositeOriginalOnset + (opposite.durationSeconds ?? 0))
  const simultaneous = Math.abs(onset - oppositeOnset) <= tolerance
  if (!simultaneous && oppositeEnd <= (note.originalOnsetSeconds ?? onset)) return true
  return hand === 'left' ? note.midiPitch <= opposite.midiPitch : note.midiPitch >= opposite.midiPitch
}

const confidenceFromMargin = (margin: number) => Number.isFinite(margin)
  ? Math.max(.01, Math.min(.995, 1 / (1 + Math.exp(-margin / 3))))
  : .995

export function decodeMergedFingering(notes: FingeringNote[], model: PortableFingeringModel, options: DecodeOptions = {}): DecodeResult {
  const { beamWidth = Infinity, enforceChordConstraints = true, chordToleranceSeconds = 0, enforceHeldFingerConstraints = false, enforceHandOrder = false, onStep } = options
  if (notes.length === 0) return { assignments: [], handConfidences: [], handMargins: [], score: 0, exploredStates: 0, pruned: false }
  notes.forEach((note) => { if (!Number.isInteger(note.midiPitch) || note.midiPitch < 0 || note.midiPitch > 127) throw new Error(`Hauteur MIDI invalide : ${note.midiPitch}`) })
  let states = new Map<string, State>([['-1,0,-1,0,0,0,0,0,0,0,0,0,0,0', { score: 0, leftIndex: -1, leftFinger: 0, rightIndex: -1, rightFinger: 0, leftHeld: Array(5).fill(0), rightHeld: Array(5).fill(0) }]])
  const backpointers: Map<string, Pointer>[] = []
  const bestHandScores: Record<Hand, number>[] = []
  let exploredStates = 0
  let pruned = false
  for (let index = 0; index < notes.length; index += 1) {
    const next = new Map<string, State>()
    const pointers = new Map<string, Pointer>()
    const handScores: Record<Hand, number> = { left: -Infinity, right: -Infinity }
    for (const [previousKey, state] of states) for (const hand of hands) for (let fingerValue = 1; fingerValue <= 5; fingerValue += 1) {
      const finger = fingerValue as Finger
      const physicalOnset = notes[index].onsetSeconds ?? 0
      const leftHeld = state.leftHeld.map((end) => end > physicalOnset ? end : 0)
      const rightHeld = state.rightHeld.map((end) => end > physicalOnset ? end : 0)
      const held = hand === 'left' ? leftHeld : rightHeld
      if (enforceHeldFingerConstraints && held[finger - 1] > physicalOnset) continue
      const previousIndex = hand === 'left' ? state.leftIndex : state.rightIndex
      const previousFinger = (hand === 'left' ? state.leftFinger : state.rightFinger) as Finger
      const previous = previousIndex < 0 ? null : { midiPitch: notes[previousIndex].midiPitch, onsetSeconds: notes[previousIndex].onsetSeconds, finger: previousFinger }
      if (enforceChordConstraints && !validChordContinuation(hand, previous, notes[index], finger, chordToleranceSeconds)) continue
      if (enforceHandOrder && !validHandOrder(notes, state, index, hand, chordToleranceSeconds)) continue
      const score = state.score + model.handSeparation.logHandPrior[hand] + emissionScore(model, hand, previous, notes[index], finger)
      handScores[hand] = Math.max(handScores[hand], score)
      const candidate: State = { score, leftIndex: hand === 'left' ? index : state.leftIndex, leftFinger: hand === 'left' ? finger : state.leftFinger, rightIndex: hand === 'right' ? index : state.rightIndex, rightFinger: hand === 'right' ? finger : state.rightFinger, leftHeld, rightHeld }
      const originalOnset = notes[index].originalOnsetSeconds ?? physicalOnset
      const physicalEnd = notes[index].offsetSeconds ?? (originalOnset + (notes[index].durationSeconds ?? 0))
      if (enforceHeldFingerConstraints && physicalEnd > physicalOnset) (hand === 'left' ? candidate.leftHeld : candidate.rightHeld)[finger - 1] = physicalEnd
      const key = `${candidate.leftIndex},${candidate.leftFinger},${candidate.rightIndex},${candidate.rightFinger},${candidate.leftHeld.join(',')},${candidate.rightHeld.join(',')}`
      exploredStates += 1
      if (!next.has(key) || score > next.get(key)!.score) { next.set(key, candidate); pointers.set(key, { previousKey, hand, finger }) }
    }
    if (next.size === 0) throw new Error(`Aucun doigt physiquement disponible à ${(notes[index].onsetSeconds ?? 0).toFixed(3)} s`)
    if (next.size > beamWidth) {
      const retained = [...next.entries()].sort((a, b) => b[1].score - a[1].score || a[0].localeCompare(b[0])).slice(0, beamWidth)
      const retainedKeys = new Set(retained.map(([key]) => key)); states = new Map(retained)
      for (const key of pointers.keys()) if (!retainedKeys.has(key)) pointers.delete(key)
      pruned = true
    } else states = next
    backpointers.push(pointers); bestHandScores.push(handScores); onStep?.({ index, stateCount: states.size, exploredStates })
  }
  let [bestKey, bestState] = [...states.entries()].sort((a, b) => b[1].score - a[1].score || a[0].localeCompare(b[0]))[0]
  const assignments = Array<FingeringAssignment>(notes.length)
  for (let index = notes.length - 1; index >= 0; index -= 1) { const pointer = backpointers[index].get(bestKey)!; assignments[index] = { hand: pointer.hand, finger: pointer.finger }; bestKey = pointer.previousKey }
  const handMargins = assignments.map(({ hand }, index) => bestHandScores[index][hand] - bestHandScores[index][hand === 'left' ? 'right' : 'left'])
  return { assignments, handMargins, handConfidences: handMargins.map(confidenceFromMargin), score: bestState.score, exploredStates, pruned }
}
