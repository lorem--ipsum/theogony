import { useCallback, useEffect, useMemo, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { entities, index } from './data'
import { CATEGORIES, CATEGORY_LABELS, type Categorie } from './data/categories'
import { focusSet } from './graph/buildGraph'
import { layoutKey } from './graph/elkGraph'
import { GraphView } from './components/GraphView'
import { DetailCard, EntityLink } from './components/DetailCard'
import { Toolbar, type ViewMode } from './components/Toolbar'
import { CategoryIcon } from './components/CategoryIcon'
import { Glossary } from './components/Glossary'
import { termById, termForCategory } from './data/glossary'

const DEFAULT_ID = 'zeus'

/** hauteur du panneau de détail sur mobile, en part de l'écran (cf. app.css) */
const SHEET_SHARE = { half: 0.52, full: 0.88, closed: 0 } as const

function useIsMobile() {
  const query = '(max-width: 767px)'
  const [m, setM] = useState(() => matchMedia(query).matches)
  useEffect(() => {
    const mq = matchMedia(query)
    const on = () => setM(mq.matches)
    // Safari < 14 ne connaît que addListener/removeListener
    if (mq.addEventListener) {
      mq.addEventListener('change', on)
      return () => mq.removeEventListener('change', on)
    }
    mq.addListener(on)
    return () => mq.removeListener(on)
  }, [])
  return m
}

type Route ={ entityId: string; glossary: null | { term?: string } }

const fallbackId = () => (index.byId.has(DEFAULT_ID) ? DEFAULT_ID : (entities[0]?.id ?? ''))

/** #/p/<id> → personnage ; #/g ou #/g/<terme> → glossaire (le graphe garde le dernier personnage) */
function readHash(prev?: Route): Route {
  const g = location.hash.match(/^#\/g(?:\/([a-z0-9-]+))?/)
  if (g) return { entityId: prev?.entityId ?? fallbackId(), glossary: { term: g[1] && termById.has(g[1]) ? g[1] : undefined } }
  const id = location.hash.match(/^#\/p\/([a-z0-9-]+)/)?.[1]
  return { entityId: id && index.byId.has(id) ? id : fallbackId(), glossary: null }
}

function useRoute() {
  const [route, setRoute] = useState<Route>(() => readHash())
  useEffect(() => {
    const on = () => setRoute((prev) => readHash(prev))
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const go = useCallback((hash: string) => {
    if (location.hash !== `#${hash}`) location.hash = hash
  }, [])
  const select = useCallback((id: string) => go(`/p/${id}`), [go])
  const openGlossary = useCallback((term?: string) => go(term ? `/g/${term}` : '/g'), [go])
  return { route, select, openGlossary }
}

export default function App() {
  const { route, select, openGlossary } = useRoute()
  const selectedId = route.entityId
  const [mode, setMode] = useState<ViewMode>('focus')
  const [categories, setCategories] = useState<Set<Categorie>>(() => new Set(CATEGORIES))
  const [tags, setTags] = useState<Set<string>>(() => new Set())
  const [sheet, setSheet] = useState<'half' | 'full' | 'closed'>('half')
  const isMobile = useIsMobile()

  const entity = index.byId.get(selectedId)

  useEffect(() => {
    if (route.glossary) document.title = 'Glossaire · Théogonie'
    else if (entity) document.title = `${entity.nom} · Théogonie`
  }, [entity, route.glossary])

  const handleOpenGlossary = useCallback(
    (term?: string) => {
      openGlossary(term)
      setSheet((s) => (s === 'closed' ? 'half' : s))
    },
    [openGlossary],
  )

  const toggleTag = useCallback((t: string) => {
    setTags((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }, [])

  const toggleCategory = useCallback((c: Categorie) => {
    setCategories((prev) => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })
  }, [])

  const handleSelect = useCallback(
    (id: string) => {
      select(id)
      setSheet((s) => (s === 'closed' ? 'half' : s))
    },
    [select],
  )

  /** entités correspondant à TOUS les tags actifs */
  const matches = useMemo(() => {
    if (tags.size === 0) return null
    return new Set(entities.filter((e) => [...tags].every((t) => e.tags.includes(t))).map((e) => e.id))
  }, [tags])

  const visible = useMemo(() => {
    const base = mode === 'focus' ? focusSet(index, selectedId) : new Set(entities.map((e) => e.id))
    const out = new Set<string>()
    for (const id of base) {
      const e = index.byId.get(id)
      if (e && (categories.has(e.categorie) || id === selectedId)) out.add(id)
    }
    return out
  }, [mode, selectedId, categories])

  const matchList = useMemo(
    () => (matches ? [...matches].sort((a, b) => index.byId.get(a)!.nom.localeCompare(index.byId.get(b)!.nom, 'fr')) : []),
    [matches],
  )

  return (
    <div className="app">
      <Toolbar
        onSelect={handleSelect}
        activeTags={tags}
        onToggleTag={toggleTag}
        categories={categories}
        onToggleCategory={toggleCategory}
        onAllCategories={() => setCategories(new Set(CATEGORIES))}
        mode={mode}
        onMode={setMode}
        glossaryOpen={route.glossary !== null}
        onOpenGlossary={handleOpenGlossary}
      />

      {tags.size > 0 && (
        <div className="tagbar">
          <span className="muted">Filtre :</span>
          {[...tags].map((t) => (
            <button type="button" key={t} className="tag is-on" onClick={() => toggleTag(t)} aria-label={`Retirer #${t}`}>
              #{t} <span aria-hidden="true">×</span>
            </button>
          ))}
          <span className="muted">{matches?.size ?? 0} résultat{(matches?.size ?? 0) > 1 ? 's' : ''}</span>
          <button type="button" className="linklike" onClick={() => setTags(new Set())}>
            Effacer
          </button>
        </div>
      )}

      <main className={`body sheet-${sheet}`}>
        <section className="master" aria-label="Arbre généalogique">
          <ReactFlowProvider>
            <GraphView
              visible={visible}
              selectedId={selectedId}
              highlight={matches}
              onSelect={handleSelect}
              mode={mode}
              layoutKey={categories.size === CATEGORIES.length ? layoutKey(mode, selectedId) : null}
              obscuredBottom={isMobile ? SHEET_SHARE[sheet] : 0}
            />
          </ReactFlowProvider>

          <div className="legend" aria-label="Légende">
            {CATEGORIES.map((c) => (
              <button
                type="button"
                key={c}
                className={`legend-item cat-${c}${categories.has(c) ? '' : ' is-off'}`}
                title={`Définition : ${CATEGORY_LABELS[c]}`}
                onClick={() => handleOpenGlossary(termForCategory.get(c)?.id)}
              >
                <CategoryIcon categorie={c} size={11} />
                <span>{CATEGORY_LABELS[c]}</span>
              </button>
            ))}
          </div>

          {matches && (
            <div className="results">
              <div className="results-head">
                {matchList.length} personnage{matchList.length > 1 ? 's' : ''}
                {mode === 'focus' && matchList.length > 0 && (
                  <button type="button" className="linklike" onClick={() => setMode('full')}>
                    Voir dans l'arbre complet
                  </button>
                )}
              </div>
              <div className="results-list">
                {matchList.length === 0 && <p className="muted">Aucun personnage n'a tous ces tags.</p>}
                {matchList.map((id) => (
                  <EntityLink key={id} id={id} onSelect={handleSelect} />
                ))}
              </div>
            </div>
          )}
        </section>

        <aside className="detail-pane" aria-label="Détail du personnage">
          <div className="sheet-handle">
            <button
              type="button"
              aria-label={sheet === 'full' ? 'Réduire le panneau' : 'Agrandir le panneau'}
              onClick={() => setSheet((s) => (s === 'full' ? 'half' : 'full'))}
            >
              <span />
            </button>
            <button type="button" className="sheet-close" aria-label="Fermer le panneau" onClick={() => setSheet('closed')}>
              ×
            </button>
          </div>
          <div className="detail-scroll">
            {route.glossary ? (
              <Glossary
                termId={route.glossary.term}
                backTo={selectedId}
                onSelect={handleSelect}
                onOpenTerm={handleOpenGlossary}
              />
            ) : entity ? (
              <DetailCard
                entity={entity}
                onSelect={handleSelect}
                activeTags={tags}
                onToggleTag={toggleTag}
                onOpenTerm={handleOpenGlossary}
              />
            ) : (
              <p className="muted pad">Aucune donnée chargée.</p>
            )}
          </div>
        </aside>
      </main>
    </div>
  )
}
