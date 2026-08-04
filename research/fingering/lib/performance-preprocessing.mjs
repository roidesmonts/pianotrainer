export function groupPerformanceAttacks(notes, toleranceSeconds = 0.03) {
  if (!Number.isFinite(toleranceSeconds) || toleranceSeconds < 0) throw new Error('Tolérance d’attaque invalide')
  const ordered = notes.map((note, sourceOrder) => ({ ...note, sourceOrder })).sort((a, b) =>
    a.onsetSeconds - b.onsetSeconds || a.midiPitch - b.midiPitch || a.sourceOrder - b.sourceOrder,
  )
  const groups = []
  for (const note of ordered) {
    const current = groups.at(-1)
    if (!current || note.onsetSeconds - current.anchor > toleranceSeconds) groups.push({ anchor: note.onsetSeconds, notes: [note] })
    else current.notes.push(note)
  }
  return groups.flatMap((group, attackGroup) => group.notes.sort((a, b) => a.midiPitch - b.midiPitch || a.sourceOrder - b.sourceOrder).map((note) => ({
    ...note,
    originalOnsetSeconds: note.onsetSeconds,
    onsetSeconds: group.anchor,
    attackGroup,
  })))
}

export function deterministicChordJitter(notes, amplitudeSeconds) {
  const onsetCounts = new Map()
  notes.forEach((note) => onsetCounts.set(note.onsetSeconds, (onsetCounts.get(note.onsetSeconds) ?? 0) + 1))
  return notes.map((note, index) => {
    if (onsetCounts.get(note.onsetSeconds) < 2) return { ...note }
    const unit = ((index * 1103515245 + 12345) >>> 8) % 1001 / 1000
    return { ...note, onsetSeconds: note.onsetSeconds + (unit * 2 - 1) * amplitudeSeconds }
  })
}

export function buildSustainIntervals(events, threshold = 0.5) {
  const ordered = [...events].sort((a, b) => a.time - b.time)
  const intervals = []
  let start = null
  for (const event of ordered) {
    if (event.value >= threshold && start === null) start = event.time
    if (event.value < threshold && start !== null) { intervals.push({ startSeconds: start, endSeconds: event.time }); start = null }
  }
  if (start !== null) intervals.push({ startSeconds: start, endSeconds: Infinity })
  return intervals
}

export function sustainAt(time, intervals) {
  return intervals.find((interval) => interval.startSeconds <= time && time < interval.endSeconds) ?? null
}
