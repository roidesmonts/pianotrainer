#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parsePigAnnotation } from '../lib/pig-format.mjs'
import { decodeMergedFingering, orderNotesForMergedOutput, trainMergedFingeringModel } from '../lib/merged-fingering-model.mjs'
import { deterministicChordJitter, groupPerformanceAttacks } from '../lib/performance-preprocessing.mjs'

const researchRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataRoot = path.join(researchRoot, 'data/PianoFingeringDataset_v1.2/FingeringFiles')
const files = (await readdir(dataRoot)).filter((file) => /_fingering\.txt$/.test(file)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
const load = async (file) => orderNotesForMergedOutput((await parsePigAnnotation(await readFile(path.join(dataRoot, file), 'utf8'), file)).notes.map(({ sourceId, midiPitch, onsetSeconds, hand, finger }) => ({ sourceId, midiPitch, onsetSeconds, hand, finger })))
const training = await Promise.all(files.filter((file) => Number(file.slice(0, 3)) >= 31).map(load))
const testFiles = Array.from({ length: 30 }, (_, index) => files.find((file) => file.startsWith(`${String(index + 1).padStart(3, '0')}-`)))
const test = await Promise.all(testFiles.map(load))
const model = trainMergedFingeringModel(training)

for (const toleranceSeconds of [0, 0.01, 0.02, 0.03, 0.04, 0.05]) {
  const scores = []
  for (const jitterAmplitude of [0, 0.02]) {
    let notes = 0, handCorrect = 0, jointCorrect = 0
    for (const sequence of test) {
      const performed = jitterAmplitude ? deterministicChordJitter(sequence, jitterAmplitude) : sequence
      const prepared = groupPerformanceAttacks(performed, toleranceSeconds)
      const decoded = decodeMergedFingering(prepared, model, { beamWidth: 100, enforceChordConstraints: true })
      const truthById = new Map(sequence.map((note) => [note.sourceId, note]))
      decoded.assignments.forEach((assignment, index) => {
        const truth = truthById.get(prepared[index].sourceId)
        if (assignment.hand === truth.hand) handCorrect += 1
        if (assignment.hand === truth.hand && assignment.finger === truth.finger) jointCorrect += 1
        notes += 1
      })
    }
    scores.push({ hand: handCorrect / notes, joint: jointCorrect / notes })
  }
  console.log(`${Math.round(toleranceSeconds * 1000)} ms: intact ${(scores[0].joint * 100).toFixed(2)} %, désynchronisé ${(scores[1].joint * 100).toFixed(2)} %, mains désynchronisées ${(scores[1].hand * 100).toFixed(2)} %`)
}
