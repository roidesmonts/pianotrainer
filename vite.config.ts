import fs from 'node:fs/promises'
import type { ServerResponse } from 'node:http'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const dossierMidi = path.resolve(process.cwd(), '../midi')
const dossierRecherche = path.resolve(process.cwd(), 'research/fingering')
const dossierAnnotations = path.join(dossierRecherche, 'generated/internal-v1')
const dossierPartitions = path.join(dossierRecherche, 'data/PianoFingeringDataset_v1.2/ScorePDF')
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
type ServeurVite = { middlewares: { use: (route: string, handler: (req: { url?: string }, res: ServerResponse) => void) => void } }
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
