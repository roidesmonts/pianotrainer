import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const dossierMidi = path.resolve(process.cwd(), '../midi')
const dossierRecherche = path.resolve(process.cwd(), 'research/fingering')
const dossierAnnotations = path.join(dossierRecherche, 'generated/internal-v1')
const dossierPartitions = path.join(dossierRecherche, 'data/PianoFingeringDataset_v1.2/ScorePDF')
const modeleDoigtesLocal = path.join(dossierRecherche, 'artifacts/joint-fingering-v1/portable-model.json')
const sourceDoigtes = path.join(dossierRecherche, 'vendor/SourceCode')
const binaireFhmm3 = path.join(sourceDoigtes, 'Binary/FingeringHMM3_Run')
const parametresFhmm3 = path.join(dossierRecherche, 'artifacts/retrained-v1.2/parameters/param_FHMM3.txt')
const executer = promisify(execFile)
async function listerMidi(dossier = dossierMidi): Promise<string[]> {
  const entrees = await fs.readdir(dossier, { withFileTypes: true })
  const listes = await Promise.all(entrees.map(async (entree) => {
    const chemin = path.join(dossier, entree.name)
    if (entree.isDirectory()) return listerMidi(chemin)
    return /\.midi?$/i.test(entree.name) ? [path.relative(dossierMidi, chemin).split(path.sep).join('/')] : []
  }))
  return listes.flat()
}
const bibliothequeMidi = () => ({
  name: 'bibliotheque-midi-locale',
  configureServer(server: ServeurVite) { configurerBibliotheque(server) },
  configurePreviewServer(server: ServeurVite) { configurerBibliotheque(server) },
})
const rechercheDoigtes = () => ({
  name: 'recherche-doigtes-locale',
  configureServer(server: ServeurVite) { configurerRecherche(server) },
  configurePreviewServer(server: ServeurVite) { configurerRecherche(server) },
})
type ServeurVite = { middlewares: { use: (route: string, handler: (req: IncomingMessage, res: ServerResponse) => void) => void } }
const hauteurAnglaise = (midi: number) => `${['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][midi % 12]}${Math.floor(midi / 12) - 1}`
async function lireJson(req: IncomingMessage, limite = 8 * 1024 * 1024) {
  const morceaux: Buffer[] = []; let taille = 0
  for await (const morceau of req) { const buffer = Buffer.from(morceau); taille += buffer.length; if (taille > limite) throw new Error('Requête trop volumineuse'); morceaux.push(buffer) }
  return JSON.parse(Buffer.concat(morceaux).toString('utf8'))
}
function configurerBibliotheque(server: ServeurVite) {
    server.middlewares.use('/api/midi-library', async (_req, res) => {
      try {
        const chemins = (await listerMidi()).sort((a, b) => a.localeCompare(b, 'fr'))
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify(chemins.map((chemin) => ({ id: chemin, nom: path.basename(chemin), chemin }))))
      } catch { res.statusCode = 500; res.end('Bibliothèque indisponible') }
    })
    server.middlewares.use('/midi-library', async (req, res) => {
      try {
        const relatif = decodeURIComponent((req.url ?? '').replace(/^\//, ''))
        const absolu = path.resolve(dossierMidi, relatif)
        if (!absolu.startsWith(`${dossierMidi}${path.sep}`) || !/\.midi?$/i.test(absolu)) { res.statusCode = 403; res.end('Accès refusé'); return }
        res.setHeader('Content-Type', 'audio/midi'); res.end(await fs.readFile(absolu))
      } catch { res.statusCode = 404; res.end('Fichier introuvable') }
    })
}
function cheminLocalSecurise(racine: string, url: string, extension: RegExp) {
  const relatif = decodeURIComponent(url.replace(/^\//, ''))
  const absolu = path.resolve(racine, relatif)
  return absolu.startsWith(`${racine}${path.sep}`) && extension.test(absolu) ? absolu : null
}
async function configurerIndexRecherche() {
  const [annotations, partitions] = await Promise.all([
    fs.readdir(dossierAnnotations),
    fs.readdir(dossierPartitions),
  ])
  const pdfParPiece = new Map(partitions.filter((nom) => /\.pdf$/i.test(nom)).map((nom) => [nom.slice(0, 3), nom]))
  const oeuvres = new Map<string, { pieceId: string; title: string; pdf: string | null; annotations: string[] }>()
  for (const nom of annotations.filter((nom) => /^\d+-\d+\.json$/.test(nom))) {
    const pieceId = nom.slice(0, 3)
    const pdf = pdfParPiece.get(pieceId) ?? null
    const title = pdf ? pdf.replace(/^\d+_/, '').replace(/\.pdf$/i, '').replace(/_/g, ' ') : `Œuvre ${pieceId}`
    const oeuvre = oeuvres.get(pieceId) ?? { pieceId, title, pdf, annotations: [] }
    oeuvre.annotations.push(nom)
    oeuvres.set(pieceId, oeuvre)
  }
  return [...oeuvres.values()].sort((a, b) => a.pieceId.localeCompare(b.pieceId, 'en', { numeric: true }))
}
function configurerRecherche(server: ServeurVite) {
  server.middlewares.use('/api/fingering-model', async (_req, res) => {
    try { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(await fs.readFile(modeleDoigtesLocal)) }
    catch { res.statusCode = 503; res.end(JSON.stringify({ error: 'Modèle PIG local absent. Lancez npm run export:fingering-model:local.' })) }
  })
  server.middlewares.use('/api/fingering-fhmm3', async (req, res) => {
    if (req.method !== 'POST') { res.statusCode = 405; res.end('POST requis'); return }
    let temporaire = ''
    try {
      const payload = await lireJson(req)
      if (!Array.isArray(payload.notes) || payload.notes.length > 30000) throw new Error('Liste de notes invalide')
      const notes = payload.notes.map((note: any, index: number) => {
        if (!Number.isInteger(note.midi) || note.midi < 0 || note.midi > 127 || !Number.isFinite(note.onset) || !Number.isFinite(note.offset) || !['left','right'].includes(note.hand)) throw new Error(`Note ${index} invalide`)
        return { midi: note.midi, onset: note.onset, offset: Math.max(note.onset, note.offset), hand: note.hand as 'left'|'right' }
      })
      temporaire = await fs.mkdtemp(path.join(os.tmpdir(), 'piano-trainer-fhmm3-'))
      const entree = path.join(temporaire, 'input.txt'), sortie = path.join(temporaire, 'output.txt')
      const texte = notes.map((note, index) => `${index}\t${note.onset}\t${note.offset}\t${hauteurAnglaise(note.midi)}\t80\t80\t${note.hand === 'right' ? 0 : 1}\t${note.hand === 'right' ? 1 : -1}`).join('\n') + '\n'
      await fs.writeFile(entree, texte)
      await executer(binaireFhmm3, [parametresFhmm3, entree, sortie, '0.448', '0.292', '0.194', '0.470', '0.504', '-5'], { maxBuffer: 20 * 1024 * 1024 })
      const fingers = (await fs.readFile(sortie, 'utf8')).split(/\r?\n/).filter((line) => line.trim() && !line.startsWith('//')).map((line) => { const fields = line.trim().split(/\s+/); return Math.abs(Number(fields[fields.length - 1])) })
      if (fingers.length !== notes.length || fingers.some((finger) => !Number.isInteger(finger) || finger < 1 || finger > 5)) throw new Error('Sortie FHMM3 invalide')
      res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify({ fingers, model: 'FHMM3-retrained-v1.2' }))
    } catch (error) { res.statusCode = 503; res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'FHMM3 indisponible' })) }
    finally { if (temporaire) await fs.rm(temporaire, { recursive: true, force: true }) }
  })
  server.middlewares.use('/api/fingering-research', async (_req, res) => {
    try {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify(await configurerIndexRecherche()))
    } catch {
      res.statusCode = 503
      res.end(JSON.stringify({ error: 'Lancez npm run convert:pig pour préparer les données de recherche.' }))
    }
  })
  server.middlewares.use('/fingering-research/annotations', async (req, res) => {
    const fichier = cheminLocalSecurise(dossierAnnotations, req.url ?? '', /\.json$/i)
    if (!fichier) { res.statusCode = 403; res.end('Accès refusé'); return }
    try { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(await fs.readFile(fichier)) }
    catch { res.statusCode = 404; res.end('Annotation introuvable') }
  })
  server.middlewares.use('/fingering-research/scores', async (req, res) => {
    const fichier = cheminLocalSecurise(dossierPartitions, req.url ?? '', /\.pdf$/i)
    if (!fichier) { res.statusCode = 403; res.end('Accès refusé'); return }
    try { res.setHeader('Content-Type', 'application/pdf'); res.end(await fs.readFile(fichier)) }
    catch { res.statusCode = 404; res.end('Partition introuvable') }
  })
}
export default defineConfig({ plugins: [react(), bibliothequeMidi(), rechercheDoigtes()] })
