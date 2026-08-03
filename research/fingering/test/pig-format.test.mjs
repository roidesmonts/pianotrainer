import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { parsePigAnnotation, pitchSpellingToMidi, toInternalAnnotation } from '../lib/pig-format.mjs'

const fixtureUrl = new URL('./fixtures/controlled_fingering.txt', import.meta.url)

test('convertit les hauteurs enharmoniques en numéros MIDI', () => {
  assert.equal(pitchSpellingToMidi('C4'), 60)
  assert.equal(pitchSpellingToMidi('Eb3'), 51)
  assert.equal(pitchSpellingToMidi('G#4'), 68)
})

test('normalise les mains, doigts et substitutions sans perdre la source', async () => {
  const annotation = toInternalAnnotation(await readFile(fixtureUrl, 'utf8'), '999-2_fingering.txt')
  assert.deepEqual(annotation.metadata, { Version: 'PianoFingering_v170101', Piece: 'controlled' })
  assert.deepEqual(annotation.notes.map(({ noteId, hand, finger, midiPitch }) => ({ noteId, hand, finger, midiPitch })), [
    { noteId: '999:0:60:0', hand: 'right', finger: 1, midiPitch: 60 },
    { noteId: '999:1:51:0', hand: 'left', finger: 5, midiPitch: 51 },
    { noteId: '999:2:68:0', hand: 'right', finger: 4, midiPitch: 68 },
    { noteId: '999:3:65:0', hand: 'right', finger: 4, midiPitch: 65 },
  ])
  assert.deepEqual(annotation.notes[2].substitutions, [1])
  assert.equal(annotation.notes[3].substitutionIncomplete, true)
  assert.equal(annotation.notes[3].source.fingerText, '4_')
})

test('refuse un signe de doigt incohérent avec la main', () => {
  assert.throws(() => parsePigAnnotation('0 0 1 C4 80 64 1 3', 'bad.txt'), /signe du doigt incohérent/)
})
