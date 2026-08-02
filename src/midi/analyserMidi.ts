import { Midi } from '@tonejs/midi'
import type { MesureMidi, MorceauMidi, SignatureRythmique } from '../types/midi'

const noms = ['Do', 'Do♯', 'Ré', 'Ré♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si']
const nomNote = (midi: number) => `${noms[midi % 12]}${Math.floor(midi / 12) - 1}`

const normaliserSignatures = (midi: Midi): SignatureRythmique[] => {
  const signatures = midi.header.timeSignatures.map((s) => ({
    numerateur: s.timeSignature[0] ?? 4,
    denominateur: s.timeSignature[1] ?? 4,
    ticks: s.ticks,
    temps: midi.header.ticksToSeconds(s.ticks),
  }))
  if (!signatures.length || signatures[0].ticks > 0) {
    signatures.unshift({ numerateur: 4, denominateur: 4, ticks: 0, temps: 0 })
  }
  return signatures
}

const construireMesures = (midi: Midi, signatures: SignatureRythmique[]): MesureMidi[] => {
  const mesures: MesureMidi[] = []
  let numero = 1
  signatures.forEach((signature, index) => {
    const fin = signatures[index + 1]?.ticks ?? midi.durationTicks
    const pas = midi.header.ppq * signature.numerateur * (4 / signature.denominateur)
    for (let ticks = signature.ticks; ticks <= fin && ticks <= midi.durationTicks; ticks += pas) {
      if (!mesures.length || mesures[mesures.length - 1].ticks !== ticks) {
        mesures.push({
          numero: numero++, ticks, temps: midi.header.ticksToSeconds(ticks),
          signature: `${signature.numerateur}/${signature.denominateur}`,
        })
      }
    }
  })
  return mesures
}

export const analyserMidi = (donnees: ArrayBuffer, nomFichier: string): MorceauMidi => {
  let midi: Midi
  try { midi = new Midi(donnees) }
  catch { throw new Error(`« ${nomFichier} » ne semble pas être un fichier MIDI valide.`) }

  const pistes = midi.tracks.map((piste, index) => ({
    id: `piste-${index}`, index, nom: piste.name.trim() || `Piste ${index + 1}`,
    canal: piste.channel, instrument: piste.instrument.name || `Programme ${piste.instrument.number}`,
    nombreNotes: piste.notes.length,
  }))
  const notes = midi.tracks.flatMap((piste, pisteIndex) => piste.notes.map((note) => ({
    midi: note.midi, nom: nomNote(note.midi), temps: note.time, duree: note.duration,
    velocite: note.velocity, ticks: note.ticks, dureeTicks: note.durationTicks,
    pisteId: `piste-${pisteIndex}`, pisteIndex,
  }))).sort((a, b) => a.temps - b.temps || a.midi - b.midi || a.pisteIndex - b.pisteIndex)
  const hauteurs = notes.map((note) => note.midi)
  const min = hauteurs.length ? Math.min(...hauteurs) : 0
  const max = hauteurs.length ? Math.max(...hauteurs) : 0
  const signaturesRythmiques = normaliserSignatures(midi)
  const tempos = midi.header.tempos.length ? midi.header.tempos.map((tempo) => ({
    bpm: tempo.bpm, ticks: tempo.ticks,
    temps: tempo.time ?? midi.header.ticksToSeconds(tempo.ticks),
  })) : [{ bpm: 120, ticks: 0, temps: 0 }]

  return {
    nomInterne: midi.name, duree: midi.duration, dureeTicks: midi.durationTicks,
    ppq: midi.header.ppq, tempoInitial: tempos[0].bpm, tempos, signaturesRythmiques,
    mesures: construireMesures(midi, signaturesRythmiques), pistes, notes,
    etendue: hauteurs.length ? { min, max, nomMin: nomNote(min), nomMax: nomNote(max) } : null,
  }
}
