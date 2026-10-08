import { Plus, Shuffle } from 'lucide-react'

import { cn } from '@/design'
import type { RepertoireNode, RepertoireNodeId } from '@/domain'

import { childrenOf, type RepertoireTree } from './tree'

import type { Gap } from './gaps'

export interface TreeViewProps {
  readonly tree: RepertoireTree
  readonly rootId: RepertoireNodeId
  readonly selectedId: RepertoireNodeId | null
  readonly dueIds: ReadonlySet<RepertoireNodeId>
  readonly transposed: ReadonlySet<RepertoireNodeId>
  readonly gapsByParent: ReadonlyMap<RepertoireNodeId, readonly Gap[]>
  readonly onSelect: (id: RepertoireNodeId) => void
  readonly onAddGap: (gap: Gap) => void
}

/** `3.e5` for White's move, `3…Bf5` when a black move opens a chain. */
function moveLabel(node: RepertoireNode, opensChain: boolean): string {
  const number = Math.ceil(node.ply / 2)
  if (node.ply % 2 === 1) return `${String(number)}.${node.san ?? ''}`
  return opensChain ? `${String(number)}…${node.san ?? ''}` : (node.san ?? '')
}

/**
 * The repertoire as nested branches, in the style of the prototype's tree preview.
 *
 * Single-child runs are written on one row (`4.Nf3 e6 5.Be2 c5`) and only real branch
 * points indent, so a deep line reads as a line and not as a staircase.
 */
export function TreeView(props: TreeViewProps) {
  const roots = childrenOf(props.tree, props.rootId)
  const rootGaps = props.gapsByParent.get(props.rootId) ?? []
  return (
    <ul className="space-y-1.5" aria-label="Repertoire tree">
      {roots.map((node) => (
        <Branch key={node.id} node={node} {...props} />
      ))}
      <GapRows gaps={rootGaps} onAddGap={props.onAddGap} />
    </ul>
  )
}

function GapRows({
  gaps,
  onAddGap,
}: {
  readonly gaps: readonly Gap[]
  readonly onAddGap: (gap: Gap) => void
}) {
  return gaps.map((gap) => (
    <li key={gap.uci} className="text-muted-foreground/70">
      <div className="flex flex-wrap items-center gap-2">
        {gap.san}
        <span className="font-sans text-xs">
          {String(gap.popularity)}% play this · not in repertoire yet
        </span>
        <button
          type="button"
          className="inline-flex min-h-[28px] cursor-pointer items-center gap-1 font-sans text-xs font-medium text-primary hover:underline"
          onClick={() => {
            onAddGap(gap)
          }}
        >
          <Plus className="size-3" aria-hidden="true" />
          Add {gap.san}
          <span className="sr-only"> after {gap.path === '' ? 'the start' : gap.path}</span>
        </button>
      </div>
    </li>
  ))
}

interface BranchProps extends TreeViewProps {
  readonly node: RepertoireNode
}

function Branch({ node, ...props }: BranchProps) {
  const chain: RepertoireNode[] = [node]
  let last = node
  while (last.childIds.length === 1) {
    const nextId = last.childIds[0]
    const next = nextId === undefined ? undefined : props.tree.nodes.get(nextId)
    if (next === undefined) break
    chain.push(next)
    last = next
  }
  const kids = childrenOf(props.tree, last.id)
  const gaps = props.gapsByParent.get(last.id) ?? []
  const parent = node.parentId === null ? undefined : props.tree.nodes.get(node.parentId)
  const showVariation = last.variation !== undefined && last.variation !== parent?.variation
  return (
    <li>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {chain.map((item, index) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={props.selectedId === item.id}
            className={cn(
              'min-h-[26px] cursor-pointer rounded px-1.5 py-0.5',
              item.isYourMove
                ? 'bg-accent font-semibold text-accent-foreground ring-1 ring-primary/30'
                : 'text-foreground hover:bg-muted',
              props.selectedId === item.id && 'ring-2 ring-cta',
            )}
            onClick={() => {
              props.onSelect(item.id)
            }}
          >
            {moveLabel(item, index === 0)}
          </button>
        ))}
        {showVariation && (
          <span className="font-sans text-xs text-muted-foreground">{last.variation}</span>
        )}
        {props.transposed.has(last.id) && (
          <span
            className="inline-flex items-center gap-1 font-sans text-xs text-muted-foreground"
            title="Another move order reaches this position"
          >
            <Shuffle className="size-3" aria-hidden="true" />
            transposes
          </span>
        )}
        {props.dueIds.has(last.id) && (
          <span className="badge ml-1 border-transparent bg-cta-soft font-sans text-[11px] text-cta">
            due
          </span>
        )}
      </div>
      {(kids.length > 0 || gaps.length > 0) && (
        <ul className="mt-1 ml-3 space-y-1.5 border-l-2 border-border pl-3 sm:pl-4">
          {kids.map((kid) => (
            <Branch key={kid.id} node={kid} {...props} />
          ))}
          <GapRows gaps={gaps} onAddGap={props.onAddGap} />
        </ul>
      )}
    </li>
  )
}
