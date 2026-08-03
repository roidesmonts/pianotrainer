#!/usr/bin/env node

import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const datasetRoot = path.resolve(
  process.argv[2] ?? 'research/fingering/data/PianoFingeringDataset_v1.2',
)
const fingeringDirectory = path.join(datasetRoot, 'FingeringFiles')

function parseFinger(value) {
  const rawParts = value.split('_')
  const trailingSeparator = rawParts.at(-1) === ''
  const parts = rawParts.filter(Boolean).map(Number)
  if (parts.some((finger) => !Number.isInteger(finger) || finger === 0 || Math.abs(finger) > 5)) {
    throw new Error(`doigt invalide: ${value}`)
  }
  return { initial: parts[0], substitutions: parts.slice(1), trailingSeparator }
}

function parseAnnotation(text, fileName) {
  const metadata = []
  const notes = []

  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('//')) {
      metadata.push(line)
      continue
    }

    const fields = line.split(/\s+/)
    if (fields.length !== 8) {
      throw new Error(`${fileName}:${index + 1}: 8 champs attendus, ${fields.length} reçus`)
    }

    const [id, onsetText, offsetText, pitch, onVelocityText, offVelocityText, channelText, fingerText] = fields
    const onset = Number(onsetText)
    const offset = Number(offsetText)
    const onVelocity = Number(onVelocityText)
    const offVelocity = Number(offVelocityText)
    const channel = Number(channelText)
    const finger = parseFinger(fingerText)

    if (![onset, offset, onVelocity, offVelocity, channel].every(Number.isFinite)) {
      throw new Error(`${fileName}:${index + 1}: valeur numérique invalide`)
    }
    if (onset > offset) throw new Error(`${fileName}:${index + 1}: onset supérieur à offset`)
    if (!/^[A-G](?:#|b)*-?\d+$/.test(pitch)) throw new Error(`${fileName}:${index + 1}: hauteur invalide: ${pitch}`)
    if (![0, 1].includes(channel)) throw new Error(`${fileName}:${index + 1}: canal invalide: ${channel}`)
    if (finger.initial * (channel === 0 ? 1 : -1) < 0) {
      throw new Error(`${fileName}:${index + 1}: signe du doigt incohérent avec le canal`)
    }

    notes.push({ id, onset, offset, pitch, onVelocity, offVelocity, channel, fingerText, finger })
  }

  return { metadata, notes }
}

function scoreIdentity(notes) {
  return notes.map(({ id, pitch, channel }) => `${id}|${pitch}|${channel}`).join('\n')
}

function performanceIdentity(notes) {
  return notes.map(({ id, onset, offset, pitch, channel }) => `${id}|${onset}|${offset}|${pitch}|${channel}`).join('\n')
}

const fileNames = (await readdir(fingeringDirectory))
  .filter((fileName) => fileName.endsWith('_fingering.txt'))
  .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))

const pieces = new Map()
const errors = []
let noteCount = 0
let rightHandNotes = 0
let leftHandNotes = 0
let substitutions = 0
let malformedFingerAnnotations = 0
let exactSimultaneousNotes = 0

for (const fileName of fileNames) {
  try {
    const annotation = parseAnnotation(
      await readFile(path.join(fingeringDirectory, fileName), 'utf8'),
      fileName,
    )
    const pieceId = fileName.split('-')[0]
    const previous = pieces.get(pieceId) ?? []
    previous.push({ fileName, ...annotation })
    pieces.set(pieceId, previous)

    noteCount += annotation.notes.length
    rightHandNotes += annotation.notes.filter((note) => note.channel === 0).length
    leftHandNotes += annotation.notes.filter((note) => note.channel === 1).length
    substitutions += annotation.notes.filter((note) => note.finger.substitutions.length > 0).length
    malformedFingerAnnotations += annotation.notes.filter((note) => note.finger.trailingSeparator).length

    const onsetCounts = new Map()
    for (const note of annotation.notes) onsetCounts.set(note.onset, (onsetCounts.get(note.onset) ?? 0) + 1)
    exactSimultaneousNotes += [...onsetCounts.values()].filter((count) => count > 1).reduce((sum, count) => sum + count, 0)
  } catch (error) {
    errors.push(error.message)
  }
}

const identityMismatches = []
const timingMismatches = []
for (const [pieceId, annotations] of pieces) {
  const reference = scoreIdentity(annotations[0].notes)
  const performanceReference = performanceIdentity(annotations[0].notes)
  for (const annotation of annotations.slice(1)) {
    if (scoreIdentity(annotation.notes) !== reference) identityMismatches.push(`${pieceId}:${annotation.fileName}`)
    else if (performanceIdentity(annotation.notes) !== performanceReference) timingMismatches.push(`${pieceId}:${annotation.fileName}`)
  }
}

const annotationCounts = [...pieces.values()].map((annotations) => annotations.length)
const report = {
  datasetRoot,
  pieces: pieces.size,
  annotationFiles: fileNames.length,
  annotationsPerPiece: {
    min: Math.min(...annotationCounts),
    max: Math.max(...annotationCounts),
    distribution: Object.fromEntries(
      [...new Set(annotationCounts)].sort((a, b) => a - b).map((count) => [count, annotationCounts.filter((value) => value === count).length]),
    ),
  },
  notesAcrossAnnotations: noteCount,
  rightHandNotes,
  leftHandNotes,
  notesWithFingerSubstitution: substitutions,
  malformedFingerAnnotations,
  notesInExactSimultaneities: exactSimultaneousNotes,
  identityMismatchesBetweenAnnotations: identityMismatches,
  timingMismatchesBetweenStructurallyIdenticalAnnotations: timingMismatches,
  parseErrors: errors,
}

console.log(JSON.stringify(report, null, 2))
if (errors.length > 0) process.exitCode = 1
