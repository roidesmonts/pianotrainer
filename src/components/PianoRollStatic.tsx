import { useEffect, useMemo, useRef, useState } from 'react'
import { instrument, type Player } from 'soundfont-player'
import type { MorceauMidi, NoteMidi } from '../types/midi'
import type { Finger, Hand } from '../fingering/model'
import { applyFingeringCorrections } from '../fingering/corrections'
import { deleteFingeringCorrection, listFingeringCorrections, saveFingeringCorrection } from '../storage/fingeringCorrections'

const touchesNoires = new Set([1, 3, 6, 8, 10])
const couleurs = ['#ef4b4b', '#ef4b4b', '#f28c28', '#f28c28', '#f4d43d', '#70d35b', '#70d35b', '#35cbbb', '#35cbbb', '#6876e8', '#6876e8', '#d94fc3']
const nomsSoundfont = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const nomSoundfont = (midi: number) => `${nomsSoundfont[midi % 12]}${Math.floor(midi / 12) - 1}`
const noms = ['Do', 'Do♯', 'Ré', 'Ré♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si']

interface Geometrie { x: number; largeur: number }

function creerGeometrie(debut: number, fin: number, largeur: number) {
  const notes = Array.from({ length: fin - debut }, (_, i) => debut + i)
  const blanches = notes.filter(n => !touchesNoires.has(n % 12))
  const largeurBlanche = largeur / blanches.length, largeurNoire = largeurBlanche * .62
  const indexBlanche = (midi: number) => notes.slice(0, midi - debut).filter(n => !touchesNoires.has(n % 12)).length
  const touches = new Map<number, Geometrie>()
  notes.forEach(midi => touches.set(midi, touchesNoires.has(midi % 12)
    ? { x: indexBlanche(midi) * largeurBlanche - largeurNoire / 2, largeur: largeurNoire }
    : { x: indexBlanche(midi) * largeurBlanche, largeur: largeurBlanche }))
  return { notes, blanches, touches, largeurBlanche, largeurNoire, indexBlanche }
}

function croix(ctx: CanvasRenderingContext2D, x: number, y: number, taille: number) {
  ctx.strokeStyle = '#111827'; ctx.lineWidth = Math.max(1.2, taille * .13); ctx.beginPath()
  ctx.moveTo(x - taille, y - taille); ctx.lineTo(x + taille, y + taille)
  ctx.moveTo(x + taille, y - taille); ctx.lineTo(x - taille, y + taille); ctx.stroke()
}

function calculerSeparationMains(notes: NoteMidi[]) {
  let meilleure = 60, meilleurScore = Number.POSITIVE_INFINITY
  for (let coupure = 22; coupure <= 108; coupure++) {
    const score = notes.reduce((total, note) => total + Number(note.main === 'left' ? note.midi >= coupure : note.midi < coupure), 0)
    if (score < meilleurScore || (score === meilleurScore && Math.abs(coupure - 60) < Math.abs(meilleure - 60))) { meilleure = coupure; meilleurScore = score }
  }
  return meilleure
}

function calculerSeparationLocale(notes: NoteMidi[], temps: number, precedente: number) {
  const poidsGauche = Array(128).fill(0) as number[], poidsDroite = Array(128).fill(0) as number[]
  let totalGauche = 0, totalDroite = 0
  notes.forEach(note => {
    const fin = note.temps + note.duree
    const distance = temps < note.temps ? note.temps - temps : temps > fin ? temps - fin : 0
    if (distance > 1.25) return
    const poids = Math.exp(-distance / .55)
    if (note.main === 'left') { poidsGauche[note.midi] += poids; totalGauche += poids }
    else { poidsDroite[note.midi] += poids; totalDroite += poids }
  })
  if (!totalGauche || !totalDroite) return precedente
  const cumulGauche = Array(129).fill(0) as number[], cumulDroite = Array(129).fill(0) as number[]
  for (let midi = 0; midi < 128; midi++) { cumulGauche[midi + 1] = cumulGauche[midi] + poidsGauche[midi]; cumulDroite[midi + 1] = cumulDroite[midi] + poidsDroite[midi] }
  let meilleure = Math.round(precedente), meilleurScore = Number.POSITIVE_INFINITY
  for (let coupure = 22; coupure <= 108; coupure++) {
    const erreurs = totalGauche - cumulGauche[coupure] + cumulDroite[coupure]
    const score = erreurs + Math.abs(coupure - precedente) * .025
    if (score < meilleurScore) { meilleure = coupure; meilleurScore = score }
  }
  return meilleure
}

interface PointSeparation { temps: number; coupure: number }
interface PlageTravailGraphique { debut: number; fin: number }

function calculerCourbeSeparation(notes: NoteMidi[], duree: number) {
  const courbe: PointSeparation[] = [], pas = .2, nombrePoints = Math.ceil(duree / pas) + 2
  const notesParTranche = Array.from({ length: nombrePoints }, () => [] as NoteMidi[])
  notes.forEach(note => {
    const debut = Math.max(0, Math.floor((note.temps - 1.25) / pas)), fin = Math.min(nombrePoints - 1, Math.ceil((note.temps + note.duree + 1.25) / pas))
    for (let index = debut; index <= fin; index++) notesParTranche[index].push(note)
  })
  let separation = calculerSeparationMains(notes)
  for (let index = 0; index < nombrePoints; index++) {
    const temps = index * pas, cible = calculerSeparationLocale(notesParTranche[index], temps, separation)
    separation += Math.max(-.75, Math.min(.75, (cible - separation) * .28))
    courbe.push({ temps, coupure: separation })
  }
  return courbe
}

function separationAuTemps(courbe: PointSeparation[], temps: number) {
  const pas = .2, index = Math.max(0, Math.min(courbe.length - 1, Math.floor(temps / pas))), suivant = Math.min(courbe.length - 1, index + 1)
  const progression = Math.max(0, Math.min(1, (temps - courbe[index].temps) / pas))
  return courbe[index].coupure + (courbe[suivant].coupure - courbe[index].coupure) * progression
}

function dessiner(canvas: HTMLCanvasElement, morceau: MorceauMidi, notes: NoteMidi[], position: number, pps: number, debut: number, fin: number, afficherDoigtes: boolean, afficherIncertains: boolean, mainMiseEnAvant: 'both' | Hand, afficherContoursMainGauche: boolean, courbeSeparation: PointSeparation[] | null, plageTravail: PlageTravailGraphique | null) {
  const rect = canvas.getBoundingClientRect(), ratio = window.devicePixelRatio || 1
  canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio)
  const ctx = canvas.getContext('2d'); if (!ctx) return
  ctx.scale(ratio, ratio)
  const w = rect.width, h = rect.height, clavierH = Math.min(128, h * .2), frappeY = h - clavierH
  const geo = creerGeometrie(debut, fin, w)
  ctx.fillStyle = '#09111f'; ctx.fillRect(0, 0, w, h)

  geo.blanches.forEach(midi => { const g = geo.touches.get(midi)!; ctx.fillStyle = midi % 12 === 0 ? '#101d31' : '#0c1728'; ctx.fillRect(g.x, 0, g.largeur, frappeY); ctx.strokeStyle = '#192942'; ctx.strokeRect(g.x + .5, 0, g.largeur, frappeY) })
  geo.notes.filter(n => touchesNoires.has(n % 12)).forEach(midi => { const g = geo.touches.get(midi)!; ctx.fillStyle = '#0a1322'; ctx.fillRect(g.x, 0, g.largeur, frappeY); ctx.strokeStyle = '#22324b'; ctx.strokeRect(g.x + .5, 0, g.largeur, frappeY) })

  morceau.mesures.forEach((mesure, i) => {
    const y = frappeY - (mesure.temps - position) * pps
    const suivante = morceau.mesures[i + 1]
    if (suivante) {
      const signature = Number(mesure.signature.split('/')[0]) || 4
      for (let temps = 1; temps < signature; temps++) {
        const beatY = frappeY - (mesure.temps + (suivante.temps - mesure.temps) * temps / signature - position) * pps
        if (beatY >= 0 && beatY <= frappeY) { ctx.strokeStyle = '#1c2a40'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, beatY + .5); ctx.lineTo(w, beatY + .5); ctx.stroke() }
      }
    }
    if (y < 0 || y > frappeY) return
    ctx.strokeStyle = '#40516c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(w, y + .5); ctx.stroke()
    ctx.fillStyle = '#74839a'; ctx.font = '10px system-ui'; ctx.textAlign = 'left'; ctx.fillText(`${mesure.numero}`, 5, Math.max(11, y - 4))
  })

  if (courbeSeparation?.length) {
    const xPourCoupure = (coupure: number) => {
      const bornee = Math.max(debut + 1, Math.min(fin - 1, coupure)), basse = Math.floor(bornee), haute = Math.ceil(bornee)
      const xEntier = (valeur: number) => { const gauche = geo.touches.get(valeur - 1)!, droite = geo.touches.get(valeur)!; return (gauche.x + gauche.largeur / 2 + droite.x + droite.largeur / 2) / 2 }
      if (basse === haute) return xEntier(basse)
      return xEntier(basse) + (xEntier(haute) - xEntier(basse)) * (bornee - basse)
    }
    ctx.beginPath()
    for (let y = frappeY; y >= 0; y -= 10) {
      const temps = position + (frappeY - y) / pps, x = xPourCoupure(separationAuTemps(courbeSeparation, temps))
      if (y === frappeY) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
    ctx.lineTo(xPourCoupure(separationAuTemps(courbeSeparation, position + frappeY / pps)), 0)
    ctx.strokeStyle = '#07101c'; ctx.globalAlpha = .8; ctx.lineWidth = 4; ctx.stroke()
    ctx.strokeStyle = '#dce8f5'; ctx.globalAlpha = .82; ctx.lineWidth = 1.5; ctx.stroke(); ctx.globalAlpha = 1; ctx.lineWidth = 1
  }

  const visibles = notes
    .filter(note => note.midi >= debut && note.midi < fin && note.temps + note.duree >= position && note.temps <= position + frappeY / pps)
    .sort((a, b) => Number(mainMiseEnAvant !== 'both' && a.main === mainMiseEnAvant) - Number(mainMiseEnAvant !== 'both' && b.main === mainMiseEnAvant))
  visibles.forEach(note => {
    const g = geo.touches.get(note.midi); if (!g) return
    const bas = frappeY - (note.temps - position) * pps, hauteur = Math.max(3, note.duree * pps), y = bas - hauteur
    const attenuee = mainMiseEnAvant !== 'both' && note.main !== mainMiseEnAvant
    ctx.fillStyle = attenuee ? '#718096' : couleurs[note.midi % 12]; ctx.globalAlpha = attenuee ? .28 : .92; ctx.fillRect(g.x + 1, y, Math.max(2, g.largeur - 2), hauteur); ctx.globalAlpha = 1
    if (afficherContoursMainGauche && note.main === 'left') {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3
      ctx.strokeRect(g.x + 2, y + 1, Math.max(1, g.largeur - 4), Math.max(1, hauteur - 2)); ctx.lineWidth = 1
    }
    const incertaine = note.confiance < .6
    ctx.setLineDash(incertaine && afficherIncertains ? [4, 3] : [])
    ctx.strokeStyle = note.origineDoigte === 'manual' ? '#8ff0c8' : incertaine && afficherIncertains ? '#ffc66d' : afficherContoursMainGauche && note.main === 'left' ? '#ffffff' : '#ffffff55'
    ctx.lineWidth = incertaine && afficherIncertains ? 2 : 1
    ctx.strokeRect(g.x + 1.5, y + .5, Math.max(1, g.largeur - 3), Math.max(1, hauteur - 1)); ctx.setLineDash([]); ctx.lineWidth = 1
    if (touchesNoires.has(note.midi % 12) && hauteur >= 12) croix(ctx, g.x + g.largeur / 2, y + Math.min(10, hauteur / 2), Math.min(3.5, g.largeur / 5))
    if (afficherDoigtes && hauteur >= 13 && g.largeur >= 11) { ctx.fillStyle = attenuee ? '#293548' : '#09111f'; ctx.font = `900 ${Math.min(13, Math.max(9, g.largeur * .38))}px system-ui`; ctx.textAlign = 'center'; ctx.fillText(String(note.doigt), g.x + g.largeur / 2, y + Math.min(14, hauteur - 3), g.largeur - 3) }
    if (incertaine && afficherIncertains && hauteur >= 25) { ctx.fillStyle = '#ffc66d'; ctx.font = '900 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText('?', g.x + g.largeur / 2, y + hauteur - 4) }
  })

  if (plageTravail) {
    const yReprise = frappeY - (plageTravail.fin - position) * pps
    if (yReprise >= 0 && yReprise <= frappeY) {
      ctx.shadowColor = '#ffb454'; ctx.shadowBlur = 9; ctx.strokeStyle = '#ffd08a'; ctx.lineWidth = 4
      ctx.beginPath(); ctx.moveTo(0, yReprise); ctx.lineTo(w, yReprise); ctx.stroke(); ctx.shadowBlur = 0; ctx.lineWidth = 1
      const labelY = yReprise > 24 ? yReprise - 22 : yReprise + 5
      ctx.fillStyle = '#ffd08a'; ctx.fillRect(8, labelY, 86, 18)
      ctx.fillStyle = '#201306'; ctx.font = '800 10px system-ui'; ctx.textAlign = 'left'; ctx.fillText('↻ REPRISE', 14, labelY + 12)
    }
  }

  ctx.shadowColor = '#9fdcff'; ctx.shadowBlur = 10; ctx.strokeStyle = '#c2e9ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, frappeY); ctx.lineTo(w, frappeY); ctx.stroke(); ctx.shadowBlur = 0
  const actives = notes.filter(n => n.midi >= debut && n.midi < fin && n.temps <= position && n.temps + n.duree > position)
  const noteActive = (midi: number) => actives.find(n => n.midi === midi && (mainMiseEnAvant === 'both' || n.main === mainMiseEnAvant)) ?? actives.find(n => n.midi === midi)
  const couleurActive = (note: NoteMidi | undefined) => note && mainMiseEnAvant !== 'both' && note.main !== mainMiseEnAvant ? '#8a94a4' : note ? couleurs[note.midi % 12] : undefined
  geo.blanches.forEach(midi => { const g = geo.touches.get(midi)!; const active = noteActive(midi); ctx.fillStyle = couleurActive(active) ?? '#eef1f5'; ctx.fillRect(g.x, frappeY, g.largeur, clavierH); ctx.strokeStyle = '#69768a'; ctx.strokeRect(g.x, frappeY, g.largeur, clavierH); if (g.largeur > 23) { ctx.fillStyle = '#303847'; ctx.font = '10px system-ui'; ctx.textAlign = 'center'; ctx.fillText(noms[midi % 12], g.x + g.largeur / 2, h - 9) } })
  geo.notes.filter(n => touchesNoires.has(n % 12)).forEach(midi => { const g = geo.touches.get(midi)!; const active = noteActive(midi); ctx.fillStyle = couleurActive(active) ?? '#111827'; ctx.fillRect(g.x, frappeY, g.largeur, clavierH * .64); ctx.strokeStyle = '#02050b'; ctx.strokeRect(g.x, frappeY, g.largeur, clavierH * .64) })
}

export function PianoRollStatic({ morceau }: { morceau: MorceauMidi }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const positionRef = useRef(0)
  const audioRef = useRef<AudioContext | null>(null)
  const sortieRef = useRef<GainNode | null>(null)
  const pianoRef = useRef<Player | null>(null)
  const oscillateursRef = useRef(new Set<OscillatorNode>())
  const prochaineNoteRef = useRef(0)
  const ancreAudioRef = useRef(0), ancreMusicaleRef = useRef(0)
  const [position, setPosition] = useState(0), [pps, setPps] = useState(105), [lecture, setLecture] = useState(false)
  const [sonActif, setSonActif] = useState(true), [timbre, setTimbre] = useState<'synthese' | 'piano'>('synthese'), [chargementPiano, setChargementPiano] = useState(false), [erreurPiano, setErreurPiano] = useState(false)
  const [volume, setVolume] = useState(.75), [vitesse, setVitesse] = useState(1)
  const [clavierComplet, setClavierComplet] = useState(false)
  const [notes, setNotes] = useState(morceau.notes), [main, setMain] = useState<'both' | Hand>('both')
  const [afficherDoigtes, setAfficherDoigtes] = useState(false), [afficherIncertains, setAfficherIncertains] = useState(true)
  const [afficherContoursMainGauche, setAfficherContoursMainGauche] = useState(false), [afficherSeparationMains, setAfficherSeparationMains] = useState(true)
  const [modeTravail, setModeTravail] = useState(false), [indexMesureTravail, setIndexMesureTravail] = useState(0), [nombreMesuresTravail, setNombreMesuresTravail] = useState(4)
  const [erreurCorrection, setErreurCorrection] = useState('')
  const plagesMesures = useMemo(() => morceau.mesures.map((mesure, index) => ({ ...mesure, fin: morceau.mesures[index + 1]?.temps ?? morceau.duree })), [morceau])
  const mesureTravail = useMemo(() => {
    if (!plagesMesures.length) return undefined
    const debut = Math.min(indexMesureTravail, plagesMesures.length - 1), fin = Math.min(plagesMesures.length - 1, debut + nombreMesuresTravail - 1)
    return { ...plagesMesures[debut], fin: plagesMesures[fin].fin, numeroFin: plagesMesures[fin].numero }
  }, [plagesMesures, indexMesureTravail, nombreMesuresTravail])
  const notesFiltrees = useMemo(() => main === 'both' ? notes : notes.filter(note => note.main === main), [notes, main])
  const notesAudio = useMemo(() => {
    const uniques = new Map<string, NoteMidi>()
    notesFiltrees.filter(note => note.midi >= 21 && note.midi <= 108).forEach(note => {
      const cle = `${note.ticks}:${note.midi}`, existante = uniques.get(cle)
      if (!existante || note.velocite > existante.velocite) uniques.set(cle, note)
    })
    return [...uniques.values()].sort((a, b) => a.temps - b.temps || a.midi - b.midi)
  }, [notesFiltrees])
  const notesLecture = timbre === 'piano' ? notesAudio : notesFiltrees
  const courbeSeparation = useMemo(() => calculerCourbeSeparation(notes, morceau.duree), [notes, morceau.duree])
  useEffect(() => {
    let low = 0, high = notesLecture.length
    while (low < high) { const middle = (low + high) >> 1; if (notesLecture[middle].temps < positionRef.current) low = middle + 1; else high = middle }
    prochaineNoteRef.current = low; couperVoix()
  }, [notesLecture])
  const plage = useMemo(() => { if (clavierComplet) return { debut: 21, fin: 109 }; const min = morceau.etendue?.min ?? 48, max = morceau.etendue?.max ?? 83; if (max - min > 60) return { debut: Math.max(0, min), fin: Math.min(128, max + 1) }; let debut = Math.floor(min / 12) * 12, fin = Math.ceil((max + 1) / 12) * 12; if (fin - debut < 24) { debut -= 12; fin += 12 } return { debut: Math.max(0, debut), fin: Math.min(128, fin) } }, [morceau, clavierComplet])
  useEffect(() => { const canvas = ref.current; if (!canvas) return; const rendu = () => dessiner(canvas, morceau, notes, position, pps, plage.debut, plage.fin, afficherDoigtes, afficherIncertains, main, afficherContoursMainGauche, afficherSeparationMains ? courbeSeparation : null, modeTravail && mesureTravail ? { debut: mesureTravail.temps, fin: mesureTravail.fin } : null); const observer = new ResizeObserver(rendu); observer.observe(canvas); rendu(); return () => observer.disconnect() }, [morceau, notes, position, pps, plage, afficherDoigtes, afficherIncertains, main, afficherContoursMainGauche, afficherSeparationMains, courbeSeparation, modeTravail, mesureTravail])
  useEffect(() => { positionRef.current = position }, [position])
  useEffect(() => {
    if (!lecture) return
    let animation = 0
    const avancer = () => {
      const audio = audioRef.current
      if (!audio) return
      const nouvellePosition = ancreMusicaleRef.current + (audio.currentTime - ancreAudioRef.current) * vitesse
      if (modeTravail && mesureTravail && nouvellePosition >= mesureTravail.fin) {
        couperVoix(); ancreMusicaleRef.current = mesureTravail.temps; ancreAudioRef.current = audio.currentTime; positionRef.current = mesureTravail.temps
        prochaineNoteRef.current = indexDepuis(mesureTravail.temps); setPosition(mesureTravail.temps)
        animation = requestAnimationFrame(avancer); return
      }
      if (nouvellePosition >= morceau.duree) { setPosition(morceau.duree); setLecture(false); return }
      setPosition(nouvellePosition)
      animation = requestAnimationFrame(avancer)
    }
    animation = requestAnimationFrame(avancer)
    return () => cancelAnimationFrame(animation)
  }, [lecture, morceau.duree, vitesse, modeTravail, mesureTravail])
  useEffect(() => {
    let cancelled = false
    setLecture(false); setPosition(0); setMain('both'); setNotes(morceau.notes); setModeTravail(false); setIndexMesureTravail(0); setNombreMesuresTravail(4); setErreurCorrection(''); ancreMusicaleRef.current = 0
    listFingeringCorrections(morceau.identite).then((corrections) => { if (!cancelled) setNotes(applyFingeringCorrections(morceau.notes, corrections)) }).catch(() => { if (!cancelled) setErreurCorrection('Les corrections enregistrées n’ont pas pu être chargées.') })
    return () => { cancelled = true }
  }, [morceau])
  useEffect(() => {
    if (sortieRef.current) sortieRef.current.gain.value = volume
  }, [volume])

  useEffect(() => {
    if (!lecture || !sonActif) return
    const programmer = () => {
      const audio = audioRef.current, sortie = sortieRef.current
      if (!audio || !sortie) return
      const temps = ancreMusicaleRef.current + (audio.currentTime - ancreAudioRef.current) * vitesse
      while (prochaineNoteRef.current < notesLecture.length) {
        const note = notesLecture[prochaineNoteRef.current]
        if (modeTravail && mesureTravail && note.temps >= mesureTravail.fin) break
        if (note.temps > temps + 1 * vitesse) break
        prochaineNoteRef.current++
        if (note.temps + note.duree <= temps) continue
        const debut = Math.max(audio.currentTime, ancreAudioRef.current + (note.temps - ancreMusicaleRef.current) / vitesse)
        const finNote = modeTravail && mesureTravail ? Math.min(note.temps + note.duree, mesureTravail.fin) : note.temps + note.duree
        const duree = Math.max(.02, (finNote - Math.max(temps, note.temps)) / vitesse)
        const tenue = Math.max(.08, Math.min(duree, 2.8 + (72 - note.midi) * .035))
        if (timbre === 'piano') {
          pianoRef.current?.play(nomSoundfont(note.midi), debut, { duration: tenue, gain: Math.max(.06, Math.min(.65, note.velocite * .55)), release: .35 } as any)
        } else {
          const fondamentale = 440 * 2 ** ((note.midi - 69) / 12), grave = note.midi < 48
          const harmoniques = grave ? [[1, .5], [2.003, .34], [3.01, .18], [4.02, .1]] : [[1, .68], [2.003, .2], [3.01, .09]]
          harmoniques.forEach(([ratio, part]) => {
            const osc = audio.createOscillator(), gain = audio.createGain(), niveau = Math.max(.002, note.velocite * part * .24)
            osc.type = 'sine'; osc.frequency.value = fondamentale * ratio; osc.detune.value = (ratio - Math.round(ratio)) * 7
            gain.gain.setValueAtTime(.0001, debut); gain.gain.exponentialRampToValueAtTime(niveau, debut + .004)
            gain.gain.exponentialRampToValueAtTime(Math.max(.0002, niveau * .18), debut + tenue * .72); gain.gain.exponentialRampToValueAtTime(.0001, debut + tenue)
            osc.connect(gain).connect(sortie); oscillateursRef.current.add(osc); osc.onended = () => oscillateursRef.current.delete(osc)
            osc.start(debut); osc.stop(debut + tenue + .015)
          })
        }
      }
    }
    programmer(); const id = window.setInterval(programmer, 25)
    return () => window.clearInterval(id)
  }, [lecture, sonActif, morceau, vitesse, timbre, notesLecture, modeTravail, mesureTravail])
  useEffect(() => () => { couperVoix(); void audioRef.current?.close() }, [])

  function couperVoix() { pianoRef.current?.stop(); oscillateursRef.current.forEach(osc => { try { osc.stop() } catch {} }); oscillateursRef.current.clear() }
  async function chargerPiano(audio: AudioContext, sortie: GainNode) {
    if (pianoRef.current || chargementPiano) return
    setChargementPiano(true); setErreurPiano(false)
    try {
      pianoRef.current = await instrument(audio, 'acoustic_grand_piano', { soundfont: 'FluidR3_GM', format: 'mp3', destination: sortie, notes: [...new Set(notes.map(note => nomSoundfont(note.midi)))] })
    } catch { setErreurPiano(true); setSonActif(false) }
    finally { setChargementPiano(false) }
  }
  function indexDepuis(temps: number) {
    let bas = 0, haut = notesLecture.length
    while (bas < haut) { const milieu = (bas + haut) >> 1; if (notesLecture[milieu].temps < temps) bas = milieu + 1; else haut = milieu }
    return bas
  }
  function indexMesureDepuis(temps: number) {
    let index = 0
    for (let candidate = 1; candidate < plagesMesures.length && plagesMesures[candidate].temps <= temps; candidate++) index = candidate
    return index
  }

  async function basculerLecture() {
    let audio = audioRef.current
    if (!audio) { audio = new AudioContext(); audioRef.current = audio; const sortie = audio.createGain(), limiteur = audio.createDynamicsCompressor(); sortie.gain.value = volume; limiteur.threshold.value = -10; limiteur.knee.value = 8; limiteur.ratio.value = 8; limiteur.attack.value = .003; limiteur.release.value = .18; sortie.connect(limiteur).connect(audio.destination); sortieRef.current = sortie }
    if (audio.state === 'suspended') await audio.resume()
    if (!lecture && sonActif && sortieRef.current && !pianoRef.current && timbre === 'piano') await chargerPiano(audio, sortieRef.current)
    if (lecture) {
      const positionPause = Math.min(morceau.duree, ancreMusicaleRef.current + (audio.currentTime - ancreAudioRef.current) * vitesse)
      ancreMusicaleRef.current = positionPause; setPosition(positionPause); setLecture(false); couperVoix()
    } else {
      const depart = modeTravail && mesureTravail && (position < mesureTravail.temps || position >= mesureTravail.fin) ? mesureTravail.temps : position >= morceau.duree ? 0 : position
      ancreMusicaleRef.current = depart; ancreAudioRef.current = audio.currentTime; prochaineNoteRef.current = indexDepuis(depart); setPosition(depart); setLecture(true)
    }
  }
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    let glissement = false, dernierY = 0
    const naviguer = (event: WheelEvent) => { event.preventDefault(); deplacer(positionRef.current + event.deltaY / pps) }
    const commencer = (event: PointerEvent) => { glissement = true; dernierY = event.clientY; canvas.setPointerCapture(event.pointerId); event.preventDefault() }
    const glisser = (event: PointerEvent) => {
      if (!glissement) return
      event.preventDefault(); const delta = event.clientY - dernierY; dernierY = event.clientY
      deplacer(positionRef.current - delta / pps)
    }
    const terminer = (event: PointerEvent) => { glissement = false; if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId) }
    canvas.addEventListener('wheel', naviguer, { passive: false }); canvas.addEventListener('pointerdown', commencer)
    canvas.addEventListener('pointermove', glisser); canvas.addEventListener('pointerup', terminer); canvas.addEventListener('pointercancel', terminer)
    return () => { canvas.removeEventListener('wheel', naviguer); canvas.removeEventListener('pointerdown', commencer); canvas.removeEventListener('pointermove', glisser); canvas.removeEventListener('pointerup', terminer); canvas.removeEventListener('pointercancel', terminer) }
  }, [morceau, lecture, pps])

  function arreter() { const debut = modeTravail && mesureTravail ? mesureTravail.temps : 0; setLecture(false); couperVoix(); setPosition(debut); ancreMusicaleRef.current = debut; prochaineNoteRef.current = indexDepuis(debut) }
  function changerVitesse(nouvelleVitesse: number) {
    let actuelle = position
    if (lecture && audioRef.current) actuelle = Math.min(morceau.duree, ancreMusicaleRef.current + (audioRef.current.currentTime - ancreAudioRef.current) * vitesse)
    couperVoix(); setPosition(actuelle); ancreMusicaleRef.current = actuelle; prochaineNoteRef.current = indexDepuis(actuelle)
    if (audioRef.current) ancreAudioRef.current = audioRef.current.currentTime
    setVitesse(nouvelleVitesse)
  }
  function deplacer(nouvellePosition: number) {
    const bornee = Math.max(0, Math.min(morceau.duree, nouvellePosition))
    if (modeTravail && plagesMesures.length) setIndexMesureTravail(indexMesureDepuis(bornee))
    couperVoix(); setPosition(bornee); ancreMusicaleRef.current = bornee; prochaineNoteRef.current = indexDepuis(bornee)
    if (lecture && audioRef.current) ancreAudioRef.current = audioRef.current.currentTime
  }

  function basculerModeTravail() {
    couperVoix(); setLecture(false)
    if (modeTravail) { setModeTravail(false); return }
    const index = indexMesureDepuis(position)
    setIndexMesureTravail(index); setModeTravail(true)
    const debut = plagesMesures[index]?.temps ?? 0
    setPosition(debut); positionRef.current = debut; ancreMusicaleRef.current = debut; prochaineNoteRef.current = indexDepuis(debut)
  }

  function changerMesureTravail(index: number) {
    const bornee = Math.max(0, Math.min(plagesMesures.length - 1, index)), debut = plagesMesures[bornee]?.temps ?? 0
    couperVoix(); setIndexMesureTravail(bornee); setPosition(debut); positionRef.current = debut; ancreMusicaleRef.current = debut; prochaineNoteRef.current = indexDepuis(debut)
    if (lecture && audioRef.current) ancreAudioRef.current = audioRef.current.currentTime
  }

  function changerNombreMesuresTravail(nombre: number) {
    setLecture(false); couperVoix(); setNombreMesuresTravail(nombre)
    const debut = plagesMesures[indexMesureTravail]?.temps ?? 0
    setPosition(debut); positionRef.current = debut; ancreMusicaleRef.current = debut; prochaineNoteRef.current = indexDepuis(debut)
  }

  async function corriger(note: NoteMidi, hand: Hand, finger: Finger) {
    const correction = { pieceId: morceau.identite, noteId: note.id, hand, finger, updatedAt: new Date().toISOString() }
    setNotes(current => applyFingeringCorrections(current, [correction])); setErreurCorrection('')
    try { await saveFingeringCorrection(correction) }
    catch { setErreurCorrection('La correction est appliquée, mais sa sauvegarde locale a échoué.') }
  }

  async function restaurer(note: NoteMidi) {
    const originale = morceau.notes.find(candidate => candidate.id === note.id)
    if (originale) setNotes(current => current.map(candidate => candidate.id === note.id ? originale : candidate))
    setErreurCorrection('')
    try { await deleteFingeringCorrection(morceau.identite, note.id) }
    catch { setErreurCorrection('La proposition est restaurée, mais la correction enregistrée n’a pas pu être supprimée.') }
  }

  const notesAEditer = notes.filter(note => note.temps >= Math.max(0, position - .05) && note.temps <= position + 4).slice(0, 12)
  const incertaines = notes.filter(note => note.confiance < .6).length
  const manuelles = notes.filter(note => note.origineDoigte === 'manual').length

  return <section className="roll-step"><header><div><p className="eyebrow">Étape 6 · Mains et doigtés</p><h2>Lecture visuelle du morceau</h2></div><div className="roll-readout"><strong>{position.toFixed(2)} s</strong><span>{noms[plage.debut % 12]}{Math.floor(plage.debut / 12) - 1} → {noms[(plage.fin - 1) % 12]}{Math.floor((plage.fin - 1) / 12) - 1}</span></div></header>
    <canvas ref={ref} className="roll-canvas" title="Faites défiler ou glissez verticalement pour naviguer dans le morceau" />
    <div className="fingering-toolbar"><nav aria-label="Main mise en avant"><button className={main === 'both' ? 'active' : ''} aria-pressed={main === 'both'} onClick={() => { couperVoix(); setMain('both') }}>Deux mains</button><button className={main === 'right' ? 'active' : ''} aria-pressed={main === 'right'} onClick={() => { couperVoix(); setMain('right') }}>Main droite</button><button className={main === 'left' ? 'active' : ''} aria-pressed={main === 'left'} onClick={() => { couperVoix(); setMain('left') }}>Main gauche</button></nav><div><button className={afficherSeparationMains ? 'active' : ''} aria-pressed={afficherSeparationMains} onClick={() => setAfficherSeparationMains(value => !value)}>Ligne des mains</button><button className={afficherContoursMainGauche ? 'active' : ''} aria-pressed={afficherContoursMainGauche} onClick={() => setAfficherContoursMainGauche(value => !value)}>Contours main gauche</button><button className={afficherDoigtes ? 'active' : ''} aria-pressed={afficherDoigtes} onClick={() => setAfficherDoigtes(value => !value)}>Doigts {afficherDoigtes ? 'visibles' : 'masqués'}</button><button className={afficherIncertains ? 'warning active' : ''} onClick={() => setAfficherIncertains(value => !value)}>{incertaines} incertaine{incertaines !== 1 ? 's' : ''}</button></div><small>{manuelles} correction{manuelles !== 1 ? 's' : ''} manuelle{manuelles !== 1 ? 's' : ''}</small></div>
    <div className="transport"><button className={lecture ? 'pause' : 'play'} disabled={chargementPiano} onClick={() => void basculerLecture()} aria-label={lecture ? 'Mettre en pause' : 'Lire'}><span aria-hidden="true">{lecture ? 'Ⅱ' : '▶'}</span>{chargementPiano ? 'Chargement du piano…' : lecture ? 'Pause' : position >= morceau.duree ? 'Rejouer' : 'Lecture'}</button><button className="secondary" onClick={arreter} disabled={position === (modeTravail && mesureTravail ? mesureTravail.temps : 0) && !lecture}>■ Arrêt</button><button className={`secondary work-toggle ${modeTravail ? 'active' : ''}`} aria-pressed={modeTravail} disabled={!plagesMesures.length} onClick={basculerModeTravail}>Mode travail</button><button className="secondary" onClick={() => { couperVoix(); setSonActif(actif => !actif); prochaineNoteRef.current = indexDepuis(position) }}>{sonActif ? 'Son activé' : 'Activer le son'}</button><label className="volume">Son<select disabled={lecture} value={timbre} onChange={e => { couperVoix(); setErreurPiano(false); setTimbre(e.target.value as 'synthese' | 'piano') }}><option value="synthese">Synthèse (fiable)</option><option value="piano">Piano échantillonné</option></select></label><button className="secondary keyboard-toggle" onClick={() => setClavierComplet(complet => !complet)}>{clavierComplet ? 'Clavier : complet' : 'Clavier : mini'}</button><label className="volume">Volume<input type="range" min="0" max="1" step="0.01" value={volume} onChange={e => setVolume(Number(e.target.value))} /></label></div>
    {modeTravail && mesureTravail && <div className="work-controls"><button className="secondary" disabled={indexMesureTravail === 0} onClick={() => changerMesureTravail(indexMesureTravail - 1)}>← Mesure précédente</button><strong>{mesureTravail.numero === mesureTravail.numeroFin ? `Mesure ${mesureTravail.numero}` : `Mesures ${mesureTravail.numero}–${mesureTravail.numeroFin}`}</strong><span>{mesureTravail.signature} · répétition en boucle</span><label>Fenêtre<select value={nombreMesuresTravail} onChange={event => changerNombreMesuresTravail(Number(event.target.value))}><option value="1">1 mesure</option><option value="2">2 mesures</option><option value="4">4 mesures</option><option value="8">8 mesures</option></select></label><button className="secondary" disabled={indexMesureTravail >= plagesMesures.length - 1} onClick={() => changerMesureTravail(indexMesureTravail + 1)}>Mesure suivante →</button></div>}
    <div className="roll-controls"><label>Position dans le morceau<input type="range" min="0" max={morceau.duree} step="0.01" value={position} onChange={e => deplacer(Number(e.target.value))} /></label><label>Tempo<input type="range" min="0.25" max="1.5" step="0.05" value={vitesse} onChange={e => changerVitesse(Number(e.target.value))} /><span>{Math.round(vitesse * 100)} %</span></label><label>Échelle temporelle<input type="range" min="45" max="220" step="5" value={pps} onChange={e => setPps(Number(e.target.value))} /><span>{pps} px/s</span></label></div>
    <section className="fingering-editor"><header><div><h3>Corriger les propositions</h3><p>Notes des quatre prochaines secondes · contour orange : séparation de main incertaine · vert : correction enregistrée.</p></div><small>Mains : modèle PIG contraint · doigts : FHMM3 réentraîné localement.</small></header>{erreurCorrection && <p className="fingering-error" role="alert">{erreurCorrection}</p>}<div className="fingering-note-list">{notesAEditer.length ? notesAEditer.map(note => <article className={`${note.confiance < .6 ? 'uncertain' : ''} ${note.origineDoigte === 'manual' ? 'manual' : ''}`} key={note.id}><button className="note-time" onClick={() => deplacer(note.temps)}><strong>{note.nom}</strong><small>{note.temps.toFixed(2)} s</small></button><label>Main<select value={note.main} onChange={event => void corriger(note, event.target.value as Hand, note.doigt)}><option value="right">Droite</option><option value="left">Gauche</option></select></label><label>Doigt<select value={note.doigt} onChange={event => void corriger(note, note.main, Number(event.target.value) as Finger)}>{([1,2,3,4,5] as Finger[]).map(finger => <option key={finger} value={finger}>{finger}</option>)}</select></label><span title={`Confiance de séparation de main ${Math.round(note.confiance * 100)} %`}>{Math.round(note.confiance * 100)} %</span><button className="secondary" disabled={note.origineDoigte !== 'manual'} onClick={() => void restaurer(note)}>Restaurer</button></article>) : <p>Aucune attaque dans les quatre prochaines secondes.</p>}</div></section>
  </section>
}
