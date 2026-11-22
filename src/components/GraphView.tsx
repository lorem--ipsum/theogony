import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type Viewport,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { index } from '../data'
import type { Categorie } from '../data/categories'
import { buildGraph, type Graph } from '../graph/buildGraph'
import type { Positions } from '../graph/elkGraph'
import { layoutGraph } from '../graph/layout'
import { CategoryIcon } from './CategoryIcon'

type EntityData = { label: string; categorie: Categorie; selected: boolean; dim: boolean; match: boolean }
type EntityNodeT = Node<EntityData, 'entity'>
type UnionNodeT = Node<{ dim: boolean }, 'union'>

const EntityNode = memo(function EntityNode({ data }: NodeProps<EntityNodeT>) {
  const cls = ['gnode', `cat-${data.categorie}`]
  if (data.selected) cls.push('is-selected')
  if (data.dim) cls.push('is-dim')
  if (data.match) cls.push('is-match')
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

const nodeTypes = { entity: EntityNode, union: UnionNode }

/** En dessous de ce zoom, les étiquettes sont illisibles : on ne les dessine plus. */
const FAR_ZOOM = 0.45
/** Au-delà de ce nombre de nœuds, la mini-carte coûte trop cher à chaque déplacement. */
const MINIMAP_MAX_NODES = 120

const minimapColor = (n: Node) => (n.type === 'union' ? 'transparent' : `var(--c-${(n.data as EntityData).categorie}-fg)`)

type Props = {
  visible: Set<string>
  selectedId: string
  highlight: Set<string> | null
  onSelect: (id: string) => void
  /** clé de la mise en page précalculée (null si un filtre rend la vue unique) */
  layoutKey: string | null
  /** part (0–1) du bas du graphe masquée par le panneau de détail sur mobile */
  obscuredBottom?: number
}

export function GraphView({ visible, selectedId, highlight, onSelect, layoutKey, obscuredBottom = 0 }: Props) {
  const graph = useMemo(() => buildGraph(index, visible), [visible])
  const [laid, setLaid] = useState<{ graph: Graph; pos: Positions } | null>(null)
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
    layoutGraph(graph, layoutKey).then((pos) => {
      if (!cancelled) setLaid({ graph, pos })
    })
    return () => {
      cancelled = true
    }
    // layoutKey change toujours en même temps que graph
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph])

  const related = useMemo(() => {
    const s = new Set<string>([selectedId])
    for (const p of index.allParents.get(selectedId) ?? []) s.add(p)
    for (const c of index.children.get(selectedId) ?? []) s.add(c)
    for (const c of index.spouses.get(selectedId) ?? []) s.add(c)
    return s
  }, [selectedId])

  const nodes: Node[] = useMemo(() => {
    if (!laid) return []
    const prev = nodeCache.current
    const next = new Map<string, Node>()
    const out = laid.graph.nodes.map((n) => {
      const position = laid.pos.get(n.id) ?? { x: 0, y: 0 }
      let node: Node
      if (n.kind === 'union') {
        const [a, b] = n.id.slice(2).split('+')
        const dim = highlight ? !(highlight.has(a) && highlight.has(b)) : false
        const old = prev.get(n.id)
        node =
          old && old.position === position && (old.data as { dim: boolean }).dim === dim
            ? old
            : { id: n.id, type: 'union', position, data: { dim }, selectable: false, draggable: false, width: n.width, height: n.height }
      } else {
        const match = highlight?.has(n.entityId) ?? false
        const selected = n.entityId === selectedId
        const dim = highlight ? !match && !selected : false
        const old = prev.get(n.id)
        const od = old?.data as EntityData | undefined
        node =
          old && old.position === position && od!.selected === selected && od!.dim === dim && od!.match === match
            ? old
            : {
                id: n.id,
                type: 'entity',
                position,
                draggable: false,
                width: n.width,
                height: n.height,
                data: { label: n.label, categorie: n.categorie, selected, dim, match },
              }
      }
      next.set(n.id, node)
      return node
    })
    nodeCache.current = next
    return out
  }, [laid, highlight, selectedId])

  const edges: Edge[] = useMemo(() => {
    const prev = edgeCache.current
    const next = new Map<string, Edge>()
    const out = (laid?.graph.edges ?? []).map((e) => {
      const endpoints = [e.source, e.target].flatMap((x) => (x.startsWith('u:') ? x.slice(2).split('+') : [x]))
      const active = endpoints.includes(selectedId) && (related.has(e.source) || related.has(e.target))
      const dim = highlight ? !endpoints.every((x) => highlight.has(x)) : false
      const className = `gedge gedge-${e.kind}${active ? ' is-active' : ''}${dim ? ' is-dim' : ''}`
      const old = prev.get(e.id)
      const edge: Edge =
        old && old.className === className
          ? old
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
  }, [laid, related, selectedId, highlight])

  // recadrage : vue d'ensemble quand le graphe change, sinon centrage sur la sélection
  useEffect(() => {
    if (!laid || laid.graph !== graph) return
    const graphChanged = lastGraph.current !== graph
    lastGraph.current = graph
    const p = laid.pos.get(selectedId)
    const node = graph.nodes.find((n) => n.id === selectedId)
    // zone réellement visible : on exclut le bas masqué par le panneau (mobile)
    const padding = { top: '8%', left: '6%', right: '6%', bottom: `${Math.round(obscuredBottom * 100) + 6}%` } as const
    const height = boxRef.current?.clientHeight ?? 0
    requestAnimationFrame(() => {
      if (graphChanged && graph.nodes.length < 60) {
        rf.fitView({ padding, duration: 300, maxZoom: 1.2 })
      } else if (p && node) {
        const zoom = graphChanged ? 0.75 : Math.max(rf.getZoom(), 0.6)
        const shift = (height * obscuredBottom) / 2 / zoom
        rf.setCenter(p.x + node.width / 2, p.y + node.height / 2 + shift, { zoom, duration: 300 })
      } else if (graphChanged) {
        rf.fitView({ padding, duration: 300 })
      }
    })
  }, [laid, graph, selectedId, rf, obscuredBottom])

  // un seul rendu quand on franchit le seuil de zoom, pas à chaque image
  const onMove = useCallback((_: unknown, vp: Viewport) => setFar(vp.zoom < FAR_ZOOM), [])
  const onNodeClick = useCallback((_: unknown, n: Node) => n.type === 'entity' && onSelect(n.id), [onSelect])

  return (
    <div className={`graph${far ? ' is-far' : ''}`} ref={boxRef}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
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
        {nodes.length <= MINIMAP_MAX_NODES && (
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
