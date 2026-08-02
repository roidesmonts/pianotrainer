import { useEffect, useRef, useState } from 'react'

type Variante = 'reelle' | 'chromatique'
const noires = new Set([1, 3, 6, 8, 10])
const noms = ['Do', 'Do♯', 'Ré', 'Ré♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si']

function dessiner(canvas: HTMLCanvasElement, variante: Variante, debut: number, octaves: number) {
  const rect = canvas.getBoundingClientRect(), ratio = window.devicePixelRatio || 1
  canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio)
  const ctx = canvas.getContext('2d'); if (!ctx) return
  ctx.scale(ratio, ratio)
  const largeur = rect.width, hauteur = rect.height, clavierY = hauteur * .68, clavierH = hauteur - clavierY
  const nombreBlanches = octaves * 7, largeurBlanche = largeur / nombreBlanches, largeurNoire = largeurBlanche * .62
  const notes = Array.from({ length: octaves * 12 }, (_, i) => debut + i)
  const indexBlanche = (midi: number) => notes.slice(0, midi - debut).filter(n => !noires.has(n % 12)).length

  ctx.fillStyle = '#0b1425'; ctx.fillRect(0, 0, largeur, hauteur)
  ctx.strokeStyle = '#263651'; ctx.lineWidth = 1
  notes.forEach((midi, i) => {
    let x: number, w: number
    if (variante === 'chromatique') { w = largeur / notes.length; x = i * w }
    else if (noires.has(midi % 12)) { w = largeurNoire; x = indexBlanche(midi) * largeurBlanche - w / 2 }
    else { w = largeurBlanche; x = indexBlanche(midi) * largeurBlanche }
    ctx.strokeRect(Math.round(x) + .5, 0, Math.max(1, Math.round(w)), clavierY)
  })
  ctx.strokeStyle = '#9aabc5'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, clavierY); ctx.lineTo(largeur, clavierY); ctx.stroke()

  notes.filter(midi => !noires.has(midi % 12)).forEach(midi => {
    const x = indexBlanche(midi) * largeurBlanche
    ctx.fillStyle = '#e9edf2'; ctx.fillRect(x, clavierY, largeurBlanche, clavierH)
    ctx.strokeStyle = '#758197'; ctx.lineWidth = 1; ctx.strokeRect(x, clavierY, largeurBlanche, clavierH)
    if (largeurBlanche > 22) { ctx.fillStyle = '#303847'; ctx.font = '10px system-ui'; ctx.textAlign = 'center'; ctx.fillText(noms[midi % 12], x + largeurBlanche / 2, hauteur - 9) }
  })
  notes.filter(midi => noires.has(midi % 12)).forEach(midi => {
    const x = indexBlanche(midi) * largeurBlanche - largeurNoire / 2
    ctx.fillStyle = '#111827'; ctx.fillRect(x, clavierY, largeurNoire, clavierH * .64)
    ctx.strokeStyle = '#02050b'; ctx.strokeRect(x, clavierY, largeurNoire, clavierH * .64)
  })
  ctx.fillStyle = '#8190a8'; ctx.font = '11px system-ui'; ctx.textAlign = 'left'
  ctx.fillText(variante === 'reelle' ? 'Les couloirs épousent exactement chaque touche' : 'Les couloirs ont tous la même largeur', 12, 20)
}

function Clavier({ variante, debut, octaves }: { variante: Variante; debut: number; octaves: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return
    const rendu = () => dessiner(canvas, variante, debut, octaves)
    const observer = new ResizeObserver(rendu); observer.observe(canvas); rendu()
    return () => observer.disconnect()
  }, [variante, debut, octaves])
  return <canvas ref={ref} className="keyboard-canvas" />
}

export function KeyboardComparison() {
  const [octaveDepart, setOctaveDepart] = useState(2), [octaves, setOctaves] = useState(4)
  const debut = (octaveDepart + 1) * 12
  return <section className="keyboard-step">
    <header><div><p className="eyebrow">Étape 2 · Géométrie de référence</p><h2>Quel alignement vous paraît le plus naturel ?</h2><p>Les lignes verticales matérialisent les futurs couloirs de notes.</p></div>
      <div className="keyboard-controls"><label>Départ <select value={octaveDepart} onChange={e => setOctaveDepart(Number(e.target.value))}>{[0,1,2,3,4].map(o => <option key={o} value={o}>Do{o}</option>)}</select></label>
        <label>Étendue <select value={octaves} onChange={e => setOctaves(Number(e.target.value))}>{[2,3,4,5,6,7].map(o => <option key={o} value={o}>{o} octaves</option>)}</select></label></div></header>
    <div className="keyboard-grid"><article><div><span>A</span><h3>Alignement sur le clavier réel</h3><b>Recommandé</b></div><Clavier variante="reelle" debut={debut} octaves={octaves} /></article>
      <article><div><span>B</span><h3>Douze couloirs chromatiques égaux</h3></div><Clavier variante="chromatique" debut={debut} octaves={octaves} /></article></div>
  </section>
}
