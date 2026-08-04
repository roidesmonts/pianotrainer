import type { Finger, Hand } from './model'
import type { NoteMidi } from '../types/midi'

export interface FingeringCorrection {
  pieceId: string
  noteId: string
  hand: Hand
  finger: Finger
  updatedAt: string
}

export function applyFingeringCorrections(notes: NoteMidi[], corrections: FingeringCorrection[]): NoteMidi[] {
  const byNote = new Map(corrections.map((correction) => [correction.noteId, correction]))
  return notes.map((note) => {
    const correction = byNote.get(note.id)
    return correction
      ? { ...note, main: correction.hand, doigt: correction.finger, confiance: 1, origineDoigte: 'manual' }
      : note
  })
}
