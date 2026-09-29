import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  ArrowUpDown,
  Flag,
  Handshake,
  Info,
  Palette,
  Repeat,
  Users,
  WifiOff,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import { Board, type BoardHandle, type BoardMove, type LegalMoveMap } from '@/board'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  cn,
  toast,
} from '@/design'
import {
  emptyBoardShapes,
  toFen,
  toSquare,
  type BoardShapes,
  type Fen,
  type Square,
} from '@/domain'

const INITIAL_LIVE_FEN: Fen = toFen(
  'rnb1kb1r/1p3ppp/pq1ppn2/6B1/3NPP2/2N5/PPP3PP/R2QKB1R w KQkq - 1 8',
)

const LIVE_LEGAL_MOVES: LegalMoveMap = new Map<Square, readonly Square[]>([
  [toSquare('d1'), [toSquare('d2'), toSquare('d3'), toSquare('e2'), toSquare('f3')]],
  [
    toSquare('d4'),
    [
      toSquare('b3'),
      toSquare('f3'),
      toSquare('e2'),
      toSquare('f5'),
      toSquare('b5'),
      toSquare('c6'),
      toSquare('e6'),
    ],
  ],
  [toSquare('c3'), [toSquare('a4'), toSquare('e2'), toSquare('b5'), toSquare('d5')]],
  [
    toSquare('g5'),
    [
      toSquare('f6'),
      toSquare('e7'),
      toSquare('d8'),
      toSquare('h4'),
      toSquare('e3'),
      toSquare('d2'),
      toSquare('h6'),
    ],
  ],
  [toSquare('f1'), [toSquare('e2'), toSquare('d3'), toSquare('c4'), toSquare('b5')]],
  [toSquare('a1'), [toSquare('b1')]],
  [toSquare('a2'), [toSquare('a3'), toSquare('a4')]],
  [toSquare('b2'), [toSquare('b3'), toSquare('b4')]],
  [toSquare('g2'), [toSquare('g3'), toSquare('g4')]],
  [toSquare('h2'), [toSquare('h3'), toSquare('h4')]],
  [toSquare('f4'), [toSquare('f5')]],
  [toSquare('e4'), [toSquare('e5')]],
])

export interface MoveHistoryItem {
  readonly moveNumber: number
  readonly white: string
  readonly black: string
  readonly isCurrent?: boolean
}

const INITIAL_MOVES: readonly MoveHistoryItem[] = [
  { moveNumber: 1, white: 'e4', black: 'c5' },
  { moveNumber: 2, white: 'Nf3', black: 'd6' },
  { moveNumber: 3, white: 'd4', black: 'cxd4' },
  { moveNumber: 4, white: 'Nxd4', black: 'Nf6' },
  { moveNumber: 5, white: 'Nc3', black: 'a6' },
  { moveNumber: 6, white: 'Bg5', black: 'e6' },
  { moveNumber: 7, white: 'f4', black: 'Qb6', isCurrent: true },
]

/**
 * Live Game Screen (`/friends/live`) — ported from `prototype/live.html`.
 *
 * Real-time match room with low-latency relay connection:
 * - Playable chessboard with live highlights for opponent's last move
 * - Active timers with ticking turn clock
 * - Reconnect banner explaining auto-pause protection
 * - Quick friendly reaction phrases
 * - Move score sheet tracking variation theory
 * - Draw offer and resign dialog flow
 */
export function LiveGameScreen() {
  const boardRef = useRef<BoardHandle>(null)

  const [currentFen, setCurrentFen] = useState<Fen>(INITIAL_LIVE_FEN)
  const [orientation, setOrientation] = useState<'white' | 'black'>('white')
  const [isResignOpen, setIsResignOpen] = useState(false)
  const [playedMove8, setPlayedMove8] = useState<string | null>(null)
  const [floatingReaction, setFloatingReaction] = useState<string>('Good move!')

  const boardShapes: BoardShapes = useMemo(
    () => ({
      ...emptyBoardShapes(),
      highlight: [toSquare('d8'), toSquare('b6')],
    }),
    [],
  )

  const handleFlip = () => {
    setOrientation((prev) => (prev === 'white' ? 'black' : 'white'))
    toast('Board flipped')
  }

  const handleMove = (move: BoardMove) => {
    setPlayedMove8(`${move.from}-${move.to}`)
    if (move.from === 'd1' && move.to === 'd2') {
      setCurrentFen(toFen('rnb1kb1r/1p3ppp/pq1ppn2/6B1/3NPP2/2N5/PPPQ2PP/R3KB1R b KQkq - 2 8'))
    }
    boardRef.current?.flash('success')
    toast(`Played ${move.from} to ${move.to}. Waiting for Rafi…`)
  }

  const handleSendReaction = (text: string) => {
    setFloatingReaction(text)
    toast(`Sent: ${text}`)
  }

  const handleOfferDraw = () => {
    toast('Draw offered to Rafi')
  }

  return (
    <main className="mx-auto min-h-full w-full max-w-[1280px] pb-8">
      {/* Game header */}
      <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur sm:px-4 lg:px-6">
        <Button asChild variant="ghost" size="sm" className="h-9 px-2.5 sm:px-3">
          <Link to="/friends">
            <ArrowLeft className="mr-1 size-4" aria-hidden="true" />
            <span className="max-sm:hidden">Friends</span>
          </Link>
        </Button>
        <div className="mx-0.5 h-5 w-px bg-border sm:mx-1" />
        <h1
          aria-label="Live game"
          className="flex min-w-0 items-center gap-1.5 text-sm font-bold sm:gap-2 sm:text-base"
        >
          <Users className="size-4 shrink-0 text-cta" aria-hidden="true" />
          <span className="truncate">You vs Rafi</span>
        </h1>
        <span className="badge max-sm:hidden">10 + 5</span>
        <span
          className="badge badge-soft max-md:hidden"
          title="Round-trip to Rafi through the relay"
        >
          <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
          Connected · 42 ms
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFlip}
            aria-label="Flip board"
            className="h-9 px-2 sm:px-3"
          >
            <ArrowUpDown className="size-4" aria-hidden="true" />
            <span className="max-sm:hidden">Flip</span>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="size-9 sm:size-8"
            title="Board & pieces"
            aria-label="Board and piece settings"
          >
            <Link to="/settings" hash="board">
              <Palette className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </header>

      <div className="grid gap-5 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Board column */}
        <section className="flex justify-center" aria-label="Game board">
          <div className="w-full max-w-[min(100%,calc(100dvh-56px-48px-120px),560px)] space-y-2.5">
            {/* Opponent Card */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <span className="avatar size-8 shrink-0 rounded-xl bg-[#e9a15a] text-xs font-bold text-[#3b1d00] sm:size-9">
                RA
              </span>
              <div className="min-w-0 leading-tight">
                <div className="truncate text-sm font-semibold">Rafi</div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="size-1.5 shrink-0 rounded-full bg-success" aria-hidden="true" />
                  <span className="truncate">
                    Online · played{' '}
                    <span className="font-mono font-medium text-foreground">…Qb6</span>
                  </span>
                </div>
              </div>
              <div className="relative ml-auto flex shrink-0 items-center gap-2">
                {floatingReaction && (
                  <span className="rise rounded-full rounded-br-sm border bg-card px-2.5 py-1 text-xs font-medium shadow-xs max-sm:hidden">
                    {floatingReaction}
                  </span>
                )}
                <div className="clock ml-0 flex min-h-[36px] items-center justify-center rounded-md bg-muted px-2.5 py-1 font-mono text-sm font-semibold tabular-nums">
                  7:48
                </div>
              </div>
            </div>

            {/* Chessboard */}
            <div className="overflow-hidden rounded-xl shadow-[0_18px_40px_-18px_rgba(30,40,30,.45)] ring-1 ring-border">
              <Board
                ref={boardRef}
                fen={currentFen}
                orientation={orientation}
                coordinates
                movable="white"
                legalMoves={LIVE_LEGAL_MOVES}
                onMove={handleMove}
                shapes={boardShapes}
                label="Game board, White to move. Rafi's queen just went to b6."
              />
            </div>

            {/* Player Card */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <span className="avatar size-8 shrink-0 rounded-xl bg-primary text-xs font-bold text-primary-foreground sm:size-9">
                SK
              </span>
              <div className="min-w-0 leading-tight">
                <div className="text-sm font-semibold">You</div>
                <div className="truncate text-xs font-medium text-success">
                  {playedMove8 ? 'Waiting for Rafi…' : 'Your move'}
                </div>
              </div>
              <div className="clock is-running ml-auto flex min-h-[36px] shrink-0 items-center justify-center rounded-md bg-primary px-2.5 py-1 font-mono text-sm font-bold text-primary-foreground tabular-nums shadow-xs">
                8:31
              </div>
            </div>
          </div>
        </section>

        {/* Side panel */}
        <aside
          className="card flex min-h-0 flex-col overflow-hidden lg:max-h-[calc(100dvh-56px-48px)]"
          aria-label="Game panel"
        >
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <span className="inline-flex size-6 shrink-0 items-center justify-center rounded bg-accent font-mono text-xs font-bold text-accent-foreground">
              B
            </span>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-semibold">Sicilian Najdorf</div>
              <div className="text-xs text-muted-foreground">Poisoned Pawn · B97</div>
            </div>
          </div>

          {/* Moves List */}
          <div className="min-h-0 flex-1 overflow-auto p-2 max-lg:max-h-[240px]">
            <ol className="text-sm" aria-label="Moves">
              {INITIAL_MOVES.map((item) => (
                <li
                  key={item.moveNumber}
                  className="grid grid-cols-[32px_1fr_1fr] items-center rounded-md px-2 py-1 odd:bg-muted/50"
                >
                  <span className="font-mono text-xs text-muted-foreground">
                    {String(item.moveNumber)}.
                  </span>
                  <span className="font-mono text-xs">{item.white}</span>
                  <span
                    className={cn(
                      'font-mono text-xs',
                      item.isCurrent &&
                        'rounded bg-cta-soft px-1 py-0.5 font-bold text-cta ring-1 ring-cta/30',
                    )}
                  >
                    {item.black}
                  </span>
                </li>
              ))}
              <li className="grid grid-cols-[32px_1fr_1fr] items-center rounded-md px-2 py-1 odd:bg-muted/50">
                <span className="font-mono text-xs text-muted-foreground">8.</span>
                <span className="font-mono text-xs">
                  {playedMove8 ? (
                    <span className="rounded bg-primary/10 px-1 py-0.5 font-bold text-primary">
                      {playedMove8}
                    </span>
                  ) : (
                    <span className="px-1.5 font-mono text-muted-foreground">…</span>
                  )}
                </span>
                <span />
              </li>
            </ol>
          </div>

          {/* Reconnect notice */}
          <div
            className="mx-3 mb-3 flex items-start gap-2 rounded-xl border border-reward/40 bg-reward-soft px-3 py-2.5 text-xs text-reward-ink"
            role="status"
          >
            <WifiOff className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            <span>
              <b className="font-semibold">Example: Reconnecting…</b> If a connection drops, both
              clocks pause for up to 60 seconds and the game picks up where it left off.
            </span>
          </div>

          {/* Quick reactions & game actions */}
          <div className="space-y-3 border-t p-3">
            <div>
              <p className="label mb-1.5 px-0.5">Quick reactions</p>
              <div className="flex flex-wrap gap-1.5">
                {['Good move!', 'Oops', 'Rematch?', 'Good game'].map((phrase) => (
                  <button
                    key={phrase}
                    type="button"
                    className="reply min-h-[36px] px-3 py-1.5 text-xs font-medium"
                    onClick={() => {
                      handleSendReaction(phrase)
                    }}
                  >
                    {phrase}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 px-0.5 text-[11px] text-muted-foreground">
                Set phrases only. Friendly by design.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="min-h-[40px]"
                onClick={handleOfferDraw}
              >
                <Handshake className="size-3.5" aria-hidden="true" />
                Draw
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="min-h-[40px] text-muted-foreground"
                onClick={() => {
                  setIsResignOpen(true)
                }}
              >
                <Flag className="size-3.5" aria-hidden="true" />
                Resign
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="min-h-[40px] text-muted-foreground"
                disabled
                title="Available when the game ends"
              >
                <Repeat className="size-3.5" aria-hidden="true" />
                Rematch
              </Button>
            </div>

            <p className="flex gap-2 rounded-lg border border-dashed p-2.5 text-xs text-muted-foreground">
              <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              After the game you both get it in Review, with Sage back on.
            </p>
          </div>
        </aside>
      </div>

      {/* Resign Dialog */}
      <Dialog open={isResignOpen} onOpenChange={setIsResignOpen}>
        <DialogContent className="max-w-[min(440px,calc(100vw-32px))] p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Resign against Rafi?</DialogTitle>
            <DialogDescription className="mt-2 text-sm text-muted-foreground">
              It's move 8 and the position is wide open. Rafi will see "You resigned" and the game
              goes to Review for both of you.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className="min-h-[44px] w-full sm:w-auto"
              onClick={() => {
                setIsResignOpen(false)
              }}
            >
              Keep playing
            </Button>
            <Button asChild variant="destructive" className="min-h-[44px] w-full sm:w-auto">
              <Link to="/games/review">Resign &amp; review</Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}
