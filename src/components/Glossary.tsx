import { useEffect, useMemo, useRef, useState } from 'react'
import { index } from '../data'
import { termById, terms } from '../data/glossary'
import { EntityLink } from './DetailCard'

type Props = {
  termId?: string
  backTo?: string
  onSelect: (id: string) => void
  onOpenTerm: (id?: string) => void
}

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const letterOf = (s: string) => normalize(s)[0].toUpperCase()

export function Glossary({ termId, backTo, onSelect, onOpenTerm }: Props) {
  const [q, setQ] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const n = normalize(q.trim())
    if (!n) return terms
    return terms.filter((t) => normalize(t.terme).includes(n) || normalize(t.definition).includes(n))
  }, [q])

  const groups = useMemo(() => {
    const m = new Map<string, typeof terms>()
    for (const t of filtered) {
      const l = letterOf(t.terme)
      m.set(l, [...(m.get(l) ?? []), t])
    }
    return [...m.entries()]
  }, [filtered])

  // amène le terme demandé à l'écran
  useEffect(() => {
    if (!termId) return
    setQ('')
    requestAnimationFrame(() => {
      rootRef.current?.querySelector(`#g-${termId}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    })
  }, [termId])

  const back = backTo ? index.byId.get(backTo) : undefined

  return (
    <div className="glossary" ref={rootRef}>
      <header className="glossary-head">
        {back && (
          <button type="button" className="linklike back" onClick={() => onSelect(back.id)}>
            ← Retour à {back.nom}
          </button>
        )}
        <h1>Glossaire</h1>
        <p className="subtitle">Les mots de la mythologie grecque, et les catégories utilisées dans l'arbre.</p>
        <input
          type="search"
          className="glossary-filter"
          placeholder="Filtrer les définitions"
          aria-label="Filtrer le glossaire"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <nav className="letters" aria-label="Lettres">
          {groups.map(([l]) => (
            <a key={l} href={`#g-letter-${l}`} onClick={(e) => {
              e.preventDefault()
              rootRef.current?.querySelector(`#g-letter-${l}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
            }}>
              {l}
            </a>
          ))}
        </nav>
      </header>

      {filtered.length === 0 && <p className="muted">Aucun terme ne correspond à « {q} ».</p>}

      {groups.map(([letter, items]) => (
        <section key={letter} className="glossary-group">
          <h2 id={`g-letter-${letter}`}>{letter}</h2>
          {items.map((t) => (
            <article key={t.id} id={`g-${t.id}`} className={`term${t.id === termId ? ' is-current' : ''}`}>
              <h3>
                {t.terme}
                {t.categorie && <span className={`badge small cat-${t.categorie}`}>Catégorie de l'arbre</span>}
              </h3>
              <p>{t.definition}</p>
              {t.exemples?.length ? (
                <div className="term-row">
                  <span className="muted">Exemples</span>
                  <div className="links">
                    {t.exemples.map((id) => (
                      <EntityLink key={id} id={id} onSelect={onSelect} />
                    ))}
                  </div>
                </div>
              ) : null}
              {t.voir?.length ? (
                <div className="term-row">
                  <span className="muted">Voir aussi</span>
                  <div className="links">
                    {t.voir.map((v) => (
                      <button key={v} type="button" className="termlink" onClick={() => onOpenTerm(v)}>
                        {termById.get(v)?.terme ?? v}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </section>
      ))}
    </div>
  )
}
