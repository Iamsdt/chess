import { Link } from '@tanstack/react-router'
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  KeyRound,
  Lightbulb,
  LockOpen,
  MessageCircle,
  MousePointerClick,
  Palette,
  PartyPopper,
  RotateCcw,
  Sparkles,
  Sprout,
  Target,
  X,
} from 'lucide-react'
import { useContext, useMemo, useRef, useState } from 'react'

import { ChatPanelContext } from '@/app/shell/shell-contexts'
import { Board, type BoardHandle, type BoardMove, type LegalMoveMap } from '@/board'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  SimpleTooltip,
  toast,
} from '@/design'
import {
  emptyBoardShapes,
  toFen,
  toSquare,
  type Arrow,
  type BoardShapes,
  type Fen,
  type Square,
} from '@/domain'

const INITIAL_LESSON_FEN: Fen = toFen(
  'r1q2rk1/1p1n1pbp/p2p2p1/3Np3/4P3/2P5/PP2BPPP/R2Q1RK1 w - - 0 13',
)

const AFTER_MOVE_FEN: Fen = toFen('r1q2rk1/1p1nNpbp/p2p2p1/4p3/4P3/2P5/PP2BPPP/R2Q1RK1 b - - 1 13')

const LEGAL_MOVES_MAP: LegalMoveMap = new Map<Square, readonly Square[]>([
  [
    toSquare('d5'),
    [
      toSquare('e7'),
      toSquare('b6'),
      toSquare('f6'),
      toSquare('f4'),
      toSquare('c7'),
      toSquare('b4'),
    ],
  ],
  [toSquare('f1'), [toSquare('e1')]],
  [
    toSquare('d1'),
    [toSquare('d2'), toSquare('d3'), toSquare('c2'), toSquare('b3'), toSquare('a4')],
  ],
])

/**
 * S16 · Interactive Lesson Screen (`/learn/lesson`) — ported from `prototype/lesson.html`.
 *
 * Provides a step-by-step interactive chess drill:
 * - Real playable chessboard testing user moves with instant feedback
 * - Three-tier hint ladder (Nudge, Show Piece, Show Move)
 * - Move verification for Royal fork (14.Ne7+ checking king and attacking queen)
 * - Alternative fork handling (14.Nb6) with tailored explanations
 * - Key takeaway card & lesson completion modal
 */
export function LessonScreen() {
  const chatPanel = useContext(ChatPanelContext)
  const boardRef = useRef<BoardHandle>(null)

  const [currentFen, setCurrentFen] = useState<Fen>(INITIAL_LESSON_FEN)
  const [feedbackTab, setFeedbackTab] = useState<'ok' | 'miss'>('ok')
  const [hintsUnlocked, setHintsUnlocked] = useState<number>(1)
  const [doneModalOpen, setDoneModalOpen] = useState<boolean>(false)
  const [moveAttempted, setMoveAttempted] = useState<boolean>(false)

  // Target circled squares: Black King on g8, Black Queen on c8
  const baseShapes: BoardShapes = useMemo(() => {
    const highlight: Square[] = [toSquare('g8'), toSquare('c8')]
    const arrows: Arrow[] = []

    if (hintsUnlocked >= 2) {
      highlight.push(toSquare('d5'))
    }
    if (hintsUnlocked >= 3) {
      arrows.push({
        from: toSquare('d5'),
        to: toSquare('e7'),
        kind: 'best',
      })
    }

    return {
      ...emptyBoardShapes(),
      highlight,
      arrows,
    }
  }, [hintsUnlocked])

  const miniBoardShapes: BoardShapes = useMemo(() => {
    const arrows: Arrow[] = [
      { from: toSquare('e7'), to: toSquare('g8'), kind: 'threat' },
      { from: toSquare('e7'), to: toSquare('c8'), kind: 'threat' },
    ]
    return {
      ...emptyBoardShapes(),
      highlight: [toSquare('d5'), toSquare('e7'), toSquare('g8')],
      arrows,
    }
  }, [])

  const handleAskSage = (prompt: string) => {
    if (chatPanel) {
      chatPanel.open()
      chatPanel.focusComposer()
    }
    toast(prompt)
  }

  const handleUnlockHint2 = () => {
    setHintsUnlocked((prev) => Math.max(prev, 2))
    toast('The knight on d5 is your hero. Where can it jump?')
  }

  const handleUnlockHint3 = () => {
    setHintsUnlocked(3)
    toast('Revealing the move: Jump to e7 with check!')
  }

  const handleResetPosition = () => {
    setCurrentFen(INITIAL_LESSON_FEN)
    setFeedbackTab('ok')
    setMoveAttempted(false)
    boardRef.current?.clearSelection()
    toast('Position reset. Try again.')
  }

  const handleMove = (move: BoardMove) => {
    setMoveAttempted(true)

    // Winning Royal Fork: 14.Ne7+
    if (move.from === 'd5' && move.to === 'e7') {
      setCurrentFen(AFTER_MOVE_FEN)
      setFeedbackTab('ok')
      boardRef.current?.flash('success')
      toast("Correct! That's the royal fork.")
      return
    }

    // Alternative missed check: 14.Nb6
    if (move.from === 'd5' && move.to === 'b6') {
      setFeedbackTab('miss')
      boardRef.current?.flash('error')
      toast('Close. Nb6 forks queen and rook, but misses check!')
      return
    }

    // Other moves
    boardRef.current?.shake()
    toast('Not quite the idea. Look for a jump that gives check and attacks the queen!')
  }

  const handleNextStep = () => {
    if (currentFen === AFTER_MOVE_FEN || moveAttempted) {
      setDoneModalOpen(true)
    } else {
      toast('Play the move on the board first')
    }
  }

  return (
    <main className="min-h-full">
      {/* Sticky Header */}
      <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur sm:px-4 lg:px-6">
        <Button asChild variant="ghost" size="sm" className="h-9 px-2.5 text-xs sm:px-3 sm:text-sm">
          <Link to="/learn">
            <X className="mr-1 size-4" aria-hidden="true" />
            Exit
          </Link>
        </Button>
        <div className="mx-0.5 h-5 w-px bg-border sm:mx-1" />
        <h1
          aria-label="Lesson"
          className="flex min-w-0 items-center gap-1.5 text-sm font-bold sm:gap-2 sm:text-base"
        >
          <Sprout className="size-4 shrink-0 text-cta" aria-hidden="true" />
          <span className="truncate">Royal fork</span>
        </h1>
        <span className="badge max-md:hidden">Double attacks</span>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <div
            className="flex items-center gap-1 max-sm:hidden"
            role="group"
            aria-label="Step 3 of 7 progress"
          >
            <span className="h-1.5 w-4 rounded-full bg-primary sm:w-6" />
            <span className="h-1.5 w-4 rounded-full bg-primary sm:w-6" />
            <span className="h-1.5 w-4 rounded-full bg-cta sm:w-6" />
            <span className="h-1.5 w-4 rounded-full bg-muted sm:w-6" />
            <span className="h-1.5 w-4 rounded-full bg-muted sm:w-6" />
            <span className="h-1.5 w-4 rounded-full bg-muted sm:w-6" />
            <span className="h-1.5 w-4 rounded-full bg-muted sm:w-6" />
          </div>
          <span className="shrink-0 text-xs font-medium tabular-nums sm:text-sm">
            Step 3 <span className="text-muted-foreground">of 7</span>
          </span>
          <SimpleTooltip content="Board and piece settings">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="size-8 shrink-0 px-0 sm:size-9"
              aria-label="Board and piece settings"
            >
              <Link to="/settings">
                <Palette className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </SimpleTooltip>
        </div>
      </header>

      {/* Main Grid: Board Column & Side Panel */}
      <div className="grid gap-4 p-3 sm:gap-5 sm:p-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Left Column: Playable Board */}
        <section className="flex justify-center" aria-label="Lesson board">
          <div className="w-full max-w-[min(100%,calc(100dvh-200px),620px)] space-y-2 sm:space-y-2.5">
            <div className="flex items-center justify-between gap-2 text-xs sm:text-sm">
              <span className="inline-flex items-center gap-1.5 font-medium sm:gap-2">
                <span
                  className="size-2.5 rounded-full bg-white ring-1 ring-border sm:size-3"
                  aria-hidden="true"
                />
                White to move
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <MousePointerClick className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="hidden min-[380px]:inline">Click a piece, then a square</span>
                <span className="min-[380px]:hidden">Tap to move</span>
              </span>
            </div>

            <div className="overflow-hidden rounded-xl shadow-[0_18px_40px_-18px_rgba(30,40,30,.45)] ring-1 ring-border">
              <Board
                ref={boardRef}
                fen={currentFen}
                orientation="white"
                legalMoves={LEGAL_MOVES_MAP}
                movable="white"
                onMove={handleMove}
                shapes={baseShapes}
                label="Lesson board, White to move. The black king on g8 and queen on c8 are circled."
              />
            </div>

            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <span
                className="inline-block size-2.5 shrink-0 rounded-full ring-2 ring-cta sm:size-3"
                aria-hidden="true"
              />
              Circled: the two targets. Your job is to hit both at once.
            </p>
          </div>
        </section>

        {/* Right Column: Step Instructions & Feedback Side Panel */}
        <aside
          className="card flex min-h-0 flex-col overflow-hidden lg:max-h-[calc(100dvh-56px-48px)]"
          aria-label="Lesson step"
        >
          <div className="min-h-0 flex-1 space-y-3.5 overflow-auto p-4 sm:space-y-4 sm:p-5">
            <div>
              <p className="eyebrow">Step 3 · Your turn</p>
              <h2 className="mt-1.5 text-lg leading-snug font-bold sm:text-xl">
                Your move: find the knight jump that attacks king and queen
              </h2>
              <p className="mt-1.5 text-xs text-muted-foreground sm:mt-2 sm:text-sm">
                A knight check can&apos;t be blocked. If the same jump also lands on the queen,
                Black has to save the king first.
              </p>
            </div>

            {/* Hint Ladder */}
            <div>
              <div className="flex items-center justify-between">
                <span className="label">Hints</span>
                <span className="text-xs text-muted-foreground">
                  {String(hintsUnlocked)} of 3 used
                </span>
              </div>
              <ol className="mt-2 space-y-1.5 text-xs sm:text-sm">
                <li className="flex items-start gap-2.5 rounded-lg bg-muted/60 p-2 sm:p-2.5">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    1
                  </span>
                  <span>
                    <span className="font-medium">Nudge.</span>{' '}
                    <span className="text-muted-foreground">
                      Which of your pieces can check the king without being taken?
                    </span>
                  </span>
                </li>

                {hintsUnlocked >= 2 ? (
                  <li className="flex items-start gap-2.5 rounded-lg bg-muted/60 p-2 sm:p-2.5">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      2
                    </span>
                    <span>
                      <span className="font-medium">The piece:</span>{' '}
                      <span className="text-muted-foreground">
                        The knight on d5 is your hero. Where can it jump?
                      </span>
                    </span>
                  </li>
                ) : (
                  <li>
                    <button
                      type="button"
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-dashed p-2 text-left transition-colors hover:bg-muted/50 sm:p-2.5"
                      onClick={handleUnlockHint2}
                    >
                      <span className="grid size-5 shrink-0 place-items-center rounded-full border text-[10px] font-bold text-muted-foreground">
                        2
                      </span>
                      <span className="flex-1 text-muted-foreground">Show the piece</span>
                      <LockOpen className="size-4 text-muted-foreground" aria-hidden="true" />
                    </button>
                  </li>
                )}

                {hintsUnlocked >= 3 ? (
                  <li className="flex items-start gap-2.5 rounded-lg bg-muted/60 p-2 sm:p-2.5">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      3
                    </span>
                    <span>
                      <span className="font-medium">The move:</span>{' '}
                      <span className="text-muted-foreground">
                        Play <span className="san">14.Ne7+</span> giving check and winning the
                        queen!
                      </span>
                    </span>
                  </li>
                ) : (
                  <li>
                    <button
                      type="button"
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-dashed p-2 text-left transition-colors hover:bg-muted/50 sm:p-2.5"
                      onClick={handleUnlockHint3}
                    >
                      <span className="grid size-5 shrink-0 place-items-center rounded-full border text-[10px] font-bold text-muted-foreground">
                        3
                      </span>
                      <span className="flex-1 text-muted-foreground">Show the move</span>
                      <Eye className="size-4 text-muted-foreground" aria-hidden="true" />
                    </button>
                  </li>
                )}
              </ol>
            </div>

            {/* Example Feedback States */}
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="label">Feedback preview</span>
                <div className="seg text-xs" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={feedbackTab === 'ok'}
                    className={`cursor-pointer rounded-md px-2.5 py-1 transition sm:px-3 ${
                      feedbackTab === 'ok' ? 'bg-card font-semibold text-foreground shadow-xs' : ''
                    }`}
                    onClick={() => {
                      setFeedbackTab('ok')
                    }}
                  >
                    Correct
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={feedbackTab === 'miss'}
                    className={`cursor-pointer rounded-md px-2.5 py-1 transition sm:px-3 ${
                      feedbackTab === 'miss'
                        ? 'bg-card font-semibold text-foreground shadow-xs'
                        : ''
                    }`}
                    onClick={() => {
                      setFeedbackTab('miss')
                    }}
                  >
                    Not quite
                  </button>
                </div>
              </div>

              {feedbackTab === 'ok' ? (
                <div className="mt-2 rounded-xl border border-primary/25 bg-accent/60 p-3 sm:p-3.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-primary sm:text-sm">
                    <Sparkles className="size-4 shrink-0" aria-hidden="true" />
                    That&apos;s the royal fork
                  </div>
                  <div className="mt-2.5 grid grid-cols-[88px_1fr] items-start gap-2.5 sm:grid-cols-[104px_1fr] sm:gap-3">
                    <div className="overflow-hidden rounded-lg ring-1 ring-border">
                      <Board
                        fen={AFTER_MOVE_FEN}
                        orientation="white"
                        coordinates={false}
                        movable="none"
                        shapes={miniBoardShapes}
                        label="Knight on e7 attacks g8 and c8"
                      />
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                      <span className="san">Ne7+</span> checks the king on g8 and hits the queen on
                      c8. After <span className="san">…Kh8</span>, <span className="san">Nxc8</span>{' '}
                      wins the queen.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-2 rounded-xl border border-reward/40 bg-reward-soft p-3 sm:p-3.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-reward-ink sm:text-sm">
                    <Lightbulb className="size-4 shrink-0" aria-hidden="true" />
                    Close. Good eye for forks.
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                    <span className="san">Nb6</span> attacks the queen and the rook. But it
                    isn&apos;t check, so Black simply moves the queen. Can you find a jump that{' '}
                    <b className="font-semibold text-foreground">gives check</b> too?
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2.5 h-8 text-xs sm:h-9"
                    onClick={handleResetPosition}
                  >
                    <RotateCcw className="mr-1 size-3.5" aria-hidden="true" />
                    Try again
                  </Button>
                </div>
              )}
            </div>

            {/* Key Idea */}
            <div className="flex gap-2.5 rounded-xl bg-lilac/60 p-3 sm:gap-3 sm:p-3.5">
              <KeyRound className="mt-0.5 size-4 shrink-0 text-lilac-ink" aria-hidden="true" />
              <div>
                <div className="text-xs font-semibold text-lilac-ink sm:text-sm">Key idea</div>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  Check first, collect later. A fork with check leaves the opponent no time to save
                  both pieces.
                </p>
              </div>
            </div>

            {/* Ask Sage Guidance */}
            <Button
              variant="ghost"
              size="sm"
              className="h-auto w-full px-3 py-2 text-center text-xs whitespace-normal text-muted-foreground sm:py-2.5"
              aria-label="Ask Sage to explain the royal fork in a different way"
              onClick={() => {
                handleAskSage('Can you explain the royal fork in a different way? No spoilers.')
              }}
            >
              <MessageCircle className="mr-1.5 size-3.5 shrink-0" aria-hidden="true" />
              Still fuzzy? Ask Sage to explain it differently
            </Button>
          </div>

          {/* Bottom Navigation & Complete Trigger */}
          <div className="space-y-2 border-t p-3 sm:p-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 min-h-[44px] text-xs sm:h-10 sm:min-h-0 sm:text-sm"
                onClick={() => {
                  toast('Step 2 · How a knight moves in an L')
                }}
              >
                <ChevronLeft className="mr-1 size-4" aria-hidden="true" />
                Prev step
              </Button>
              <Button
                variant="default"
                size="sm"
                className="h-9 min-h-[44px] text-xs sm:h-10 sm:min-h-0 sm:text-sm"
                onClick={handleNextStep}
              >
                Next step
                <ChevronRight className="ml-1 size-4" aria-hidden="true" />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-full text-xs text-muted-foreground"
              onClick={() => {
                setDoneModalOpen(true)
              }}
            >
              <PartyPopper className="mr-1.5 size-3.5" aria-hidden="true" />
              Preview the lesson-complete card
            </Button>
          </div>
        </aside>
      </div>

      {/* Lesson Complete Dialog */}
      <Dialog open={doneModalOpen} onOpenChange={setDoneModalOpen}>
        <DialogContent className="max-h-[92dvh] max-w-md overflow-y-auto p-0 text-center">
          <div className="relative p-4 sm:p-6">
            <div className="absolute inset-x-0 top-0 h-24 bg-reward-soft" />
            <div className="relative mx-auto grid size-14 place-items-center rounded-2xl bg-primary text-reward shadow-lg sm:size-16">
              <Sprout className="size-7 sm:size-8" aria-hidden="true" />
            </div>
            <DialogHeader className="relative mt-3 sm:mt-4">
              <p className="eyebrow mx-auto">Lesson complete</p>
              <DialogTitle className="mt-1 text-xl font-bold sm:text-2xl">
                You found the royal fork
              </DialogTitle>
              <DialogDescription className="mx-auto mt-2 max-w-sm text-xs text-muted-foreground sm:text-sm">
                Seven steps in 6 minutes. You solved 5 of 6 without the final hint.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 grid grid-cols-3 gap-1.5 text-left sm:mt-5 sm:gap-2">
              <div className="rounded-xl bg-muted/60 p-2.5 sm:p-3">
                <div className="font-display text-lg font-bold sm:text-xl">5/6</div>
                <div className="text-[11px] text-muted-foreground sm:text-xs">first try</div>
              </div>
              <div className="rounded-xl bg-muted/60 p-2.5 sm:p-3">
                <div className="font-display text-lg font-bold sm:text-xl">
                  {String(hintsUnlocked)}
                </div>
                <div className="text-[11px] text-muted-foreground sm:text-xs">
                  {hintsUnlocked === 1 ? 'hint used' : 'hints used'}
                </div>
              </div>
              <div className="rounded-xl bg-reward-soft p-2.5 sm:p-3">
                <div className="font-display text-lg font-bold text-reward-ink sm:text-xl">+1</div>
                <div className="text-[11px] text-muted-foreground sm:text-xs">leaf grown</div>
              </div>
            </div>

            <div className="mt-3.5 rounded-xl border p-3 text-left text-sm sm:mt-4">
              <div className="label">Take-away</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Before every move, ask:{' '}
                <b className="font-semibold text-foreground">
                  &quot;Can a knight check and hit my queen?&quot;
                </b>{' '}
                This comes back for review in 3 days.
              </p>
            </div>

            <div className="mt-5 flex flex-col items-center gap-2 sm:mt-6">
              <Button
                asChild
                className="btn-cta h-10 w-full bg-cta text-white hover:bg-cta/90 sm:h-11"
              >
                <Link to="/puzzles">
                  <Target className="mr-1.5 size-4" aria-hidden="true" />
                  Practice 5 puzzles
                </Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="h-9 text-muted-foreground"
                onClick={() => {
                  setDoneModalOpen(false)
                }}
              >
                <Link to="/learn">Back to course</Link>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}
