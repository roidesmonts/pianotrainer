#!/usr/bin/env node
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { decodeMergedFingering } from '../../../.fingering-test-build/fingering/viterbi.js'
import { parsePortableFingeringModel } from '../../../.fingering-test-build/fingering/model.js'
import { groupPerformanceAttacks } from '../lib/performance-preprocessing.mjs'

const researchRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const run = promisify(execFile)
const binary = path.join(researchRoot, 'vendor/SourceCode/Binary/FingeringHMM3_Run')
const parameters = path.join(researchRoot, 'artifacts/retrained-v1.2/parameters/param_FHMM3.txt')
const model = parsePortableFingeringModel(JSON.parse(await readFile(path.join(researchRoot, 'artifacts/joint-fingering-v1/portable-model.json'), 'utf8')))
const previousReport = JSON.parse(await readFile(path.join(researchRoot, 'artifacts/joint-fingering-v1/report-all-annotations.json'), 'utf8'))
const files = previousReport.testFiles.filter((file, index, all) => all.findIndex((candidate) => candidate.slice(0, 3) === file.slice(0, 3)) === index)
let noteCount = 0, correctHands = 0, correctPairs = 0, uncertain = 0, uncertainCorrect = 0, confidentCorrect = 0, crossedChords = 0, mixedChords = 0

async function estimateFingers(notes, assignments) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'evaluate-fhmm3-'))
  try {
    const input = path.join(directory, 'input.txt'), output = path.join(directory, 'output.txt')
    const text = notes.map((note, index) => `${index}\t${note.originalOnsetSeconds}\t${note.offsetSeconds}\t${note.pitchSpelling}\t80\t80\t${assignments[index].hand === 'right' ? 0 : 1}\t${assignments[index].hand === 'right' ? 1 : -1}`).join('\n') + '\n'
    await writeFile(input, text); await run(binary, [parameters, input, output, '0.448', '0.292', '0.194', '0.470', '0.504', '-5'])
    return (await readFile(output, 'utf8')).split(/\r?\n/).filter((line) => line.trim() && !line.startsWith('//')).map((line) => { const fields = line.trim().split(/\s+/); return Math.abs(Number(fields[fields.length - 1])) })
  } finally { await rm(directory, { recursive: true, force: true }) }
}

for (const file of files) {
  const annotation = JSON.parse(await readFile(path.join(researchRoot, 'generated/internal-v1', file.replace(/_fingering\.txt$/, '.json')), 'utf8'))
  const notes = groupPerformanceAttacks(annotation.notes.map((note) => ({ ...note, durationSeconds: note.offsetSeconds - note.onsetSeconds })), .04)
  const input = notes.map((note) => ({ midiPitch: note.midiPitch, onsetSeconds: note.onsetSeconds, originalOnsetSeconds: note.originalOnsetSeconds, offsetSeconds: note.offsetSeconds, durationSeconds: note.durationSeconds }))
  let decoded
  try { decoded = decodeMergedFingering(input, model, { beamWidth: 100, chordToleranceSeconds: .04, enforceChordConstraints: true, enforceHeldFingerConstraints: true, enforceHandOrder: true }) }
  catch { decoded = decodeMergedFingering(input, model, { beamWidth: 100, chordToleranceSeconds: .04, enforceChordConstraints: true, enforceHandOrder: true }) }
  const fingers = await estimateFingers(notes, decoded.assignments)
  notes.forEach((note, index) => {
    const handCorrect = decoded.assignments[index].hand === note.hand
    noteCount += 1; if (handCorrect) correctHands += 1
    if (handCorrect && fingers[index] === note.finger) correctPairs += 1
    if (decoded.handConfidences[index] < .6) { uncertain += 1; if (handCorrect) uncertainCorrect += 1 }
    else if (handCorrect) confidentCorrect += 1
  })
  const groups = new Map()
  notes.forEach((note, index) => { const current = groups.get(note.attackGroup) ?? []; current.push({ note, assignment: decoded.assignments[index] }); groups.set(note.attackGroup, current) })
  for (const group of groups.values()) {
    const left = group.filter(({ assignment }) => assignment.hand === 'left').map(({ note }) => note.midiPitch)
    const right = group.filter(({ assignment }) => assignment.hand === 'right').map(({ note }) => note.midiPitch)
    if (left.length && right.length) { mixedChords += 1; if (Math.max(...left) > Math.min(...right)) crossedChords += 1 }
  }
  process.stdout.write('.')
}

const report = {
  schemaVersion: 1, files: files.length, notes: noteCount,
  handAccuracy: correctHands / noteCount,
  handAndFingerAccuracy: correctPairs / noteCount,
  uncertainRate: uncertain / noteCount,
  uncertainHandAccuracy: uncertain ? uncertainCorrect / uncertain : null,
  confidentHandAccuracy: noteCount > uncertain ? confidentCorrect / (noteCount - uncertain) : null,
  mixedChords, crossedChords,
}
const output = path.join(researchRoot, 'artifacts/interface-model-v1/report.json')
await mkdir(path.dirname(output), { recursive: true }); await writeFile(output, `${JSON.stringify(report, null, 2)}\n`)
console.log(`\n${JSON.stringify(report, null, 2)}\n-> ${output}`)
