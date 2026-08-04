export type PracticeExperience = 'long' | 'chrono'
export type PracticeResult = 'completed' | 'disqualified' | 'stopped'

export type PracticeAttempt = {
  id: string
  playedAt: string
  experience: PracticeExperience
  noteCount: 1 | 3 | 5
  score: number
  correctAnswers: number
  totalQuestions: number
  accuracy: number
  durationSeconds: number
  configuredDuration: number | null
  reflectionDelay: number | null
  levelReached: number | null
  result: PracticeResult
}

const DB_NAME = 'piano-trainer', STORE_NAME = 'practice-attempts', DB_VERSION = 1

export function createAttemptId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const randomPart = typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function'
    ? crypto.getRandomValues(new Uint32Array(2)).join('-')
    : Math.random().toString(36).slice(2)
  return `${Date.now()}-${randomPart}`
}

function ouvrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const demande = indexedDB.open(DB_NAME, DB_VERSION)
    demande.onupgradeneeded = () => {
      const db = demande.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('playedAt', 'playedAt')
        store.createIndex('experience', 'experience')
      }
    }
    demande.onsuccess = () => resolve(demande.result)
    demande.onerror = () => reject(demande.error)
  })
}

export async function savePracticeAttempt(attempt: PracticeAttempt) {
  const db = await ouvrir()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put(attempt)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  db.close()
}

export async function listPracticeAttempts(): Promise<PracticeAttempt[]> {
  const db = await ouvrir()
  const attempts = await new Promise<PracticeAttempt[]>((resolve, reject) => {
    const demande = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll()
    demande.onsuccess = () => resolve(demande.result)
    demande.onerror = () => reject(demande.error)
  })
  db.close()
  return attempts.sort((a, b) => a.playedAt.localeCompare(b.playedAt))
}
