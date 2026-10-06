import { Link, useSearch } from '@tanstack/react-router'
import {
  ArrowLeft,
  ArrowUpDown,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Cpu,
  FlagTriangleRight,
  Microscope,
  RefreshCw,
  Sparkles,
  TriangleAlert,
  UserRound,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Board } from '@/board'
import { useActiveJobs, useGameLookup, useGameMoves, useSettings } from '@/data'
import type { GameRow } from '@/data'
import { Button, cn, EmptyState, QualityGlyph, SimpleTooltip, toast } from '@/design'
import { MOVE_QUALITIES } from '@/domain'
import {
  emptyBoardShapes,
  toGameId,
  toSquare,
  type Arrow,
  type BoardMark,
  type BoardShapes,
  type Color,
  type GameId,
  type MoveQuality,
  type MoveRecord,
} from '@/domain'

import { whiteWinSeries } from './analyse'
import { registerReviewHandler, reviewDedupeKey, startReview } from './review-job'
import {
  formatEval,
  keyMomentsOf,
  movePairs,
  outcomeFor,
  outcomeWord,
  plural,
  positionAt,
} from './review-model'

type Tab = 'sum' | 'key' | 'mv'

const QUALITY_ORDER: readonly MoveQuality[] = MOVE_QUALITIES

const QUALITY_LABEL: Readonly<Record<MoveQuality, string>> = {
  brilliant: 'Brilliant',
  great: 'Great',
  best: 'Best',
  excellent: 'Excellent',
  good: 'Good',
  book: 'Book',
  inaccuracy: 'Inaccuracies',
  mistake: 'Mistakes',
  miss: 'Misses',
  blunder: 'Blunders',
}

function sideName(game: GameRow, color: Color): string {
  return (color === 'white' ? game.white : game.black).name
}

/**
 * Game Review Screen (`/games/review?id=…`) — ported from `prototype/review.html`.
 *
 * Everything here was written by the background review onto the stored game: a verdict and
 * an explanation for each move, the accuracy of both sides, the turning points. Opening a
 * reviewed game is a database read, so it works offline and costs the engine nothing. A
 * game that has not been reviewed offers to start one, and shows the job's progress.
 */
export function ReviewScreen() {
  const search: unknown = useSearch({ strict: false })
  const rawId =
    typeof search === 'object' && search !== null && 'id' in search && typeof search.id === 'string'
      ? search.id
      : undefined
  const id: GameId | undefined = rawId === undefined ? undefined : toGameId(rawId)

  const game = useGameLookup(id)
  const moves = useGameMoves(id)

  if (id === undefined) {
    return (
      <main className="page">
        <h1 className="sr-only">Game review</h1>
        <EmptyState
          icon={FlagTriangleRight}
          title="Choose a game to review"
          description="Reviews open from your games library, or straight after a game ends."
          action={
            <Button asChild>
              <Link to="/games">Open my games</Link>
            </Button>
          }
        />
      </main>
    )
  }
  if (game === null) {
    return (
      <main className="page">
        <h1 className="sr-only">Game review</h1>
        <EmptyState
          icon={TriangleAlert}
          title="That game is not in your library"
          description="It may have been deleted, or the link is old."
          action={
            <Button asChild>
              <Link to="/games">Open my games</Link>
            </Button>
          }
        />
      </main>
    )
  }
  if (game === undefined || moves === undefined) {
    return (
      <main className="page">
        <h1 className="sr-only">Game review</h1>
        <p className="text-sm text-muted-foreground" role="status">
          Opening your game…
        </p>
      </main>
    )
  }
  return <ReviewBody gameId={id} game={game} moves={moves} />
}

function ReviewBody({
  gameId,
  game,
  moves,
}: {
  readonly gameId: GameId
  readonly game: GameRow
  readonly moves: readonly MoveRecord[]
}) {
  const reviewed =
    game.reviewState === 'reviewed' && moves.some((move) => move.quality !== undefined)

  // A reload mid-review must pick up where it was: the job is in the queue, but only a
  // registered handler will run it.
  useEffect(() => {
    if (game.reviewState === 'queued' || game.reviewState === 'analysing') registerReviewHandler()
  }, [game.reviewState])

  if (!reviewed) return <Unreviewed gameId={gameId} game={game} hasMoves={moves.length > 0} />
  return <Reviewed game={game} moves={moves} />
}

/* ------------------------------------------------------------------ waiting */

function Unreviewed({
  gameId,
  game,
  hasMoves,
}: {
  readonly gameId: GameId
  readonly game: GameRow
  readonly hasMoves: boolean
}) {
  const jobs = useActiveJobs()
  const job = jobs?.find((candidate) => candidate.dedupeKey === reviewDedupeKey(gameId))
  const [starting, setStarting] = useState(false)
  const running = game.reviewState === 'queued' || game.reviewState === 'analysing'
  const failed = game.reviewState === 'failed'
  const opponent = sideName(game, game.youPlay === 'white' ? 'black' : 'white')

  function start(): void {
    setStarting(true)
    void startReview(gameId).then((result) => {
      setStarting(false)
      if (!result.ok)
        toast.error('The review could not start', { description: result.error.message })
    })
  }

  return (
    <main className="page">
      <h1 className="sr-only">Game review</h1>
      <div className="mx-auto max-w-xl">
        <EmptyState
          icon={failed ? TriangleAlert : Microscope}
          title={
            running
              ? 'Reviewing your game'
              : failed
                ? 'The review did not finish'
                : `Review your game against ${opponent}`
          }
          description={
            !hasMoves
              ? 'This game has no moves to review.'
              : running
                ? 'Stockfish is looking at every position, in the background. You can leave and come back; it keeps going.'
                : failed
                  ? 'Something stopped the engine part-way. Nothing is lost; you can try again.'
                  : 'Stockfish checks every move, then tells you where the game was decided and saves the ideas you missed to your Mistake Bank.'
          }
          action={
            hasMoves && !running ? (
              <Button onClick={start} disabled={starting}>
                {failed ? (
                  <RefreshCw className="size-4" aria-hidden="true" />
                ) : (
                  <Sparkles className="size-4" aria-hidden="true" />
                )}
                {failed ? 'Try again' : 'Start review'}
              </Button>
            ) : undefined
          }
        />
        {running && (
          <div className="mt-4" aria-live="polite">
            <div
              role="progressbar"
              aria-label="Review progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(job?.progress ?? 0)}
              className="progress h-2"
            >
              <span style={{ width: `${String(Math.round(job?.progress ?? 0))}%` }} />
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {job?.progressLabel ?? 'Waiting for a free moment…'}
            </p>
          </div>
        )}
        <p className="mt-6 text-center text-sm">
          <Link to="/games" className="text-muted-foreground underline underline-offset-4">
            Back to my games
          </Link>
        </p>
      </div>
    </main>
  )
}

/* ----------------------------------------------------------------- reviewed */

const GRAPH = { width: 320, height: 80 } as const

function EvalGraph({
  series,
  ply,
  onSelect,
}: {
  readonly series: readonly number[]
  readonly ply: number
  readonly onSelect: (ply: number) => void
}) {
  const last = Math.max(series.length - 1, 1)
  const x = (index: number): number => (index / last) * GRAPH.width
  const y = (win: number): number => GRAPH.height - (win / 100) * GRAPH.height
  const line = series.map((win, index) => `${x(index).toFixed(1)},${y(win).toFixed(1)}`).join(' ')

  return (
    <button
      type="button"
      className="block w-full cursor-pointer rounded-lg"
      aria-label="Evaluation graph. Click to jump to a move."
      onClick={(event) => {
        const box = event.currentTarget.getBoundingClientRect()
        const fraction = box.width === 0 ? 0 : (event.clientX - box.left) / box.width
        onSelect(Math.round(Math.min(Math.max(fraction, 0), 1) * last))
      }}
    >
      <svg
        viewBox={`0 0 ${String(GRAPH.width)} ${String(GRAPH.height)}`}
        className="w-full"
        aria-hidden="true"
      >
        <rect width={GRAPH.width} height={GRAPH.height} rx="8" fill="var(--muted)" opacity=".5" />
        <line
          x1="0"
          x2={GRAPH.width}
          y1={GRAPH.height / 2}
          y2={GRAPH.height / 2}
          stroke="var(--border)"
        />
        <polygon
          points={`0,${String(GRAPH.height)} ${line} ${String(GRAPH.width)},${String(GRAPH.height)}`}
          fill="var(--foreground)"
          opacity=".12"
        />
        <polyline
          points={line}
          fill="none"
          stroke="var(--foreground)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <line
          x1={x(ply)}
          x2={x(ply)}
          y1="0"
          y2={GRAPH.height}
          stroke="var(--cta)"
          strokeWidth="2"
        />
      </svg>
    </button>
  )
}

function MoveCell({
  move,
  current,
  onSelect,
}: {
  readonly move: MoveRecord | undefined
  readonly current: boolean
  readonly onSelect: (ply: number) => void
}) {
  if (move === undefined) return <span />
  return (
    <button
      type="button"
      aria-current={current ? 'step' : undefined}
      className={cn(
        'flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-left text-sm transition hover:bg-muted',
        current && 'bg-accent font-semibold',
      )}
      onClick={() => {
        onSelect(move.ply + 1)
      }}
    >
      <span className="san">{move.san}</span>
      {move.quality !== undefined && move.quality !== 'book' && (
        <QualityGlyph quality={move.quality} size="sm" />
      )}
    </button>
  )
}

function Reviewed({
  game,
  moves,
}: {
  readonly game: GameRow
  readonly moves: readonly MoveRecord[]
}) {
  const settings = useSettings()
  const [tab, setTab] = useState<Tab>('sum')
  const [ply, setPly] = useState(0)
  const [orientation, setOrientation] = useState<Color>(game.youPlay)

  const outcome = outcomeFor(game)
  const youAre = game.youPlay
  const opponentColor: Color = youAre === 'white' ? 'black' : 'white'
  const opponentName = sideName(game, opponentColor)
  const series = useMemo(() => whiteWinSeries(moves), [moves])
  const moments = useMemo(() => keyMomentsOf(moves, youAre), [moves, youAre])
  const pairs = useMemo(() => movePairs(moves), [moves])
  const fen = positionAt(moves, ply)
  const current = ply === 0 ? undefined : moves[ply - 1]

  const shapes: BoardShapes = useMemo(() => {
    if (current === undefined) return emptyBoardShapes()
    const arrows: Arrow[] =
      current.bestMove === undefined
        ? []
        : [
            {
              from: toSquare(current.bestMove.slice(0, 2)),
              to: toSquare(current.bestMove.slice(2, 4)),
              kind: 'best',
            },
          ]
    const marks: BoardMark[] =
      current.quality === undefined
        ? []
        : [{ square: toSquare(current.uci.slice(2, 4)), quality: current.quality }]
    return {
      ...emptyBoardShapes(),
      highlight: [toSquare(current.uci.slice(0, 2)), toSquare(current.uci.slice(2, 4))],
      arrows,
      marks,
    }
  }, [current])

  const accuracy = game.accuracy
  const counts = game.qualityCounts
  const total = moves.length
  const evalAfter = current === undefined ? undefined : current.evalAfter
  const sideAfter: Color =
    current === undefined ? 'white' : current.color === 'white' ? 'black' : 'white'

  function copyPgn(): void {
    if (game.pgn === undefined) {
      toast('This game has no PGN stored')
      return
    }
    void navigator.clipboard.writeText(game.pgn).then(
      () => {
        toast('PGN copied to clipboard')
      },
      () => {
        toast.error('Could not copy the PGN')
      },
    )
  }

  const bar = (color: Color, name: string, you: boolean) => (
    <div className="flex items-center gap-2.5 sm:gap-3">
      <span
        className={cn(
          'grid size-8 place-items-center rounded-xl sm:size-9',
          you ? 'bg-primary text-primary-foreground' : 'bg-[#3b4a44] text-[#cfe0d6]',
        )}
      >
        {you ? (
          <UserRound className="size-3.5 sm:size-4" aria-hidden="true" />
        ) : (
          <Cpu className="size-3.5 sm:size-4" aria-hidden="true" />
        )}
      </span>
      <div className="leading-tight">
        <div className="text-sm font-semibold">{name}</div>
        <div className="text-xs text-muted-foreground">
          {accuracy === undefined
            ? 'Accuracy not available'
            : `Accuracy ${String(Math.round(accuracy[color]))}%`}
        </div>
      </div>
      <span className="badge ml-auto">{color === 'white' ? 'White' : 'Black'}</span>
    </div>
  )

  const opponentBar = bar(opponentColor, opponentName, false)
  const youBar = bar(youAre, sideName(game, youAre), true)

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-1.5 border-b bg-background/85 px-2 backdrop-blur sm:gap-2 sm:px-4 lg:px-6">
        <Button asChild variant="ghost" size="sm">
          <Link to="/games">
            <ArrowLeft className="size-4" aria-hidden="true" />
            <span className="max-sm:hidden">Back to games</span>
          </Link>
        </Button>
        <div className="mx-1 h-5 w-px bg-border" />
        <h1
          aria-label="Game review"
          className="flex min-w-0 items-center gap-2 text-base font-bold"
        >
          <FlagTriangleRight className="size-4 shrink-0 text-cta" aria-hidden="true" />
          <span className="truncate">
            Review · vs {opponentName} · {outcomeWord(outcome)}
          </span>
        </h1>
        <span className="badge border-transparent bg-muted text-foreground/80 max-md:hidden">
          {game.result} · {game.termination.replace(/-/g, ' ')} · {total} half-moves
        </span>
        <div className="ml-auto flex items-center gap-1">
          <SimpleTooltip content="Flip board orientation">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Flip board"
              onClick={() => {
                setOrientation((value) => (value === 'white' ? 'black' : 'white'))
              }}
            >
              <ArrowUpDown className="size-4" aria-hidden="true" />
              <span className="max-sm:hidden">Flip</span>
            </Button>
          </SimpleTooltip>
          <SimpleTooltip content="Copy PGN to clipboard">
            <Button variant="ghost" size="sm" aria-label="Copy PGN" onClick={copyPgn}>
              Copy PGN
            </Button>
          </SimpleTooltip>
        </div>
      </header>

      <div className="grid gap-4 p-2 sm:gap-5 sm:p-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="flex justify-center" aria-label="Review board">
          <div className="w-full max-w-[min(100%,calc(100dvh-320px))] space-y-2 sm:space-y-2.5 lg:max-w-[min(100%,60vh)]">
            {orientation === youAre ? opponentBar : youBar}

            <div className="overflow-hidden rounded-xl shadow-[0_18px_40px_-18px_rgba(30,40,30,.45)] ring-1 ring-border">
              <Board
                fen={fen ?? game.initialFen}
                orientation={orientation}
                movable="none"
                shapes={shapes}
                coordinates={settings.board.coordinates}
                animationSpeed={settings.board.animation}
                label={
                  current === undefined
                    ? 'Starting position'
                    : `Position after move ${String(current.moveNumber)}, ${current.san}`
                }
              />
            </div>

            {orientation === youAre ? youBar : opponentBar}

            <div
              className="flex items-center justify-center gap-1.5"
              role="group"
              aria-label="Move controls"
            >
              <Button
                variant="outline"
                size="sm"
                aria-label="First position"
                disabled={ply === 0}
                onClick={() => {
                  setPly(0)
                }}
              >
                <ChevronFirst className="size-4" aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                aria-label="Previous move"
                disabled={ply === 0}
                onClick={() => {
                  setPly((value) => Math.max(value - 1, 0))
                }}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </Button>
              <span className="min-w-20 text-center text-xs text-muted-foreground tabular-nums">
                {ply} / {total}
              </span>
              <Button
                variant="outline"
                size="sm"
                aria-label="Next move"
                disabled={ply === total}
                onClick={() => {
                  setPly((value) => Math.min(value + 1, total))
                }}
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                aria-label="Last position"
                disabled={ply === total}
                onClick={() => {
                  setPly(total)
                }}
              >
                <ChevronLast className="size-4" aria-hidden="true" />
              </Button>
            </div>

            {series.length > 1 && <EvalGraph series={series} ply={ply} onSelect={setPly} />}

            {current !== undefined && (
              <div className="rounded-xl border bg-card p-3 text-sm" aria-live="polite">
                <div className="flex items-center gap-2 font-semibold">
                  <span className="san">{current.san}</span>
                  {current.quality !== undefined && (
                    <>
                      <QualityGlyph quality={current.quality} size="sm" labelled={false} />
                      <span className="text-xs font-medium text-muted-foreground">
                        {current.quality}
                      </span>
                    </>
                  )}
                  <span className="ml-auto text-xs font-normal text-muted-foreground">
                    Eval {formatEval(evalAfter, sideAfter)}
                  </span>
                </div>
                {current.explanation !== undefined && (
                  <p className="mt-1.5 text-xs text-muted-foreground sm:text-sm">
                    {current.explanation}
                  </p>
                )}
              </div>
            )}
          </div>
        </section>

        <aside
          className="card flex min-h-0 flex-col overflow-hidden lg:max-h-[calc(100dvh-56px-48px)]"
          aria-label="Review details"
        >
          <div className="seg m-3 flex" role="tablist" aria-label="Review sections">
            {(
              [
                ['sum', 'Summary'],
                ['key', 'Key moments'],
                ['mv', 'Moves'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={cn('flex-1', tab === id && 'is-active')}
                onClick={() => {
                  setTab(id)
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-auto px-4 pb-4" role="tabpanel">
            {tab === 'sum' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-xl bg-accent/60 p-3">
                    <div className="font-display text-2xl font-bold tabular-nums">
                      {accuracy === undefined ? '—' : `${String(Math.round(accuracy[youAre]))}%`}
                    </div>
                    <div className="text-xs text-muted-foreground">Your accuracy</div>
                  </div>
                  <div className="rounded-xl bg-muted/60 p-3">
                    <div className="font-display text-2xl font-bold tabular-nums">
                      {accuracy === undefined
                        ? '—'
                        : `${String(Math.round(accuracy[opponentColor]))}%`}
                    </div>
                    <div className="text-xs text-muted-foreground">{opponentName}</div>
                  </div>
                </div>

                {game.opening !== undefined && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{game.opening.name}</span>
                    {game.opening.eco !== undefined && ` · ${game.opening.eco}`}
                  </p>
                )}

                {counts !== undefined && (
                  <table className="w-full text-sm">
                    <caption className="sr-only">Move quality, you against {opponentName}</caption>
                    <thead>
                      <tr className="text-xs text-muted-foreground">
                        <th className="text-left font-medium" scope="col">
                          Move
                        </th>
                        <th className="w-14 text-right font-medium" scope="col">
                          You
                        </th>
                        <th className="w-14 text-right font-medium" scope="col">
                          Them
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {QUALITY_ORDER.map((quality) => (
                        <tr key={quality} className="border-t">
                          <th scope="row" className="py-1.5 text-left font-normal">
                            <span className="inline-flex items-center gap-2">
                              <QualityGlyph quality={quality} size="sm" labelled={false} />
                              {QUALITY_LABEL[quality]}
                            </span>
                          </th>
                          <td className="text-right tabular-nums">{counts[youAre][quality]}</td>
                          <td className="text-right text-muted-foreground tabular-nums">
                            {counts[opponentColor][quality]}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div className="rounded-xl bg-lilac/60 p-3 text-sm">
                  {game.mistakeCount === 0 ? (
                    <p>Nothing to add to your Mistake Bank from this game. Well played.</p>
                  ) : (
                    <p>
                      {plural(game.mistakeCount, 'position')} saved to your{' '}
                      <Link to="/mistakes" className="font-semibold underline underline-offset-4">
                        Mistake Bank
                      </Link>
                      , ready to practise.
                    </p>
                  )}
                </div>

                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to="/analysis">
                    <Microscope className="size-4" aria-hidden="true" />
                    Analyse further with the engine
                  </Link>
                </Button>
              </div>
            )}

            {tab === 'key' && (
              <div>
                {moments.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    No turning points of your own in this game. You did not give away a position.
                  </p>
                ) : (
                  <ol className="space-y-3">
                    {moments.map((moment) => (
                      <li key={moment.ply} className="rounded-xl border p-3">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <QualityGlyph
                            quality={moment.move.quality ?? 'mistake'}
                            size="sm"
                            labelled={false}
                          />
                          Move {moment.move.moveNumber}:{' '}
                          <span className="san">{moment.move.san}</span>
                        </div>
                        {moment.move.explanation !== undefined && (
                          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                            {moment.move.explanation}
                          </p>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 h-8 text-xs"
                          onClick={() => {
                            setPly(moment.ply)
                            setOrientation(youAre)
                          }}
                        >
                          Show the position before it
                        </Button>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}

            {tab === 'mv' && (
              <ol className="grid grid-cols-[2rem_1fr_1fr] items-center gap-y-0.5 text-sm">
                {pairs.map((pair) => (
                  <li key={pair.number} className="contents">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {pair.number}.
                    </span>
                    <MoveCell
                      move={pair.white}
                      current={pair.white !== undefined && pair.white.ply + 1 === ply}
                      onSelect={setPly}
                    />
                    <MoveCell
                      move={pair.black}
                      current={pair.black !== undefined && pair.black.ply + 1 === ply}
                      onSelect={setPly}
                    />
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
