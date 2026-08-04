#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { trainMergedFingeringModel } from '../lib/merged-fingering-model.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const args = process.argv.slice(2)
const inputFlag = args.indexOf('--input'), outputFlag = args.indexOf('--output')
const input = inputFlag >= 0 ? path.resolve(args[inputFlag + 1]) : null
const output = outputFlag >= 0 ? path.resolve(args[outputFlag + 1]) : path.join(root, 'src/fingering/models/synthetic-v1.json')
const sequences = [
  [[48, 'left', 5], [60, 'right', 1], [50, 'left', 4], [62, 'right', 2], [52, 'left', 3], [64, 'right', 3]],
  [[43, 'left', 5], [55, 'left', 1], [60, 'right', 1], [64, 'right', 3], [67, 'right', 5]],
  [[41, 'left', 5], [45, 'left', 3], [48, 'left', 1], [60, 'right', 1], [65, 'right', 4], [69, 'right', 5]],
].map((sequence) => sequence.map(([midiPitch, hand, finger]) => ({ midiPitch, hand, finger })))
let raw, provenance
if (input) {
  raw = JSON.parse(await readFile(input, 'utf8'))
  provenance = { corpus: 'PIG Dataset v1.2 (local training split)', license: 'Academic non-commercial; derived-parameter redistribution not cleared', redistribution: 'not-cleared' }
  if (args.includes('--public')) throw new Error('Export public refusé : les droits de redistribution des paramètres dérivés de PIG ne sont pas confirmés.')
} else {
  raw = trainMergedFingeringModel(sequences)
  provenance = { corpus: 'Piano Trainer project-authored synthetic fixture corpus v1', license: 'CC0-1.0', redistribution: 'allowed' }
}
const model = { $schema: '../../../research/fingering/model/merged-output-model.schema.json', schemaVersion: 1, kind: 'merged-output-hand-fingering', modelVersion: input ? 'pig-local-v1' : 'synthetic-v1', widthX: raw.widthX, provenance: { ...provenance, trainedAt: '2026-08-04T00:00:00.000Z', smoothing: { handSeparation: raw.handSeparation.smoothing, fingering: 1e-3 } }, handSeparation: raw.handSeparation, logInitialFinger: raw.logInitialFinger, logFingerTransition: raw.logFingerTransition, logKeyOutput: raw.logKeyOutput }
await mkdir(path.dirname(output), { recursive: true })
await writeFile(output, `${JSON.stringify(model)}\n`)
console.log(`${model.modelVersion} -> ${output} (${model.provenance.redistribution})`)
