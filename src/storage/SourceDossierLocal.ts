import type { EntreeMorceau, SourceBibliotheque } from '../types/midi'

export class SourceDossierLocal implements SourceBibliotheque {
  private readonly fichiers = new Map<string, File>()

  ajouter(fichier: File): EntreeMorceau {
    const id = `${fichier.name}:${fichier.size}:${fichier.lastModified}`
    this.fichiers.set(id, fichier)
    return { id, nom: fichier.name, chemin: fichier.name, taille: fichier.size }
  }

  async lister(): Promise<EntreeMorceau[]> {
    return [...this.fichiers.entries()].map(([id, fichier]) => ({
      id, nom: fichier.name, chemin: fichier.name, taille: fichier.size,
    }))
  }

  async chargerFichier(id: string): Promise<ArrayBuffer> {
    const fichier = this.fichiers.get(id)
    if (!fichier) throw new Error('Fichier local introuvable.')
    return fichier.arrayBuffer()
  }
}
