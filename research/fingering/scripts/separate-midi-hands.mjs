#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import toneMidi from '@tonejs/midi'
import { separateHandsViterbi } from '../lib/merged-hand-separator.mjs'
import { buildSustainIntervals, groupPerformanceAttacks, sustainAt } from '../lib/performance-preprocessing.mjs'

const { Midi } = toneMidi

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const researchRoot = path.resolve(scriptDirectory, '..')
const inputPath = process.argv[2]
const outputPath = process.argv[3]
const modelPath = process.argv[4] ?? path.join(researchRoot, 'artifacts/hand-separation-v1/model.json')
if (!inputPath || !outputPath) {
  console.error('Usage: node separate-midi-hands.mjs entree.mid sortie.json [modele.json]')
  process.exit(1)
}

const midi = new Midi(await readFile(path.resolve(inputPath)))
const sustainIntervals = buildSustainIntervals(midi.tracks.flatMap((track) => track.controlChanges[64] ?? []))
const duplicateCounts = new Map()
const rawNotes = midi.tracks.flatMap((track, trackIndex) => track.notes.map((note) => {
  const identityBase = `${trackIndex}:${note.ticks}:${note.midi}`
  const duplicateIndex = duplicateCounts.get(identityBase) ?? 0
  duplicateCounts.set(identityBase, duplicateIndex + 1)
  const pedal = sustainAt(note.time, sustainIntervals)
  return {
    noteId: `${identityBase}:${duplicateIndex}`,
    trackIndex,
    startTicks: note.ticks,
    durationTicks: note.durationTicks,
    midiPitch: note.midi,
    onsetSeconds: note.time,
    durationSeconds: note.duration,
    velocity: note.velocity,
    pedalDownAtOnset: pedal !== null,
    pedalReleaseSeconds: pedal?.endSeconds ?? null,
  }
}))
const notes = groupPerformanceAttacks(rawNotes, 0.04)
const model = JSON.parse(await readFile(path.resolve(modelPath), 'utf8'))
const decoded = separateHandsViterbi(notes, model)
const result = {
  schemaVersion: 1,
  sourceFile: path.basename(inputPath),
  ppq: midi.header.ppq,
  noteCount: notes.length,
  model: { kind: 'merged-output-pitch-viterbi', schemaVersion: model.schemaVersion },
  score: decoded.score,
  notes: notes.map(({ originalOnsetSeconds, onsetSeconds, sourceOrder: _sourceOrder, ...note }, index) => ({ ...note, onsetSeconds: originalOnsetSeconds, groupedOnsetSeconds: onsetSeconds, attackGroup: note.attackGroup, hand: decoded.hands[index] })),
}
await writeFile(path.resolve(outputPath), `${JSON.stringify(result, null, 2)}\n`)
console.log(`${result.noteCount} notes séparées -> ${path.resolve(outputPath)}`)
