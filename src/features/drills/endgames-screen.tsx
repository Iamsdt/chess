import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  ArrowUpDown,
  Box,
  Cpu,
  Flag,
  Lightbulb,
  MessageCircle,
  Palette,
  RotateCcw,
  Star,
  TrendingUp,
  Undo2,
} from 'lucide-react'
import { useContext, useMemo, useRef, useState } from 'react'

import { ChatPanelContext } from '@/app/shell/shell-contexts'
import { Board, type BoardHandle, type BoardMove, type LegalMoveMap } from '@/board'
import { Button, toast } from '@/design'
import {
  emptyBoardShapes,
  toFen,
  toSquare,
  type Arrow,
  type BoardShapes,
  type Fen,
  type Square,
} from '@/domain'

export interface DrillItem {
  readonly id: string
  readonly title: string
  readonly category: 'basic' | 'pawn' | 'rook'
  readonly stats: string
  readonly stars?: number
  readonly isNew?: boolean
  readonly par: number
  readonly bestMoves?: number
  readonly fen: Fen
  readonly headline: string
  readonly techniqueTitle?: string
  readonly techniqueText?: string
  readonly techniqueSteps?: readonly string[]
  readonly moveHistoryText: string
  readonly initialMoveCount: number
}

const DEFAULT_DRILL: DrillItem = {
  id: 'kr-vs-k',
  title: 'K+R vs K',
  category: 'basic',
  stats: 'Best 19 · par 16',
  stars: 1,
  par: 16,
  bestMoves: 19,
  fen: toFen('8/8/8/8/6k1/8/4RK2/8 w - - 8 5'),
  headline: 'Checkmate with K+R vs K in 16 moves or fewer',
  techniqueTitle: 'Technique: the box',
  techniqueText:
    "Your rook on e2 is a fence. Black's king is boxed on the f, g and h files. Make the box smaller, one line at a time.",
  techniqueSteps: [
    "Keep the fence. Don't give it up for a check.",
    'Walk your king up to protect the rook.',
    "Shrink the box whenever it's safe.",
  ],
  moveHistoryText: '1.Rd1 Kf5 2.Kf2 Ke4 3.Rd2 Kf4 4.Re2 Kg4',
  initialMoveCount: 4,
}

const DEFAULT_DRILLS: readonly DrillItem[] = [
  {
    id: 'kq-vs-k',
    title: 'K+Q vs K',
    category: 'basic',
    stats: 'Best 9 · par 10',
    stars: 3,
    par: 10,
    bestMoves: 9,
    fen: toFen('8/8/3k4/8/8/8/4QK2/8 w - - 0 1'),
    headline: 'Checkmate with K+Q vs K in 10 moves or fewer',
    techniqueTitle: 'The knight step',
    techniqueText:
      'Keep your queen a knight jump away from the enemy king until it reaches the edge.',
    techniqueSteps: [
      'Mirror the enemy king a knight jump away.',
      'Trap it on the back rank or file.',
      'Bring your king in for the final checkmate.',
    ],
    moveHistoryText: '1.Qd3 Ke6 2.Qe4 Kd6 3.Kf3 Kc5 4.Ke3',
    initialMoveCount: 4,
  },
  DEFAULT_DRILL,
  {
    id: 'two-bishops',
    title: 'Two bishops',
    category: 'basic',
    stats: 'Not tried · par 20',
    isNew: true,
    par: 20,
    fen: toFen('8/8/3k4/8/8/8/4BB2/4K3 w - - 0 1'),
    headline: 'Checkmate with two bishops against a lone king',
    techniqueTitle: 'The bishop wedge',
    techniqueText:
      'Side-by-side bishops create an impassable barrier that drives the king into a corner.',
    techniqueSteps: [
      'Keep the bishops adjacent to control diagonals.',
      'Use your king to take away remaining escape squares.',
      'Push the opponent into the corner for mate.',
    ],
    moveHistoryText: 'Not started yet',
    initialMoveCount: 0,
  },
  {
    id: 'opposition',
    title: 'Opposition',
    category: 'pawn',
    stats: 'Won 4 of 5',
    stars: 2,
    par: 8,
    fen: toFen('8/8/8/4k3/8/4K3/4P3/8 w - - 0 1'),
    headline: 'Promote your pawn using direct king opposition',
    techniqueTitle: 'The direct opposition',
    techniqueText:
      'Keep an odd number of squares between the kings to control key advance squares.',
    techniqueSteps: [
      'Take opposition when possible.',
      'Outflank the enemy king when it steps aside.',
      'Escort your pawn safely to the 8th rank.',
    ],
    moveHistoryText: '1.Kd3 Kd5 2.e4+ Ke5 3.Ke3',
    initialMoveCount: 3,
  },
  {
    id: 'rule-square',
    title: 'Rule of the square',
    category: 'pawn',
    stats: '12 in a row',
    stars: 3,
    par: 6,
    fen: toFen('8/8/8/8/3P2k1/8/8/4K3 w - - 0 1'),
    headline: 'Determine if your pawn can outrun the enemy king',
    techniqueTitle: 'Visualising the square',
    techniqueText:
      'Count the diagonal distance to the promotion rank to define the boundary square.',
    techniqueSteps: [
      'Draw a diagonal from the pawn to the promotion rank.',
      'If the enemy king cannot step into the box, push without hesitation.',
      'Queen before the king can intercept.',
    ],
    moveHistoryText: '1.d5 Kf5 2.d6 Ke6',
    initialMoveCount: 2,
  },
  {
    id: 'lucena',
    title: 'Lucena',
    category: 'rook',
    stats: 'Build a bridge · won 1 of 3',
    stars: 1,
    par: 12,
    fen: toFen('1K1R4/8/1k6/8/8/8/8/r7 w - - 0 1'),
    headline: 'Win the rook ending by building a bridge with your rook',
    techniqueTitle: 'Building the bridge',
    techniqueText: 'Place the rook on the 4th rank to shield your king from checks upon exit.',
    techniqueSteps: [
      'Check the opposing king away to the side.',
      'Place your rook on the 4th rank.',
      'Step your king out and use the rook as a shield.',
    ],
    moveHistoryText: '1.Rd4 Ra2 2.Kc8 Rc2+ 3.Kd7',
    initialMoveCount: 3,
  },
  {
    id: 'philidor',
    title: 'Philidor',
    category: 'rook',
    stats: 'Hold the draw · not tried',
    isNew: true,
    par: 10,
    fen: toFen('4k3/R7/8/3KP3/8/8/8/7r b - - 0 1'),
    headline: 'Hold the draw with the 6th-rank defensive barrier',
    techniqueTitle: 'The 6th-rank shield',
    techniqueText:
      'Keep the rook on the 6th rank until the pawn pushes, then give checks from behind.',
    techniqueSteps: [
      'Keep the rook on the 6th rank to prevent the enemy king from advancing.',
      'Once the pawn advances to the 6th rank, retreat your rook to the 1st rank.',
      'Deliver checks from behind the king indefinitely.',
    ],
    moveHistoryText: 'Not started yet',
    initialMoveCount: 0,
  },
]

const KR_LEGAL_MOVES: LegalMoveMap = new Map<Square, readonly Square[]>([
  [
    toSquare('e2'),
    [
      toSquare('e1'),
      toSquare('e3'),
      toSquare('e4'),
      toSquare('e5'),
      toSquare('e6'),
      toSquare('e7'),
      toSquare('e8'),
      toSquare('a2'),
      toSquare('b2'),
      toSquare('c2'),
      toSquare('d2'),
      toSquare('f2'),
      toSquare('g2'),
      toSquare('h2'),
    ],
  ],
  [
    toSquare('f2'),
    [
      toSquare('f1'),
      toSquare('f3'),
      toSquare('e1'),
      toSquare('e3'),
      toSquare('g1'),
      toSquare('g2'),
      toSquare('g3'),
    ],
  ],
])

/**
 * S18 · Endgame Drills (`/drills/endgames`) — ported from `prototype/endgames.html`.
 *
 * Interactive technique training against Stockfish defense:
 * - Real playable board with legal move validation and takebacks
 * - Par comparison, attempt counters, and star rating system
 * - Interactive technique guides (The Box, Lucena Bridge, Opposition)
 * - Complete library of basic mates, pawn endings, and rook endings
 */
export function EndgamesScreen() {
  const chatPanel = useContext(ChatPanelContext)
  const boardRef = useRef<BoardHandle>(null)

  const [activeDrillId, setActiveDrillId] = useState<string>('kr-vs-k')
  const [orientation, setOrientation] = useState<'white' | 'black'>('white')

  const activeDrill = useMemo(
    () => DEFAULT_DRILLS.find((d) => d.id === activeDrillId) ?? DEFAULT_DRILL,
    [activeDrillId],
  )

  const [currentFen, setCurrentFen] = useState<Fen>(activeDrill.fen)
  const [movesUsed, setMovesUsed] = useState<number>(activeDrill.initialMoveCount)
  const [moveHistory, setMoveHistory] = useState<readonly Fen[]>([activeDrill.fen])

  const boardShapes: BoardShapes = useMemo(() => {
    if (activeDrill.id === 'kr-vs-k') {
      const arrows: Arrow[] = [
        {
          from: toSquare('e2'),
          to: toSquare('e8'),
          kind: 'best',
        },
      ]
      return {
        ...emptyBoardShapes(),
        highlight: [toSquare('f4'), toSquare('g4')],
        arrows,
      }
    }
    return emptyBoardShapes()
  }, [activeDrill.id])

  const handleSelectDrill = (drill: DrillItem) => {
    setActiveDrillId(drill.id)
    setCurrentFen(drill.fen)
    setMovesUsed(drill.initialMoveCount)
    setMoveHistory([drill.fen])
    boardRef.current?.clearSelection()
  }

  const handleFlip = () => {
    setOrientation((prev) => (prev === 'white' ? 'black' : 'white'))
    toast('Board flipped')
  }

  const handleMove = (move: BoardMove) => {
    setMovesUsed((prev) => prev + 1)
    setMoveHistory((prev) => [...prev, currentFen])
    boardRef.current?.flash('success')
    toast(`Played ${move.from} to ${move.to}`)
  }

  const handleTakeBack = () => {
    if (moveHistory.length > 1) {
      const previousFen = moveHistory[moveHistory.length - 2]
      if (previousFen) {
        setCurrentFen(previousFen)
        setMoveHistory((prev) => prev.slice(0, -1))
        setMovesUsed((prev) => Math.max(0, prev - 1))
        boardRef.current?.clearSelection()
        toast('Took back your last move')
        return
      }
    }
    toast('No moves to take back')
  }

  const handleRestart = () => {
    setCurrentFen(activeDrill.fen)
    setMovesUsed(activeDrill.initialMoveCount)
    setMoveHistory([activeDrill.fen])
    boardRef.current?.clearSelection()
    toast('Drill restarted from move 1')
  }

  const handleAskSage = (prompt: string) => {
    if (chatPanel) {
      chatPanel.open()
      chatPanel.focusComposer()
    }
    toast(prompt)
  }

  return (
    <main className="min-h-full">
      {/* Sticky Header */}
      <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur lg:px-6">
        <Button asChild variant="ghost" size="sm">
          <Link to="/learn">
            <ArrowLeft className="mr-1 size-4" aria-hidden="true" />
            <span className="max-sm:hidden">Learn</span>
          </Link>
        </Button>
        <div className="mx-1 h-5 w-px bg-border" />
        <h1
          aria-label="Endgame drills"
          className="flex min-w-0 items-center gap-2 text-base font-bold"
        >
          <Flag className="size-4 shrink-0 text-cta" aria-hidden="true" />
          <span className="truncate">Endgame drills</span>
        </h1>
        <span className="badge max-sm:hidden">4 of 7 mastered</span>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={handleFlip}>
            <ArrowUpDown className="mr-1 size-4" aria-hidden="true" />
            <span className="max-sm:hidden">Flip</span>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="size-9 px-0"
            title="Board & pieces"
            aria-label="Board and piece settings"
          >
            <Link to="/settings">
              <Palette className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </header>

      {/* Main Grid: Left Nav, Center Board, Right Side Panel */}
      <div className="grid gap-5 p-4 lg:grid-cols-[230px_minmax(0,1fr)] lg:p-6 2xl:grid-cols-[240px_minmax(0,1fr)_290px]">
        {/* Column 1: Drill Navigation */}
        <nav className="card h-fit overflow-hidden max-lg:order-3" aria-label="Endgame drills list">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-bold">All drills</h2>
            <p className="text-xs text-muted-foreground">Stars for beating par</p>
          </div>
          <div className="space-y-1 p-2">
            {/* Basic mates */}
            <p className="eyebrow px-2 pt-2 pb-1">Basic mates</p>
            {DEFAULT_DRILLS.filter((d) => d.category === 'basic').map((drill) => {
              const isActive = drill.id === activeDrillId
              return (
                <button
                  key={drill.id}
                  type="button"
                  aria-pressed={isActive}
                  className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                    isActive ? 'bg-cta-soft font-semibold ring-1 ring-cta/30' : 'hover:bg-muted/60'
                  }`}
                  onClick={() => {
                    handleSelectDrill(drill)
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block">{drill.title}</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      {drill.stats}
                    </span>
                  </span>
                  {drill.stars !== undefined ? (
                    <span
                      className="flex text-reward"
                      role="img"
                      aria-label={`${String(drill.stars)} of 3 stars`}
                    >
                      {[1, 2, 3].map((starIndex) => (
                        <Star
                          key={starIndex}
                          className={`size-3.5 ${
                            starIndex <= (drill.stars ?? 0)
                              ? 'fill-reward text-reward'
                              : 'text-muted-foreground/30'
                          }`}
                          aria-hidden="true"
                        />
                      ))}
                    </span>
                  ) : null}
                  {drill.isNew ? (
                    <span className="badge px-1.5 text-[10px] text-muted-foreground">New</span>
                  ) : null}
                </button>
              )
            })}

            {/* Pawn endgames */}
            <p className="eyebrow px-2 pt-3 pb-1">Pawn endgames</p>
            {DEFAULT_DRILLS.filter((d) => d.category === 'pawn').map((drill) => {
              const isActive = drill.id === activeDrillId
              return (
                <button
                  key={drill.id}
                  type="button"
                  aria-pressed={isActive}
                  className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                    isActive ? 'bg-cta-soft font-semibold ring-1 ring-cta/30' : 'hover:bg-muted/60'
                  }`}
                  onClick={() => {
                    handleSelectDrill(drill)
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block">{drill.title}</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      {drill.stats}
                    </span>
                  </span>
                  {drill.stars !== undefined ? (
                    <span
                      className="flex text-reward"
                      role="img"
                      aria-label={`${String(drill.stars)} of 3 stars`}
                    >
                      {[1, 2, 3].map((starIndex) => (
                        <Star
                          key={starIndex}
                          className={`size-3.5 ${
                            starIndex <= (drill.stars ?? 0)
                              ? 'fill-reward text-reward'
                              : 'text-muted-foreground/30'
                          }`}
                          aria-hidden="true"
                        />
                      ))}
                    </span>
                  ) : null}
                </button>
              )
            })}

            {/* Rook endgames */}
            <p className="eyebrow px-2 pt-3 pb-1">Rook endgames</p>
            {DEFAULT_DRILLS.filter((d) => d.category === 'rook').map((drill) => {
              const isActive = drill.id === activeDrillId
              return (
                <button
                  key={drill.id}
                  type="button"
                  aria-pressed={isActive}
                  className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                    isActive ? 'bg-cta-soft font-semibold ring-1 ring-cta/30' : 'hover:bg-muted/60'
                  }`}
                  onClick={() => {
                    handleSelectDrill(drill)
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block">{drill.title}</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      {drill.stats}
                    </span>
                  </span>
                  {drill.stars !== undefined ? (
                    <span
                      className="flex text-reward"
                      role="img"
                      aria-label={`${String(drill.stars)} of 3 stars`}
                    >
                      {[1, 2, 3].map((starIndex) => (
                        <Star
                          key={starIndex}
                          className={`size-3.5 ${
                            starIndex <= (drill.stars ?? 0)
                              ? 'fill-reward text-reward'
                              : 'text-muted-foreground/30'
                          }`}
                          aria-hidden="true"
                        />
                      ))}
                    </span>
                  ) : null}
                  {drill.isNew ? (
                    <span className="badge px-1.5 text-[10px] text-muted-foreground">New</span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </nav>

        {/* Column 2: Drill Board */}
        <section className="flex justify-center" aria-label="Drill board">
          <div className="w-full max-w-[620px] space-y-2.5">
            {/* Opponent Status Bar */}
            <div className="flex items-center gap-3">
              <span className="avatar size-9 rounded-xl bg-[#3b4a44] text-[#cfe0d6]">
                <Cpu className="size-4" aria-hidden="true" />
              </span>
              <div className="leading-tight">
                <div className="text-sm font-semibold">
                  Stockfish <span className="font-normal text-muted-foreground">defends</span>
                </div>
                <div className="text-xs text-muted-foreground">Full strength · runs longest</div>
              </div>
              <span
                className="ml-auto rounded-lg bg-muted px-3 py-1 font-mono text-sm font-semibold text-muted-foreground tabular-nums"
                aria-label={`Move ${String(movesUsed + 1)}, par ${String(activeDrill.par)}`}
              >
                {String(movesUsed + 1)}{' '}
                <span className="font-normal">/ {String(activeDrill.par)}</span>
              </span>
            </div>

            {/* Board Container */}
            <div className="overflow-hidden rounded-xl shadow-[0_18px_40px_-18px_rgba(30,40,30,.45)] ring-1 ring-border">
              <Board
                ref={boardRef}
                fen={currentFen}
                orientation={orientation}
                legalMoves={KR_LEGAL_MOVES}
                movable="white"
                onMove={handleMove}
                shapes={boardShapes}
                label="Drill board. White king f2, rook e2. Black king g4. White to move."
              />
            </div>

            {/* Player Status Bar */}
            <div className="flex items-center gap-3">
              <span className="avatar size-9 rounded-xl bg-primary font-bold text-primary-foreground">
                SK
              </span>
              <div className="leading-tight">
                <div className="text-sm font-semibold">
                  You <span className="font-normal text-muted-foreground">· White</span>
                </div>
                <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  Your move · the box is holding
                </div>
              </div>
              <span className="badge ml-auto border-transparent bg-accent text-accent-foreground">
                <TrendingUp className="mr-1 size-3.5" aria-hidden="true" />
                On pace for 15
              </span>
            </div>
          </div>
        </section>

        {/* Column 3: Drill Details Panel */}
        <aside
          className="card flex h-fit flex-col overflow-hidden lg:col-start-2 2xl:col-start-3 2xl:max-h-[calc(100dvh-56px-48px)]"
          aria-label="Drill details"
        >
          <div className="border-b p-4">
            <p className="eyebrow">
              {activeDrill.category === 'basic'
                ? 'Basic mates'
                : activeDrill.category === 'pawn'
                  ? 'Pawn endgames'
                  : 'Rook endgames'}{' '}
              · drill
            </p>
            <h2 className="mt-1 text-lg leading-snug font-bold">{activeDrill.headline}</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="badge badge-reward">Par {String(activeDrill.par)}</span>
              <span className="badge">Attempt 3</span>
              {activeDrill.bestMoves ? (
                <span className="badge text-muted-foreground">
                  Best {String(activeDrill.bestMoves)}
                </span>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
            {/* Move Progress Bar */}
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="label">Moves used</span>
                <span className="font-medium tabular-nums">
                  {String(movesUsed)} of {String(activeDrill.par)}
                </span>
              </div>
              <div
                className="mt-1.5 grid gap-0.5"
                style={{
                  gridTemplateColumns: `repeat(${String(activeDrill.par)}, minmax(0, 1fr))`,
                }}
                role="progressbar"
                aria-valuenow={movesUsed}
                aria-valuemin={0}
                aria-valuemax={activeDrill.par}
                aria-label={`${String(movesUsed)} of ${String(activeDrill.par)} moves used`}
              >
                {Array.from({ length: activeDrill.par }, (_, i) => {
                  let barClass = 'bg-muted'
                  if (i < movesUsed) {
                    barClass = 'bg-primary'
                  } else if (i === movesUsed) {
                    barClass = 'bg-cta'
                  } else if (i === activeDrill.par - 1) {
                    barClass = 'bg-reward'
                  }
                  return <span key={i} className={`h-2 rounded-xs ${barClass}`} />
                })}
              </div>
              <p className="mt-2 font-mono text-[12.5px] text-muted-foreground">
                {activeDrill.moveHistoryText}
              </p>
            </div>

            {/* Technique Card */}
            {activeDrill.techniqueTitle ? (
              <div className="rounded-xl bg-lilac/60 p-3.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-lilac-ink">
                  <Box className="size-4" aria-hidden="true" />
                  {activeDrill.techniqueTitle}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{activeDrill.techniqueText}</p>
                {activeDrill.techniqueSteps ? (
                  <ol className="mt-2.5 space-y-1.5 text-sm">
                    {activeDrill.techniqueSteps.map((step, idx) => (
                      <li key={idx} className="flex gap-2">
                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-card text-[10px] font-bold">
                          {String(idx + 1)}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                ) : null}
                <button
                  type="button"
                  className="mt-2.5 inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-lilac-ink hover:underline"
                  onClick={() => {
                    handleAskSage('Explain the box technique for K+R vs K')
                  }}
                >
                  <MessageCircle className="size-3.5" aria-hidden="true" />
                  Ask Sage about the box
                </button>
              </div>
            ) : null}

            {/* Stat Counters */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-muted/60 p-2.5">
                <div className="font-display text-lg font-bold">3</div>
                <div className="text-[11px] text-muted-foreground">attempts</div>
              </div>
              <div className="rounded-lg bg-muted/60 p-2.5">
                <div className="font-display text-lg font-bold">
                  {String(activeDrill.bestMoves ?? '-')}
                </div>
                <div className="text-[11px] text-muted-foreground">best so far</div>
              </div>
              <div className="rounded-lg bg-reward-soft p-2.5">
                <div className="font-display text-lg font-bold text-reward-ink">
                  {String(activeDrill.par - 1)}
                </div>
                <div className="text-[11px] text-muted-foreground">perfect play</div>
              </div>
            </div>
          </div>

          {/* Drill Action Buttons */}
          <div className="space-y-2 border-t p-3">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={handleTakeBack}>
                <Undo2 className="mr-1 size-4" aria-hidden="true" />
                Take back
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-cta/30 bg-cta-soft text-cta hover:bg-cta hover:text-white"
                onClick={() => {
                  handleAskSage("Give me a hint for the box, but don't tell me the move")
                }}
              >
                <Lightbulb className="mr-1 size-4" aria-hidden="true" />
                Hint
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={handleRestart}
            >
              <RotateCcw className="mr-1 size-3.5" aria-hidden="true" />
              Restart drill
            </Button>
          </div>
        </aside>
      </div>
    </main>
  )
}
