import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSustainIntervals, groupPerformanceAttacks, sustainAt } from '../lib/performance-preprocessing.mjs'

test('regroupe et ordonne grave→aigu les attaques dans la tolérance', () => {
  const grouped = groupPerformanceAttacks([
    { noteId: 'high', onsetSeconds: 1.012, midiPitch: 72 },
    { noteId: 'low', onsetSeconds: 1, midiPitch: 48 },
    { noteId: 'middle', onsetSeconds: 1.008, midiPitch: 60 },
  ], 0.02)
  assert.deepEqual(grouped.map((note) => note.noteId), ['low', 'middle', 'high'])
  assert.deepEqual(grouped.map((note) => note.onsetSeconds), [1, 1, 1])
  assert.deepEqual(grouped.map((note) => note.originalOnsetSeconds), [1, 1.008, 1.012])
})

test('l’ancrage empêche un regroupement transitif trop large', () => {
  const grouped = groupPerformanceAttacks([
    { onsetSeconds: 0, midiPitch: 48 }, { onsetSeconds: 0.02, midiPitch: 52 }, { onsetSeconds: 0.04, midiPitch: 55 },
  ], 0.03)
  assert.deepEqual(grouped.map((note) => note.attackGroup), [0, 0, 1])
})

test('la pédale continue utilise le seuil 0,5 et produit des intervalles', () => {
  const intervals = buildSustainIntervals([{ time: 1, value: 0.3 }, { time: 1.1, value: 0.7 }, { time: 2, value: 0.4 }])
  assert.deepEqual(intervals, [{ startSeconds: 1.1, endSeconds: 2 }])
  assert.equal(sustainAt(1.5, intervals)?.endSeconds, 2)
  assert.equal(sustainAt(2, intervals), null)
})
