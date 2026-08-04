#!/usr/bin/env node
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parsePigAnnotation } from '../lib/pig-format.mjs'
import { findBestPitchCutoff, separateHandsViterbi, trainHandSeparationModel } from '../lib/merged-hand-separator.mjs'
import { orderNotesForMergedOutput } from '../lib/merged-fingering-model.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const researchRoot = path.resolve(scriptDirectory, '..')
const dataRoot = path.join(researchRoot, 'data/PianoFingeringDataset_v1.2/FingeringFiles')
const outputRoot = path.join(researchRoot, 'artifacts/hand-separation-v1')
const files = (await readdir(dataRoot)).filter((file) => /_fingering\.txt$/.test(file)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))

async function load(file) {
  const parsed = parsePigAnnotation(await readFile(path.join(dataRoot, file), 'utf8'), file)
  return orderNotesForMergedOutput(parsed.notes.map(({ midiPitch, onsetSeconds, hand }) => ({ midiPitch, onsetSeconds, hand })))
}
const trainingFiles = files.filter((file) => Number(file.slice(0, 3)) >= 31)
const testFiles = files.filter((file) => Number(file.slice(0, 3)) <= 30)
const training = await Promise.all(trainingFiles.map(load))
const test = await Promise.all(testFiles.map(load))
const learnedCutoff = findBestPitchCutoff(training).cutoff
const model = trainHandSeparationModel(training)

function evaluate(name, predict) {
  let notes = 0
  let errors = 0
  const perFile = []
  for (let index = 0; index < test.length; index += 1) {
    const predicted = predict(test[index])
    const fileErrors = predicted.reduce((sum, hand, noteIndex) => sum + (hand === test[index][noteIndex].hand ? 0 : 1), 0)
    notes += predicted.length
    errors += fileErrors
    perFile.push({ file: testFiles[index], notes: predicted.length, errors: fileErrors, errorRate: fileErrors / predicted.length })
  }
  return { name, notes, errors, accuracy: 1 - errors / notes, errorRate: errors / notes, perFile }
}
const threshold = (cutoff) => (notes) => notes.map((note) => note.midiPitch >= cutoff ? 'right' : 'left')
const results = [
  evaluate('fixed-cutoff-60', threshold(60)),
  evaluate(`learned-cutoff-${learnedCutoff}`, threshold(learnedCutoff)),
  evaluate('merged-output-pitch-viterbi', (notes) => separateHandsViterbi(notes, model).hands),
]
const report = {
  schemaVersion: 1,
  createdAt: new Date().toISOString(),
  trainingAnnotations: trainingFiles.length,
  testAnnotations: testFiles.length,
  learnedCutoff,
  results,
}
await mkdir(outputRoot, { recursive: true })
await writeFile(path.join(outputRoot, 'model.json'), `${JSON.stringify(model)}\n`)
await writeFile(path.join(outputRoot, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
for (const result of results) console.log(`${result.name}: ${(result.accuracy * 100).toFixed(2)} % (${result.errors}/${result.notes} erreurs)`)
