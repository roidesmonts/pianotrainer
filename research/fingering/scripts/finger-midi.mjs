#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import toneMidi from '@tonejs/midi'
import { decodeMergedFingering } from '../lib/merged-fingering-model.mjs'
import { buildSustainIntervals, groupPerformanceAttacks, sustainAt } from '../lib/performance-preprocessing.mjs'

const { Midi } = toneMidi
const researchRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const [inputPath, outputPath, customModelPath] = process.argv.slice(2)
const modelPath = customModelPath ?? path.join(researchRoot, 'artifacts/joint-fingering-v1/model.json')
if (!inputPath || !outputPath) { console.error('Usage: node finger-midi.mjs entree.mid sortie.json [modele.json]'); process.exit(1) }
const midi = new Midi(await readFile(path.resolve(inputPath)))
const sustainIntervals = buildSustainIntervals(midi.tracks.flatMap((track) => track.controlChanges[64] ?? []))
const duplicates = new Map()
const rawNotes = midi.tracks.flatMap((track, trackIndex) => track.notes.map((note) => {
  const base = `${trackIndex}:${note.ticks}:${note.midi}`
  const duplicate = duplicates.get(base) ?? 0
  duplicates.set(base, duplicate + 1)
  const pedal = sustainAt(note.time, sustainIntervals)
  return { noteId: `${base}:${duplicate}`, trackIndex, startTicks: note.ticks, durationTicks: note.durationTicks, midiPitch: note.midi, onsetSeconds: note.time, durationSeconds: note.duration, velocity: note.velocity, pedalDownAtOnset: pedal !== null, pedalReleaseSeconds: pedal?.endSeconds ?? null }
}))
const notes = groupPerformanceAttacks(rawNotes, 0.04)
const model = JSON.parse(await readFile(path.resolve(modelPath), 'utf8'))
const decoded = decodeMergedFingering(notes, model, { beamWidth: 100, enforceHeldFingerConstraints: true })
const result = {
  schemaVersion: 1, sourceFile: path.basename(inputPath), ppq: midi.header.ppq, noteCount: notes.length,
  model: { kind: 'merged-output-hand-fingering', schemaVersion: model.schemaVersion, beamWidth: 100, attackToleranceSeconds: 0.04, sustainThreshold: 0.5 },
  score: decoded.score,
  notes: notes.map(({ originalOnsetSeconds, onsetSeconds, sourceOrder: _sourceOrder, ...note }, index) => ({ ...note, onsetSeconds: originalOnsetSeconds, groupedOnsetSeconds: onsetSeconds, attackGroup: note.attackGroup, ...decoded.assignments[index] })),
}
await writeFile(path.resolve(outputPath), `${JSON.stringify(result, null, 2)}\n`)
console.log(`${result.noteCount} notes avec main et doigt -> ${path.resolve(outputPath)}`)
