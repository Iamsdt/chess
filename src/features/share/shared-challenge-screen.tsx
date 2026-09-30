import { Link } from '@tanstack/react-router'
import {
  EyeOff,
  Footprints,
  Link as LinkIcon,
  MessageCircle,
  Microscope,
  Move,
  Play,
  Send,
  ShieldCheck,
  Swords,
  Timer,
} from 'lucide-react'
import { useContext, useMemo, useState } from 'react'

import { ChatPanelContext } from '@/app/shell/shell-contexts'
import { Board } from '@/board'
import { Button, cn, toast } from '@/design'
import { emptyBoardShapes, toFen, toSquare, type Arrow, type BoardShapes, type Fen } from '@/domain'

const PUZZLE_FEN: Fen = toFen('r4r1k/pp1b2pp/1qnp4/2p1p1N1/2Q1P3/2PP4/PP4PP/R1B1R2K w - - 0 18')
const POSITION_FEN: Fen = toFen(
  'r1bq1rk1/pp1nbppp/2p1p3/3n2B1/2BP4/2N1PN2/PP3PPP/2RQK2R w K - 1 10',
)
const GAME_FEN: Fen = toFen('r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 w - - 2 7')
const CORR_FEN: Fen = toFen('rnb1kb1r/1p3ppp/pq1ppn2/6B1/3NPP2/2N5/PPP3PP/R2QKB1R w KQkq - 1 8')

type ShareTab = 'puzzle' | 'position' | 'game' | 'corr'

/**
 * Shared Challenge Screen (`/share`) — ported from `prototype/share.html`.
 *
 * Ephemeral link-decoded experience for shared chess content:
 * - Puzzle challenge sent from friends with target time to beat
 * - Tactical/strategic position with open question
 * - Annotated game with human and AI annotations
 * - Correspondence turn receiver linking to live game
 */
export function SharedChallengeScreen() {
  const chatPanel = useContext(ChatPanelContext)
  const [activeTab, setActiveTab] = useState<ShareTab>('puzzle')

  const positionShapes: BoardShapes = useMemo(
    () => ({
      ...emptyBoardShapes(),
      highlight: [toSquare('f6'), toSquare('d5')],
    }),
    [],
  )

  const gameShapes: BoardShapes = useMemo(() => {
    const arrows: readonly Arrow[] = [
      { from: toSquare('a2'), to: toSquare('a4'), kind: 'sage' },
      { from: toSquare('b1'), to: toSquare('d2'), kind: 'sage' },
    ]
    return {
      ...emptyBoardShapes(),
      arrows: [...arrows],
    }
  }, [])

  const corrShapes: BoardShapes = useMemo(
    () => ({
      ...emptyBoardShapes(),
      highlight: [toSquare('d8'), toSquare('b6')],
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

  return (
    <div className="page pb-12">
      <header>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <LinkIcon className="size-3.5" aria-hidden="true" />
          Opened from a link · nothing to sign up for
        </p>
        <h1 className="page-title mt-1">Shared challenge</h1>
      </header>

      {/* Tabs */}
      <div
        className="tabs -mx-4 mt-4 flex [scrollbar-width:none] overflow-x-auto px-4 sm:mx-0 sm:px-0"
        role="tablist"
        aria-label="Share types"
      >
        <button
          type="button"
          role="tab"
          id="tab-puzzle"
          aria-selected={activeTab === 'puzzle'}
          aria-controls="panel-puzzle"
          className={cn(
            'tab min-h-[40px] whitespace-nowrap sm:min-h-[44px]',
            activeTab === 'puzzle' && 'is-active',
          )}
          onClick={() => {
            setActiveTab('puzzle')
          }}
        >
          Puzzle challenge
        </button>
        <button
          type="button"
          role="tab"
          id="tab-position"
          aria-selected={activeTab === 'position'}
          aria-controls="panel-position"
          className={cn(
            'tab min-h-[40px] whitespace-nowrap sm:min-h-[44px]',
            activeTab === 'position' && 'is-active',
          )}
          onClick={() => {
            setActiveTab('position')
          }}
        >
          Position
        </button>
        <button
          type="button"
          role="tab"
          id="tab-game"
          aria-selected={activeTab === 'game'}
          aria-controls="panel-game"
          className={cn(
            'tab min-h-[40px] whitespace-nowrap sm:min-h-[44px]',
            activeTab === 'game' && 'is-active',
          )}
          onClick={() => {
            setActiveTab('game')
          }}
        >
          Annotated game
        </button>
        <button
          type="button"
          role="tab"
          id="tab-corr"
          aria-selected={activeTab === 'corr'}
          aria-controls="panel-corr"
          className={cn(
            'tab min-h-[40px] whitespace-nowrap sm:min-h-[44px]',
            activeTab === 'corr' && 'is-active',
          )}
          onClick={() => {
            setActiveTab('corr')
          }}
        >
          Correspondence move
        </button>
      </div>

      {/* PUZZLE PANEL */}
      {activeTab === 'puzzle' && (
        <section id="panel-puzzle" role="tabpanel" aria-labelledby="tab-puzzle" className="mt-6">
          <div className="card overflow-hidden">
            <div className="grid gap-6 p-4 sm:gap-8 sm:p-6 md:grid-cols-[minmax(0,380px)_minmax(0,1fr)] md:p-8">
              <figure className="mx-auto w-full max-w-[min(100%,calc(100dvh-260px),420px)] md:max-w-none">
                <div className="overflow-hidden rounded-xl shadow-[0_18px_40px_-18px_rgba(30,40,30,.45)] ring-1 ring-border">
                  <Board
                    fen={PUZZLE_FEN}
                    orientation="white"
                    coordinates
                    movable="none"
                    label="Puzzle: White to play and win"
                  />
                </div>
                <figcaption className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <span
                    className="size-3 shrink-0 rounded-full border bg-white"
                    aria-hidden="true"
                  />
                  <span>
                    <b className="font-medium text-foreground">White to play.</b> Mate is in there
                    somewhere.
                  </span>
                </figcaption>
              </figure>

              <div className="flex flex-col">
                <div className="flex items-center gap-3">
                  <span className="avatar size-10 shrink-0 bg-[#e9a15a] text-xs font-bold text-[#3b1d00]">
                    RA
                  </span>
                  <div className="min-w-0 leading-tight">
                    <div className="truncate text-sm font-semibold">Rafi challenged you</div>
                    <div className="truncate text-xs text-muted-foreground">
                      He solved it in 1:12 · rated about 1550
                    </div>
                  </div>
                </div>

                <h2 className="mt-4 text-2xl font-bold tracking-tight sm:mt-5 sm:text-[30px] sm:leading-[1.05] md:text-[34px]">
                  White to play and win
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  "Found this in my club game last night. Bet you can't see it in under a minute."{' '}
                  <span className="text-foreground">— Rafi</span>
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="badge">
                    <Timer className="size-3.5" aria-hidden="true" />
                    Beat 1:12
                  </span>
                  <span className="badge">
                    <Footprints className="size-3.5" aria-hidden="true" />4 moves deep
                  </span>
                  <span className="badge badge-reward">
                    <EyeOff className="size-3.5" aria-hidden="true" />
                    Theme hidden
                  </span>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <Button asChild className="btn-cta min-h-[44px] w-full sm:w-auto">
                    <Link to="/puzzles/solve">
                      <Play className="size-[18px]" aria-hidden="true" />
                      Solve it
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="min-h-[44px] w-full sm:w-auto"
                  >
                    <Link to="/analysis">
                      <Microscope className="size-4" aria-hidden="true" />
                      Open in analysis
                    </Link>
                  </Button>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Solve it and you get a link back to send Rafi with your time.
                </p>

                <div className="mt-auto pt-6 sm:pt-8">
                  <div className="rounded-2xl bg-accent/60 p-3.5 sm:p-4">
                    <h3 className="flex items-center gap-2 text-sm font-bold">
                      <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
                      The whole puzzle lives inside the link
                    </h3>
                    <p className="mt-1.5 rounded-lg bg-card px-2.5 py-2 font-mono text-[11px] leading-relaxed break-all text-muted-foreground ring-1 ring-border sm:px-3 sm:text-[11.5px]">
                      chessking.app/s
                      <span className="font-semibold text-primary">
                        #p=r4r1k/pp1b2pp/1qnp4/2p1p1N1/2Q1P3/2PP4/PP4PP/R1B1R2K_w&amp;by=Rafi&amp;t=72
                      </span>
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Everything after the{' '}
                      <span className="font-mono font-medium whitespace-nowrap text-foreground">
                        #
                      </span>{' '}
                      is the position, who sent it and their time. Browsers never send that part to
                      a server, so nothing is stored anywhere.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* POSITION PANEL */}
      {activeTab === 'position' && (
        <section
          id="panel-position"
          role="tabpanel"
          aria-labelledby="tab-position"
          className="mt-6"
        >
          <div className="card grid gap-6 p-4 sm:gap-8 sm:p-6 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)] md:p-8">
            <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-260px),380px)] overflow-hidden rounded-xl ring-1 ring-border md:max-w-none">
              <Board
                fen={POSITION_FEN}
                coordinates
                movable="none"
                shapes={positionShapes}
                label="Queen's Gambit Declined, White to move"
              />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <span className="avatar size-10 shrink-0 bg-sky text-xs font-bold text-sky-ink">
                  MN
                </span>
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-sm font-semibold">Mina shared a position</div>
                  <div className="truncate text-xs text-muted-foreground">
                    Queen's Gambit Declined · move 10
                  </div>
                </div>
              </div>
              <h2 className="mt-4 text-xl font-bold sm:mt-5 sm:text-2xl">
                "Trade on e7, or keep the bishop?"
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                A shared position is a question, not a quiz. Open it, try ideas, and send your
                answer back as a new link.
              </p>
              <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-2">
                <Button asChild className="min-h-[44px] w-full sm:w-auto">
                  <Link to="/analysis">
                    <Microscope className="size-4" aria-hidden="true" />
                    Open in analysis
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  className="min-h-[44px] w-full sm:w-auto"
                  onClick={() => {
                    handleAskSage(
                      "Help me think about Mina's question: trade on e7 or keep the bishop?",
                    )
                  }}
                >
                  <MessageCircle className="size-4" aria-hidden="true" />
                  Think it through with Sage
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ANNOTATED GAME PANEL */}
      {activeTab === 'game' && (
        <section id="panel-game" role="tabpanel" aria-labelledby="tab-game" className="mt-6">
          <div className="card grid gap-6 p-4 sm:gap-8 sm:p-6 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)] md:p-8">
            <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-260px),380px)] overflow-hidden rounded-xl ring-1 ring-border md:max-w-none">
              <Board
                fen={GAME_FEN}
                coordinates
                movable="none"
                shapes={gameShapes}
                label="Italian Game after 6...O-O, with two plan arrows"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span className="avatar size-10 shrink-0 bg-lilac text-xs font-bold text-lilac-ink">
                  TO
                </span>
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-sm font-semibold">
                    Tomás shared an annotated game
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    Tomás vs Stockfish 1400 · 1–0 · 41 moves
                  </div>
                </div>
              </div>
              <h2 className="mt-4 text-xl font-bold sm:mt-5 sm:text-2xl">
                My first win with the slow Italian
              </h2>
              <ol className="mt-4 space-y-2 text-sm">
                <li className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
                  <span className="h-fit font-mono font-medium whitespace-nowrap">7.a4</span>
                  <span className="text-muted-foreground">
                    "Grab space before Black plays …a6 and …Ba7."{' '}
                    <span className="font-medium text-foreground">Tomás</span>
                  </span>
                </li>
                <li className="flex items-start gap-3 rounded-lg bg-lilac/60 p-3">
                  <span className="h-fit font-mono font-medium whitespace-nowrap">8.Nbd2</span>
                  <span className="text-muted-foreground">
                    "The knight heads for f1 and g3, the classic tour."{' '}
                    <span className="font-semibold text-lilac-ink">Sage</span>
                  </span>
                </li>
              </ol>
              <Button asChild className="mt-5 min-h-[44px] w-full sm:w-auto">
                <Link to="/analysis">
                  <Play className="size-4" aria-hidden="true" />
                  Step through the game
                </Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* CORRESPONDENCE MOVE PANEL */}
      {activeTab === 'corr' && (
        <section id="panel-corr" role="tabpanel" aria-labelledby="tab-corr" className="mt-6">
          <div className="card grid gap-6 p-4 sm:gap-8 sm:p-6 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)] md:p-8">
            <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-260px),380px)] overflow-hidden rounded-xl ring-1 ring-border md:max-w-none">
              <Board
                fen={CORR_FEN}
                coordinates
                movable="none"
                shapes={corrShapes}
                label="Najdorf Poisoned Pawn, White to move after 7...Qb6"
              />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <span className="avatar size-10 shrink-0 bg-[#e9a15a] text-xs font-bold text-[#3b1d00]">
                  RA
                </span>
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-sm font-semibold">
                    Rafi played{' '}
                    <span className="font-mono font-medium whitespace-nowrap">7…Qb6</span>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    Sicilian Najdorf · correspondence · 2h ago
                  </div>
                </div>
              </div>
              <h2 className="mt-4 text-xl font-bold sm:mt-5 sm:text-2xl">
                Your move. Then send the link back.
              </h2>
              <ol className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <Move className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>Play your move on the board.</span>
                </li>
                <li className="flex gap-2">
                  <LinkIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>We make a new link with the whole game inside.</span>
                </li>
                <li className="flex gap-2">
                  <Send className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>Send it to Rafi however you chat.</span>
                </li>
              </ol>
              <Button asChild className="mt-5 min-h-[44px] w-full sm:w-auto">
                <Link to="/friends/live">
                  <Swords className="size-4" aria-hidden="true" />
                  Make my move
                </Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <p className="mt-6 text-center text-xs text-muted-foreground">
        New here? Chess King is a free, open-source place to learn chess.{' '}
        <Link to="/onboarding" className="font-medium text-primary hover:underline">
          Set up in under a minute
        </Link>
      </p>
    </div>
  )
}
