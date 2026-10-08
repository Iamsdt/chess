import { MessageCircle, Star, Trash2 } from 'lucide-react'
import { useContext, useEffect, useMemo, useRef, useState } from 'react'

import { ChatPanelContext } from '@/app/shell/shell-contexts'
import { Board } from '@/board'
import type { BoardMove } from '@/board'
import { Button, Textarea, toast } from '@/design'
import type { RepertoireNodeId } from '@/domain'

import { legalMapFor, promotes, shapesForMove, uciOfBoardMove } from './board-moves'
import { GapsPanel } from './gaps-panel'
import { ImportPanel } from './import-panel'
import {
  createLichessExplorer,
  prefetchExplorer,
  type ExplorerPort,
  type ExplorerStatus,
  type OpponentMove,
} from './popularity'
import {
  addMoveAndSave,
  annotateAndSave,
  deleteAndSave,
  setMainLineAndSave,
  type LineSummary,
  type OpeningsDeps,
} from './service'
import { isDue } from './summary'
import {
  findTranspositions,
  lineTo,
  transpositionsOf,
  treeStats,
  type RepertoireTree,
} from './tree'
import { TreeView } from './tree-view'
import { useCoverage } from './use-openings'

import type { Gap } from './gaps'
import type { LinesPort } from './pgn-lines-port'

export interface RepertoireEditorProps {
  readonly deps: OpeningsDeps
  readonly tree: RepertoireTree
  /** The opening being edited; the whole colour when absent. */
  readonly headId: RepertoireNodeId | null
  readonly title: string
  readonly lines: readonly LineSummary[]
  readonly explorer?: ExplorerPort
  readonly linesPort?: LinesPort
}

/**
 * The tree editor: read the tree, play moves on the board to extend it, annotate, promote
 * a main line, delete, import PGN, and see what the tree is missing.
 *
 * Every edit is a pure tree operation followed by one repository write (`service.ts`);
 * the live query then re-renders this with the stored tree, so nothing here holds a copy
 * that could drift from the database.
 */
export function RepertoireEditor(props: RepertoireEditorProps) {
  const { deps, tree, headId, lines } = props
  const chatPanel = useContext(ChatPanelContext)
  const rootId = headId ?? tree.rootId
  const [selectedId, setSelectedId] = useState<RepertoireNodeId>(headId ?? tree.rootId)
  const [explorerMap, setExplorerMap] = useState<
    ReadonlyMap<string, readonly OpponentMove[]> | undefined
  >(undefined)
  const [explorerStatus, setExplorerStatus] = useState<ExplorerStatus>('off')
  const [explorerBusy, setExplorerBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const abort = useRef<AbortController | null>(null)

  const selected =
    tree.nodes.get(selectedId) ?? tree.nodes.get(rootId) ?? tree.nodes.get(tree.rootId)
  useEffect(
    () => () => {
      abort.current?.abort()
    },
    [],
  )

  const coverage = useCoverage(tree, explorerMap)
  const gapsByParent = useMemo(() => {
    const map = new Map<RepertoireNodeId, Gap[]>()
    for (const gap of coverage.report?.gaps ?? []) {
      const list = map.get(gap.parentId)
      if (list === undefined) map.set(gap.parentId, [gap])
      else list.push(gap)
    }
    return map
  }, [coverage.report])
  const transposed = useMemo(() => {
    const ids = new Set<RepertoireNodeId>()
    for (const group of findTranspositions(tree)) for (const id of group.nodeIds) ids.add(id)
    return ids
  }, [tree])
  const dueIds = useMemo(() => {
    const at = new Date()
    return new Set(lines.flatMap((line) => (isDue(line, at) ? [line.node.id] : [])))
  }, [lines])

  if (selected === undefined) return null
  const stats = treeStats(tree, rootId)
  const others = transpositionsOf(tree, selected.id)
  const isRoot = selected.parentId === null
  const legal = legalMapFor(selected.fen)

  const fail = (message: string): void => {
    setError(message)
  }

  const addMove = async (parentId: RepertoireNodeId, uci: string) => {
    setError(null)
    const result = await addMoveAndSave(deps, tree, parentId, uci)
    if (!result.ok) {
      fail(result.error.message)
      return
    }
    const added = result.value.value
    setSelectedId(added.id)
  }

  const onBoardMove = (move: BoardMove) => {
    void addMove(selected.id, uciOfBoardMove(move))
  }

  const addGap = async (gap: Gap) => {
    setError(null)
    const result = await addMoveAndSave(deps, tree, gap.parentId, gap.uci)
    if (!result.ok) {
      fail(result.error.message)
      return
    }
    setSelectedId(result.value.value.id)
    toast(`${gap.san} added. Play your answer on the board.`)
  }

  const saveComment = async (text: string) => {
    const next = text.trim()
    if (next === (selected.comment ?? '')) return
    const result = await annotateAndSave(deps, tree, selected.id, {
      comment: next === '' ? null : next,
    })
    if (!result.ok) fail(result.error.message)
  }

  const makeMain = async () => {
    const result = await setMainLineAndSave(deps, tree, selected.id)
    if (!result.ok) fail(result.error.message)
    else toast('Marked as the main line')
  }

  const remove = async () => {
    const parentId = selected.parentId
    const result = await deleteAndSave(deps, tree, selected.id)
    if (!result.ok) {
      fail(result.error.message)
      return
    }
    setSelectedId(parentId ?? rootId)
    toast(`Deleted ${String(result.value.value)} ${result.value.value === 1 ? 'move' : 'moves'}`)
  }

  const toggleExplorer = async () => {
    if (explorerStatus !== 'off') {
      abort.current?.abort()
      setExplorerMap(undefined)
      setExplorerStatus('off')
      return
    }
    const controller = new AbortController()
    abort.current = controller
    setExplorerBusy(true)
    const snapshot = await prefetchExplorer(
      tree,
      props.explorer ?? createLichessExplorer(),
      controller.signal,
    )
    setExplorerBusy(false)
    if (controller.signal.aborted) return
    setExplorerMap(snapshot.status === 'ok' ? snapshot.byPosition : undefined)
    setExplorerStatus(snapshot.status)
  }

  const askSage = () => {
    chatPanel?.open()
    chatPanel?.focusComposer()
    toast(`Is my ${props.title} tree missing anything important at my level?`)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <section id="tree" className="card overflow-hidden" aria-labelledby="tree-h">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5 sm:py-4">
          <div>
            <h2 id="tree-h" className="text-base font-bold sm:text-lg">
              {props.title} tree
            </h2>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Your moves are marked. Play a move on the board to add it to the tree.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs sm:h-9 sm:text-sm"
              aria-label={`Check ${props.title} tree with Sage`}
              onClick={askSage}
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              Check with Sage
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs sm:h-9 sm:text-sm"
              aria-expanded={showImport}
              onClick={() => {
                setShowImport((open) => !open)
              }}
            >
              Import PGN
            </Button>
          </div>
        </div>

        {showImport && (
          <div className="border-b bg-muted/30 p-4 sm:p-5">
            <ImportPanel
              deps={deps}
              color={tree.color}
              {...(props.linesPort === undefined ? {} : { port: props.linesPort })}
            />
          </div>
        )}

        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_260px] xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="overflow-x-auto p-3.5 font-mono text-xs sm:p-5 sm:text-[13px]">
            <TreeView
              tree={tree}
              rootId={rootId}
              selectedId={selectedId}
              dueIds={dueIds}
              transposed={transposed}
              gapsByParent={gapsByParent}
              onSelect={setSelectedId}
              onAddGap={(gap) => {
                void addGap(gap)
              }}
            />
            {stats.nodes === 0 && (
              <p className="font-sans text-sm text-muted-foreground">
                Nothing here yet. Play the first move on the board.
              </p>
            )}
          </div>

          <aside className="border-t bg-muted/30 p-4 sm:p-5 lg:border-t-0 lg:border-l">
            <div className="max-w-[240px] overflow-hidden rounded-lg ring-1 ring-border lg:max-w-none">
              <Board
                fen={selected.fen}
                orientation={tree.color}
                coordinates={false}
                movable="both"
                legalMoves={legal}
                isPromotion={(from, to) => promotes(selected.fen, from, to)}
                onMove={onBoardMove}
                shapes={shapesForMove(selected.uci)}
                label={`Editor board${selected.san === null ? ', starting position' : `, after ${lineTo(tree, selected.id)}`}`}
              />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {selected.san === null ? (
                'The starting position.'
              ) : (
                <>
                  After{' '}
                  <span className="font-mono font-medium whitespace-nowrap text-foreground">
                    {lineTo(tree, selected.id).split(' ').slice(-2).join(' ')}
                  </span>
                  {selected.eco !== undefined && ` · ${selected.eco}`}
                </>
              )}
            </p>
            {others.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Also reached by {others.map((node) => lineTo(tree, node.id)).join('; ')}.
              </p>
            )}
            {!isRoot && (
              <div className="mt-3">
                <NoteField
                  key={selected.id}
                  initial={selected.comment ?? ''}
                  onSave={(text) => {
                    void saveComment(text)
                  }}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    disabled={selected.isMainLine}
                    onClick={() => {
                      void makeMain()
                    }}
                  >
                    <Star className="size-3.5" aria-hidden="true" />
                    {selected.isMainLine ? 'Main line' : 'Make main line'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs text-destructive"
                    onClick={() => {
                      void remove()
                    }}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    Delete branch
                  </Button>
                </div>
              </div>
            )}
            {error !== null && (
              <p role="alert" className="mt-2 text-xs text-destructive">
                {error}
              </p>
            )}
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-card p-2 sm:p-2.5">
                <dt className="text-[11px] text-muted-foreground sm:text-xs">Lines</dt>
                <dd className="font-display text-base font-bold sm:text-lg">
                  {String(stats.lines)}
                </dd>
              </div>
              <div className="rounded-lg bg-card p-2 sm:p-2.5">
                <dt className="text-[11px] text-muted-foreground sm:text-xs">Your moves</dt>
                <dd className="font-display text-base font-bold sm:text-lg">
                  {String(stats.yourMoves)}
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>

      <GapsPanel
        coverage={coverage}
        explorerStatus={explorerStatus}
        explorerBusy={explorerBusy}
        onToggleExplorer={() => {
          void toggleExplorer()
        }}
        onAddGap={(gap) => {
          void addGap(gap)
        }}
        onSelectGap={(gap) => {
          setSelectedId(gap.parentId)
        }}
      />
    </div>
  )
}

function NoteField({
  initial,
  onSave,
}: {
  readonly initial: string
  readonly onSave: (text: string) => void
}) {
  const [draft, setDraft] = useState(initial)
  return (
    <>
      <label htmlFor="node-note" className="text-xs font-medium">
        Note for this move
      </label>
      <Textarea
        id="node-note"
        rows={3}
        value={draft}
        className="mt-1 text-xs"
        placeholder="What is the plan here?"
        onChange={(event) => {
          setDraft(event.target.value)
        }}
        onBlur={() => {
          onSave(draft)
        }}
      />
    </>
  )
}
