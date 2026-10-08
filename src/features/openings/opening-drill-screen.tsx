import { Link, useSearch } from '@tanstack/react-router'
import {
  ArrowLeft,
  BookOpen,
  Eye,
  GitBranch,
  Info,
  Lightbulb,
  MessageCircle,
  Palette,
  Repeat,
  RotateCcw,
  SkipForward,
} from 'lucide-react'
import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { z } from 'zod'

import { ChatPanelContext } from '@/app/shell/shell-contexts'
import { Board, type BoardHandle, type BoardMove } from '@/board'
import { uciToSan } from '@/chess'
import { Button, cn, EmptyState, SimpleTooltip, Spinner, toast } from '@/design'
import { toFen, type Fen, type RepertoireNodeId } from '@/domain'

import { legalMapFor, promotes, shapesForMove, uciOfBoardMove } from './board-moves'
import { APP_DEPS } from './deps'
import {
  formatNextReview,
  giveUp,
  lineMastery,
  playMove,
  progressOf,
  startRun,
  takeHint,
  type DrillRun,
  type Random,
} from './drill'
import { lineText, moveText, preludeNodes, variationAlong } from './drill-view'
import { ecoDistribution } from './popularity'
import { addMoveAndSave, dueLines, recordRun, type LineSummary, type OpeningsDeps } from './service'
import { srsScheduler } from './srs-scheduler'
import { headOf, lineEnds } from './tree'
import { treeOf, useLines, useTrees, type Trees } from './use-openings'

import type { Scheduler } from './scheduler'

export interface OpeningDrillScreenProps {
  readonly deps?: OpeningsDeps
  readonly scheduler?: Scheduler
  /** Injected so tests can choose the opponent's reply. */
  readonly random?: Random
}

const SearchSchema = z.object({ opening: z.string().min(1).optional() })

/** Why a function: reading the clock inside a handler is fine, inside render it is not. */
function readClock(): number {
  return Date.now()
}

type Feedback =
  | { readonly kind: 'idle' }
  | { readonly kind: 'correct'; readonly san: string; readonly note: string | undefined }
  | { readonly kind: 'wrong'; readonly expected: string }
  | { readonly kind: 'complete'; readonly grade: string; readonly next: string }
  | { readonly kind: 'out-of-book'; readonly reply: string }
  | { readonly kind: 'revealed'; readonly line: string; readonly next: string }

interface Session {
  readonly queue: readonly RepertoireNodeId[]
  readonly index: number
  /** True when the queue is "practice anyway", not what the scheduler said was due. */
  readonly practice: boolean
}

/** Where a session starts: the scheduler's due queue, and the first run on it. */
function openSession(
  lines: readonly LineSummary[],
  trees: Trees,
  scheduler: Scheduler,
  random: Random,
): { readonly session: Session; readonly run: DrillRun | null; readonly due: number } {
  const queue = dueLines(lines, scheduler, new Date()).map((line) => line.node.id)
  return {
    session: { queue, index: 0, practice: false },
    run: runFor(queue[0], lines, trees, random),
    due: queue.length,
  }
}

function runFor(
  target: RepertoireNodeId | undefined,
  lines: readonly LineSummary[],
  trees: Trees,
  random: Random,
): DrillRun | null {
  if (target === undefined) return null
  const line = lines.find((candidate) => candidate.node.id === target)
  const tree = line === undefined ? null : treeOf(trees, line.node.color)
  return tree === null ? null : startRun(tree, target, ecoDistribution, random)
}

/**
 * Opening Drill (`/openings/drill`) — ported from `prototype/opening-drill.html`.
 *
 * The opponent plays replies weighted by how often they occur, the user plays the moves
 * they prepared, and each finished line is graded and handed to the shared SRS scheduler.
 * `?opening=` narrows the drill to one opening; without it, every due line is drilled.
 */
export function OpeningDrillScreen({
  deps = APP_DEPS,
  scheduler = srsScheduler,
  random = Math.random,
}: OpeningDrillScreenProps) {
  const rawSearch = useSearch({ strict: false })
  const search = SearchSchema.safeParse(rawSearch)
  const openingFilter = search.success ? search.data.opening : undefined

  const trees = useTrees()
  const whiteLines = useLines(trees?.white ?? null, deps)
  const blackLines = useLines(trees?.black ?? null, deps)

  const scoped = useMemo(() => {
    if (trees === undefined || whiteLines === undefined || blackLines === undefined) {
      return undefined
    }
    const all = [...whiteLines, ...blackLines]
    if (openingFilter === undefined) return all
    return all.filter((line) => {
      const tree = treeOf(trees, line.node.color)
      return tree !== null && headOf(tree, line.node.id)?.id === openingFilter
    })
  }, [trees, whiteLines, blackLines, openingFilter])

  if (trees === undefined || scoped === undefined) {
    return (
      <main className="min-h-full" aria-busy="true">
        <DrillHeader title="Opening drill" dueText={null} />
        <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground" role="status">
          <Spinner /> Loading your lines
        </p>
      </main>
    )
  }

  if (scoped.length === 0) {
    return (
      <main className="min-h-full">
        <DrillHeader title="Opening drill" dueText={null} />
        <div className="p-4 sm:p-6">
          <EmptyState
            icon={GitBranch}
            title="No lines to drill yet"
            description="Add an opening to your repertoire and every line you prepare becomes a card."
            action={
              <Button asChild className="btn-cta">
                <Link to="/openings">Go to my repertoire</Link>
              </Button>
            }
          />
        </div>
      </main>
    )
  }

  return (
    <DrillSession
      key={openingFilter ?? 'all'}
      deps={deps}
      scheduler={scheduler}
      random={random}
      trees={trees}
      lines={scoped}
    />
  )
}

function DrillHeader({
  title,
  dueText,
}: {
  readonly title: string
  readonly dueText: string | null
}) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-1.5 border-b bg-background/85 px-3 backdrop-blur sm:gap-2 sm:px-4 lg:px-6">
      <Button asChild variant="ghost" size="sm" className="h-9 px-2 text-xs sm:px-3 sm:text-sm">
        <Link to="/openings">
          <ArrowLeft className="mr-1 size-4" aria-hidden="true" />
          <span className="max-sm:hidden">Repertoire</span>
        </Link>
      </Button>
      <div className="mx-0.5 h-5 w-px bg-border sm:mx-1" />
      <h1
        aria-label="Opening drill"
        className="flex min-w-0 items-center gap-1.5 text-sm font-bold sm:gap-2 sm:text-base"
      >
        <BookOpen className="size-4 shrink-0 text-cta" aria-hidden="true" />
        <span className="truncate">{title}</span>
      </h1>
      <span className="badge badge-soft max-lg:hidden">
        <Repeat className="size-3.5" aria-hidden="true" />
        Spaced review
      </span>
      <div className="ml-auto flex items-center gap-1">
        {dueText !== null && (
          <span className="text-xs text-muted-foreground max-md:hidden">{dueText}</span>
        )}
        <SimpleTooltip content="Board and piece settings">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="size-8 sm:size-9"
            aria-label="Board and piece settings"
          >
            <Link to="/settings" hash="board">
              <Palette className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </SimpleTooltip>
      </div>
    </header>
  )
}

interface DrillSessionProps {
  readonly deps: OpeningsDeps
  readonly scheduler: Scheduler
  readonly random: Random
  readonly trees: Trees
  /** Live lines, so mastery bars follow each review as it is stored. */
  readonly lines: readonly LineSummary[]
}

function DrillSession({ deps, scheduler, random, trees, lines: scoped }: DrillSessionProps) {
  const chatPanel = useContext(ChatPanelContext)
  const boardRef = useRef<BoardHandle>(null)
  const moveStartedAt = useRef<number | null>(null)
  const [boot] = useState(() => openSession(scoped, trees, scheduler, random))
  const [session, setSession] = useState<Session>(boot.session)
  const [run, setRun] = useState<DrillRun | null>(boot.run)
  const [feedback, setFeedback] = useState<Feedback>({ kind: 'idle' })
  const [wrongUci, setWrongUci] = useState<string | null>(null)
  const [hintUci, setHintUci] = useState<string | null>(null)
  const dueToday = boot.due

  useEffect(() => {
    moveStartedAt.current = readClock()
  }, [])

  const begin = (target: RepertoireNodeId | undefined, nextSession: Session) => {
    setSession(nextSession)
    setFeedback({ kind: 'idle' })
    setWrongUci(null)
    setHintUci(null)
    moveStartedAt.current = readClock()
    setRun(runFor(target, scoped, trees, random))
  }

  const practiceAnyway = () => {
    const queue = [...scoped]
      .sort((a, b) => (a.card?.due ?? 0) - (b.card?.due ?? 0))
      .map((line) => line.node.id)
    begin(queue[0], { queue, index: 0, practice: true })
  }

  const advanceQueue = () => {
    const index = session.index + 1
    begin(session.queue[index], { ...session, index })
  }

  const finish = async (finished: DrillRun) => {
    const outcome = await recordRun(deps, scheduler, finished)
    if (!outcome.ok) {
      toast(`Could not save this review: ${outcome.error.message}`)
      return
    }
    if (outcome.value === null) return
    const next = formatNextReview(outcome.value.card, new Date())
    const target = finished.tree.nodes.get(finished.targetId)
    if (finished.gaveUp) {
      setFeedback({
        kind: 'revealed',
        line: target === undefined ? '' : lineText(finished.tree, finished.headId, target.id),
        next,
      })
      return
    }
    setFeedback({ kind: 'complete', grade: outcome.value.grade, next })
  }

  const handleMove = (move: BoardMove) => {
    if (run?.status !== 'your-move') return
    const uci = uciOfBoardMove(move)
    const elapsed = moveStartedAt.current === null ? 0 : readClock() - moveStartedAt.current
    const result = playMove(run, uci, elapsed, ecoDistribution, random)
    setRun(result.run)
    setHintUci(null)
    if (result.verdict.kind === 'wrong') {
      setWrongUci(uci)
      setFeedback({
        kind: 'wrong',
        expected: result.verdict.expected.map((node) => node.san ?? '').join(' or '),
      })
      boardRef.current?.shake()
      boardRef.current?.flash('error')
      return
    }
    setWrongUci(null)
    moveStartedAt.current = readClock()
    boardRef.current?.flash('success')
    setFeedback({
      kind: 'correct',
      san: moveText(result.verdict.node),
      note: result.verdict.node.comment,
    })
    if (result.run.status === 'out-of-book') {
      const last = result.run.trail.at(-1)
      setFeedback({ kind: 'out-of-book', reply: last?.san ?? '' })
    }
    if (result.run.status !== 'your-move') void finish(result.run)
  }

  const handleHint = () => {
    if (run === null) return
    const hinted = takeHint(run)
    setRun(hinted.run)
    setHintUci(hinted.hint?.uci ?? null)
  }

  const handleReveal = () => {
    if (run === null) return
    const given = giveUp(run)
    setRun(given)
    void finish(given)
  }

  const handleRetry = () => {
    boardRef.current?.clearSelection()
    setWrongUci(null)
    setHintUci(null)
    moveStartedAt.current = readClock()
    setFeedback({ kind: 'idle' })
  }

  const keepWrongMove = async () => {
    if (run === null || wrongUci === null) return
    const added = await addMoveAndSave(deps, run.tree, run.currentId, wrongUci)
    toast(
      added.ok
        ? 'Added as a side branch in your tree. Play your answer to it in the editor.'
        : `Could not add that move: ${added.error.message}`,
    )
    if (added.ok) setWrongUci(null)
  }

  const handleAskSage = (prompt: string) => {
    chatPanel?.open()
    chatPanel?.focusComposer()
    toast(prompt)
  }

  if (run === null) {
    return (
      <main className="min-h-full">
        <DrillHeader title="Opening drill" dueText={null} />
        <div className="p-4 sm:p-6">
          <EmptyState
            icon={Repeat}
            title={session.practice ? 'That was every line' : 'Nothing is due right now'}
            description={
              session.practice
                ? 'Your schedule is updated. The next lines come back when they are due.'
                : 'Your repertoire is up to date. You can still practise the lines that are furthest away.'
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {!session.practice && (
                  <Button className="btn-cta" onClick={practiceAnyway}>
                    Practise anyway
                  </Button>
                )}
                <Button asChild variant="outline">
                  <Link to="/openings">Back to my repertoire</Link>
                </Button>
              </div>
            }
          />
        </div>
      </main>
    )
  }

  const tree = run.tree
  const node = tree.nodes.get(run.currentId)
  const fen: Fen = node?.fen ?? toFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
  const head = tree.nodes.get(run.headId)
  const progress = progressOf(run)
  const yourColor = tree.color
  const peers = lineEnds(tree, run.headId)
  const prelude = preludeNodes(tree, run.headId)
  const canMove = run.status === 'your-move'
  const lastOpponent = run.trail.filter((step) => step.by === 'opponent').at(-1)
  const lastBookNode = lastOpponent === undefined ? head : tree.nodes.get(lastOpponent.nodeId)
  const wrongSan =
    wrongUci === null
      ? null
      : (() => {
          const san = uciToSan(fen, wrongUci)
          return san.ok ? san.value : wrongUci
        })()
  const remaining = Math.max(progress.total - progress.done, 0)
  const dueText = `${String(Math.max(dueToday - (session.practice ? 0 : session.index), 0))} due today`

  return (
    <main className="min-h-full">
      <DrillHeader title={titleOf(run)} dueText={dueText} />

      <div className="grid gap-4 p-3 sm:gap-5 sm:p-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="flex justify-center" aria-label="Drill board">
          <div className="w-full max-w-[min(100%,calc(100dvh-200px),540px)] space-y-2 sm:space-y-2.5">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <span className="avatar size-8 rounded-xl bg-sky text-sky-ink sm:size-9">
                <BookOpen className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 leading-tight">
                <div className="truncate text-xs font-semibold sm:text-sm">
                  {yourColor === 'white' ? 'Black' : 'White'}{' '}
                  <span className="font-normal text-muted-foreground">· plays the book</span>
                </div>
                <div className="truncate text-[11px] text-muted-foreground sm:text-xs">
                  Last move{' '}
                  <span className="font-mono">
                    {lastBookNode?.san === null || lastBookNode === undefined
                      ? 'none yet'
                      : moveText(lastBookNode)}
                  </span>
                </div>
              </div>
              <span className="badge ml-auto shrink-0 text-xs">No clock</span>
            </div>

            <div className="overflow-hidden rounded-xl shadow-[0_18px_40px_-18px_rgba(30,40,30,.45)] ring-1 ring-border">
              <Board
                ref={boardRef}
                fen={fen}
                orientation={yourColor}
                coordinates
                movable={canMove ? yourColor : 'none'}
                legalMoves={canMove ? legalMapFor(fen) : new Map()}
                isPromotion={(from, to) => promotes(fen, from, to)}
                onMove={handleMove}
                shapes={shapesForMove(hintUci ?? node?.uci ?? null)}
                label={`Drill board, ${yourColor === 'white' ? 'White' : 'Black'} to ${canMove ? 'move' : 'rest'}`}
              />
            </div>

            <div className="flex items-center gap-2.5 sm:gap-3">
              <span className="avatar size-8 rounded-xl bg-primary text-xs font-bold text-primary-foreground sm:size-9 sm:text-sm">
                You
              </span>
              <div className="min-w-0 leading-tight">
                <div className="truncate text-xs font-semibold sm:text-sm">
                  You{' '}
                  <span className="font-normal text-muted-foreground">
                    · {yourColor === 'white' ? 'White' : 'Black'}
                  </span>
                </div>
                <div
                  className={cn(
                    'truncate text-[11px] font-medium sm:text-xs',
                    feedback.kind === 'wrong' ? 'text-destructive' : 'text-primary',
                  )}
                >
                  {statusLine(feedback, canMove)}
                </div>
              </div>
            </div>

            <div
              className="card flex flex-wrap items-center gap-x-1.5 gap-y-1.5 px-2.5 py-2 sm:px-3 sm:py-2.5"
              aria-label="Line progress"
            >
              {prelude.map((step) => (
                <span key={step.id} className="font-mono text-xs text-muted-foreground">
                  {moveText(step)}
                </span>
              ))}
              {run.trail.map((step) => {
                const stepNode = tree.nodes.get(step.nodeId)
                return step.by === 'you' ? (
                  <span
                    key={step.nodeId}
                    className="flex items-center gap-0.5 font-mono text-xs font-medium"
                  >
                    <span className="rounded bg-accent px-1 text-[10px] font-bold text-accent-foreground">
                      B
                    </span>
                    {stepNode === undefined ? step.san : moveText(stepNode)}
                  </span>
                ) : (
                  <span key={step.nodeId} className="font-mono text-xs text-muted-foreground">
                    {stepNode === undefined ? step.san : moveText(stepNode)}
                  </span>
                )
              })}
              {canMove && (
                <span className="rounded bg-cta-soft px-1.5 py-0.5 font-mono text-xs font-bold text-cta ring-1 ring-cta/30">
                  your move
                </span>
              )}
              {remaining > 1 && (
                <span className="font-mono text-[11px] text-muted-foreground/60 sm:text-[13px]">
                  {'··· '.repeat(remaining - (canMove ? 1 : 0)).trim()}
                </span>
              )}
            </div>
          </div>
        </section>

        <aside
          className="card flex min-h-0 flex-col overflow-hidden lg:max-h-[calc(100dvh-56px-48px)]"
          aria-label="Drill panel"
        >
          <div className="border-b px-3.5 py-2.5 sm:px-4 sm:py-3">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="font-semibold">{head?.openingName ?? 'Repertoire line'}</span>
              <span className="text-xs text-muted-foreground">
                Your move{' '}
                <span className="font-medium text-foreground">
                  {String(Math.min(progress.done + 1, progress.total))} of {String(progress.total)}
                </span>
              </span>
            </div>
            <div className="mt-2 flex gap-1" aria-hidden="true">
              {Array.from({ length: progress.total }, (_, index) => (
                <span
                  key={index}
                  className={cn(
                    'h-1.5 flex-1 rounded-full',
                    index < progress.done
                      ? 'bg-primary'
                      : index === progress.done && canMove
                        ? 'bg-cta'
                        : 'bg-muted',
                  )}
                />
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-3.5 overflow-auto p-3.5 sm:space-y-4 sm:p-4">
            <FeedbackBox feedback={feedback} wrongSan={wrongSan} onAskSage={handleAskSage} />

            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="label">{head?.openingName ?? 'Opening'} lines · mastery</span>
                <span className="text-muted-foreground">next review</span>
              </div>
              <ul className="mt-2 space-y-1 text-xs sm:text-sm">
                {peers.map((peer, index) => {
                  const card = (scoped.find((line) => line.node.id === peer.id) ?? undefined)?.card
                  const isActive = peer.id === run.targetId
                  const mastery = lineMastery(card)
                  return (
                    <li key={peer.id}>
                      <button
                        type="button"
                        aria-current={isActive ? 'true' : undefined}
                        className={cn(
                          'flex min-h-[38px] w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
                          isActive ? 'bg-cta-soft ring-1 ring-cta/30' : 'hover:bg-muted/50',
                        )}
                        onClick={() => {
                          begin(peer.id, {
                            queue: [peer.id],
                            index: 0,
                            practice: true,
                          })
                        }}
                      >
                        <span
                          className={cn(
                            'w-4 shrink-0 text-xs',
                            isActive ? 'font-semibold text-cta' : 'text-muted-foreground',
                          )}
                        >
                          {String(index + 1)}
                        </span>
                        <span
                          className={cn(
                            'min-w-0 flex-1 truncate font-mono text-[11px] sm:text-[12px]',
                            isActive && 'font-medium',
                          )}
                        >
                          {lineText(tree, run.headId, peer.id)}
                        </span>
                        <span className="w-8 shrink-0">
                          <span
                            role="progressbar"
                            aria-valuenow={mastery}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`Line ${String(index + 1)} mastery`}
                            className="progress block h-1.5"
                          >
                            <span
                              className={cn(isActive && '!bg-cta')}
                              style={{ width: `${String(mastery)}%` }}
                            />
                          </span>
                        </span>
                        <span
                          className={cn(
                            'w-[4.2rem] shrink-0 text-right text-xs whitespace-nowrap',
                            isActive ? 'font-medium text-cta' : 'text-muted-foreground',
                          )}
                        >
                          {formatNextReview(card, new Date())}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>

            <p className="flex gap-2 rounded-lg border border-dashed p-2.5 text-xs text-muted-foreground sm:p-3">
              <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              Get a line right and its next review moves further out. A slip brings it back sooner.
            </p>
          </div>

          <div className="space-y-2 border-t p-3 sm:p-4">
            {canMove ? (
              <Button
                className="btn-cta h-10 w-full font-semibold sm:h-11"
                onClick={feedback.kind === 'wrong' ? handleRetry : handleHint}
              >
                {feedback.kind === 'wrong' ? (
                  <RotateCcw className="size-[18px]" aria-hidden="true" />
                ) : (
                  <Lightbulb className="size-[18px]" aria-hidden="true" />
                )}
                {feedback.kind === 'wrong' ? 'Try the move again' : 'Show a hint'}
              </Button>
            ) : (
              <Button className="btn-cta h-10 w-full font-semibold sm:h-11" onClick={advanceQueue}>
                <SkipForward className="size-[18px]" aria-hidden="true" />
                {session.index + 1 < session.queue.length ? 'Next line' : 'Finish'}
              </Button>
            )}
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-9 min-h-[40px] text-xs text-muted-foreground sm:min-h-0 sm:text-sm"
                disabled={!canMove}
                onClick={handleReveal}
              >
                <Eye className="size-3.5" aria-hidden="true" />
                Show answer
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 min-h-[40px] text-xs text-muted-foreground sm:min-h-0 sm:text-sm"
                onClick={advanceQueue}
              >
                <SkipForward className="size-3.5" aria-hidden="true" />
                Skip line
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 min-h-[40px] text-xs text-muted-foreground sm:min-h-0 sm:text-sm"
                disabled={wrongSan === null}
                onClick={() => {
                  void keepWrongMove()
                }}
              >
                <GitBranch className="size-3.5" aria-hidden="true" />
                {wrongSan === null ? 'Keep a move' : `Keep ${wrongSan} too`}
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}

/** "Caro-Kann Defence · Advance Variation · line 3 of 8", or just the heading while loading. */
function titleOf(run: DrillRun | null): string {
  if (run === null) return 'Opening drill'
  const head = run.tree.nodes.get(run.headId)
  const variation = variationAlong(run.tree, run.targetId)
  const peers = lineEnds(run.tree, run.headId)
  const position = peers.findIndex((peer) => peer.id === run.targetId) + 1
  return [
    head?.openingName ?? 'Repertoire',
    variation,
    position > 0 ? `line ${String(position)} of ${String(peers.length)}` : undefined,
  ]
    .filter((part): part is string => part !== undefined)
    .join(' · ')
}

function statusLine(feedback: Feedback, canMove: boolean): string {
  switch (feedback.kind) {
    case 'correct':
      return 'Repertoire move found!'
    case 'wrong':
      return 'Not in your repertoire · try again'
    case 'complete':
      return 'Line finished'
    case 'revealed':
      return 'Answer shown'
    case 'out-of-book':
      return 'Out of your book'
    case 'idle':
      return canMove ? 'Your move · play it from memory' : 'Waiting'
  }
}

function FeedbackBox({
  feedback,
  wrongSan,
  onAskSage,
}: {
  readonly feedback: Feedback
  readonly wrongSan: string | null
  readonly onAskSage: (prompt: string) => void
}) {
  const tone =
    feedback.kind === 'wrong'
      ? 'border-destructive/40 bg-destructive/10'
      : feedback.kind === 'idle'
        ? 'border-border bg-muted/40'
        : 'border-reward/40 bg-reward-soft'
  return (
    <div className={cn('rounded-xl border p-3 sm:p-3.5', tone)} role="status">
      {feedback.kind === 'idle' && (
        <p className="text-xs leading-relaxed sm:text-sm">
          Play the move you prepared. The opponent answers the way players usually do.
        </p>
      )}
      {feedback.kind === 'correct' && (
        <>
          <div className="flex items-center gap-2 text-xs font-semibold text-reward-ink sm:text-sm">
            <span aria-hidden="true">✓</span>
            You played {feedback.san}
          </div>
          <p className="mt-1 text-xs leading-relaxed sm:text-sm">
            {feedback.note ?? 'That is your repertoire move.'}
          </p>
        </>
      )}
      {feedback.kind === 'wrong' && (
        <>
          <div className="text-xs font-semibold sm:text-sm">
            {wrongSan === null ? 'Not that one' : `${wrongSan} is not in your repertoire`}
          </div>
          <p className="mt-1 text-xs leading-relaxed sm:text-sm">
            Your prepared move here is {feedback.expected}. Take another look at the position.
          </p>
          <button
            type="button"
            className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            onClick={() => {
              onAskSage(`Why is ${feedback.expected} my move here and not ${wrongSan ?? 'that'}?`)
            }}
          >
            <MessageCircle className="size-3.5" aria-hidden="true" />
            Why {feedback.expected} here?
          </button>
        </>
      )}
      {feedback.kind === 'complete' && (
        <>
          <div className="flex items-center gap-2 text-xs font-semibold text-reward-ink sm:text-sm">
            <span aria-hidden="true">✓</span>
            Line finished
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {feedback.grade === 'again'
              ? 'This one needs another look. It comes back soon.'
              : `Next review: ${feedback.next}.`}
          </p>
        </>
      )}
      {feedback.kind === 'revealed' && (
        <>
          <div className="text-xs font-semibold sm:text-sm">The line was</div>
          <p className="mt-1 font-mono text-xs leading-relaxed sm:text-sm">{feedback.line}</p>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            It comes back {feedback.next === 'now' ? 'shortly' : feedback.next}, so it sticks.
          </p>
        </>
      )}
      {feedback.kind === 'out-of-book' && (
        <>
          <div className="text-xs font-semibold sm:text-sm">
            They played {feedback.reply}, which your tree does not answer yet
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Add your reply in the tree editor. This run is not scored.
          </p>
        </>
      )}
    </div>
  )
}
