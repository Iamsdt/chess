import { useMemo } from 'react'

import { cn } from '@/design'
import type { CalcNode } from '@/domain'

import { CHIP_HEIGHT, CHIP_WIDTH, layoutTree } from './layout'
import { TAG_STYLE } from './tag-style'
import { formatEval, moveLabel, type NodePosition } from './tree-model'

/**
 * The tree, twice: an absolutely-positioned graph for wide screens and an indented list
 * for phones. Chips are real buttons so the keyboard and screen readers get the tree too;
 * the SVG only draws the edges underneath.
 */

export interface TreeViewProps {
  readonly nodes: readonly CalcNode[]
  readonly positions: ReadonlyMap<string, NodePosition>
  readonly selectedId: string | null
  /** Nodes on the selected path, drawn heavier. */
  readonly pathIds: ReadonlySet<string>
  /** Nodes on one of the user's own lines (Test me reveal). */
  readonly overlay?: ReadonlySet<string> | undefined
  readonly onSelect: (id: string) => void
  readonly onHover: (id: string | null) => void
}

function chipClass(node: CalcNode, props: TreeViewProps): string {
  const selected = props.selectedId === node.id
  return cn(
    'inline-flex items-center justify-between gap-1.5 rounded-full border px-2.5 text-xs transition-shadow outline-none',
    'focus-visible:ring-2 focus-visible:ring-ring',
    TAG_STYLE[node.tag].chip,
    props.pathIds.has(node.id) && 'border-2',
    selected && 'font-semibold ring-2 ring-foreground',
    props.overlay?.has(node.id) === true && 'shadow-[0_0_0_3px_var(--primary)]',
  )
}

function chipName(node: CalcNode, position: NodePosition | undefined): string {
  return `${moveLabel(node, position)}, ${formatEval(node.eval)}, ${TAG_STYLE[node.tag].label}`
}

function ChipBody({ node }: { readonly node: CalcNode }) {
  return (
    <>
      <span className="truncate">{node.san}</span>
      <span className="text-muted-foreground tabular-nums">{formatEval(node.eval)}</span>
    </>
  )
}

export function TreeGraph(props: TreeViewProps) {
  const layout = useMemo(() => layoutTree(props.nodes), [props.nodes])
  const byId = new Map(layout.chips.map((chip) => [chip.id, chip]))
  return (
    <div
      data-slot="calc-tree-graph"
      className="relative"
      style={{ width: layout.width, height: layout.height }}
    >
      <svg
        className="absolute inset-0 stroke-border"
        width={layout.width}
        height={layout.height}
        aria-hidden="true"
        fill="none"
      >
        {layout.edges.map((edge) => {
          const from = byId.get(edge.from)
          const to = byId.get(edge.to)
          if (from === undefined || to === undefined) return null
          const x1 = from.x + CHIP_WIDTH
          const y1 = from.y + CHIP_HEIGHT / 2
          const x2 = to.x
          const y2 = to.y + CHIP_HEIGHT / 2
          const mid = (x1 + x2) / 2
          return (
            <path
              key={edge.to}
              d={`M${String(x1)} ${String(y1)} C${String(mid)} ${String(y1)} ${String(mid)} ${String(y2)} ${String(x2)} ${String(y2)}`}
              strokeWidth={props.pathIds.has(edge.to) ? 2 : 1.25}
              className={props.pathIds.has(edge.to) ? 'stroke-foreground/60' : undefined}
            />
          )
        })}
      </svg>
      {layout.chips.map((chip) => (
        <div
          key={chip.id}
          className="absolute"
          style={{ left: chip.x, top: chip.y - 16, width: CHIP_WIDTH }}
        >
          {chip.node.branchName === undefined ? null : (
            <span className="block h-4 truncate text-[10px] font-medium text-muted-foreground">
              {chip.node.branchName}
            </span>
          )}
          <button
            type="button"
            data-slot="calc-chip"
            data-node-id={chip.id}
            data-tag={chip.node.tag}
            aria-label={chipName(chip.node, props.positions.get(chip.id))}
            aria-current={props.selectedId === chip.id ? 'true' : undefined}
            className={cn(chipClass(chip.node, props), 'w-full')}
            style={{ height: CHIP_HEIGHT, marginTop: chip.node.branchName === undefined ? 16 : 0 }}
            onClick={() => {
              props.onSelect(chip.id)
            }}
            onMouseEnter={() => {
              props.onHover(chip.id)
            }}
            onMouseLeave={() => {
              props.onHover(null)
            }}
            onFocus={() => {
              props.onHover(chip.id)
            }}
            onBlur={() => {
              props.onHover(null)
            }}
          >
            <ChipBody node={chip.node} />
          </button>
          {props.overlay?.has(chip.id) === true ? (
            <span className="absolute -top-0.5 right-0 rounded-full bg-primary px-1 text-[9px] leading-3 text-primary-foreground">
              you
            </span>
          ) : null}
        </div>
      ))}
    </div>
  )
}

export function TreeList(props: TreeViewProps) {
  const kids = useMemo(() => {
    const map = new Map<string | null, CalcNode[]>()
    for (const node of props.nodes) {
      const list = map.get(node.parentId) ?? []
      list.push(node)
      map.set(node.parentId, list)
    }
    return map
  }, [props.nodes])

  const render = (parentId: string | null, depth: number) => {
    const list = kids.get(parentId) ?? []
    if (list.length === 0) return null
    return (
      <ul className={cn('flex flex-col gap-1.5', depth > 0 && 'ml-3 border-l border-border pl-3')}>
        {list.map((node) => (
          <li key={node.id} className="flex flex-col gap-1.5">
            {node.branchName === undefined ? null : (
              <span className="mt-1 text-[11px] font-medium text-muted-foreground">
                {node.branchName}
              </span>
            )}
            <button
              type="button"
              data-slot="calc-chip"
              data-node-id={node.id}
              data-tag={node.tag}
              aria-label={chipName(node, props.positions.get(node.id))}
              aria-current={props.selectedId === node.id ? 'true' : undefined}
              className={cn(chipClass(node, props), 'h-8 w-fit min-w-24')}
              onClick={() => {
                props.onSelect(node.id)
              }}
            >
              <ChipBody node={node} />
            </button>
            {render(node.id, depth + 1)}
          </li>
        ))}
      </ul>
    )
  }
  return <div data-slot="calc-tree-list">{render(null, 0)}</div>
}
