import { useEffect, useMemo, useRef, useState } from 'react'
import Fuse from 'fuse.js'
import { entities } from '../data'
import { CATEGORIES, CATEGORY_LABELS, type Categorie } from '../data/categories'
import { CategoryIcon } from './CategoryIcon'
import { terms } from '../data/glossary'

export type ViewMode = 'focus' | 'full'

type Suggestion =
  | { type: 'entity'; id: string; nom: string; categorie: Categorie; hint?: string }
  | { type: 'tag'; tag: string; count: number }
  | { type: 'term'; id: string; terme: string }

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

const tagCounts = new Map<string, number>()
for (const e of entities) for (const t of e.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)
const usedTags = [...tagCounts.keys()].sort((a, b) => a.localeCompare(b, 'fr'))

const fuse = new Fuse(entities, {
  keys: [
    { name: 'nom', weight: 3 },
    { name: 'romain', weight: 2 },
    { name: 'grec', weight: 1 },
    { name: 'epithete', weight: 1 },
    { name: 'domaines', weight: 1 },
    { name: 'tags', weight: 1.5 },
  ],
  threshold: 0.32,
  ignoreLocation: true,
  ignoreDiacritics: true,
})

type Props = {
  onSelect: (id: string) => void
  activeTags: Set<string>
  onToggleTag: (tag: string) => void
  categories: Set<Categorie>
  onToggleCategory: (c: Categorie) => void
  onAllCategories: () => void
  mode: ViewMode
  onMode: (m: ViewMode) => void
  glossaryOpen: boolean
  onOpenGlossary: (term?: string) => void
}

function BookIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 3.5c2-.8 3.8-.6 5.5.6v9c-1.7-1.2-3.5-1.4-5.5-.6zM13.5 3.5c-2-.8-3.8-.6-5.5.6v9c1.7-1.2 3.5-1.4 5.5-.6z" />
    </svg>
  )
}

export function Toolbar(p: Props) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(0)
  const [catOpen, setCatOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const catRef = useRef<HTMLDivElement>(null)

  const suggestions: Suggestion[] = useMemo(() => {
    const query = q.trim()
    if (!query) return []
    const tagQuery = normalize(query.replace(/^#/, ''))
    const rank = (t: string) => {
      const n = normalize(t)
      return n === tagQuery ? 0 : n.startsWith(tagQuery) ? 1 : n.split(/[\s']/).some((w) => w.startsWith(tagQuery)) ? 2 : 3
    }
    const tags: Suggestion[] = usedTags
      .filter((t) => normalize(t).includes(tagQuery))
      .sort((a, b) => rank(a) - rank(b))
      .slice(0, query.startsWith('#') ? 12 : 4)
      .map((tag) => ({ type: 'tag', tag, count: tagCounts.get(tag) ?? 0 }))
    if (query.startsWith('#')) return tags
    const ents: Suggestion[] = fuse.search(query, { limit: 8 }).map(({ item }) => ({
      type: 'entity',
      id: item.id,
      nom: item.nom,
      categorie: item.categorie,
      hint: item.epithete ?? CATEGORY_LABELS[item.categorie],
    }))
    const termHits: Suggestion[] = terms
      .filter((t) => normalize(t.terme).includes(tagQuery))
      .slice(0, 3)
      .map((t) => ({ type: 'term', id: t.id, terme: t.terme }))
    const isPrefix = (s: Suggestion) => s.type === 'term' && normalize(s.terme).startsWith(tagQuery)
    return [...termHits.filter(isPrefix), ...ents, ...termHits.filter((s) => !isPrefix(s)), ...tags]
  }, [q])

  useEffect(() => setCursor(0), [q])

  useEffect(() => {
    const onDoc = (ev: MouseEvent) => {
      if (!boxRef.current?.contains(ev.target as Node)) setOpen(false)
      if (!catRef.current?.contains(ev.target as Node)) setCatOpen(false)
    }
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        ev.preventDefault()
        boxRef.current?.querySelector('input')?.focus()
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const choose = (s: Suggestion) => {
    if (s.type === 'entity') p.onSelect(s.id)
    else if (s.type === 'term') p.onOpenGlossary(s.id)
    else if (!p.activeTags.has(s.tag)) p.onToggleTag(s.tag)
    setQ('')
    setOpen(false)
  }

  const allCats = p.categories.size === CATEGORIES.length

  return (
    <header className="toolbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">Θ</span>
        <span className="brand-name">Théogonie</span>
      </div>

      <div className="search" ref={boxRef}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="search-icon">
          <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={q}
          placeholder="Rechercher un personnage ou #tag"
          aria-label="Rechercher"
          onChange={(ev) => {
            setQ(ev.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(ev) => {
            if (ev.key === 'ArrowDown') {
              ev.preventDefault()
              setCursor((c) => Math.min(c + 1, suggestions.length - 1))
            } else if (ev.key === 'ArrowUp') {
              ev.preventDefault()
              setCursor((c) => Math.max(c - 1, 0))
            } else if (ev.key === 'Enter' && suggestions[cursor]) {
              choose(suggestions[cursor])
            } else if (ev.key === 'Escape') {
              setOpen(false)
              ;(ev.target as HTMLInputElement).blur()
            }
          }}
        />
        {open && suggestions.length > 0 && (
          <ul className="suggest" role="listbox">
            {suggestions.map((s, i) => (
              <li
                key={s.type === 'tag' ? '#' + s.tag : s.type + ':' + s.id}
                role="option"
                aria-selected={i === cursor}
                className={i === cursor ? 'is-cursor' : ''}
                onMouseEnter={() => setCursor(i)}
                onMouseDown={(ev) => {
                  ev.preventDefault()
                  choose(s)
                }}
              >
                {s.type === 'entity' ? (
                  <>
                    <span className={`sicon cat-${s.categorie}`}>
                      <CategoryIcon categorie={s.categorie} size={13} />
                    </span>
                    <span className="sname">{s.nom}</span>
                    <span className="shint">{s.hint}</span>
                  </>
                ) : s.type === 'term' ? (
                  <>
                    <span className="sicon tagicon">
                      <BookIcon />
                    </span>
                    <span className="sname">{s.terme}</span>
                    <span className="shint">Définition</span>
                  </>
                ) : (
                  <>
                    <span className="sicon tagicon">#</span>
                    <span className="sname">{s.tag}</span>
                    <span className="shint">{s.count} personnages</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="tools">
        <div className="dropdown" ref={catRef}>
          <button type="button" className="btn" aria-expanded={catOpen} onClick={() => setCatOpen((o) => !o)}>
            <span>Catégories</span>
            {!allCats && <span className="count">{p.categories.size}</span>}
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
          {catOpen && (
            <div className="menu">
              {CATEGORIES.map((c) => (
                <label key={c} className="menu-item">
                  <input type="checkbox" checked={p.categories.has(c)} onChange={() => p.onToggleCategory(c)} />
                  <span className={`sicon cat-${c}`}>
                    <CategoryIcon categorie={c} size={12} />
                  </span>
                  <span>{CATEGORY_LABELS[c]}</span>
                </label>
              ))}
              <button type="button" className="menu-reset" onClick={p.onAllCategories}>
                Tout afficher
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          className={`btn${p.glossaryOpen ? ' is-on' : ''}`}
          aria-pressed={p.glossaryOpen}
          onClick={() => p.onOpenGlossary()}
        >
          <BookIcon />
          <span>Glossaire</span>
        </button>

        <div className="segmented" role="group" aria-label="Mode d'affichage">
          <button type="button" aria-pressed={p.mode === 'focus'} onClick={() => p.onMode('focus')}>
            Focalisée
          </button>
          <button type="button" aria-pressed={p.mode === 'full'} onClick={() => p.onMode('full')}>
            Complète
          </button>
        </div>
      </div>
    </header>
  )
}
