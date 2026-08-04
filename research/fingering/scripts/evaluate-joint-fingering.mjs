#!/usr/bin/env node
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import { parsePigAnnotation } from '../lib/pig-format.mjs'
import { decodeMergedFingering, orderNotesForMergedOutput, trainMergedFingeringModel } from '../lib/merged-fingering-model.mjs'

const researchRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataRoot = path.join(researchRoot, 'data/PianoFingeringDataset_v1.2/FingeringFiles')
const outputRoot = path.join(researchRoot, 'artifacts/joint-fingering-v1')
const files = (await readdir(dataRoot)).filter((file) => /_fingering\.txt$/.test(file)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
const load = async (file) => orderNotesForMergedOutput((await parsePigAnnotation(await readFile(path.join(dataRoot, file), 'utf8'), file)).notes.map(({ midiPitch, onsetSeconds, hand, finger }) => ({ midiPitch, onsetSeconds, hand, finger })))
const trainingFiles = files.filter((file) => Number(file.slice(0, 3)) >= 31)
const evaluateAllAnnotations = process.argv.includes('--all')
const testFiles = evaluateAllAnnotations
  ? files.filter((file) => Number(file.slice(0, 3)) <= 30)
  : Array.from({ length: 30 }, (_, index) => files.find((file) => file.startsWith(`${String(index + 1).padStart(3, '0')}-`)))
const training = await Promise.all(trainingFiles.map(load))
const test = await Promise.all(testFiles.map(load))
const model = trainMergedFingeringModel(training)

const results = []
const configurations = evaluateAllAnnotations
  ? [{ name: 'accords-contraints-toutes-annotations', enforceChordConstraints: true }]
  : [{ name: 'sans-contraintes', enforceChordConstraints: false }, { name: 'accords-contraints', enforceChordConstraints: true }]
for (const configuration of configurations) {
  const beamWidth = 100
  const started = performance.now()
  let notes = 0, handCorrect = 0, fingerCorrect = 0, jointCorrect = 0, exploredStates = 0
  let chordNotes = 0, chordJointCorrect = 0, monodyNotes = 0, monodyJointCorrect = 0, chordGroups = 0, invalidChordGroups = 0
  const perFile = []
  for (let fileIndex = 0; fileIndex < test.length; fileIndex += 1) {
    const decoded = decodeMergedFingering(test[fileIndex], model, { beamWidth, enforceChordConstraints: configuration.enforceChordConstraints })
    let fileJointCorrect = 0
    const onsetCounts = new Map()
    test[fileIndex].forEach((note) => onsetCounts.set(note.onsetSeconds, (onsetCounts.get(note.onsetSeconds) ?? 0) + 1))
    decoded.assignments.forEach((assignment, noteIndex) => {
      const truth = test[fileIndex][noteIndex]
      if (assignment.hand === truth.hand) handCorrect += 1
      if (assignment.finger === truth.finger) fingerCorrect += 1
      const joint = assignment.hand === truth.hand && assignment.finger === truth.finger
      if (joint) { jointCorrect += 1; fileJointCorrect += 1 }
      if (onsetCounts.get(truth.onsetSeconds) > 1) { chordNotes += 1; if (joint) chordJointCorrect += 1 }
      else { monodyNotes += 1; if (joint) monodyJointCorrect += 1 }
    })
    const groups = new Map()
    decoded.assignments.forEach((assignment, noteIndex) => {
      const key = `${test[fileIndex][noteIndex].onsetSeconds}:${assignment.hand}`
      const group = groups.get(key) ?? []
      group.push({ pitch: test[fileIndex][noteIndex].midiPitch, finger: assignment.finger, hand: assignment.hand })
      groups.set(key, group)
    })
    for (const group of groups.values()) if (group.length > 1) {
      chordGroups += 1
      group.sort((a, b) => a.pitch - b.pitch)
      if (group.some((note, index) => index > 0 && (note.pitch === group[index - 1].pitch || note.finger === group[index - 1].finger || (note.hand === 'right' ? note.finger < group[index - 1].finger : note.finger > group[index - 1].finger)))) invalidChordGroups += 1
    }
    notes += test[fileIndex].length
    exploredStates += decoded.exploredStates
    perFile.push({ file: testFiles[fileIndex], notes: test[fileIndex].length, jointAccuracy: fileJointCorrect / test[fileIndex].length })
  }
  results.push({ name: configuration.name, beamWidth, notes, handAccuracy: handCorrect / notes, fingerAccuracy: fingerCorrect / notes, jointAccuracy: jointCorrect / notes, chordJointAccuracy: chordJointCorrect / chordNotes, monodyJointAccuracy: monodyJointCorrect / monodyNotes, chordNotes, monodyNotes, chordGroups, invalidChordGroups, invalidChordRate: invalidChordGroups / chordGroups, exploredStates, elapsedSeconds: (performance.now() - started) / 1000, perFile })
  console.log(`${configuration.name}: mains ${(handCorrect / notes * 100).toFixed(2)} %, doigts ${(fingerCorrect / notes * 100).toFixed(2)} %, conjoint ${(jointCorrect / notes * 100).toFixed(2)} %`)
}
await mkdir(outputRoot, { recursive: true })
await writeFile(path.join(outputRoot, 'model.json'), `${JSON.stringify(model)}\n`)
await writeFile(path.join(outputRoot, evaluateAllAnnotations ? 'report-all-annotations.json' : 'report.json'), `${JSON.stringify({ schemaVersion: 1, trainingAnnotations: trainingFiles.length, testFiles, results }, null, 2)}\n`)
