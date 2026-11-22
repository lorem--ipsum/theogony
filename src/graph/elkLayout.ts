/**
 * Calcul de mise en page à la volée (ELK dans un Web Worker).
 * Chargé à la demande seulement : le cas courant utilise les positions précalculées.
 */
import ELK from 'elkjs/lib/elk-api.js'
import workerUrl from 'elkjs/lib/elk-worker.min.js?url'
import type { Graph } from './buildGraph'
import { fromElk, toElk, type Layout } from './elkGraph'

const elk = new ELK({ workerFactory: () => new Worker(workerUrl) })

export async function elkLayout(graph: Graph, full: boolean): Promise<Layout> {
  return fromElk(await elk.layout(toElk(graph, full)), true)
}
