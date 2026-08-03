#!/usr/bin/env node

import { execFile } from 'node:child_process'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const run = promisify(execFile)
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '../../..')
const researchRoot = path.join(projectRoot, 'research/fingering')
const sourceRoot = path.join(researchRoot, 'vendor/SourceCode')
const binaryRoot = path.join(sourceRoot, 'Binary')
const codeRoot = path.join(sourceRoot, 'Code')
const dataRoot = path.join(researchRoot, 'data/PianoFingeringDataset_v1.2/FingeringFiles')
const runId = process.argv.find((argument) => argument.startsWith('--run='))?.slice(6) ?? 'official-2020'
const shouldTrain = process.argv.includes('--train')
const outputRoot = path.join(researchRoot, 'artifacts', runId)
const estimatesRoot = path.join(outputRoot, 'estimates')
const parameterRoot = path.join(outputRoot, 'parameters')

const published = {
  FHMM1: [0.617, 0.683, 0.828, 0.740],
  FHMM2: [0.643, 0.708, 0.853, 0.776],
  FHMM3: [0.645, 0.710, 0.855, 0.778],
  CHMM: [0.612, 0.677, 0.817, 0.738],
}
const configurations = {
  FHMM1: { binary: 'FingeringHMM1_Run', parameter: 'param_FHMM1.txt', weights: ['0.964', '-5'] },
  FHMM2: { binary: 'FingeringHMM2_Run', parameter: 'param_FHMM2.txt', weights: ['0.556', '0.407', '0.474', '-5'] },
  FHMM3: { binary: 'FingeringHMM3_Run', parameter: 'param_FHMM3.txt', weights: ['0.448', '0.292', '0.194', '0.470', '0.504', '-5'] },
  CHMM: { binary: 'CHMM_Run', parameter: 'param_CHMM1.txt', weights: ['0.94', '4.70', '7.53', '5.29', '0.10'] },
}

await mkdir(estimatesRoot, { recursive: true })
await mkdir(parameterRoot, { recursive: true })
const allFiles = (await readdir(dataRoot)).filter((file) => /_fingering\.txt$/.test(file)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
const trainingIds = allFiles.filter((file) => Number(file.slice(0, 3)) >= 31).map((file) => file.replace(/_fingering\.txt$/, ''))
const testPieces = Array.from({ length: 30 }, (_, index) => String(index + 1).padStart(3, '0'))
await writeFile(path.join(outputRoot, 'train-list.txt'), `${trainingIds.join('\n')}\n`)

if (shouldTrain) {
  const training = [
    ['FingeringHMM1_Train', [path.join(outputRoot, 'train-list.txt'), `${dataRoot}/`, path.join(parameterRoot, 'param_FHMM1')]],
    ['FingeringHMM2_Train', [path.join(outputRoot, 'train-list.txt'), `${dataRoot}/`, path.join(parameterRoot, 'param_FHMM2')]],
    ['FingeringHMM3_Train', [path.join(outputRoot, 'train-list.txt'), `${dataRoot}/`, path.join(parameterRoot, 'param_FHMM3')]],
    ['CHMM_Train', [path.join(codeRoot, 'ChordFinergingTemplates.txt'), path.join(outputRoot, 'train-list.txt'), `${dataRoot}/`, path.join(parameterRoot, 'param_CHMM1')]],
  ]
  for (const [binary, arguments_] of training) {
    console.log(`Entraînement ${binary}…`)
    const result = await run(path.join(binaryRoot, binary), arguments_, { maxBuffer: 20 * 1024 * 1024 })
    await writeFile(path.join(outputRoot, `${binary}.log`), result.stdout + result.stderr)
  }
}

function parameterPath(configuration) {
  return shouldTrain ? path.join(parameterRoot, configuration.parameter) : path.join(codeRoot, configuration.parameter)
}
function parseMetrics(stdout) {
  const match = /General,Highest,Soft,Recomb:\s+([\d.e+-]+)\s+([\d.e+-]+)\s+([\d.e+-]+)\s+([\d.e+-]+)/i.exec(stdout)
  if (!match) throw new Error(`Sortie d'évaluation inattendue : ${stdout}`)
  return match.slice(1).map(Number)
}

const report = {
  runId,
  createdAt: new Date().toISOString(),
  protocol: shouldTrain ? 'retrained-miscellaneous-031-150' : 'official-pretrained-parameters',
  trainingAnnotations: trainingIds.length,
  testPieces: testPieces.length,
  metrics: ['general', 'highest', 'soft', 'recombination'],
  models: {},
}

for (const [model, configuration] of Object.entries(configurations)) {
  console.log(`Évaluation ${model}…`)
  const modelRoot = path.join(estimatesRoot, model)
  await mkdir(modelRoot, { recursive: true })
  const perPiece = []
  for (const pieceId of testPieces) {
    const groundTruths = allFiles.filter((file) => file.startsWith(`${pieceId}-`)).map((file) => path.join(dataRoot, file))
    const estimate = path.join(modelRoot, `${pieceId}.txt`)
    const inferenceArguments = model === 'CHMM'
      ? [path.join(codeRoot, 'ChordFinergingTemplates.txt'), parameterPath(configuration), groundTruths[0], estimate, ...configuration.weights]
      : [parameterPath(configuration), groundTruths[0], estimate, ...configuration.weights]
    await run(path.join(binaryRoot, configuration.binary), inferenceArguments, { maxBuffer: 20 * 1024 * 1024 })
    const evaluation = await run(path.join(binaryRoot, 'Evaluate_MultipleGroundTruth'), [String(groundTruths.length), ...groundTruths, estimate])
    perPiece.push({ pieceId, groundTruths: groundTruths.length, values: parseMetrics(evaluation.stdout) })
  }
  const mean = [0, 1, 2, 3].map((metric) => perPiece.reduce((sum, piece) => sum + piece.values[metric], 0) / perPiece.length)
  report.models[model] = {
    mean,
    published: published[model],
    differencePercentagePoints: mean.map((value, index) => (value - published[model][index]) * 100),
    perPiece,
  }
  console.log(`${model}: ${mean.map((value) => (value * 100).toFixed(2)).join(' / ')} %`)
}

await writeFile(path.join(outputRoot, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(`Rapport : ${path.join(outputRoot, 'report.json')}`)
