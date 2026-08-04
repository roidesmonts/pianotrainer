import test from 'node:test'
import assert from 'node:assert/strict'
import { applyFingeringCorrections } from '../../../.fingering-test-build/fingering/corrections.js'

const note = { id: 'piece:0:0:60:0', midi: 60, nom: 'Do4', temps: 0, duree: 1, velocite: .8, ticks: 0, dureeTicks: 480, pisteId: 'piste-0', pisteIndex: 0, main: 'right', doigt: 1, confiance: .55, origineDoigte: 'model' }

test('une correction produit une nouvelle note et préserve la proposition source', () => {
  const corrected = applyFingeringCorrections([note], [{ pieceId: 'piece', noteId: note.id, hand: 'left', finger: 4, updatedAt: '2026-08-04T00:00:00.000Z' }])
  assert.deepEqual(corrected[0], { ...note, main: 'left', doigt: 4, confiance: 1, origineDoigte: 'manual' })
  assert.equal(note.main, 'right')
  assert.equal(note.doigt, 1)
})

test('une correction étrangère au morceau ne modifie aucune note', () => {
  const result = applyFingeringCorrections([note], [{ pieceId: 'other', noteId: 'other-note', hand: 'left', finger: 5, updatedAt: '2026-08-04T00:00:00.000Z' }])
  assert.equal(result[0], note)
})
