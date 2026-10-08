import { Link } from '@tanstack/react-router'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  MessageCircleQuestion,
  Pause,
  Play,
  Star,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { Board } from '@/board'
import { winPercent } from '@/chess'
import { Badge, Button, cn, toast, useTheme } from '@/design'
import {
  emptyBoardShapes,
  type Arrow,
  type CalcNode,
  type CalculationAttachment,
  type CoachEval,
  type Color,
} from '@/domain'

import { TAG_STYLE } from './tag-style'
import { TreeGraph, TreeList } from './tree-graph'
import {
  childrenMap,
  evalValue,
  formatEval,
  mainLineFrom,
  moveLabel,
  pathTo,
  replayTree,
  siblingsOf,
  summariseCandidates,
  type NodePosition,
} from './tree-model'

/**
 * Explore: Sage's own board plus the tree (coach-agent.md §9.3).
 *
 * The board here is local to the dialog. It never reads or writes the user's analysis or
 * game board, which is the rule for everything Sage shows.
 */

const STEP_MS = 1100
/** Long enough for the slide from the parent to be seen, short enough to feel instant. */
const SETTLE_MS = 60
const PREVIEW_ARROWS = 3

function sideToMoveOf(fen: string): Color {
  return fen.split(' ')[1] === 'b' ? 'black' : 'white'
}

function whiteShare(value: CoachEval | null): number {
  if (value === null) return 0.5
  return winPercent(Math.max(-2000, Math.min(2000, evalValue(value)))) / 100
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable || target.closest('[role="tablist"]') !== null) return true
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

export interface ExplorePanelProps {
  readonly attachment: CalculationAttachment
  /** Test me's reveal: nodes on the user's own lines. */
  readonly overlay?: ReadonlySet<string> | undefined
  /** Content shown above the tree, e.g. the reveal's score card. */
  readonly lead?: ReactNode
  readonly onTestMe?: (() => void) | undefined
  readonly active?: boolean
}

export function ExplorePanel({
  attachment,
  overlay,
  lead,
  onTestMe,
  active = true,
}: ExplorePanelProps) {
  const { pieceSet } = useTheme()
  const { positions } = useMemo(() => replayTree(attachment), [attachment])
  const nodes = useMemo(
    () => attachment.nodes.filter((node) => positions.has(node.id)),
    [attachment.nodes, positions],
  )
  const kids = useMemo(() => childrenMap(nodes), [nodes])
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes])
  const sideToMove = sideToMoveOf(attachment.fen)
  const summaries = useMemo(
    () => summariseCandidates({ ...attachment, nodes }, sideToMove),
    [attachment, nodes, sideToMove],
  )

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [shownFen, setShownFen] = useState(attachment.fen)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const selectedRef = useRef<string | null>(null)
  const shownRef = useRef<string>(attachment.fen)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback(
    (fen: string) => {
      shownRef.current = fen
      setShownFen(fen as typeof attachment.fen)
    },
    [attachment],
  )

  const go = useCallback(
    (id: string | null) => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
      const previous = selectedRef.current
      selectedRef.current = id
      setSelectedId(id)
      if (id === null) {
        show(attachment.fen)
        return
      }
      const position = positions.get(id)
      if (position === undefined) return
      // Stepping forward or back keeps the board where it is; a jump re-plays the move
      // from its parent so the eye sees what changed.
      const stepping =
        shownRef.current === position.fenBefore ||
        (previous !== null && byId.get(previous)?.parentId === id)
      if (stepping || shownRef.current === position.fenAfter) {
        show(position.fenAfter)
        return
      }
      show(position.fenBefore)
      timerRef.current = setTimeout(() => {
        show(position.fenAfter)
      }, SETTLE_MS)
    },
    [attachment.fen, byId, positions, show],
  )

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    },
    [],
  )

  const selected = selectedId === null ? null : (byId.get(selectedId) ?? null)
  const selectedPosition = selectedId === null ? undefined : positions.get(selectedId)
  const path = useMemo(
    () => (selectedId === null ? [] : pathTo(nodes, selectedId)),
    [nodes, selectedId],
  )
  const pathIds = useMemo(() => new Set(path.map((node) => node.id)), [path])
  const branch = path[0] ?? null

  const forward = useCallback(() => {
    const next = kids.get(selectedRef.current)?.[0]
    if (next !== undefined) go(next.id)
  }, [go, kids])
  const back = useCallback(() => {
    const current = selectedRef.current === null ? undefined : byId.get(selectedRef.current)
    if (current !== undefined) go(current.parentId)
  }, [byId, go])
  const sibling = useCallback(
    (delta: 1 | -1) => {
      const current = selectedRef.current === null ? undefined : byId.get(selectedRef.current)
      if (current === undefined) {
        const first = kids.get(null)?.[0]
        if (first !== undefined) go(first.id)
        return
      }
      const list = siblingsOf(kids, current)
      const target = list[list.indexOf(current) + delta]
      if (target !== undefined) go(target.id)
    },
    [byId, go, kids],
  )

  useEffect(() => {
    if (!active) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
      if (isTyping(event.target)) return
      const actions: Readonly<Record<string, (() => void) | undefined>> = {
        ArrowRight: forward,
        ArrowLeft: back,
        ArrowDown: () => {
          sibling(1)
        },
        ArrowUp: () => {
          sibling(-1)
        },
      }
      const action = actions[event.key]
      if (action === undefined) return
      event.preventDefault()
      action()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [active, forward, back, sibling])

  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => {
      const next = kids.get(selectedRef.current)?.[0]
      if (next === undefined) {
        setPlaying(false)
        return
      }
      go(next.id)
    }, STEP_MS)
    return () => {
      clearInterval(timer)
    }
  }, [playing, go, kids])

  const togglePlay = (): void => {
    if (playing) {
      setPlaying(false)
      return
    }
    // At the end of a line, start the same branch again from its candidate.
    const atLeaf =
      selectedRef.current !== null && (kids.get(selectedRef.current) ?? []).length === 0
    if (atLeaf && branch !== null) go(null)
    setPlaying(true)
  }

  const shapes = useMemo(() => {
    const next = emptyBoardShapes()
    const arrows: Arrow[] = []
    const add = (position: NodePosition | undefined, kind: Arrow['kind']): void => {
      if (
        position === undefined ||
        arrows.some((a) => a.from === position.from && a.to === position.to)
      )
        return
      arrows.push({ from: position.from, to: position.to, kind })
    }
    if (selectedPosition !== undefined)
      next.highlight = [selectedPosition.from, selectedPosition.to]
    if (hoverId !== null) add(positions.get(hoverId), 'sage')
    if (selectedId === null) {
      // At the root, every candidate is a preview: the engine's picks quiet, the trap loud.
      for (const row of summaries.slice(0, 4)) {
        add(
          positions.get(row.node.id),
          row.node.tag === 'tempting' ? 'threat' : row.isBest ? 'best' : 'sage',
        )
      }
    } else {
      for (const node of mainLineFrom(kids, selectedId).slice(0, PREVIEW_ARROWS)) {
        const position = positions.get(node.id)
        add(position, position?.mover === attachment.orientation ? 'best' : 'threat')
      }
    }
    next.arrows = arrows
    return next
  }, [selectedPosition, selectedId, hoverId, positions, summaries, kids, attachment.orientation])

  const evalNow = selected?.eval ?? null
  const caption =
    selected === null
      ? `${sideToMove === 'white' ? 'White' : 'Black'} to move: pick a candidate`
      : moveLabel(selected, selectedPosition)
  const share = whiteShare(evalNow)
  const topShare = attachment.orientation === 'white' ? 1 - share : share

  const treeProps = {
    nodes,
    positions,
    selectedId,
    pathIds,
    overlay,
    onSelect: go,
    onHover: setHoverId,
  }

  return (
    <div
      data-slot="calc-explore"
      className="grid gap-4 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)] lg:items-start"
    >
      <section aria-label="Sage's board" className="flex flex-col gap-3 lg:sticky lg:top-0">
        <div className="mx-auto flex w-full max-w-[min(100%,56dvh)] gap-2 lg:max-w-none">
          <div
            data-slot="calc-eval-bar"
            role="meter"
            aria-label="Evaluation"
            aria-valuemin={-10}
            aria-valuemax={10}
            aria-valuenow={
              evalNow === null ? 0 : Math.max(-10, Math.min(10, evalValue(evalNow) / 100))
            }
            aria-valuetext={evalNow === null ? 'not evaluated' : `${formatEval(evalNow)} for White`}
            className="relative flex w-3.5 shrink-0 flex-col overflow-hidden rounded-full ring-1 ring-border sm:w-5"
          >
            <div
              className={cn(
                'transition-[flex-basis] duration-300',
                attachment.orientation === 'white' ? 'bg-engine' : 'bg-paper',
              )}
              style={{ flexBasis: `${String(topShare * 100)}%` }}
            />
            <div
              className={cn(
                'flex-1',
                attachment.orientation === 'white' ? 'bg-paper' : 'bg-engine',
              )}
            />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden rounded-xl ring-1 ring-border">
            <Board
              fen={shownFen}
              orientation={attachment.orientation}
              shapes={shapes}
              coordinates
              pieceSet={pieceSet}
              label="Sage's calculation board"
              announcement={caption}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1" role="group" aria-label="Move through the line">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Back to the start position"
              onClick={() => {
                go(null)
              }}
            >
              <ChevronsLeft aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Previous move"
              disabled={selectedId === null}
              onClick={back}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Next move"
              disabled={(kids.get(selectedId) ?? []).length === 0}
              onClick={forward}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
            <Button variant="secondary" size="sm" onClick={togglePlay} aria-pressed={playing}>
              {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
              {playing ? 'Pause' : 'Play branch'}
            </Button>
          </div>
          <p className="flex items-center gap-2 text-sm" aria-live="polite">
            <span className="font-medium">{caption}</span>
            {evalNow === null ? null : <Badge variant="soft">{formatEval(evalNow)}</Badge>}
            {selected === null ? null : (
              <span className="text-xs text-muted-foreground">{TAG_STYLE[selected.tag].label}</span>
            )}
          </p>
        </div>
        {branch?.idea === undefined ? null : (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm" data-slot="calc-idea">
            <span className="font-medium">{branch.branchName}.</span> {branch.idea}
          </p>
        )}
      </section>

      <div className="flex min-w-0 flex-col gap-4">
        {lead}
        <section aria-label="Calculation tree" className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            Click a move, use ← → along a line and ↑ ↓ between alternatives.
          </p>
          <div
            className="hidden overflow-auto rounded-xl border bg-card p-3 lg:block"
            data-slot="calc-tree-scroll"
          >
            <TreeGraph {...treeProps} />
          </div>
          <div className="rounded-xl border bg-card p-3 lg:hidden">
            <TreeList {...treeProps} />
          </div>
        </section>

        <section
          aria-label="Compare candidates"
          data-slot="calc-compare"
          className="flex flex-col gap-2"
        >
          <h3 className="text-sm font-semibold">Where each candidate ends up</h3>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {summaries.map((row) => (
              <li key={row.node.id}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    TAG_STYLE[row.node.tag].chip,
                    branch?.id === row.node.id && 'ring-2 ring-foreground',
                  )}
                  onClick={() => {
                    go(row.node.id)
                  }}
                >
                  <span className="flex items-center gap-1 font-medium">
                    {row.node.san}
                    {row.isBest ? (
                      <>
                        <Star className="size-3.5 fill-reward text-reward" aria-hidden="true" />
                        <span className="sr-only">best</span>
                      </>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatEval(row.finalEval)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {attachment.takeaway === undefined ? null : (
          <p
            className="rounded-lg border-l-4 border-primary bg-primary/5 px-3 py-2 text-sm"
            data-slot="calc-takeaway"
          >
            <span className="font-medium">Takeaway.</span> {attachment.takeaway}
          </p>
        )}

        <div className="flex flex-wrap gap-2" data-slot="calc-exits">
          <Button asChild variant="outline" size="sm">
            <Link to="/analysis">Open in analysis board</Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              toast.info('Mock: Sage would explain why here.', {
                description:
                  selected === null
                    ? 'Select a move first for a specific answer.'
                    : `About ${caption}`,
              })
            }}
          >
            <MessageCircleQuestion aria-hidden="true" />
            Ask Sage why
          </Button>
          {onTestMe === undefined ? null : (
            <Button size="sm" onClick={onTestMe}>
              Test me
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export type { CalcNode }
