export type Hand = 'left' | 'right'
export type Finger = 1 | 2 | 3 | 4 | 5

export interface PortableFingeringModel {
  $schema?: string
  schemaVersion: 1
  kind: 'merged-output-hand-fingering'
  modelVersion: string
  widthX: number
  provenance: {
    corpus: string
    license: string
    redistribution: 'allowed' | 'not-cleared'
    trainedAt: string
    smoothing: { handSeparation: number; fingering: number }
  }
  handSeparation: {
    schemaVersion: 2
    smoothing: number
    logHandPrior: Record<Hand, number>
    logInitialPitch: Record<Hand, number[]>
    logPitchTransition: Record<Hand, number[][]>
  }
  logInitialFinger: Record<Hand, number[]>
  logFingerTransition: Record<Hand, number[][]>
  logKeyOutput: Record<Hand, number[][][]>
}

const hands: Hand[] = ['left', 'right']
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const vector = (value: unknown, length: number) => Array.isArray(value) && value.length === length && value.every(finite)
const matrix = (value: unknown, rows: number, columns: number) => Array.isArray(value) && value.length === rows && value.every((row) => vector(row, columns))

/** Validate untrusted JSON before it reaches the decoder. */
export function parsePortableFingeringModel(value: unknown): PortableFingeringModel {
  if (!value || typeof value !== 'object') throw new Error('Le modèle de doigté doit être un objet JSON')
  const model = value as Partial<PortableFingeringModel>
  if (model.schemaVersion !== 1 || model.kind !== 'merged-output-hand-fingering' || typeof model.modelVersion !== 'string') {
    throw new Error('Version ou type de modèle de doigté non pris en charge')
  }
  if (model.widthX !== 15) throw new Error('widthX invalide pour le schéma v1')
  const outputSize = 3 * (2 * model.widthX! + 1)
  if (!model.provenance || !model.handSeparation || model.handSeparation.schemaVersion !== 2) throw new Error('Métadonnées du modèle incomplètes')
  for (const hand of hands) {
    if (!finite(model.handSeparation.logHandPrior?.[hand]) || !vector(model.handSeparation.logInitialPitch?.[hand], 128)
      || !matrix(model.handSeparation.logPitchTransition?.[hand], 128, 128)
      || !vector(model.logInitialFinger?.[hand], 5) || !matrix(model.logFingerTransition?.[hand], 5, 5)
      || !Array.isArray(model.logKeyOutput?.[hand]) || model.logKeyOutput[hand].length !== 5
      || !model.logKeyOutput[hand].every((rows) => matrix(rows, 5, outputSize))) {
      throw new Error(`Paramètres invalides pour la main ${hand}`)
    }
  }
  return model as PortableFingeringModel
}
