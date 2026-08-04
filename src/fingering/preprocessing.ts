import type { NoteMidi } from '../types/midi'

export type OrderedNote = { note: NoteMidi; sourceIndex: number; groupedOnset: number }

export function groupAndOrderNotes(notes: NoteMidi[], tolerance: number): OrderedNote[] {
  const chronological = notes.map((note, sourceIndex) => ({ note, sourceIndex })).sort((a, b) =>
    a.note.temps - b.note.temps || a.note.midi - b.note.midi || a.sourceIndex - b.sourceIndex)
  const groups: { anchor: number; notes: typeof chronological }[] = []
  for (const entry of chronological) {
    const current = groups[groups.length - 1]
    if (!current || entry.note.temps - current.anchor > tolerance) groups.push({ anchor: entry.note.temps, notes: [entry] })
    else current.notes.push(entry)
  }
  return groups.flatMap((group) => group.notes.sort((a, b) => a.note.midi - b.note.midi || a.sourceIndex - b.sourceIndex)
    .map((entry) => ({ ...entry, groupedOnset: group.anchor })))
}
