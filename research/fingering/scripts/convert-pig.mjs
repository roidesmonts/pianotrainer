#!/usr/bin/env node
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { toInternalAnnotation } from '../lib/pig-format.mjs'

const datasetRoot = path.resolve(process.argv[2] ?? 'research/fingering/data/PianoFingeringDataset_v1.2')
const outputDirectory = path.resolve(process.argv[3] ?? 'research/fingering/generated/internal-v1')
const sourceDirectory = path.join(datasetRoot, 'FingeringFiles')
const fileNames = (await readdir(sourceDirectory)).filter((name) => name.endsWith('_fingering.txt')).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
await mkdir(outputDirectory, { recursive: true })
let noteCount = 0
for (const fileName of fileNames) {
  const annotation = toInternalAnnotation(await readFile(path.join(sourceDirectory, fileName), 'utf8'), fileName)
  noteCount += annotation.notes.length
  await writeFile(path.join(outputDirectory, fileName.replace(/_fingering\.txt$/, '.json')), `${JSON.stringify(annotation, null, 2)}\n`)
}
const manifest = { schemaVersion: 1, sourceDataset: 'PIG Dataset v1.2', annotationCount: fileNames.length, noteCount, files: fileNames.map((name) => name.replace(/_fingering\.txt$/, '.json')) }
await writeFile(path.join(outputDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Conversion terminée : ${fileNames.length} annotations, ${noteCount} notes -> ${outputDirectory}`)
