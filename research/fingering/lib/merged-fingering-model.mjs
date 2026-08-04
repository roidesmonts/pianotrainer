import { trainHandSeparationModel } from './merged-hand-separator.mjs'

const WIDTH_X = 15
const OUTPUT_SIZE = 3 * (2 * WIDTH_X + 1)
const hands = ['left', 'right']
const normalizeLogs = (counts, smoothing) => {
  const total = counts.reduce((sum, count) => sum + count, 0) + smoothing * counts.length
  return counts.map((count) => Math.log((count + smoothing) / total))
}
const keyboardPosition = (pitch) => {
  const pitchClass = pitch % 12
  const xInOctave = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6][pitchClass]
  const y = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0][pitchClass]
  return { x: xInOctave + 7 * (Math.floor(pitch / 12) - 5), y }
}
const outputIndex = (previousPitch, pitch) => {
  const previous = keyboardPosition(previousPitch)
  const current = keyboardPosition(pitch)
  const dx = Math.max(-WIDTH_X, Math.min(WIDTH_X, current.x - previous.x))
  return 3 * (dx + WIDTH_X) + current.y - previous.y + 1
}

export function orderNotesForMergedOutput(notes) {
  return notes.map((note, sourceOrder) => ({ ...note, sourceOrder })).sort((a, b) =>
    a.onsetSeconds - b.onsetSeconds || a.midiPitch - b.midiPitch || a.sourceOrder - b.sourceOrder,
  )
}

export function trainMergedFingeringModel(sequences, smoothing = 1e-3) {
  const handSeparation = trainHandSeparationModel(sequences, 0.1)
  const initialFinger = Object.fromEntries(hands.map((hand) => [hand, Array(5).fill(0)]))
  const fingerTransition = Object.fromEntries(hands.map((hand) => [hand, Array.from({ length: 5 }, () => Array(5).fill(0))]))
  const keyOutput = Object.fromEntries(hands.map((hand) => [hand, Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => Array(OUTPUT_SIZE).fill(0)))]))
  for (const sequence of sequences) {
    const previous = { left: null, right: null }
    for (const note of sequence) {
      const finger = note.finger - 1
      if (!Number.isInteger(finger) || finger < 0 || finger > 4) throw new Error(`Doigt invalide : ${note.finger}`)
      if (previous[note.hand] === null) initialFinger[note.hand][finger] += 1
      else {
        const prior = previous[note.hand]
        fingerTransition[note.hand][prior.finger - 1][finger] += 1
        keyOutput[note.hand][prior.finger - 1][finger][outputIndex(prior.midiPitch, note.midiPitch)] += 1
      }
      previous[note.hand] = note
    }
  }
  return {
    schemaVersion: 1, widthX: WIDTH_X, handSeparation,
    logInitialFinger: Object.fromEntries(hands.map((hand) => [hand, normalizeLogs(initialFinger[hand], smoothing)])),
    logFingerTransition: Object.fromEntries(hands.map((hand) => [hand, fingerTransition[hand].map((row) => normalizeLogs(row, smoothing))])),
    logKeyOutput: Object.fromEntries(hands.map((hand) => [hand, keyOutput[hand].map((byPrevious) => byPrevious.map((row) => normalizeLogs(row, smoothing)))])),
  }
}

function emissionScore(model, hand, previous, note, finger) {
  if (previous === null) return model.handSeparation.logInitialPitch[hand][note.midiPitch] + model.logInitialFinger[hand][finger - 1]
  return model.handSeparation.logPitchTransition[hand][previous.midiPitch][note.midiPitch]
    + model.logFingerTransition[hand][previous.finger - 1][finger - 1]
    + model.logKeyOutput[hand][previous.finger - 1][finger - 1][outputIndex(previous.midiPitch, note.midiPitch)]
}

function validChordContinuation(hand, previous, note, finger, tolerance) {
  if (previous === null || !Number.isFinite(previous.onsetSeconds) || !Number.isFinite(note.onsetSeconds)) return true
  if (Math.abs(note.onsetSeconds - previous.onsetSeconds) > tolerance) return true
  if (note.midiPitch === previous.midiPitch) return false
  if (finger === previous.finger) return false
  return hand === 'right' ? finger > previous.finger : finger < previous.finger
}

export function scoreJointAssignment(notes, assignments, model) {
  const previous = { left: null, right: null }
  let score = 0
  assignments.forEach(({ hand, finger }, index) => {
    score += model.handSeparation.logHandPrior[hand] + emissionScore(model, hand, previous[hand], notes[index], finger)
    previous[hand] = { midiPitch: notes[index].midiPitch, finger }
  })
  return score
}

export function decodeMergedFingering(notes, model, { beamWidth = Infinity, enforceChordConstraints = true, chordToleranceSeconds = 0, enforceHeldFingerConstraints = false, onStep = null } = {}) {
  if (notes.length === 0) return { assignments: [], score: 0, exploredStates: 0, pruned: false }
  let states = new Map([['-1,0,-1,0,0,0,0,0,0,0,0,0,0,0', { score: 0, leftIndex: -1, leftFinger: 0, rightIndex: -1, rightFinger: 0, leftHeld: Array(5).fill(0), rightHeld: Array(5).fill(0) }]])
  const backpointers = []
  let exploredStates = 0
  let pruned = false
  for (let index = 0; index < notes.length; index += 1) {
    const next = new Map()
    const pointers = new Map()
    for (const [previousKey, state] of states) for (const hand of hands) for (let finger = 1; finger <= 5; finger += 1) {
      const physicalOnset = notes[index].onsetSeconds
      const leftHeld = state.leftHeld.map((end) => end > physicalOnset ? end : 0)
      const rightHeld = state.rightHeld.map((end) => end > physicalOnset ? end : 0)
      const held = hand === 'left' ? leftHeld : rightHeld
      if (enforceHeldFingerConstraints && held[finger - 1] > physicalOnset) continue
      const previousIndex = hand === 'left' ? state.leftIndex : state.rightIndex
      const previousFinger = hand === 'left' ? state.leftFinger : state.rightFinger
      const previous = previousIndex < 0 ? null : { midiPitch: notes[previousIndex].midiPitch, onsetSeconds: notes[previousIndex].onsetSeconds, finger: previousFinger }
      if (enforceChordConstraints && !validChordContinuation(hand, previous, notes[index], finger, chordToleranceSeconds)) continue
      const score = state.score + model.handSeparation.logHandPrior[hand] + emissionScore(model, hand, previous, notes[index], finger)
      const candidate = {
        score,
        leftIndex: hand === 'left' ? index : state.leftIndex,
        leftFinger: hand === 'left' ? finger : state.leftFinger,
        rightIndex: hand === 'right' ? index : state.rightIndex,
        rightFinger: hand === 'right' ? finger : state.rightFinger,
        leftHeld,
        rightHeld,
      }
      const originalOnset = notes[index].originalOnsetSeconds ?? physicalOnset
      const physicalEnd = notes[index].offsetSeconds ?? (originalOnset + (notes[index].durationSeconds ?? 0))
      if (enforceHeldFingerConstraints && physicalEnd > physicalOnset) (hand === 'left' ? candidate.leftHeld : candidate.rightHeld)[finger - 1] = physicalEnd
      const key = `${candidate.leftIndex},${candidate.leftFinger},${candidate.rightIndex},${candidate.rightFinger},${candidate.leftHeld.join(',')},${candidate.rightHeld.join(',')}`
      exploredStates += 1
      if (!next.has(key) || score > next.get(key).score) { next.set(key, candidate); pointers.set(key, { previousKey, hand, finger }) }
    }
    if (next.size === 0) throw new Error(`Aucun doigt physiquement disponible à ${physicalOnset.toFixed(3)} s`)
    if (next.size > beamWidth) {
      const retained = [...next.entries()].sort((a, b) => b[1].score - a[1].score || a[0].localeCompare(b[0])).slice(0, beamWidth)
      const retainedKeys = new Set(retained.map(([key]) => key))
      states = new Map(retained)
      for (const key of pointers.keys()) if (!retainedKeys.has(key)) pointers.delete(key)
      pruned = true
    } else states = next
    backpointers.push(pointers)
    if (onStep) onStep({ index, stateCount: states.size, exploredStates })
  }
  let [bestKey, bestState] = [...states.entries()].sort((a, b) => b[1].score - a[1].score || a[0].localeCompare(b[0]))[0]
  const assignments = Array(notes.length)
  for (let index = notes.length - 1; index >= 0; index -= 1) {
    const pointer = backpointers[index].get(bestKey)
    assignments[index] = { hand: pointer.hand, finger: pointer.finger }
    bestKey = pointer.previousKey
  }
  return { assignments, score: bestState.score, exploredStates, pruned }
}
