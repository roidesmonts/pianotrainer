import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { groupAndOrderNotes } from '../../../.fingering-test-build/fingering/preprocessing.js'
import { parsePortableFingeringModel } from '../../../.fingering-test-build/fingering/model.js'
import { decodeMergedFingering } from '../../../.fingering-test-build/fingering/viterbi.js'

const modelJson = JSON.parse(await readFile(new URL('../../../src/fingering/models/synthetic-v1.json', import.meta.url), 'utf8'))
const model = parsePortableFingeringModel(modelJson)
const note = (id, midi, temps) => ({ id, midi, nom: String(midi), temps, duree: .5, velocite: .8, ticks: Math.round(temps * 480), dureeTicks: 240, pisteId: 'piste-0', pisteIndex: 0, main: 'right', doigt: 1, confiance: 0, origineDoigte: 'model' })

test('le navigateur regroupe les attaques par ancre et les ordonne du grave vers aigu', () => {
  const ordered = groupAndOrderNotes([note('high', 72, .02), note('middle', 67, 0), note('next', 60, .06)], .04)
  assert.deepEqual(ordered.map(({ note: item }) => item.id), ['middle', 'high', 'next'])
  assert.deepEqual(ordered.map(({ groupedOnset }) => groupedOnset), [0, 0, .06])
})

test('la contrainte inter-main interdit une gauche au-dessus de la droite dans un accord', () => {
  const notes = [71, 79, 86, 91, 96].map((midiPitch) => ({ midiPitch, onsetSeconds: 0, originalOnsetSeconds: 0, offsetSeconds: 1 }))
  const decoded = decodeMergedFingering(notes, model, { beamWidth: 100, chordToleranceSeconds: .04, enforceChordConstraints: true, enforceHeldFingerConstraints: true, enforceHandOrder: true })
  const left = notes.filter((_, index) => decoded.assignments[index].hand === 'left').map(({ midiPitch }) => midiPitch)
  const right = notes.filter((_, index) => decoded.assignments[index].hand === 'right').map(({ midiPitch }) => midiPitch)
  assert.ok(left.length > 0 && right.length > 0)
  assert.ok(Math.max(...left) <= Math.min(...right))
  assert.ok(decoded.handConfidences.every((confidence) => confidence > 0 && confidence <= 1))
})
