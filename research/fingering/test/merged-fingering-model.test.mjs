import assert from 'node:assert/strict'
import test from 'node:test'
import { decodeMergedFingering, scoreJointAssignment, trainMergedFingeringModel } from '../lib/merged-fingering-model.mjs'

const sequence = [
  { midiPitch: 48, hand: 'left', finger: 5 }, { midiPitch: 60, hand: 'right', finger: 1 },
  { midiPitch: 50, hand: 'left', finger: 4 }, { midiPitch: 62, hand: 'right', finger: 2 },
]
const model = trainMergedFingeringModel([sequence, sequence])

test('le Viterbi conjoint exact égale une recherche exhaustive mains et doigts', () => {
  const notes = sequence.slice(0, 3).map(({ midiPitch }) => ({ midiPitch }))
  const decoded = decodeMergedFingering(notes, model)
  let best = { score: -Infinity, assignments: null }
  for (let value = 0; value < 10 ** notes.length; value += 1) {
    let cursor = value
    const assignments = notes.map(() => { const choice = cursor % 10; cursor = Math.floor(cursor / 10); return { hand: choice < 5 ? 'left' : 'right', finger: choice % 5 + 1 } })
    const score = scoreJointAssignment(notes, assignments, model)
    if (score > best.score) best = { score, assignments }
  }
  assert.deepEqual(decoded.assignments, best.assignments)
  assert.ok(Math.abs(decoded.score - best.score) < 1e-12)
  assert.equal(decoded.pruned, false)
})

test('le beam signale explicitement lorsqu’il élague des états', () => {
  assert.equal(decodeMergedFingering(sequence, model, { beamWidth: 5 }).pruned, true)
})

test('le décodage est déterministe à entrées et paramètres identiques', () => {
  const options = { beamWidth: 5 }
  const first = decodeMergedFingering(sequence, model, options)
  const second = decodeMergedFingering(sequence, model, options)
  assert.deepEqual(second.assignments, first.assignments)
  assert.equal(second.score, first.score)
  assert.equal(second.exploredStates, first.exploredStates)
})

test('un accord respecte les doigts distincts et leur ordre physique', () => {
  const chordNotes = [{ midiPitch: 60, onsetSeconds: 0 }, { midiPitch: 64, onsetSeconds: 0 }, { midiPitch: 67, onsetSeconds: 0 }]
  const decoded = decodeMergedFingering(chordNotes, model)
  for (let index = 1; index < decoded.assignments.length; index += 1) {
    const previous = decoded.assignments[index - 1]
    const current = decoded.assignments[index]
    if (previous.hand !== current.hand) continue
    assert.notEqual(previous.finger, current.finger)
    assert.equal(current.hand === 'right' ? current.finger > previous.finger : current.finger < previous.finger, true)
  }
})

test('un doigt encore physiquement tenu ne peut pas être réutilisé', () => {
  const heldNotes = [{ midiPitch: 48, onsetSeconds: 0, offsetSeconds: 2 }, { midiPitch: 50, onsetSeconds: 1, offsetSeconds: 1.5 }]
  const decoded = decodeMergedFingering(heldNotes, model, { enforceHeldFingerConstraints: true })
  if (decoded.assignments[0].hand === decoded.assignments[1].hand) assert.notEqual(decoded.assignments[0].finger, decoded.assignments[1].finger)
})
