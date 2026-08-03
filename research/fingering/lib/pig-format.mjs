const PITCH_PATTERN = /^([A-G])((?:#|b)*)(-?\d+)$/
const PITCH_CLASSES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

export function pitchSpellingToMidi(value, context = 'annotation') {
  const match = PITCH_PATTERN.exec(value)
  if (!match) throw new Error(`${context}: hauteur invalide: ${value}`)
  const [, letter, accidentals, octave] = match
  const alteration = [...accidentals].reduce((sum, sign) => sum + (sign === '#' ? 1 : -1), 0)
  const midi = (Number(octave) + 1) * 12 + PITCH_CLASSES[letter] + alteration
  if (midi < 0 || midi > 127) throw new Error(`${context}: hauteur MIDI hors limites: ${value}`)
  return midi
}

function parseFinger(value, context) {
  const rawParts = value.split('_')
  const values = rawParts.filter(Boolean).map(Number)
  if (values.length === 0 || values.some((finger) => !Number.isInteger(finger) || finger === 0 || Math.abs(finger) > 5)) {
    throw new Error(`${context}: doigt invalide: ${value}`)
  }
  return { initial: values[0], substitutions: values.slice(1), incomplete: rawParts.at(-1) === '' }
}

export function parsePigAnnotation(text, fileName = '<mémoire>') {
  const metadata = []
  const notes = []
  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('//')) {
      const separator = line.indexOf(':')
      metadata.push({
        key: separator < 0 ? null : line.slice(2, separator).trim() || null,
        value: separator < 0 ? line.slice(2).trim() : line.slice(separator + 1).trim(),
        raw: line,
      })
      continue
    }
    const context = `${fileName}:${index + 1}`
    const fields = line.split(/\s+/)
    if (fields.length !== 8) throw new Error(`${context}: 8 champs attendus, ${fields.length} reçus`)
    const [sourceId, onsetText, offsetText, pitchSpelling, onVelocityText, offVelocityText, channelText, fingerText] = fields
    const onsetSeconds = Number(onsetText)
    const offsetSeconds = Number(offsetText)
    const onVelocity = Number(onVelocityText)
    const offVelocity = Number(offVelocityText)
    const channel = Number(channelText)
    const parsedFinger = parseFinger(fingerText, context)
    if (![onsetSeconds, offsetSeconds, onVelocity, offVelocity, channel].every(Number.isFinite)) throw new Error(`${context}: valeur numérique invalide`)
    if (onsetSeconds > offsetSeconds) throw new Error(`${context}: onset supérieur à offset`)
    if (![0, 1].includes(channel)) throw new Error(`${context}: canal invalide: ${channel}`)
    if (parsedFinger.initial * (channel === 0 ? 1 : -1) < 0) throw new Error(`${context}: signe du doigt incohérent avec le canal`)
    notes.push({
      sourceId, onsetSeconds, offsetSeconds, pitchSpelling,
      midiPitch: pitchSpellingToMidi(pitchSpelling, context), onVelocity, offVelocity,
      hand: channel === 0 ? 'right' : 'left', finger: Math.abs(parsedFinger.initial),
      substitutions: parsedFinger.substitutions.map(Math.abs),
      substitutionIncomplete: parsedFinger.incomplete,
      source: { lineNumber: index + 1, channel, fingerText },
    })
  }
  return { metadata, notes }
}

export function toInternalAnnotation(text, fileName) {
  const parsed = parsePigAnnotation(text, fileName)
  const match = /^(\d+)-(\d+)_fingering\.txt$/.exec(fileName)
  if (!match) throw new Error(`${fileName}: nom de fichier PIG inattendu`)
  return {
    schemaVersion: 1, annotationId: `${match[1]}-${match[2]}`, pieceId: match[1], annotatorId: match[2], sourceFile: fileName,
    metadata: Object.fromEntries(parsed.metadata.filter(({ key }) => key).map(({ key, value }) => [key, value])),
    metadataLines: parsed.metadata.map(({ raw }) => raw),
    notes: parsed.notes.map((note, index, notes) => ({
      noteId: `${match[1]}:${note.sourceId}:${note.midiPitch}:${notes.slice(0, index).filter((item) => item.sourceId === note.sourceId && item.midiPitch === note.midiPitch).length}`,
      ...note,
    })),
  }
}
