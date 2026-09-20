import { ArrowUp, ArrowUpToLine, GitBranch, Trash2 } from 'lucide-react'
import { Fragment } from 'react'

import { Button, cn } from '@/design'

import {
  childrenOf,
  isMainLine,
  numberingFor,
  type LineStart,
  type VariationNode,
  type VariationNodeId,
  type VariationTree,
} from './variation-tree'

/**
 * The move list, with its branches.
 *
 * A branch is drawn where it happens — indented under the move it replaces —
 * because that is the only layout that lets a player see *which* move they were
 * given an alternative to. Promote and delete are ordinary buttons rather than a
 * right-click menu so that the keyboard path through the tree is the same one the
 * mouse takes.
 */

interface MoveItem {
  readonly kind: 'move'
  readonly id: VariationNodeId
  readonly ply: number
  readonly forceNumber: boolean
}

interface BranchItem {
  readonly kind: 'branch'
  readonly id: VariationNodeId
  /** The branch replaces a move, so it starts at that move's ply. */
  readonly ply: number
  readonly key: string
}

type LineItem = MoveItem | BranchItem

/**
 * Flatten one line into moves and the branches that interrupt it.
 *
 * Why a list rather than rendering inside the walk: a branch has to break the
 * inline flow of moves, and building the sequence first keeps that a layout
 * decision instead of a recursion detail.
 */
function lineItems(tree: VariationTree, startId: VariationNodeId, startPly: number): LineItem[] {
  const items: LineItem[] = []
  const seen = new Set<VariationNodeId>()
  let cursor: VariationNodeId | null = startId
  let ply = startPly
  let forceNumber = true

  while (cursor !== null && !seen.has(cursor)) {
    seen.add(cursor)
    const node: VariationNode | undefined = tree.nodes[cursor]
    if (node === undefined) break

    items.push({ kind: 'move', id: node.id, ply, forceNumber })
    forceNumber = false

    const siblings = childrenOf(tree, node.parentId)
    if (siblings[0] === node.id && siblings.length > 1) {
      for (const sibling of siblings.slice(1)) {
        items.push({ kind: 'branch', id: sibling, ply, key: `${node.id}:${sibling}` })
      }
      // The main line resumes after an interruption, so it restates its number.
      forceNumber = true
    }

    cursor = node.children[0] ?? null
    ply += 1
  }

  return items
}

interface LineProps {
  readonly tree: VariationTree
  readonly startId: VariationNodeId
  readonly startPly: number
  readonly lineStart: LineStart
  readonly onSelect: (id: VariationNodeId) => void
}

function Line({ tree, startId, startPly, lineStart, onSelect }: LineProps) {
  const items = lineItems(tree, startId, startPly)

  return (
    <div className="flex flex-wrap items-center gap-x-0.5">
      {items.map((item) => {
        if (item.kind === 'branch') {
          return (
            <div
              key={item.key}
              className="my-1 ml-3 basis-full border-l-2 border-lilac-ink/30 pl-3 text-muted-foreground"
            >
              <Line
                tree={tree}
                startId={item.id}
                startPly={item.ply}
                lineStart={lineStart}
                onSelect={onSelect}
              />
            </div>
          )
        }

        const node = tree.nodes[item.id]
        if (node === undefined) return null
        const { moveNumber, white } = numberingFor(item.ply, lineStart)
        const isCurrent = tree.currentId === item.id

        return (
          <Fragment key={item.id}>
            {white || item.forceNumber ? (
              <span className="text-xs text-muted-foreground">
                {String(moveNumber)}
                {white ? '.' : '…'}
              </span>
            ) : null}
            <button
              type="button"
              className={cn('mv', isCurrent && 'is-current')}
              onClick={() => {
                onSelect(item.id)
              }}
              aria-current={isCurrent ? 'true' : undefined}
              aria-label={`${String(moveNumber)}${white ? '.' : '…'} ${node.san}`}
            >
              {node.san}
            </button>
          </Fragment>
        )
      })}
    </div>
  )
}

export interface TreePanelProps {
  readonly tree: VariationTree
  readonly lineStart: LineStart
  readonly onSelect: (id: VariationNodeId | null) => void
  readonly onPromote: (id: VariationNodeId) => void
  readonly onPromoteToMain: (id: VariationNodeId) => void
  readonly onDelete: (id: VariationNodeId) => void
}

export function TreePanel({
  tree,
  lineStart,
  onSelect,
  onPromote,
  onPromoteToMain,
  onDelete,
}: TreePanelProps) {
  const first = tree.rootChildren[0]
  const current = tree.currentId
  const canReorder = current !== null && !isMainLine(tree, current)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {first === undefined ? (
          <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            No moves yet. Play one on the board and it starts the line.
          </p>
        ) : (
          <div className="font-mono text-[13px] leading-8">
            <Line
              tree={tree}
              startId={first}
              startPly={1}
              lineStart={lineStart}
              onSelect={onSelect}
            />
          </div>
        )}
        <p className="mt-3 flex gap-2 rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
          <GitBranch className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          Play a different move on the board to start a side line, then promote or delete it with
          the buttons below.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={!canReorder}
          onClick={() => {
            if (current !== null) onPromote(current)
          }}
        >
          <ArrowUp aria-hidden="true" />
          Promote
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={!canReorder}
          onClick={() => {
            if (current !== null) onPromoteToMain(current)
          }}
        >
          <ArrowUpToLine aria-hidden="true" />
          Make main line
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          disabled={current === null}
          onClick={() => {
            if (current !== null) onDelete(current)
          }}
        >
          <Trash2 aria-hidden="true" />
          Delete
        </Button>
      </div>
    </div>
  )
}
