import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BaseEdge,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  type Viewport,
} from '@xyflow/react'
import { index } from '../data'
import type { Categorie } from '../data/categories'
import { buildGraph, lineageOf, type Graph } from '../graph/buildGraph'
import type { Layout } from '../graph/elkGraph'
import { layoutGraph } from '../graph/layout'
import { CategoryIcon } from './CategoryIcon'

/** `badge` : nom affiché même en zoom éloigné (lignée ou résultats peu nombreux) */
type EntityData = { label: string; categorie: Categorie; selected: boolean; dim: boolean; match: boolean; badge: boolean }
type EntityNodeT = Node<EntityData, 'entity'>
type UnionNodeT = Node<{ dim: boolean }, 'union'>
type RoutedEdgeT = Edge<{ points: [number, number][] }, 'routed'>

const EntityNode = memo(function EntityNode({ data }: NodeProps<EntityNodeT>) {
  const cls = ['gnode', `cat-${data.categorie}`]
  if (data.selected) cls.push('is-selected')
  if (data.dim) cls.push('is-dim')
  if (data.match) cls.push('is-match')
  if (data.badge) cls.push('is-badge')
  return (
    <div className={cls.join(' ')} title={data.label}>
      <Handle type="target" position={Position.Top} className="ghandle" isConnectable={false} />
      <CategoryIcon categorie={data.categorie} size={13} />
      <span>{data.label}</span>
      <Handle type="source" position={Position.Bottom} className="ghandle" isConnectable={false} />
    </div>
  )
})

const UnionNode = memo(function UnionNode({ data }: NodeProps<UnionNodeT>) {
  return (
    <div className={`gunion${data.dim ? ' is-dim' : ''}`}>
      <Handle type="target" position={Position.Top} className="ghandle" isConnectable={false} />
      <Handle type="source" position={Position.Bottom} className="ghandle" isConnectable={false} />
    </div>
  )
})

/** Chemin SVG passant par les points calculés par ELK, aux coudes légèrement arrondis. */
function roundedPath(points: [number, number][], radius = 8): string {
  let d = `M ${points[0][0]} ${points[0][1]}`
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1]
    const [x, y] = points[i]
    const [nx, ny] = points[i + 1]
    const r = Math.min(radius, Math.hypot(x - px, y - py) / 2, Math.hypot(nx - x, ny - y) / 2)
    const a = [x - (Math.sign(x - px) * r), y - (Math.sign(y - py) * r)]
    const b = [x + (Math.sign(nx - x) * r), y + (Math.sign(ny - y) * r)]
    d += ` L ${a[0]} ${a[1]} Q ${x} ${y} ${b[0]} ${b[1]}`
  }
  const last = points[points.length - 1]
  return `${d} L ${last[0]} ${last[1]}`
}

/** Arête de l'arbre complet : suit le tracé orthogonal d'ELK (qui évite les nœuds) au lieu d'un tracé générique. */
const RoutedEdge = memo(function RoutedEdge({ data }: EdgeProps<RoutedEdgeT>) {
  const path = useMemo(() => roundedPath(data!.points), [data])
  return <BaseEdge path={path} interactionWidth={0} />
})

const nodeTypes = { entity: EntityNode, union: UnionNode }
const edgeTypes = { routed: RoutedEdge }

/** En dessous de ce zoom, les étiquettes sont illisibles : on ne les dessine plus (sauf celle du personnage choisi). */
const FAR_ZOOM = 0.45
/** Au-delà de ce nombre de nœuds, la mini-carte coûte cher à chaque déplacement sur un appareil modeste. */
const MINIMAP_MAX_NODES = 120
/** Au-delà, afficher tous les noms de la lignée en zoom éloigné les ferait se chevaucher. */
const MAX_BADGES = 40
const CAPABLE_DEVICE = typeof navigator !== 'undefined' && (navigator.hardwareConcurrency ?? 2) >= 4

const minimapColor = (n: Node) => (n.type === 'union' ? 'transparent' : `var(--c-${(n.data as EntityData).categorie}-fg)`)
/** Les deux parents d'un nœud d'union « u:a+b ». */
const unionParents = (id: string) => id.slice(2).split('+')

type Props = {
  visible: Set<string>
  selectedId: string
  highlight: Set<string> | null
  onSelect: (id: string) => void
  mode: 'focus' | 'full'
  /** clé de la mise en page précalculée (null si un filtre rend la vue unique) */
  layoutKey: string | null
  /** part (0–1) du bas du graphe masquée par le panneau de détail sur mobile */
  obscuredBottom?: number
}

export function GraphView({ visible, selectedId, highlight, onSelect, mode, layoutKey, obscuredBottom = 0 }: Props) {
  const full = mode === 'full'
  const graph = useMemo(() => buildGraph(index, visible, { compact: full }), [visible, full])
  const [laid, setLaid] = useState<{ graph: Graph; layout: Layout } | null>(null)
  const [far, setFar] = useState(false)
  const rf = useReactFlow()
  const lastGraph = useRef<Graph | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  // objets nœuds/arêtes déjà transmis à React Flow, réutilisés tant qu'ils n'ont pas changé :
  // une sélection ne re-rend alors que les quelques nœuds concernés
  const nodeCache = useRef(new Map<string, Node>())
  const edgeCache = useRef(new Map<string, Edge>())
  // on garde l'ancienne mise en page affichée pendant le calcul de la nouvelle
  const loading = laid?.graph !== graph

  useEffect(() => {
    let cancelled = false
    layoutGraph(graph, layoutKey, full).then((layout) => {
      if (!cancelled) setLaid({ graph, layout })
    })
    return () => {
      cancelled = true
    }
    // layoutKey et full changent toujours en même temps que graph
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph])

  const related = useMemo(() => {
    const s = new Set<string>([selectedId])
    for (const p of index.allParents.get(selectedId) ?? []) s.add(p)
    for (const c of index.children.get(selectedId) ?? []) s.add(c)
    for (const c of index.spouses.get(selectedId) ?? []) s.add(c)
    return s
  }, [selectedId])

  /**
   * Mise en valeur : le filtre par tags s'il est actif ; sinon, dans l'arbre complet,
   * la lignée du personnage choisi (unions comprises). null = tout est affiché normalement.
   */
  const emphasis = useMemo(() => {
    if (!laid) return null
    if (highlight) {
      const s = new Set(highlight)
      s.add(selectedId)
      for (const n of laid.graph.nodes)
        if (n.kind === 'union' && unionParents(n.id).every((p) => highlight.has(p))) s.add(n.id)
      return s
    }
    if (!full) return null
    const s = lineageOf(index, selectedId)
    for (const e of laid.graph.edges) {
      if (e.kind !== 'child' || !s.has(e.target)) continue
      if (unionParents(e.source).some((p) => s.has(p))) s.add(e.source)
    }
    return s
  }, [laid, highlight, full, selectedId])

  // noms gardés en zoom éloigné : la lignée (ou les résultats du filtre) si elle est assez petite
  const badges = useMemo(() => {
    if (!emphasis) return null
    const people = [...emphasis].filter((id) => !id.startsWith('u:'))
    return people.length <= MAX_BADGES ? new Set(people) : null
  }, [emphasis])

  const nodes: Node[] = useMemo(() => {
    if (!laid) return []
    const prev = nodeCache.current
    const next = new Map<string, Node>()
    const out = laid.graph.nodes.map((n) => {
      const position = laid.layout.pos.get(n.id) ?? { x: 0, y: 0 }
      const dim = emphasis ? !emphasis.has(n.id) : false
      const old = prev.get(n.id)
      let node: Node
      if (n.kind === 'union') {
        node =
          old && old.position === position && (old.data as { dim: boolean }).dim === dim
            ? old
            : { id: n.id, type: 'union', position, data: { dim }, selectable: false, draggable: false, width: n.width, height: n.height }
      } else {
        const match = highlight?.has(n.entityId) ?? false
        const selected = n.entityId === selectedId
        const badge = badges?.has(n.entityId) ?? false
        const od = old?.data as EntityData | undefined
        node =
          old && old.position === position && od!.selected === selected && od!.dim === dim && od!.match === match && od!.badge === badge
            ? old
            : {
                id: n.id,
                type: 'entity',
                position,
                draggable: false,
                width: n.width,
                height: n.height,
                data: { label: n.label, categorie: n.categorie, selected, dim, match, badge },
              }
      }
      next.set(n.id, node)
      return node
    })
    nodeCache.current = next
    return out
  }, [laid, emphasis, badges, highlight, selectedId])

  const edges: Edge[] = useMemo(() => {
    const prev = edgeCache.current
    const next = new Map<string, Edge>()
    const routes = laid?.layout.routes
    const out = (laid?.graph.edges ?? []).map((e) => {
      const endpoints = [e.source, e.target].flatMap((x) => (x.startsWith('u:') ? unionParents(x) : [x]))
      const active = endpoints.includes(selectedId) && (related.has(e.source) || related.has(e.target))
      const inEmphasis = emphasis ? emphasis.has(e.source) && emphasis.has(e.target) : false
      const dim = emphasis ? !inEmphasis : false
      // arbre complet : la lignée choisie est tracée en couleur
      const lineage = full && !highlight && inEmphasis
      const className = `gedge gedge-${e.kind}${active ? ' is-active' : ''}${dim ? ' is-dim' : ''}${lineage ? ' is-lineage' : ''}`
      const points = routes?.get(e.id)
      const old = prev.get(e.id)
      const edge: Edge =
        old && old.className === className && (old.data as { points?: unknown } | undefined)?.points === points
          ? old
          : points
            ? ({ id: e.id, source: e.source, target: e.target, type: 'routed', data: { points }, className, selectable: false, focusable: false } as Edge)
            : ({
                id: e.id,
                source: e.source,
                target: e.target,
                type: 'smoothstep',
                className,
                pathOptions: { borderRadius: 10 },
                selectable: false,
                focusable: false,
              } as Edge)
      next.set(e.id, edge)
      return edge
    })
    edgeCache.current = next
    return out
  }, [laid, related, selectedId, emphasis, full, highlight])

  // recadrage
  useEffect(() => {
    if (!laid || laid.graph !== graph) return
    const graphChanged = lastGraph.current !== graph
    lastGraph.current = graph
    const p = laid.layout.pos.get(selectedId)
    const node = graph.nodes.find((n) => n.id === selectedId)
    // zone réellement visible : on exclut le bas masqué par le panneau (mobile)
    const padding = { top: '8%', left: '6%', right: '6%', bottom: `${Math.round(obscuredBottom * 100) + 6}%` } as const
    const height = boxRef.current?.clientHeight ?? 0
    requestAnimationFrame(() => {
      if (full && emphasis && !highlight) {
        // arbre complet : on cadre la lignée du personnage choisi
        rf.fitView({ padding, duration: 400, maxZoom: 1, nodes: [...emphasis].filter((id) => !id.startsWith('u:')).map((id) => ({ id })) })
      } else if (graphChanged && graph.nodes.length < 60) {
        rf.fitView({ padding, duration: 300, maxZoom: 1.2 })
      } else if (p && node) {
        const zoom = graphChanged ? 0.75 : Math.max(rf.getZoom(), 0.6)
        const shift = (height * obscuredBottom) / 2 / zoom
        rf.setCenter(p.x + node.width / 2, p.y + node.height / 2 + shift, { zoom, duration: 300 })
      } else if (graphChanged) {
        rf.fitView({ padding, duration: 300 })
      }
    })
    // emphasis/highlight suivent selectedId et laid
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laid, graph, selectedId, rf, obscuredBottom])

  // seuil de zoom : un rendu seulement quand on le franchit ; l'échelle inverse (étiquette du personnage
  // choisi, lisible même de loin) passe par une variable CSS, sans rendu React
  const onMove = useCallback((_: unknown, vp: Viewport) => {
    boxRef.current?.style.setProperty('--inv-zoom', String(Math.min(1 / vp.zoom, 12)))
    setFar(vp.zoom < FAR_ZOOM)
  }, [])
  const onNodeClick = useCallback((_: unknown, n: Node) => n.type === 'entity' && onSelect(n.id), [onSelect])

  return (
    <div className={`graph${far ? ' is-far' : ''}${full ? ' is-full' : ''}`} ref={boxRef}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        onMove={onMove}
        onlyRenderVisibleElements
        nodesConnectable={false}
        nodesDraggable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        minZoom={0.05}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        {(nodes.length <= MINIMAP_MAX_NODES || CAPABLE_DEVICE) && (
          <MiniMap
            position="bottom-left"
            pannable
            zoomable
            nodeColor={minimapColor}
            maskColor="rgb(120 140 170 / 18%)"
            style={{ width: 150, height: 100 }}
          />
        )}
        <Controls position="bottom-right" showInteractive={false} />
      </ReactFlow>
      {loading && <div className="graph-loading">Mise en page…</div>}
    </div>
  )
}
