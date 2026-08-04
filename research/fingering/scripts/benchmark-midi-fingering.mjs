#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import toneMidi from '@tonejs/midi'
import { decodeMergedFingering } from '../lib/merged-fingering-model.mjs'
import { buildSustainIntervals, groupPerformanceAttacks, sustainAt } from '../lib/performance-preprocessing.mjs'

const { Midi } = toneMidi
const researchRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const model = JSON.parse(await readFile(path.join(researchRoot, 'artifacts/joint-fingering-v1/model.json'), 'utf8'))
const cases = [
  ['court', '../midi/Variete/Christmas/Disklavier/Divers/45-XMAS Westminster Chimes (Ampico piano roll).mid'],
  ['dense', '../midi/Classics/Collection Disklavier/Par auteurs/Rachmaninov/by Rachmaninov himself/Flight of the Bumble Bee.mid'],
  ['long', '../midi/Classics/Collection Disklavier/Competitions/eCompetition 2009/047-Franz Schubert - Sonata in B-flat-Maj D960 (Rozanski10).mid'],
]

function prepare(midi) {
  const sustain = buildSustainIntervals(midi.tracks.flatMap((track) => track.controlChanges[64] ?? []))
  let serial = 0
  return groupPerformanceAttacks(midi.tracks.flatMap((track, trackIndex) => track.notes.map((note) => {
    const pedal = sustainAt(note.time, sustain)
    return { noteId: `${trackIndex}:${note.ticks}:${note.midi}:${serial++}`, midiPitch: note.midi, onsetSeconds: note.time, durationSeconds: note.duration, velocity: note.velocity, pedalDownAtOnset: pedal !== null }
  })), 0.04)
}

const results = []
for (const [kind, relativeFile] of cases) {
  const midi = new Midi(await readFile(path.resolve(relativeFile)))
  const notes = prepare(midi)
  let peakHeapBytes = process.memoryUsage().heapUsed
  let maxStates = 0
  const started = performance.now()
  const decoded = decodeMergedFingering(notes, model, {
    beamWidth: 100,
    enforceHeldFingerConstraints: true,
    onStep: ({ stateCount }) => { maxStates = Math.max(maxStates, stateCount); peakHeapBytes = Math.max(peakHeapBytes, process.memoryUsage().heapUsed) },
  })
  const elapsedSeconds = (performance.now() - started) / 1000
  const durationSeconds = Math.max(...notes.map((note) => note.originalOnsetSeconds + note.durationSeconds))
  const assignmentHash = createHash('sha256').update(decoded.assignments.map(({ hand, finger }) => `${hand[0]}${finger}`).join('')).digest('hex')
  const result = { kind, file: relativeFile, notes: notes.length, durationSeconds, density: notes.length / durationSeconds, elapsedSeconds, notesPerSecond: notes.length / elapsedSeconds, peakHeapMiB: peakHeapBytes / 1024 / 1024, maxStates, exploredStates: decoded.exploredStates, assignmentHash }
  results.push(result)
  console.log(`${kind}: ${notes.length} notes, ${elapsedSeconds.toFixed(2)} s, ${(notes.length / elapsedSeconds).toFixed(0)} notes/s, ${(peakHeapBytes / 1024 / 1024).toFixed(1)} MiB`)
}
const outputRoot = path.join(researchRoot, 'artifacts/performance-benchmark-v1')
await mkdir(outputRoot, { recursive: true })
await writeFile(path.join(outputRoot, 'report.json'), `${JSON.stringify({ schemaVersion: 1, beamWidth: 100, attackToleranceSeconds: 0.04, results }, null, 2)}\n`)
