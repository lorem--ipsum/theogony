import { index } from '../data'
import { primaryFiliation, siblingsOf } from '../data/model'
import { CATEGORY_LABELS } from '../data/categories'
import type { Entity } from '../data/schema'
import { CategoryIcon } from './CategoryIcon'
import { termForCategory } from '../data/glossary'

type Props = {
  entity: Entity
  onSelect: (id: string) => void
  activeTags: Set<string>
  onToggleTag: (tag: string) => void
  onOpenTerm: (id?: string) => void
}

function byName(a: string, b: string) {
  return (index.byId.get(a)?.nom ?? a).localeCompare(index.byId.get(b)?.nom ?? b, 'fr')
}

export function EntityLink({ id, onSelect }: { id: string; onSelect: (id: string) => void }) {
  const e = index.byId.get(id)
  if (!e) return null
  return (
    <button type="button" className={`elink cat-${e.categorie}`} onClick={() => onSelect(id)}>
      <CategoryIcon categorie={e.categorie} size={12} />
      {e.nom}
    </button>
  )
}

function LinkList({ ids, onSelect }: { ids: string[]; onSelect: (id: string) => void }) {
  return (
    <div className="links">
      {ids.map((id) => (
        <EntityLink key={id} id={id} onSelect={onSelect} />
      ))}
    </div>
  )
}

export function DetailCard({ entity: e, onSelect, activeTags, onToggleTag, onOpenTerm }: Props) {
  const main = primaryFiliation(e)
  const variants = e.filiations.filter((f) => f !== main && f.parents.length > 0)
  const children = [...(index.children.get(e.id) ?? [])].sort(byName)
  const spouses = [...(index.spouses.get(e.id) ?? [])].sort(byName)
  const siblings = new Set(siblingsOf(index, e.id))
  const mentions = index.mentions.get(e.id) ?? []
  const noteFor = (id: string) => e.unions?.find((u) => u.avec === id)?.note

  return (
    <article className="detail" key={e.id}>
      <header className="detail-head">
        <button
          type="button"
          className={`badge cat-${e.categorie}`}
          title="Voir la définition dans le glossaire"
          onClick={() => onOpenTerm(termForCategory.get(e.categorie)?.id)}
        >
          <CategoryIcon categorie={e.categorie} size={13} />
          {CATEGORY_LABELS[e.categorie]}
          <span className="badge-info" aria-hidden="true">?</span>
        </button>
        <h1>
          {e.nom} {e.grec && <span className="greek" lang="grc">{e.grec}</span>}
        </h1>
        {(e.epithete || e.romain) && (
          <p className="subtitle">
            {e.epithete}
            {e.epithete && e.romain && ' · '}
            {e.romain && <>Chez les Romains : {e.romain}</>}
          </p>
        )}
        <div className="tags">
          {e.tags.map((t) => (
            <button
              type="button"
              key={t}
              className={`tag${activeTags.has(t) ? ' is-on' : ''}`}
              onClick={() => onToggleTag(t)}
              title={activeTags.has(t) ? 'Retirer ce filtre' : 'Filtrer par ce tag'}
            >
              #{t}
            </button>
          ))}
        </div>
      </header>

      {(e.domaines?.length || e.symboles?.length) && (
        <section className="facts">
          {e.domaines?.length ? (
            <div>
              <h3>Domaines</h3>
              <p>{e.domaines.join(', ')}</p>
            </div>
          ) : null}
          {e.symboles?.length ? (
            <div>
              <h3>Symboles</h3>
              <p>{e.symboles.join(', ')}</p>
            </div>
          ) : null}
        </section>
      )}

      <section className="family">
        <h2>Famille</h2>
        <dl>
          <dt>Parents</dt>
          <dd>
            {main && main.parents.length ? (
              <>
                <LinkList ids={main.parents} onSelect={onSelect} />
                {main.source && <span className="src">{main.source}</span>}
              </>
            ) : (
              <span className="muted">{e.categorie === 'primordial' ? 'Aucun : entité primordiale' : 'Non connus'}</span>
            )}
            {variants.map((v, i) => (
              <div className="variant" key={i}>
                <span className="muted">Variante{v.source ? ` (${v.source})` : ''} :</span>
                <LinkList ids={v.parents} onSelect={onSelect} />
              </div>
            ))}
          </dd>
          {spouses.length > 0 && (
            <>
              <dt>Unions</dt>
              <dd>
                <div className="links">
                  {spouses.map((s) => (
                    <span key={s} className="with-note">
                      <EntityLink id={s} onSelect={onSelect} />
                      {noteFor(s) && <span className="src">{noteFor(s)}</span>}
                    </span>
                  ))}
                </div>
              </dd>
            </>
          )}
          {children.length > 0 && (
            <>
              <dt>Enfants <span className="count">{children.length}</span></dt>
              <dd>
                <LinkList ids={children} onSelect={onSelect} />
              </dd>
            </>
          )}
          {siblings.size > 0 && (
            <>
              <dt>Fratrie <span className="count">{siblings.size}</span></dt>
              <dd>
                <LinkList ids={[...siblings].sort(byName)} onSelect={onSelect} />
              </dd>
            </>
          )}
        </dl>
      </section>

      <section className="stories">
        <h2>Histoires</h2>
        {e.histoires.length === 0 && <p className="muted">Aucune histoire pour l'instant.</p>}
        {e.histoires.map((h, i) => (
          <div className="story" key={i}>
            <h3>{h.titre}</h3>
            <p>{h.resume}</p>
            {h.personnages && h.personnages.filter((p) => p !== e.id).length > 0 && (
              <LinkList ids={h.personnages.filter((p) => p !== e.id)} onSelect={onSelect} />
            )}
            {h.sources?.length ? <p className="src">Sources : {h.sources.join(' ; ')}</p> : null}
          </div>
        ))}
      </section>

      {mentions.length > 0 && (
        <section className="mentions">
          <h2>Apparaît aussi dans</h2>
          <ul>
            {mentions.map((m, i) => (
              <li key={i}>
                <EntityLink id={m.from} onSelect={onSelect} /> <span>{m.titre}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}
