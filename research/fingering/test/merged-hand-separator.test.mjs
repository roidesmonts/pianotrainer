import assert from 'node:assert/strict'
import test from 'node:test'
import { scoreHandAssignment, separateHandsViterbi, trainHandSeparationModel } from '../lib/merged-hand-separator.mjs'

const training = [
  [{ midiPitch: 43, hand: 'left' }, { midiPitch: 67, hand: 'right' }, { midiPitch: 45, hand: 'left' }, { midiPitch: 69, hand: 'right' }],
  [{ midiPitch: 48, hand: 'left' }, { midiPitch: 72, hand: 'right' }, { midiPitch: 50, hand: 'left' }, { midiPitch: 74, hand: 'right' }],
]

test('Viterbi conserve la continuité propre à chaque main dans un flux entrelacé', () => {
  const model = trainHandSeparationModel(training)
  const notes = training[0].map(({ midiPitch }) => ({ midiPitch }))
  assert.deepEqual(separateHandsViterbi(notes, model).hands, ['left', 'right', 'left', 'right'])
})

test('Viterbi exact retrouve le meilleur des 2^N chemins sur une petite séquence', () => {
  const model = trainHandSeparationModel(training)
  const notes = [{ midiPitch: 48 }, { midiPitch: 72 }, { midiPitch: 50 }, { midiPitch: 74 }]
  const decoded = separateHandsViterbi(notes, model)
  const candidates = Array.from({ length: 2 ** notes.length }, (_, mask) => notes.map((_, index) => mask & (1 << index) ? 'right' : 'left'))
  const bruteForceBest = candidates.reduce((best, hands) => {
    const score = scoreHandAssignment(notes, hands, model)
    return score > best.score ? { hands, score } : best
  }, { hands: [], score: -Infinity })
  assert.deepEqual(decoded.hands, bruteForceBest.hands)
  assert.ok(Math.abs(decoded.score - bruteForceBest.score) < 1e-12)
})

test('une séquence vide produit un résultat vide déterministe', () => {
  const model = trainHandSeparationModel(training)
  assert.deepEqual(separateHandsViterbi([], model), { hands: [], score: 0, exploredStates: 0 })
})
