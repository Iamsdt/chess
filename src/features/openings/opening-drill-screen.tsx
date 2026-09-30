import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  BookOpen,
  GitBranch,
  Info,
  MessageCircle,
  Palette,
  Repeat,
  RotateCcw,
  SkipForward,
} from 'lucide-react'
import { useContext, useMemo, useRef, useState } from 'react'

import { ChatPanelContext } from '@/app/shell/shell-contexts'
import { Board, type BoardHandle, type BoardMove, type LegalMoveMap } from '@/board'
import { Button, cn, SimpleTooltip, toast } from '@/design'
import {
  emptyBoardShapes,
  toFen,
  toSquare,
  type BoardShapes,
  type Fen,
  type Square,
} from '@/domain'

export interface AdvanceLineItem {
  readonly number: number
  readonly moves: string
  readonly mastery: number
  readonly nextReview: string
}

const INITIAL_DRILL_FEN: Fen = toFen(
  'rnbqkbnr/pp2pppp/2p5/3pP3/3P4/8/PPP2PPP/RNBQKBNR b KQkq - 0 3',
)
const AFTER_BF5_FEN: Fen = toFen('rn1qkbnr/pp2pppp/2p5/3pPb2/3P4/8/PPP2PPP/RNBQKBNR w KQkq - 1 4')
const AFTER_C5_FEN: Fen = toFen('rnbqkbnr/pp2pppp/8/2ppP3/3P4/8/PPP2PPP/RNBQKBNR w KQkq - 0 4')

const ADVANCE_LINES: readonly AdvanceLineItem[] = [
  { number: 1, moves: '4.Nc3 e6 5.g4 Bg6', mastery: 88, nextReview: 'in 9 days' },
  { number: 2, moves: '4.h4 h5', mastery: 74, nextReview: 'in 4 days' },
  { number: 3, moves: '4.Nf3 e6 5.Be2 c5', mastery: 38, nextReview: 'now' },
  { number: 4, moves: '4.Nd2 e6 5.Nb3 Nd7', mastery: 52, nextReview: 'today' },
  { number: 5, moves: '4.c3 e6 5.Be2 c5', mastery: 61, nextReview: 'tomorrow' },
  { number: 6, moves: '4.Bd3 Bxd3 5.Qxd3 e6', mastery: 90, nextReview: 'in 12 days' },
  { number: 7, moves: '4.Ne2 e6 5.Ng3 Bg6', mastery: 45, nextReview: 'in 2 days' },
  { number: 8, moves: '4.g4 Bd7', mastery: 20, nextReview: 'new' },
]

/**
 * Legal moves for Black from the starting Caro-Kann Advance position (after 3.e5):
 * Bishop c8, Pawns c6, e7, g7, h7, a7, b7, Knights b8, g8, Queen d8, King e8.
 */
const CARO_LEGAL_MOVES: LegalMoveMap = new Map<Square, readonly Square[]>([
  [
    toSquare('c8'),
    [toSquare('f5'), toSquare('g4'), toSquare('h3'), toSquare('d7'), toSquare('e6')],
  ],
  [toSquare('c6'), [toSquare('c5')]],
  [toSquare('e7'), [toSquare('e6')]],
  [toSquare('b8'), [toSquare('d7'), toSquare('a6')]],
  [toSquare('g8'), [toSquare('f6'), toSquare('h6'), toSquare('e7')]],
  [toSquare('d8'), [toSquare('b6'), toSquare('a5'), toSquare('c7')]],
  [toSquare('g7'), [toSquare('g6'), toSquare('g5')]],
  [toSquare('h7'), [toSquare('h6'), toSquare('h5')]],
  [toSquare('a7'), [toSquare('a6'), toSquare('a5')]],
  [toSquare('b7'), [toSquare('b6'), toSquare('b5')]],
  [toSquare('e8'), [toSquare('d7')]],
])

type MoveState = 'unplayed' | 'correct' | 'alternative' | 'wrong'

/**
 * Opening Drill Screen (`/openings/drill`) — ported from `prototype/opening-drill.html`.
 *
 * Interactive repertoire flashcard rehearsal:
 * - Playable board testing opening memory against book responses
 * - Move classification (repertoire move, alternative side-line, or miss)
 * - Move-by-move progress bar and visual feedback cards
 * - Spaced repetition schedule preview for all lines in the variation
 */
export function OpeningDrillScreen() {
  const chatPanel = useContext(ChatPanelContext)
  const boardRef = useRef<BoardHandle>(null)

  const [currentFen, setCurrentFen] = useState<Fen>(INITIAL_DRILL_FEN)
  const [moveState, setMoveState] = useState<MoveState>('alternative')
  const [activeLineNumber, setActiveLineNumber] = useState<number>(3)
  const [playedMoveSan, setPlayedMoveSan] = useState<string>('3…c5')

  const boardShapes: BoardShapes = useMemo(
    () => ({
      ...emptyBoardShapes(),
      highlight: [toSquare('e4'), toSquare('e5')],
    }),
    [],
  )

  const handleAskSage = (prompt: string) => {
    if (chatPanel) {
      chatPanel.open()
      chatPanel.focusComposer()
    }
    toast(prompt)
  }

  const handleMove = (move: BoardMove) => {
    // Correct repertoire move: 3...Bf5 (c8 -> f5)
    if (move.from === 'c8' && move.to === 'f5') {
      setCurrentFen(AFTER_BF5_FEN)
      setMoveState('correct')
      setPlayedMoveSan('3…Bf5')
      boardRef.current?.flash('success')
      toast('Correct repertoire move: 3…Bf5!')
      return
    }

    // Alternative move: 3...c5 (c6 -> c5)
    if (move.from === 'c6' && move.to === 'c5') {
      setCurrentFen(AFTER_C5_FEN)
      setMoveState('alternative')
      setPlayedMoveSan('3…c5')
      boardRef.current?.flash('hint')
      toast('Playable move, but repertoire prefers 3…Bf5')
      return
    }

    // Any other move
    setMoveState('wrong')
    setPlayedMoveSan(`${move.from}-${move.to}`)
    boardRef.current?.shake()
    boardRef.current?.flash('error')
    toast('Not your repertoire move. Try 3…Bf5.')
  }

  const handleResetMove = () => {
    setCurrentFen(INITIAL_DRILL_FEN)
    setMoveState('unplayed')
    setPlayedMoveSan('3…?')
    boardRef.current?.clearSelection()
    toast('Board reset to 3.e5. Your move.')
  }

  const handleSkipLine = () => {
    toast('Line skipped. It comes back tomorrow.')
  }

  const handleKeepC5 = () => {
    toast('Added 3…c5 as a side branch in your tree')
  }

  return (
    <main className="min-h-full">
      {/* Sticky Header */}
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
          <span className="truncate">
            Caro-Kann{' '}
            <span className="max-sm:hidden">
              <span className="font-normal text-muted-foreground">·</span> Advance Variation
            </span>{' '}
            <span className="font-normal text-muted-foreground">·</span> line 3 of 8
          </span>
        </h1>
        <span className="badge badge-soft max-lg:hidden">
          <Repeat className="size-3.5" aria-hidden="true" />
          Spaced review
        </span>
        <div className="ml-auto flex items-center gap-1">
          <span className="text-xs text-muted-foreground max-md:hidden">7 due today</span>
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

      <div className="grid gap-4 p-3 sm:gap-5 sm:p-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Board column */}
        <section className="flex justify-center" aria-label="Drill board">
          <div className="w-full max-w-[min(100%,calc(100dvh-200px),540px)] space-y-2 sm:space-y-2.5">
            {/* White Opponent Card */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <span className="avatar size-8 rounded-xl bg-sky text-sky-ink sm:size-9">
                <BookOpen className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 leading-tight">
                <div className="truncate text-xs font-semibold sm:text-sm">
                  White <span className="font-normal text-muted-foreground">· plays the book</span>
                </div>
                <div className="truncate text-[11px] text-muted-foreground sm:text-xs">
                  Last move <span className="font-mono">3.e5</span>
                </div>
              </div>
              <span className="badge ml-auto shrink-0 text-xs">No clock</span>
            </div>

            {/* Chessboard */}
            <div className="overflow-hidden rounded-xl shadow-[0_18px_40px_-18px_rgba(30,40,30,.45)] ring-1 ring-border">
              <Board
                ref={boardRef}
                fen={currentFen}
                orientation="black"
                coordinates
                movable="black"
                legalMoves={CARO_LEGAL_MOVES}
                onMove={handleMove}
                shapes={boardShapes}
                label="Drill board after 1.e4 c6 2.d4 d5 3.e5, Black to move"
              />
            </div>

            {/* Black Player Card */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <span className="avatar size-8 rounded-xl bg-primary text-xs font-bold text-primary-foreground sm:size-9 sm:text-sm">
                SK
              </span>
              <div className="min-w-0 leading-tight">
                <div className="truncate text-xs font-semibold sm:text-sm">
                  You <span className="font-normal text-muted-foreground">· Black</span>
                </div>
                <div
                  className={cn(
                    'truncate text-[11px] font-medium sm:text-xs',
                    moveState === 'correct' && 'text-emerald-600 dark:text-emerald-400',
                    moveState === 'alternative' && 'text-cta',
                    moveState === 'wrong' && 'text-destructive',
                    moveState === 'unplayed' && 'text-emerald-600 dark:text-emerald-400',
                  )}
                >
                  {moveState === 'correct'
                    ? 'Repertoire move found!'
                    : moveState === 'alternative'
                      ? 'Playable, but repertoire prefers 3…Bf5'
                      : moveState === 'wrong'
                        ? 'Try again · find 3…Bf5'
                        : 'Your move · play it from memory'}
                </div>
              </div>
            </div>

            {/* Line Progress Card */}
            <div
              className="card flex flex-wrap items-center gap-x-1.5 gap-y-1.5 px-2.5 py-2 sm:px-3 sm:py-2.5"
              aria-label="Line progress"
            >
              <span className="font-mono text-xs text-muted-foreground">1.e4</span>
              <span className="flex items-center gap-0.5 font-mono text-xs font-medium">
                <span className="rounded bg-accent px-1 text-[10px] font-bold text-accent-foreground">
                  B
                </span>
                c6
              </span>
              <span className="font-mono text-xs text-muted-foreground">2.d4</span>
              <span className="flex items-center gap-0.5 font-mono text-xs font-medium">
                <span className="rounded bg-accent px-1 text-[10px] font-bold text-accent-foreground">
                  B
                </span>
                d5
              </span>
              <span className="font-mono text-xs text-muted-foreground">3.e5</span>
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 font-mono text-xs font-bold',
                  moveState === 'correct'
                    ? 'bg-reward-soft text-reward-ink ring-1 ring-reward/40'
                    : 'bg-cta-soft text-cta ring-1 ring-cta/30',
                )}
              >
                {moveState === 'correct' ? '3…Bf5' : playedMoveSan}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground/60 sm:text-[13px]">
                4.··· ··· 5.··· ··· 6.··· ··· 7.··· ···
              </span>
            </div>
          </div>
        </section>

        {/* Side Panel */}
        <aside
          className="card flex min-h-0 flex-col overflow-hidden lg:max-h-[calc(100dvh-56px-48px)]"
          aria-label="Drill panel"
        >
          <div className="border-b px-3.5 py-2.5 sm:px-4 sm:py-3">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="font-semibold">Short System</span>
              <span className="text-xs text-muted-foreground">
                Your move <span className="font-medium text-foreground">3 of 7</span>
              </span>
            </div>
            <div className="mt-2 grid grid-cols-7 gap-1" aria-hidden="true">
              <span className="h-1.5 rounded-full bg-primary" />
              <span className="h-1.5 rounded-full bg-primary" />
              <span className="h-1.5 rounded-full bg-cta" />
              <span className="h-1.5 rounded-full bg-muted" />
              <span className="h-1.5 rounded-full bg-muted" />
              <span className="h-1.5 rounded-full bg-muted" />
              <span className="h-1.5 rounded-full bg-muted" />
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-3.5 overflow-auto p-3.5 sm:space-y-4 sm:p-4">
            {/* Feedback Box */}
            <div
              className="rounded-xl border border-reward/40 bg-reward-soft p-3 sm:p-3.5"
              role="status"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-reward-ink sm:text-sm">
                <span>✓</span>
                {moveState === 'correct'
                  ? 'You played 3…Bf5'
                  : moveState === 'wrong'
                    ? 'Move attempted'
                    : 'You played 3…c5'}
              </div>
              <p className="mt-1 text-xs leading-relaxed sm:text-sm">
                {moveState === 'correct'
                  ? 'Core repertoire move. The bishop gets out before …e6 locks it in.'
                  : moveState === 'wrong'
                    ? "That's not in your repertoire. Look for an active bishop developing move."
                    : "That's playable, but your repertoire move is 3…Bf5."}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {moveState === 'correct'
                  ? 'Line mastered for today. Next spaced rehearsal in 3 days.'
                  : 'Bishop out first, then …e6 and …c5. This line comes back tomorrow so it sticks.'}
              </p>
              <button
                type="button"
                className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                onClick={() => {
                  handleAskSage('Why is 3...Bf5 my move here and not 3...c5?')
                }}
              >
                <MessageCircle className="size-3.5" aria-hidden="true" />
                Why …Bf5 here?
              </button>
            </div>

            {/* Advance lines list */}
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="label">Advance lines · mastery</span>
                <span className="text-muted-foreground">next review</span>
              </div>
              <ul className="mt-2 space-y-1 text-xs sm:text-sm">
                {ADVANCE_LINES.map((line) => {
                  const isActive = line.number === activeLineNumber
                  return (
                    <li key={line.number}>
                      <button
                        type="button"
                        className={cn(
                          'flex min-h-[38px] w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
                          isActive ? 'bg-cta-soft ring-1 ring-cta/30' : 'hover:bg-muted/50',
                        )}
                        onClick={() => {
                          setActiveLineNumber(line.number)
                        }}
                      >
                        <span
                          className={cn(
                            'w-4 shrink-0 text-xs',
                            isActive ? 'font-semibold text-cta' : 'text-muted-foreground',
                          )}
                        >
                          {String(line.number)}
                        </span>
                        <span
                          className={cn(
                            'min-w-0 flex-1 truncate font-mono text-[11px] sm:text-[12px]',
                            isActive && 'font-medium',
                          )}
                        >
                          {line.moves}
                        </span>
                        <span className="w-8 shrink-0">
                          <span
                            role="progressbar"
                            aria-valuenow={line.mastery}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`Line ${String(line.number)} mastery`}
                            className="progress block h-1.5"
                          >
                            <span
                              className={cn(isActive && '!bg-cta')}
                              style={{ width: `${String(line.mastery)}%` }}
                            />
                          </span>
                        </span>
                        <span
                          className={cn(
                            'w-[4.2rem] shrink-0 text-right text-xs whitespace-nowrap',
                            isActive ? 'font-medium text-cta' : 'text-muted-foreground',
                          )}
                        >
                          {line.nextReview}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>

            <p className="flex gap-2 rounded-lg border border-dashed p-2.5 text-xs text-muted-foreground sm:p-3">
              <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              Get a line right and its next review moves further out: 1, 3, 7, then 14 days.
            </p>
          </div>

          {/* Action buttons */}
          <div className="space-y-2 border-t p-3 sm:p-4">
            <Button className="btn-cta h-10 w-full font-semibold sm:h-11" onClick={handleResetMove}>
              <RotateCcw className="size-[18px]" aria-hidden="true" />
              Try the move again
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-9 min-h-[40px] text-xs text-muted-foreground sm:min-h-0 sm:text-sm"
                onClick={handleSkipLine}
              >
                <SkipForward className="size-3.5" aria-hidden="true" />
                Skip line
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 min-h-[40px] text-xs text-muted-foreground sm:min-h-0 sm:text-sm"
                onClick={handleKeepC5}
              >
                <GitBranch className="size-3.5" aria-hidden="true" />
                Keep …c5 too
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}
