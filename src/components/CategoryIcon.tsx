import type { Categorie } from '../data/categories'

/** Petites icônes (traits) par catégorie, dessinées sur une grille 16×16. */
const PATHS: Record<Categorie, string> = {
  primordial: 'M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2Zm0 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z',
  titan: 'M3 13h10M4 13V6l4-3 4 3v7M7 13v-3h2v3',
  olympien: 'M2 6h12M3 6l5-3 5 3M4 6v6M8 6v6M12 6v6M2 13h12',
  dieu: 'M8 2l1.6 3.6L13 6l-2.6 2.4.7 3.6L8 10.2 4.9 12l.7-3.6L3 6l3.4-.4Z',
  'demi-dieu': 'M8 2v12M4 6l4-4 4 4M5 10h6',
  heros: 'M4 3h8v4a4 4 0 0 1-8 0Zm4 8v3M5.5 14h5',
  nymphe: 'M8 14V7M8 7C8 4 10 2.5 13 2.5 13 5.5 11 7 8 7ZM8 9C8 6.5 6 5 3 5c0 3 2 4 5 4Z',
  mortel: 'M8 3a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3.5 14c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5',
  monstre: 'M3 12c1-6 3-9 5-9s4 3 5 9M6 8h.01M10 8h.01M6 11l1 1 1-1 1 1 1-1',
  creature: 'M3 11c0-3 2-5 5-5 2 0 3-2 5-2-1 2 0 4-1 6-1 2-3 3-5 3H5M5 13v-2M9 13v-1.5',
}

export function CategoryIcon({ categorie, size = 14 }: { categorie: Categorie; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="caticon"
    >
      <path d={PATHS[categorie]} />
    </svg>
  )
}
