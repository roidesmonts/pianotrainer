import fs from 'node:fs/promises'
import type { ServerResponse } from 'node:http'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const dossierMidi = path.resolve(process.cwd(), '../midi')
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
  configureServer(server: { middlewares: { use: (route: string, handler: (req: { url?: string }, res: ServerResponse) => void) => void } }) {
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
  },
})
export default defineConfig({ plugins: [react(), bibliothequeMidi()] })
