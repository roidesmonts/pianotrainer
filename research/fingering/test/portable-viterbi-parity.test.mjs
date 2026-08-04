import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { decodeMergedFingering as decodeReference } from '../lib/merged-fingering-model.mjs'
import { decodeMergedFingering as decodeTypeScript } from '../../../.fingering-test-build/fingering/viterbi.js'
import { parsePortableFingeringModel } from '../../../.fingering-test-build/fingering/model.js'
const modelJson = JSON.parse(await readFile(new URL('../../../src/fingering/models/synthetic-v1.json', import.meta.url), 'utf8'))
const model = parsePortableFingeringModel(modelJson)
const fixture = JSON.parse(await readFile(new URL('./fixtures/portable-viterbi-v1.json', import.meta.url), 'utf8'))
test('le chargeur rejette un modèle portable tronqué', () => assert.throws(() => parsePortableFingeringModel({ ...modelJson, logKeyOutput: {} }), /Paramètres invalides/))
for (const entry of fixture.cases) test(`parité prototype/TypeScript : ${entry.name}`, () => {
  const reference = decodeReference(entry.notes, modelJson, entry.options), typescript = decodeTypeScript(entry.notes, model, entry.options)
  assert.deepEqual(typescript.assignments, reference.assignments)
  assert.ok(Math.abs(typescript.score - reference.score) < 1e-12, `${typescript.score} != ${reference.score}`)
  assert.equal(typescript.exploredStates, reference.exploredStates); assert.equal(typescript.pruned, reference.pruned)
})
