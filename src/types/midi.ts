export interface EntreeMorceau { id: string; nom: string; chemin: string; taille: number }
export interface SourceBibliotheque {
  lister(): Promise<EntreeMorceau[]>
  chargerFichier(id: string): Promise<ArrayBuffer>
}
export interface NoteMidi {
  midi: number; nom: string; temps: number; duree: number; velocite: number
  ticks: number; dureeTicks: number; pisteId: string; pisteIndex: number
}
export interface PisteMidi {
  id: string; index: number; nom: string; canal: number; instrument: string; nombreNotes: number
}
export interface TempoMidi { bpm: number; ticks: number; temps: number }
export interface SignatureRythmique {
  numerateur: number; denominateur: number; ticks: number; temps: number
}
export interface MesureMidi {
  numero: number; ticks: number; temps: number; signature: `${number}/${number}`
}
export interface MorceauMidi {
  nomInterne: string; duree: number; dureeTicks: number; ppq: number; tempoInitial: number
  tempos: TempoMidi[]; signaturesRythmiques: SignatureRythmique[]; mesures: MesureMidi[]
  pistes: PisteMidi[]; notes: NoteMidi[]
  etendue: { min: number; max: number; nomMin: string; nomMax: string } | null
}
