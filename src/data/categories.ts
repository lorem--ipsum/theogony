// Constantes sans dépendance (pas de zod) : importables par l'appli.
export const CATEGORIES = [
  'primordial',
  'titan',
  'olympien',
  'dieu',
  'demi-dieu',
  'heros',
  'nymphe',
  'mortel',
  'monstre',
  'creature',
] as const

export type Categorie = (typeof CATEGORIES)[number]

export const CATEGORY_LABELS: Record<Categorie, string> = {
  primordial: 'Primordial',
  titan: 'Titan',
  olympien: 'Olympien',
  dieu: 'Divinité',
  'demi-dieu': 'Demi-dieu',
  heros: 'Héros',
  nymphe: 'Nymphe',
  mortel: 'Mortel',
  monstre: 'Monstre',
  creature: 'Créature',
}
