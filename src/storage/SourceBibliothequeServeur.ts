import type { EntreeMorceau, SourceBibliotheque } from '../types/midi'

export class SourceBibliothequeServeur implements SourceBibliotheque {
  async lister(): Promise<EntreeMorceau[]> {
    const reponse = await fetch('/api/midi-library')
    if (!reponse.ok) throw new Error('La bibliothèque du serveur est indisponible.')
    const entrees = await reponse.json() as Array<Omit<EntreeMorceau, 'taille'>>
    return entrees.map((entree) => ({ ...entree, taille: 0 }))
  }
  async chargerFichier(id: string): Promise<ArrayBuffer> {
    const chemin = id.split('/').map(encodeURIComponent).join('/')
    const reponse = await fetch(`/midi-library/${chemin}`)
    if (!reponse.ok) throw new Error('Le fichier MIDI sélectionné est introuvable.')
    return reponse.arrayBuffer()
  }
}
