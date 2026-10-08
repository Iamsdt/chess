import {
  Box,
  Cpu,
  Lightbulb,
  MessageCircle,
  RotateCcw,
  Star,
  TrendingUp,
  Undo2,
} from 'lucide-react'
import { useContext, useMemo, useRef, useState } from 'react'

import { ChatPanelContext } from '@/app/shell/shell-contexts'
import { Board, type BoardHandle, type BoardMove } from '@/board'
import { Button, EmptyState, toast } from '@/design'
import {
  emptyBoardShapes,
  oppositeColor,
  type BoardShapes,
  type Color,
  type Square,
} from '@/domain'

import { ENDGAME_CATEGORY_LABELS, defenderColor, type EndgameDrill } from './endgame-drills'
import {
  isPromotionMove,
  isUserTurn,
  kingSquareOf,
  legalMoveMap,
  moveListText,
  type DrillOutcome,
} from './endgame-session'
import { describeOutcome, outcomeHeadline, starsLabel } from './outcome-copy'
import { useDrillPorts } from './ports'
import { useEndgameDrill } from './use-endgame-drill'

import type { EndgameRecord } from './drill-records'

export interface EndgameWorkspaceProps {
  readonly drill: EndgameDrill
  readonly record: EndgameRecord
  /** The player asked to look from the other side. */
  readonly flipped: boolean
  readonly onFinished: (drill: EndgameDrill, outcome: DrillOutcome) => void
  readonly onRestart: () => void
}

/** What the status line under the player's name says. */
function statusLine(
  outcome: DrillOutcome,
  thinking: boolean,
  engineError: string | null,
  par: number,
): { text: string; tone: 'info' | 'good' | 'bad' } {
  if (engineError !== null) return { text: 'The engine stopped answering', tone: 'bad' }
  const headline = outcomeHeadline(outcome)
  if (headline !== null) return { text: headline, tone: outcome.kind === 'failed' ? 'bad' : 'good' }
  if (thinking) return { text: 'Stockfish is thinking', tone: 'info' }
  return { text: `Your move · par ${String(par)}`, tone: 'info' }
}

const TONE_CLASS = {
  info: 'text-muted-foreground',
  good: 'text-emerald-600 dark:text-emerald-400',
  bad: 'text-cta',
} as const

/**
 * The board and the detail panel for one drill.
 *
 * Mounted with `key={drill.id}:{restart}`, so choosing another drill or restarting is a
 * fresh mount rather than a reset of a dozen pieces of state.
 */
export function EndgameWorkspace({
  drill,
  record,
  flipped,
  onFinished,
  onRestart,
}: EndgameWorkspaceProps) {
  const ports = useDrillPorts()
  const chatPanel = useContext(ChatPanelContext)
  const boardRef = useRef<BoardHandle>(null)
  const [hint, setHint] = useState<Square | null>(null)

  const controller = useEndgameDrill(drill, ports.engine, (outcome) => {
    boardRef.current?.flash(outcome.kind === 'failed' ? 'error' : 'success')
    onFinished(drill, outcome)
  })
  const { session } = controller

  const orientation: Color = flipped ? oppositeColor(drill.userColor) : drill.userColor
  const outcome: DrillOutcome = session?.outcome ?? { kind: 'playing' }
  const history = useMemo(() => session?.game.history ?? [], [session])
  const movesUsed = history.filter((move) => move.color === drill.userColor).length
  const status = statusLine(outcome, controller.thinking, controller.engineError, drill.par)
  const verdict = describeOutcome(outcome, drill.par)

  const shapes: BoardShapes = useMemo(() => {
    if (session === null) return emptyBoardShapes()
    const last = history.at(-1)
    return {
      ...emptyBoardShapes(),
      highlight: last === undefined ? [] : [last.from, last.to],
      focus: hint === null ? [] : [hint],
      check:
        session.game.status.kind === 'checkmate'
          ? kingSquareOf(session.game.fen, session.game.turn)
          : null,
    }
  }, [session, history, hint])

  const legalMoves = useMemo(
    () => (session === null ? new Map<Square, readonly Square[]>() : legalMoveMap(session)),
    [session],
  )

  const handleMove = (move: BoardMove) => {
    setHint(null)
    controller.play(move)
  }

  const handleHint = () => {
    void controller.hintSquare().then((square) => {
      if (square === null) {
        toast(drill.technique.steps[0] ?? drill.technique.text)
        return
      }
      setHint(square)
      toast('Look at the highlighted piece. What does it want to do?')
    })
  }

  const handleAskSage = () => {
    if (chatPanel) {
      chatPanel.open()
      chatPanel.focusComposer()
    }
    toast(`Explain ${drill.technique.title.toLowerCase()} for ${drill.title}`)
  }

  const label = `Drill board. ${drill.title}. ${session === null ? '' : session.game.turn === 'white' ? 'White' : 'Black'} to move.`

  return (
    <>
      {/* Column 2: Drill Board */}
      <section className="flex justify-center" aria-label="Drill board">
        <div className="w-full max-w-[min(100%,calc(100dvh-220px),620px)] space-y-2 sm:space-y-2.5">
          {/* Opponent Status Bar */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <span className="avatar size-8 rounded-xl bg-engine text-engine-foreground sm:size-9">
              <Cpu className="size-4 shrink-0" aria-hidden="true" />
            </span>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-xs font-semibold sm:text-sm">
                Stockfish{' '}
                <span className="font-normal text-muted-foreground">
                  {drill.goal === 'draw' ? 'attacks' : 'defends'}
                </span>
              </div>
              <div className="truncate text-[11px] text-muted-foreground sm:text-xs">
                Full strength · plays {defenderColor(drill)}
              </div>
            </div>
            <span
              className="ml-auto shrink-0 rounded-lg bg-muted px-2.5 py-1 font-mono text-xs font-semibold text-muted-foreground tabular-nums sm:px-3 sm:text-sm"
              aria-label={`Move ${String(movesUsed + 1)}, par ${String(drill.par)}`}
            >
              {String(movesUsed + 1)} <span className="font-normal">/ {String(drill.par)}</span>
            </span>
          </div>

          {/* Board Container */}
          <div className="overflow-hidden rounded-xl shadow-[0_18px_40px_-18px_rgba(30,40,30,.45)] ring-1 ring-border">
            {session === null ? (
              <EmptyState
                icon={Box}
                title="This drill could not start"
                description={controller.startError ?? 'Its starting position is not valid.'}
                className="m-4"
              />
            ) : (
              <Board
                ref={boardRef}
                fen={session.game.fen}
                orientation={orientation}
                legalMoves={legalMoves}
                movable={isUserTurn(session) ? drill.userColor : 'none'}
                isPromotion={(from, to) => isPromotionMove(session, from, to)}
                onMove={handleMove}
                shapes={shapes}
                label={label}
                announcement={verdict ?? status.text}
              />
            )}
          </div>

          {/* Player Status Bar */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <span className="avatar size-8 rounded-xl bg-primary text-xs font-bold text-primary-foreground sm:size-9 sm:text-sm">
              You
            </span>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-xs font-semibold sm:text-sm">
                You{' '}
                <span className="font-normal text-muted-foreground">
                  · {drill.userColor === 'white' ? 'White' : 'Black'}
                </span>
              </div>
              <div
                className={`truncate text-[11px] font-medium sm:text-xs ${TONE_CLASS[status.tone]}`}
                role="status"
              >
                {status.text}
              </div>
              {controller.engineError !== null ? (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={controller.retry}
                >
                  Ask the engine again
                </Button>
              ) : null}
            </div>
            <span className="badge ml-auto shrink-0 border-transparent bg-accent text-xs text-accent-foreground sm:text-sm">
              <TrendingUp className="mr-1 size-3.5 shrink-0" aria-hidden="true" />
              {movesUsed <= drill.par
                ? `${String(drill.par - movesUsed)} to par`
                : `${String(movesUsed - drill.par)} over par`}
            </span>
          </div>
        </div>
      </section>

      {/* Column 3: Drill Details Panel */}
      <aside
        className="card flex h-fit flex-col overflow-hidden lg:col-start-2 xl:col-start-3 xl:max-h-[calc(100dvh-56px-48px)]"
        aria-label="Drill details"
      >
        <div className="border-b p-3.5 sm:p-4">
          <p className="eyebrow">{ENDGAME_CATEGORY_LABELS[drill.category]} · drill</p>
          <h2 className="mt-1 text-base leading-snug font-bold sm:text-lg">{drill.headline}</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="badge badge-reward text-xs">Par {String(drill.par)}</span>
            <span className="badge text-xs">Attempt {String(record.attempts + 1)}</span>
            {record.bestMoves !== null ? (
              <span className="badge text-xs text-muted-foreground">
                Best {String(record.bestMoves)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3.5 overflow-auto p-3.5 sm:space-y-4 sm:p-4">
          {/* Result */}
          {verdict !== null ? (
            <div
              className={`rounded-xl p-3 text-xs sm:text-sm ${
                outcome.kind === 'failed'
                  ? 'bg-cta-soft text-cta'
                  : 'bg-reward-soft text-reward-ink'
              }`}
              role="status"
            >
              <p className="font-semibold">{outcomeHeadline(outcome)}</p>
              <p className="mt-0.5">{verdict}</p>
              {outcome.kind === 'success' ? (
                <span className="mt-1.5 flex" role="img" aria-label={starsLabel(outcome.stars)}>
                  {[1, 2, 3].map((index) => (
                    <Star
                      key={index}
                      className={`size-4 ${
                        index <= outcome.stars
                          ? 'fill-reward text-reward'
                          : 'text-muted-foreground/30'
                      }`}
                      aria-hidden="true"
                    />
                  ))}
                </span>
              ) : null}
            </div>
          ) : null}

          {/* Move Progress Bar */}
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="label">Moves used</span>
              <span className="font-medium tabular-nums">
                {String(movesUsed)} of {String(drill.par)}
              </span>
            </div>
            <div
              className="mt-1.5 grid gap-0.5"
              style={{ gridTemplateColumns: `repeat(${String(drill.par)}, minmax(0, 1fr))` }}
              role="progressbar"
              aria-valuenow={Math.min(movesUsed, drill.par)}
              aria-valuemin={0}
              aria-valuemax={drill.par}
              aria-label={`${String(movesUsed)} of ${String(drill.par)} moves used`}
            >
              {Array.from({ length: drill.par }, (_, i) => {
                let barClass = 'bg-muted'
                if (i < movesUsed) barClass = 'bg-primary'
                else if (i === movesUsed) barClass = 'bg-cta'
                else if (i === drill.par - 1) barClass = 'bg-reward'
                return <span key={i} className={`h-2 rounded-xs ${barClass}`} />
              })}
            </div>
            <p className="mt-2 font-mono text-[12.5px] text-muted-foreground">
              {history.length === 0 ? 'No moves yet' : moveListText(history)}
            </p>
          </div>

          {/* Technique Card */}
          <div className="rounded-xl bg-lilac/60 p-3 sm:p-3.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-lilac-ink sm:text-sm">
              <Box className="size-4 shrink-0" aria-hidden="true" />
              {drill.technique.title}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {drill.technique.text}
            </p>
            <ol className="mt-2.5 space-y-1.5 text-xs sm:text-sm">
              {drill.technique.steps.map((step, idx) => (
                <li key={step} className="flex gap-2">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-card text-[10px] font-bold">
                    {String(idx + 1)}
                  </span>
                  <span className="leading-snug">{step}</span>
                </li>
              ))}
            </ol>
            <button
              type="button"
              className="mt-2.5 inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-lilac-ink hover:underline"
              onClick={handleAskSage}
            >
              <MessageCircle className="size-3.5 shrink-0" aria-hidden="true" />
              Ask Sage about this technique
            </button>
          </div>

          {/* Stat Counters, or an invitation when nothing has been played */}
          {record.attempts === 0 ? (
            <EmptyState
              icon={Star}
              title="No attempts yet"
              description="Finish this drill once and your best record and stars appear here."
            />
          ) : (
            <div className="grid grid-cols-3 gap-1.5 text-center sm:gap-2">
              <div className="rounded-lg bg-muted/60 p-2 sm:p-2.5">
                <div className="font-display text-base font-bold sm:text-lg">
                  {String(record.attempts)}
                </div>
                <div className="text-[11px] text-muted-foreground">attempts</div>
              </div>
              <div className="rounded-lg bg-muted/60 p-2 sm:p-2.5">
                <div className="font-display text-base font-bold sm:text-lg">
                  {record.bestMoves === null ? '–' : String(record.bestMoves)}
                </div>
                <div className="text-[11px] text-muted-foreground">best so far</div>
              </div>
              <div className="rounded-lg bg-reward-soft p-2 sm:p-2.5">
                <div className="font-display text-base font-bold text-reward-ink sm:text-lg">
                  {String(record.wins)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {drill.goal === 'draw' ? 'held' : 'wins'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Drill Action Buttons */}
        <div className="space-y-2 border-t p-3 sm:p-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 min-h-[44px] text-xs sm:h-10 sm:min-h-0 sm:text-sm"
              disabled={!controller.canTakeBack}
              onClick={controller.takeBack}
            >
              <Undo2 className="mr-1 size-4" aria-hidden="true" />
              Take back
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 min-h-[44px] border-cta/30 bg-cta-soft text-xs text-cta hover:bg-cta hover:text-cta-foreground sm:h-10 sm:min-h-0 sm:text-sm"
              disabled={session === null || !isUserTurn(session)}
              onClick={handleHint}
            >
              <Lightbulb className="mr-1 size-4" aria-hidden="true" />
              Hint
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-full text-xs text-muted-foreground"
            onClick={onRestart}
          >
            <RotateCcw className="mr-1 size-3.5" aria-hidden="true" />
            Restart drill
          </Button>
        </div>
      </aside>
    </>
  )
}
