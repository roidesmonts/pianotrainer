import { useEffect, useMemo, useRef, useState } from 'react'
import { instrument, type Player } from 'soundfont-player'
import type { MorceauMidi, NoteMidi } from '../types/midi'

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

function dessiner(canvas: HTMLCanvasElement, morceau: MorceauMidi, position: number, pps: number, debut: number, fin: number) {
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

  const visibles = morceau.notes.filter(note => note.midi >= debut && note.midi < fin && note.temps + note.duree >= position && note.temps <= position + frappeY / pps)
  visibles.forEach(note => {
    const g = geo.touches.get(note.midi); if (!g) return
    const bas = frappeY - (note.temps - position) * pps, hauteur = Math.max(3, note.duree * pps), y = bas - hauteur
    ctx.fillStyle = couleurs[note.midi % 12]; ctx.globalAlpha = .92; ctx.fillRect(g.x + 1, y, Math.max(2, g.largeur - 2), hauteur); ctx.globalAlpha = 1
    ctx.strokeStyle = '#ffffff55'; ctx.strokeRect(g.x + 1.5, y + .5, Math.max(1, g.largeur - 3), Math.max(1, hauteur - 1))
    if (touchesNoires.has(note.midi % 12) && hauteur >= 12) croix(ctx, g.x + g.largeur / 2, y + Math.min(10, hauteur / 2), Math.min(3.5, g.largeur / 5))
    if (hauteur >= 22 && g.largeur >= 19) { ctx.fillStyle = note.midi % 12 === 4 ? '#302b08' : '#101522'; ctx.font = `600 ${Math.min(11, g.largeur * .25)}px system-ui`; ctx.textAlign = 'center'; ctx.fillText(noms[note.midi % 12], g.x + g.largeur / 2, y + hauteur / 2 + 4, g.largeur - 4) }
  })

  ctx.shadowColor = '#9fdcff'; ctx.shadowBlur = 10; ctx.strokeStyle = '#c2e9ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, frappeY); ctx.lineTo(w, frappeY); ctx.stroke(); ctx.shadowBlur = 0
  const actives = morceau.notes.filter(n => n.midi >= debut && n.midi < fin && n.temps <= position && n.temps + n.duree > position)
  geo.blanches.forEach(midi => { const g = geo.touches.get(midi)!; const active = actives.find(n => n.midi === midi); ctx.fillStyle = active ? couleurs[midi % 12] : '#eef1f5'; ctx.fillRect(g.x, frappeY, g.largeur, clavierH); ctx.strokeStyle = '#69768a'; ctx.strokeRect(g.x, frappeY, g.largeur, clavierH); if (g.largeur > 23) { ctx.fillStyle = '#303847'; ctx.font = '10px system-ui'; ctx.textAlign = 'center'; ctx.fillText(noms[midi % 12], g.x + g.largeur / 2, h - 9) } })
  geo.notes.filter(n => touchesNoires.has(n % 12)).forEach(midi => { const g = geo.touches.get(midi)!; const active = actives.find(n => n.midi === midi); ctx.fillStyle = active ? couleurs[midi % 12] : '#111827'; ctx.fillRect(g.x, frappeY, g.largeur, clavierH * .64); ctx.strokeStyle = '#02050b'; ctx.strokeRect(g.x, frappeY, g.largeur, clavierH * .64) })
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
  const notesAudio = useMemo(() => {
    const uniques = new Map<string, NoteMidi>()
    morceau.notes.filter(note => note.midi >= 21 && note.midi <= 108).forEach(note => {
      const cle = `${note.ticks}:${note.midi}`, existante = uniques.get(cle)
      if (!existante || note.velocite > existante.velocite) uniques.set(cle, note)
    })
    return [...uniques.values()].sort((a, b) => a.temps - b.temps || a.midi - b.midi)
  }, [morceau])
  const notesLecture = timbre === 'piano' ? notesAudio : morceau.notes
  const plage = useMemo(() => { if (clavierComplet) return { debut: 21, fin: 109 }; const min = morceau.etendue?.min ?? 48, max = morceau.etendue?.max ?? 83; if (max - min > 60) return { debut: Math.max(0, min), fin: Math.min(128, max + 1) }; let debut = Math.floor(min / 12) * 12, fin = Math.ceil((max + 1) / 12) * 12; if (fin - debut < 24) { debut -= 12; fin += 12 } return { debut: Math.max(0, debut), fin: Math.min(128, fin) } }, [morceau, clavierComplet])
  useEffect(() => { const canvas = ref.current; if (!canvas) return; const rendu = () => dessiner(canvas, morceau, position, pps, plage.debut, plage.fin); const observer = new ResizeObserver(rendu); observer.observe(canvas); rendu(); return () => observer.disconnect() }, [morceau, position, pps, plage])
  useEffect(() => { positionRef.current = position }, [position])
  useEffect(() => {
    if (!lecture) return
    let animation = 0
    const avancer = () => {
      const audio = audioRef.current
      if (!audio) return
      const nouvellePosition = ancreMusicaleRef.current + (audio.currentTime - ancreAudioRef.current) * vitesse
      if (nouvellePosition >= morceau.duree) { setPosition(morceau.duree); setLecture(false); return }
      setPosition(nouvellePosition)
      animation = requestAnimationFrame(avancer)
    }
    animation = requestAnimationFrame(avancer)
    return () => cancelAnimationFrame(animation)
  }, [lecture, morceau.duree, vitesse])
  useEffect(() => {
    setLecture(false); setPosition(0); ancreMusicaleRef.current = 0
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
        if (note.temps > temps + 1 * vitesse) break
        prochaineNoteRef.current++
        if (note.temps + note.duree <= temps) continue
        const debut = Math.max(audio.currentTime, ancreAudioRef.current + (note.temps - ancreMusicaleRef.current) / vitesse)
        const duree = Math.max(.02, (note.duree - Math.max(0, temps - note.temps)) / vitesse)
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
  }, [lecture, sonActif, morceau, vitesse, timbre, notesLecture])
  useEffect(() => () => { couperVoix(); void audioRef.current?.close() }, [])

  function couperVoix() { pianoRef.current?.stop(); oscillateursRef.current.forEach(osc => { try { osc.stop() } catch {} }); oscillateursRef.current.clear() }
  async function chargerPiano(audio: AudioContext, sortie: GainNode) {
    if (pianoRef.current || chargementPiano) return
    setChargementPiano(true); setErreurPiano(false)
    try {
      pianoRef.current = await instrument(audio, 'acoustic_grand_piano', { soundfont: 'FluidR3_GM', format: 'mp3', destination: sortie, notes: [...new Set(notesAudio.map(note => nomSoundfont(note.midi)))] })
    } catch { setErreurPiano(true); setSonActif(false) }
    finally { setChargementPiano(false) }
  }
  function indexDepuis(temps: number) {
    let bas = 0, haut = notesLecture.length
    while (bas < haut) { const milieu = (bas + haut) >> 1; if (notesLecture[milieu].temps < temps) bas = milieu + 1; else haut = milieu }
    return bas
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
      const depart = position >= morceau.duree ? 0 : position
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

  function arreter() { setLecture(false); couperVoix(); setPosition(0); ancreMusicaleRef.current = 0; prochaineNoteRef.current = 0 }
  function changerVitesse(nouvelleVitesse: number) {
    let actuelle = position
    if (lecture && audioRef.current) actuelle = Math.min(morceau.duree, ancreMusicaleRef.current + (audioRef.current.currentTime - ancreAudioRef.current) * vitesse)
    couperVoix(); setPosition(actuelle); ancreMusicaleRef.current = actuelle; prochaineNoteRef.current = indexDepuis(actuelle)
    if (audioRef.current) ancreAudioRef.current = audioRef.current.currentTime
    setVitesse(nouvelleVitesse)
  }
  function deplacer(nouvellePosition: number) {
    const bornee = Math.max(0, Math.min(morceau.duree, nouvellePosition))
    couperVoix(); setPosition(bornee); ancreMusicaleRef.current = bornee; prochaineNoteRef.current = indexDepuis(bornee)
    if (lecture && audioRef.current) ancreAudioRef.current = audioRef.current.currentTime
  }

  return <section className="roll-step"><header><div><p className="eyebrow">Étape 5 · Son synchronisé</p><h2>Lecture visuelle du morceau</h2></div><div className="roll-readout"><strong>{position.toFixed(2)} s</strong><span>{noms[plage.debut % 12]}{Math.floor(plage.debut / 12) - 1} → {noms[(plage.fin - 1) % 12]}{Math.floor((plage.fin - 1) / 12) - 1}</span></div></header>
    <canvas ref={ref} className="roll-canvas" title="Faites défiler ou glissez verticalement pour naviguer dans le morceau" />
    <div className="transport"><button className={lecture ? 'pause' : 'play'} disabled={chargementPiano} onClick={() => void basculerLecture()} aria-label={lecture ? 'Mettre en pause' : 'Lire'}><span aria-hidden="true">{lecture ? 'Ⅱ' : '▶'}</span>{chargementPiano ? 'Chargement du piano…' : lecture ? 'Pause' : position >= morceau.duree ? 'Rejouer' : 'Lecture'}</button><button className="secondary" onClick={arreter} disabled={position === 0 && !lecture}>■ Arrêt</button><button className="secondary" onClick={() => { couperVoix(); setSonActif(actif => !actif); prochaineNoteRef.current = indexDepuis(position) }}>{sonActif ? 'Son activé' : 'Activer le son'}</button><label className="volume">Son<select disabled={lecture} value={timbre} onChange={e => { couperVoix(); setErreurPiano(false); setTimbre(e.target.value as 'synthese' | 'piano') }}><option value="synthese">Synthèse (fiable)</option><option value="piano">Piano échantillonné</option></select></label><button className="secondary keyboard-toggle" onClick={() => setClavierComplet(complet => !complet)}>{clavierComplet ? 'Clavier : complet' : 'Clavier : mini'}</button><label className="volume">Volume<input type="range" min="0" max="1" step="0.01" value={volume} onChange={e => setVolume(Number(e.target.value))} /></label></div>
    <div className="roll-controls"><label>Position dans le morceau<input type="range" min="0" max={morceau.duree} step="0.01" value={position} onChange={e => deplacer(Number(e.target.value))} /></label><label>Tempo<input type="range" min="0.25" max="1.5" step="0.05" value={vitesse} onChange={e => changerVitesse(Number(e.target.value))} /><span>{Math.round(vitesse * 100)} %</span></label><label>Échelle temporelle<input type="range" min="45" max="220" step="5" value={pps} onChange={e => setPps(Number(e.target.value))} /><span>{pps} px/s</span></label></div>
  </section>
}
