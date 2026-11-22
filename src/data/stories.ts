import { useEffect, useState } from 'react'
import type { Histoire } from './schema'

type Mention = { from: string; titre: string }
type Stories = { byId: Record<string, Histoire[]>; mentions: Map<string, Mention[]> }

let loaded: Stories | null = null
let pending: Promise<Stories> | null = null

/**
 * Les histoires (≈ 3/4 des données) sont chargées à part, après le démarrage.
 * L'index « apparaît aussi dans » en est déduit une fois pour toutes.
 */
export function loadStories(): Promise<Stories> {
  return (pending ??= import('../generated/stories.json').then((m) => {
    const byId = m.default as unknown as Record<string, Histoire[]>
    const mentions = new Map<string, Mention[]>()
    for (const [from, list] of Object.entries(byId))
      for (const h of list)
        for (const pid of h.personnages ?? []) {
          if (pid === from) continue
          const arr = mentions.get(pid)
          if (arr) arr.push({ from, titre: h.titre })
          else mentions.set(pid, [{ from, titre: h.titre }])
        }
    return (loaded = { byId, mentions })
  }))
}

/** Histoires d'un personnage et mentions ailleurs ; `null` tant qu'elles ne sont pas chargées. */
export function useStories(id: string): { histoires: Histoire[]; mentions: Mention[] } | null {
  const [, force] = useState(0)
  useEffect(() => {
    if (!loaded) loadStories().then(() => force((n) => n + 1))
  }, [])
  return loaded ? { histoires: loaded.byId[id] ?? [], mentions: loaded.mentions.get(id) ?? [] } : null
}
