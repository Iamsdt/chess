import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ClipboardCopy,
  Cpu,
  FlagTriangleRight,
  MessageCircle,
  Microscope,
  RotateCcw,
  Sprout,
  Star,
  Trophy,
} from 'lucide-react'
import { useContext, useMemo, useState } from 'react'

import { ChatPanelContext } from '@/app/shell/shell-contexts'
import { Board } from '@/board'
import { Button, QualityGlyph, SimpleTooltip, toast } from '@/design'
import {
  emptyBoardShapes,
  toFen,
  toSquare,
  type Arrow,
  type BoardMark,
  type BoardShapes,
  type Fen,
  type MoveQuality,
} from '@/domain'

export interface KeyMoment {
  readonly id: string
  readonly ply: number
  readonly moveNumber: number
  readonly turn: 'white' | 'black'
  readonly moveSan: string
  readonly quality: MoveQuality
  readonly fen: Fen
  readonly explanation: string
  readonly isHero?: boolean
}

export interface MoveRecordItem {
  readonly moveNumber: number
  readonly whiteSan: string
  readonly whiteQuality?: MoveQuality
  readonly blackSan: string
  readonly blackQuality?: MoveQuality
}

const REVIEW_FEN_DEFAULT = toFen(
  'r3r1k1/bpp2pp1/p1n1b2p/P2nN3/2B4q/1QPP3P/1P1N1PP1/R1B1R1K1 w - - 1 15',
)

const KEY_MOMENTS: readonly KeyMoment[] = [
  {
    id: 'km1',
    ply: 27,
    moveNumber: 14,
    turn: 'white',
    moveSan: '14.Nxe5',
    quality: 'mistake',
    fen: toFen('r2qr1k1/bpp2pp1/p1n1b2p/P2np3/2B5/1QPP1N1P/1P1N1PP1/R1B1R1K1 w - - 0 14'),
    explanation: 'The idea you missed: b7 was loose. A free pawn, and your queen gets active.',
  },
  {
    id: 'km2',
    ply: 29,
    moveNumber: 15,
    turn: 'white',
    moveSan: '15.d4!',
    quality: 'great',
    fen: toFen('r3r1k1/bpp2pp1/p1n1b2p/P2nN3/2B4q/1QPP3P/1P1N1PP1/R1B1R1K1 w - - 1 15'),
    explanation: 'Every other move loses material. You found the one pawn that blocks the attack.',
    isHero: true,
  },
  {
    id: 'km3',
    ply: 37,
    moveNumber: 19,
    turn: 'white',
    moveSan: '19.Qa4',
    quality: 'inaccuracy',
    fen: toFen('2rqr1k1/b4pp1/p1Q1b2p/P2nR3/2BP4/2P4P/1P1N1PP1/R1B3K1 w - - 1 19'),
    explanation: 'Safe, but passive. 19.Qb7 kept the queen close to the action.',
  },
  {
    id: 'km4',
    ply: 41,
    moveNumber: 21,
    turn: 'white',
    moveSan: '21.Kh2',
    quality: 'mistake',
    fen: toFen('2rq2k1/b4pp1/p3r2p/P3R3/Q2P1n2/2P4P/1P1N1PP1/R1B3K1 w - - 0 21'),
    explanation: 'The idea you missed: develop first. 21.Nf3 brings your last knight into play.',
  },
]

const SAMPLE_MOVES: readonly MoveRecordItem[] = [
  { moveNumber: 1, whiteSan: 'e4', blackSan: 'e5' },
  { moveNumber: 2, whiteSan: 'Nf3', blackSan: 'Nc6' },
  { moveNumber: 3, whiteSan: 'Bc4', blackSan: 'Bc5' },
  { moveNumber: 4, whiteSan: 'c3', blackSan: 'Nf6' },
  { moveNumber: 5, whiteSan: 'd3', blackSan: 'd6' },
  { moveNumber: 6, whiteSan: 'O-O', blackSan: 'O-O' },
  { moveNumber: 7, whiteSan: 'a4', blackSan: 'a6' },
  { moveNumber: 8, whiteSan: 'Re1', blackSan: 'Ba7' },
  { moveNumber: 9, whiteSan: 'h3', blackSan: 'Be6' },
  { moveNumber: 10, whiteSan: 'Nbd2', blackSan: 'h6' },
  { moveNumber: 11, whiteSan: 'a5', blackSan: 'Re8' },
  { moveNumber: 12, whiteSan: 'Qb3', blackSan: 'd5' },
  { moveNumber: 13, whiteSan: 'exd5', blackSan: 'Nxd5', blackQuality: 'mistake' },
  {
    moveNumber: 14,
    whiteSan: 'Nxe5',
    whiteQuality: 'mistake',
    blackSan: 'Qh4',
    blackQuality: 'mistake',
  },
  { moveNumber: 15, whiteSan: 'd4', whiteQuality: 'great', blackSan: 'Nxe5' },
  { moveNumber: 16, whiteSan: 'Rxe5', blackSan: 'c6' },
  { moveNumber: 17, whiteSan: 'Qxb7', blackSan: 'Qd8' },
  { moveNumber: 18, whiteSan: 'Qxc6', blackSan: 'Rc8' },
  {
    moveNumber: 19,
    whiteSan: 'Qa4',
    whiteQuality: 'inaccuracy',
    blackSan: 'Nf4',
    blackQuality: 'inaccuracy',
  },
  { moveNumber: 20, whiteSan: 'Bxe6', blackSan: 'Rxe6' },
  { moveNumber: 21, whiteSan: 'Kh2', whiteQuality: 'mistake', blackSan: 'Rxe5' },
  { moveNumber: 22, whiteSan: 'dxe5', blackSan: 'Nd3' },
  { moveNumber: 23, whiteSan: 'Nf3', blackSan: 'Qc7' },
  { moveNumber: 24, whiteSan: 'Qe4', blackSan: 'Nxf2' },
  { moveNumber: 25, whiteSan: 'Qf5', blackSan: 'Rd8', blackQuality: 'inaccuracy' },
  { moveNumber: 26, whiteSan: 'Nd4', blackSan: 'Bxd4' },
  { moveNumber: 27, whiteSan: 'cxd4', blackSan: 'Rxd4' },
  { moveNumber: 28, whiteSan: 'Be3', blackSan: 'Rd1' },
  { moveNumber: 29, whiteSan: 'Rxd1', blackSan: 'Nxd1' },
  { moveNumber: 30, whiteSan: 'Bd4', blackSan: 'Nxb2' },
  { moveNumber: 31, whiteSan: 'Bxb2', blackSan: 'Qxa5' },
  { moveNumber: 32, whiteSan: 'Qc8+', blackSan: 'Kh7' },
  { moveNumber: 33, whiteSan: 'Qc3', blackSan: 'Qb6' },
  { moveNumber: 34, whiteSan: 'e6', blackSan: 'f6' },
  { moveNumber: 35, whiteSan: 'Qd3+', blackSan: 'Kg8' },
  { moveNumber: 36, whiteSan: 'Qd5', blackSan: 'Qc7+' },
  { moveNumber: 37, whiteSan: 'Kh1', blackSan: '' },
]

const QUALITY_BREAKDOWN: readonly {
  quality: MoveQuality
  label: string
  youCount: number
  sfCount: number
}[] = [
  { quality: 'great', label: 'Great', youCount: 1, sfCount: 0 },
  { quality: 'best', label: 'Best', youCount: 19, sfCount: 18 },
  { quality: 'good', label: 'Good', youCount: 8, sfCount: 8 },
  { quality: 'book', label: 'Book', youCount: 6, sfCount: 6 },
  { quality: 'inaccuracy', label: 'Inaccuracy', youCount: 1, sfCount: 2 },
  { quality: 'mistake', label: 'Mistake', youCount: 2, sfCount: 2 },
  { quality: 'blunder', label: 'Blunder', youCount: 0, sfCount: 0 },
]

/**
 * Game Review Screen (`/games/review`) — ported from `prototype/review.html`.
 *
 * Provides in-depth post-game analysis:
 * - Accuracy comparisons (You vs Opponent)
 * - Move-by-move evaluation curve
 * - Plain-language explanations for critical positions
 * - Key moments review (tactical turnarounds, missed opportunities)
 * - Full annotated move list with evaluation markers
 */
export function ReviewScreen() {
  const chatPanel = useContext(ChatPanelContext)

  const [activeTab, setActiveTab] = useState<'sum' | 'key' | 'mv'>('sum')
  const [orientation, setOrientation] = useState<'white' | 'black'>('white')
  const [currentFen, setCurrentFen] = useState<Fen>(REVIEW_FEN_DEFAULT)
  const [currentMoveIndex, setCurrentMoveIndex] = useState<number>(14)

  const boardShapes: BoardShapes = useMemo(() => {
    const arrows: Arrow[] = [
      {
        from: toSquare('d3'),
        to: toSquare('d4'),
        kind: 'best',
      },
      {
        from: toSquare('h4'),
        to: toSquare('f2'),
        kind: 'threat',
      },
    ]

    const marks: BoardMark[] = [
      {
        square: toSquare('h4'),
        quality: 'mistake',
      },
    ]

    return {
      ...emptyBoardShapes(),
      highlight: [toSquare('d8'), toSquare('h4')],
      arrows,
      marks,
    }
  }, [])

  const handleAskSage = (prompt: string) => {
    if (chatPanel) {
      chatPanel.open()
      chatPanel.focusComposer()
    }
    toast(prompt)
  }

  const handleFlip = () => {
    setOrientation((prev) => (prev === 'white' ? 'black' : 'white'))
    toast('Board flipped')
  }

  const handleCopyPgn = () => {
    toast('PGN copied to clipboard')
  }

  const handleStepFirst = () => {
    setCurrentMoveIndex(1)
    toast('Move 1')
  }

  const handleStepPrev = () => {
    setCurrentMoveIndex((prev) => Math.max(1, prev - 1))
  }

  const handleStepNext = () => {
    setCurrentMoveIndex((prev) => Math.min(37, prev + 1))
  }

  const handleStepLast = () => {
    setCurrentMoveIndex(37)
    toast('Move 37')
  }

  const handleSelectMoment = (moment: KeyMoment) => {
    setCurrentFen(moment.fen)
    setCurrentMoveIndex(moment.moveNumber)
  }

  return (
    <div className="min-h-full">
      {/* Sticky Review Header */}
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
          <span className="truncate">Review · vs Stockfish 1200 · Won</span>
        </h1>
        <span className="badge border-transparent bg-muted text-foreground/80 max-md:hidden">
          1–0 · resigned on move 37
        </span>
        <div className="ml-auto flex items-center gap-1">
          <SimpleTooltip content="Flip board orientation">
            <Button variant="ghost" size="sm" aria-label="Flip board" onClick={handleFlip}>
              <ArrowUpDown className="size-4" aria-hidden="true" />
              <span className="max-sm:hidden">Flip</span>
            </Button>
          </SimpleTooltip>
          <SimpleTooltip content="Analyse in deep engine">
            <Button asChild variant="ghost" size="sm" aria-label="Analyse in deep engine">
              <Link to="/analysis">
                <Microscope className="size-4" aria-hidden="true" />
                <span className="max-sm:hidden">Analyse</span>
              </Link>
            </Button>
          </SimpleTooltip>
          <SimpleTooltip content="Copy PGN to clipboard">
            <Button
              variant="ghost"
              size="sm"
              className="size-9 px-0"
              aria-label="Copy PGN"
              onClick={handleCopyPgn}
            >
              <ClipboardCopy className="size-4" aria-hidden="true" />
            </Button>
          </SimpleTooltip>
        </div>
      </header>

      {/* Main Review Grid */}
      <div className="grid gap-4 p-2 sm:gap-5 sm:p-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Left Column: Board & Eval Graph */}
        <section className="flex justify-center" aria-label="Review board">
          <div className="w-full max-w-[min(100%,calc(100dvh-320px))] space-y-2 sm:space-y-2.5 lg:max-w-[min(100%,60vh)]">
            {/* Opponent Bar */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <span className="grid size-8 place-items-center rounded-xl bg-[#3b4a44] text-[#cfe0d6] sm:size-9">
                <Cpu className="size-3.5 sm:size-4" aria-hidden="true" />
              </span>
              <div className="leading-tight">
                <div className="text-sm font-semibold">
                  Stockfish <span className="font-normal text-muted-foreground">1200</span>
                </div>
                <div className="text-xs text-muted-foreground">Solid · accuracy 77%</div>
              </div>
              <span className="badge ml-auto">Black</span>
            </div>

            {/* Chessboard */}
            <div className="overflow-hidden rounded-xl shadow-[0_18px_40px_-18px_rgba(30,40,30,.45)] ring-1 ring-border">
              <Board
                fen={currentFen}
                orientation={orientation}
                coordinates
                movable="none"
                shapes={boardShapes}
                label="Review position: move 14…Qh4"
              />
            </div>

            {/* User Bar */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <span className="avatar size-8 rounded-xl bg-primary font-bold text-primary-foreground sm:size-9">
                SK
              </span>
              <div className="leading-tight">
                <div className="text-sm font-semibold">
                  You <span className="font-normal text-muted-foreground">1180</span>
                </div>
                <div className="text-xs text-muted-foreground">White · accuracy 84%</div>
              </div>
              <span className="badge ml-auto border-transparent bg-reward-soft text-[#8a6310]">
                <Trophy className="mr-1 size-3.5" aria-hidden="true" />
                Won
              </span>
            </div>

            {/* Evaluation Graph */}
            <figure className="card p-2.5 sm:p-3" aria-labelledby="graph-cap">
              <figcaption
                id="graph-cap"
                className="mb-1.5 flex items-center justify-between text-xs"
              >
                <span className="font-medium">
                  Evaluation{' '}
                  <span className="font-normal text-muted-foreground">· up is better for you</span>
                </span>
                <span className="flex items-center gap-3 text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-q-mistake" />
                    Mistake
                  </span>
                  <span className="flex items-center gap-1 max-sm:hidden">
                    <span className="size-2 rounded-full bg-q-inaccuracy" />
                    Inaccuracy
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-q-great" />
                    Great
                  </span>
                </span>
              </figcaption>

              <div className="relative h-[72px] overflow-hidden rounded-lg bg-muted/60">
                <svg
                  viewBox="0 0 730 96"
                  preserveAspectRatio="none"
                  className="absolute inset-0 size-full"
                  role="img"
                  aria-label="Evaluation graph: even until move 14, then White pulls ahead and stays winning to the end."
                >
                  <line
                    x1="0"
                    y1="48"
                    x2="730"
                    y2="48"
                    stroke="var(--border)"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    vectorEffect="non-scaling-stroke"
                  />
                  <path
                    d="M0,48.0 L10,46.1 L20,46.0 L30,45.8 L40,45.1 L50,45.5 L60,46.5 L70,46.2 L80,46.2 L90,46.2 L100,46.1 L110,46.2 L120,45.7 L130,46.5 L140,46.4 L150,46.8 L160,46.1 L170,46.6 L180,46.7 L190,46.9 L200,46.4 L210,48.7 L220,48.8 L230,47.6 L240,46.4 L250,46.4 L260,34.4 L270,48.0 L280,27.0 L290,26.3 L300,23.4 L310,23.7 L320,22.5 L330,24.2 L340,22.1 L350,22.3 L360,21.1 L370,27.4 L380,21.5 L390,20.4 L400,21.2 L410,31.9 L420,30.8 L430,30.2 L440,29.4 L450,30.8 L460,28.1 L470,27.6 L480,27.3 L490,26.6 L500,21.2 L510,21.1 L520,19.0 L530,19.1 L540,19.9 L550,15.8 L560,15.8 L570,15.4 L580,15.5 L590,16.0 L600,14.0 L610,14.6 L620,14.0 L630,13.8 L640,14.0 L650,15.0 L660,13.5 L670,12.9 L680,12.6 L690,12.9 L700,12.2 L710,11.9 L720,7.4 L730,6.4 L730,48.0 L0,48.0 Z"
                    fill="var(--primary)"
                    fillOpacity=".14"
                  />
                  <path
                    d="M0,48.0 L10,46.1 L20,46.0 L30,45.8 L40,45.1 L50,45.5 L60,46.5 L70,46.2 L80,46.2 L90,46.2 L100,46.1 L110,46.2 L120,45.7 L130,46.5 L140,46.4 L150,46.8 L160,46.1 L170,46.6 L180,46.7 L190,46.9 L200,46.4 L210,48.7 L220,48.8 L230,47.6 L240,46.4 L250,46.4 L260,34.4 L270,48.0 L280,27.0 L290,26.3 L300,23.4 L310,23.7 L320,22.5 L330,24.2 L340,22.1 L350,22.3 L360,21.1 L370,27.4 L380,21.5 L390,20.4 L400,21.2 L410,31.9 L420,30.8 L430,30.2 L440,29.4 L450,30.8 L460,28.1 L470,27.6 L480,27.3 L490,26.6 L500,21.2 L510,21.1 L520,19.0 L530,19.1 L540,19.9 L550,15.8 L560,15.8 L570,15.4 L580,15.5 L590,16.0 L600,14.0 L610,14.6 L620,14.0 L630,13.8 L640,14.0 L650,15.0 L660,13.5 L670,12.9 L680,12.6 L690,12.9 L700,12.2 L710,11.9 L720,7.4 L730,6.4"
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  <line
                    x1="280"
                    y1="0"
                    x2="280"
                    y2="96"
                    stroke="var(--cta)"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>

                {/* Key Moment interactive markers */}
                <button
                  type="button"
                  className="absolute size-3 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-q-mistake ring-2 ring-card"
                  style={{ left: '36.99%', top: '50%' }}
                  title="14.Nxe5 · mistake"
                  aria-label="Move 14, your mistake Nxe5"
                  onClick={() => {
                    setCurrentMoveIndex(14)
                  }}
                />
                <button
                  type="button"
                  className="absolute size-3.5 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-q-mistake ring-2 ring-cta"
                  style={{ left: '38.36%', top: '28.1%' }}
                  title="14…Qh4 · Black's mistake (current move)"
                  aria-label="Move 14, Black's mistake Qh4, current"
                  onClick={() => {
                    setCurrentMoveIndex(14)
                  }}
                />
                <button
                  type="button"
                  className="absolute size-3 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-q-great ring-2 ring-card"
                  style={{ left: '39.73%', top: '27.4%' }}
                  title="15.d4! · great move"
                  aria-label="Move 15, great move d4"
                  onClick={() => {
                    setCurrentMoveIndex(15)
                  }}
                />
                <button
                  type="button"
                  className="absolute size-3 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-q-inaccuracy ring-2 ring-card"
                  style={{ left: '50.68%', top: '28.5%' }}
                  title="19.Qa4 · inaccuracy"
                  aria-label="Move 19, inaccuracy Qa4"
                  onClick={() => {
                    setCurrentMoveIndex(19)
                  }}
                />
                <button
                  type="button"
                  className="absolute size-3 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-q-mistake ring-2 ring-card"
                  style={{ left: '56.16%', top: '33.2%' }}
                  title="21.Kh2 · mistake"
                  aria-label="Move 21, your mistake Kh2"
                  onClick={() => {
                    setCurrentMoveIndex(21)
                  }}
                />

                <span className="pointer-events-none absolute top-1 left-2 text-[10px] font-medium text-muted-foreground">
                  + You
                </span>
                <span className="pointer-events-none absolute bottom-1 left-2 text-[10px] font-medium text-muted-foreground">
                  − Stockfish
                </span>
              </div>

              <div
                className="relative mt-1 h-3 font-mono text-[10px] text-muted-foreground"
                aria-hidden="true"
              >
                <span className="absolute left-[26%] -translate-x-1/2">10</span>
                <span className="absolute left-[53.4%] -translate-x-1/2">20</span>
                <span className="absolute left-[80.8%] -translate-x-1/2">30</span>
              </div>
            </figure>
          </div>
        </section>

        {/* Right Column: Side Panel */}
        <div className="flex min-h-0 flex-col gap-3 overflow-auto sm:gap-4 lg:max-h-[calc(100dvh-56px-48px)]">
          {/* Plain-Language Explanation for Current Move */}
          <article
            className="card shrink-0 border-q-mistake/40 p-3.5 sm:p-4"
            aria-labelledby="explain-h"
          >
            <div className="flex items-center gap-2">
              <QualityGlyph quality="mistake" size="default" />
              <h2 id="explain-h" className="text-base font-bold">
                14…Qh4 was a mistake
              </h2>
              <span className="ml-auto font-mono text-xs text-muted-foreground">0.0 → +2.7</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              <span className="text-foreground">It looks like an attack on f2</span>, with the
              bishop on a7 helping. But one pawn move, <span className="san">15.d4!</span>, cuts the
              bishop off, protects your knight on e5 and leaves the queen hitting nothing.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-accent/60 px-3 py-2 text-xs">
              <Star className="size-3.5 text-primary" aria-hidden="true" />
              <span>
                Black's best was <span className="san">14…Nf4</span>. You found{' '}
                <span className="san">15.d4!</span>, the only good reply.
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link to="/puzzles/solve">
                  <RotateCcw className="mr-1 size-3.5" aria-hidden="true" />
                  Retry position
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 text-primary"
                onClick={() => {
                  handleAskSage('Why was …Qh4 a mistake if it attacks f2?')
                }}
              >
                <MessageCircle className="mr-1 size-3.5" aria-hidden="true" />
                Why?
              </Button>
            </div>
          </article>

          {/* Tabbed Review Panel */}
          <aside
            className="card flex min-h-0 flex-1 flex-col overflow-hidden"
            aria-label="Review panel"
          >
            {/* Tabs */}
            <div className="tabs px-3 pt-2" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'sum'}
                className={`tab ${activeTab === 'sum' ? 'is-active' : ''}`}
                onClick={() => {
                  setActiveTab('sum')
                }}
              >
                Summary
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'key'}
                className={`tab ${activeTab === 'key' ? 'is-active' : ''}`}
                onClick={() => {
                  setActiveTab('key')
                }}
              >
                Key moments
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'mv'}
                className={`tab ${activeTab === 'mv' ? 'is-active' : ''}`}
                onClick={() => {
                  setActiveTab('mv')
                }}
              >
                Moves
              </button>
            </div>

            {/* Tab 1: Summary Panel */}
            {activeTab === 'sum' && (
              <div className="min-h-0 flex-1 overflow-auto p-3.5 sm:p-4">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-accent/60 p-2.5 sm:p-3">
                    <div className="label">You</div>
                    <div className="font-display text-2xl font-bold tabular-nums sm:text-3xl">
                      84<span className="text-base sm:text-lg">%</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      accuracy · +6 vs your average
                    </div>
                  </div>
                  <div className="rounded-xl bg-muted/60 p-2.5 sm:p-3">
                    <div className="label">Stockfish 1200</div>
                    <div className="font-display text-2xl font-bold text-muted-foreground tabular-nums sm:text-3xl">
                      77<span className="text-base sm:text-lg">%</span>
                    </div>
                    <div className="text-xs text-muted-foreground">accuracy</div>
                  </div>
                </div>

                {/* Move Quality Table */}
                <table className="mt-4 w-full text-sm">
                  <caption className="sr-only">Moves by quality</caption>
                  <thead>
                    <tr className="text-xs text-muted-foreground">
                      <th className="pb-1.5 text-left font-medium" scope="col">
                        Move quality
                      </th>
                      <th className="pb-1.5 text-right font-medium" scope="col">
                        You
                      </th>
                      <th className="pb-1.5 text-right font-medium" scope="col">
                        SF
                      </th>
                    </tr>
                  </thead>
                  <tbody className="[&_td]:py-1">
                    {QUALITY_BREAKDOWN.map((row) => (
                      <tr key={row.quality}>
                        <td className="flex items-center gap-2">
                          <QualityGlyph quality={row.quality} size="sm" />
                          <span>{row.label}</span>
                        </td>
                        <td className="text-right font-semibold tabular-nums">{row.youCount}</td>
                        <td className="text-right text-muted-foreground tabular-nums">
                          {row.sfCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Mistake Bank CTA Banner */}
                <Link
                  to="/mistakes"
                  className="mt-4 flex items-center gap-3 rounded-xl border border-cta/30 bg-cta-soft p-3 transition hover:-translate-y-0.5"
                >
                  <span className="grid size-9 place-items-center rounded-lg bg-card text-cta">
                    <RotateCcw className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block text-sm font-semibold">
                      3 mistakes added to your Mistake Bank
                    </span>
                    <span className="text-xs text-muted-foreground">
                      First replay tomorrow, then in 3 days
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                </Link>

                <p className="mt-3 flex gap-2 text-xs text-muted-foreground">
                  <Sprout className="mt-px size-3.5 shrink-0 text-primary" aria-hidden="true" />
                  <span>Your best stretch: moves 22–37 without a single inaccuracy.</span>
                </p>
              </div>
            )}

            {/* Tab 2: Key Moments */}
            {activeTab === 'key' && (
              <div className="min-h-0 flex-1 space-y-2.5 overflow-auto p-3.5 sm:space-y-3 sm:p-4">
                <p className="text-xs text-muted-foreground">
                  4 turning points. Play each one again before reading the answer.
                </p>
                {KEY_MOMENTS.map((moment) => (
                  <article
                    key={moment.id}
                    className={`rounded-xl border p-2.5 sm:p-3 ${
                      moment.isHero ? 'border-q-great/40 bg-sky/40' : ''
                    }`}
                  >
                    <div className="flex gap-2.5 sm:gap-3">
                      <div className="w-[64px] shrink-0 overflow-hidden rounded-md ring-1 ring-border sm:w-[72px]">
                        <Board
                          fen={moment.fen}
                          orientation="white"
                          coordinates={false}
                          movable="none"
                          label={`Key moment: ${moment.moveSan}`}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-sm font-semibold">
                          <QualityGlyph quality={moment.quality} size="sm" />
                          <span>
                            Move {moment.moveNumber} · <span className="san">{moment.moveSan}</span>
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{moment.explanation}</p>
                      </div>
                    </div>
                    <div className="mt-2.5 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => {
                          handleSelectMoment(moment)
                        }}
                      >
                        <RotateCcw className="mr-1 size-3" aria-hidden="true" />
                        View board
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-primary"
                        onClick={() => {
                          handleAskSage(`Why was ${moment.moveSan} significant?`)
                        }}
                      >
                        Why?
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {/* Tab 3: Moves List */}
            {activeTab === 'mv' && (
              <div className="min-h-0 flex-1 overflow-auto p-2">
                <div className="flex items-center gap-2 px-2 pt-1 pb-2">
                  <QualityGlyph quality="book" size="sm" />
                  <span className="text-xs text-muted-foreground">
                    Italian Game · Giuoco Pianissimo (C54) · book until move 6
                  </span>
                </div>
                <ol className="text-sm">
                  {SAMPLE_MOVES.map((item) => {
                    const isWhiteActive = currentMoveIndex === item.moveNumber
                    return (
                      <li
                        key={item.moveNumber}
                        className="grid grid-cols-[32px_1fr_1fr] items-center rounded-md px-2 py-1 odd:bg-muted/50"
                      >
                        <span className="font-mono text-xs text-muted-foreground">
                          {item.moveNumber}.
                        </span>
                        <button
                          type="button"
                          className={`mv flex items-center justify-start text-left ${
                            isWhiteActive ? 'is-current' : ''
                          }`}
                          onClick={() => {
                            setCurrentMoveIndex(item.moveNumber)
                          }}
                        >
                          <span>{item.whiteSan}</span>
                          {item.whiteQuality ? (
                            <QualityGlyph quality={item.whiteQuality} size="sm" className="ml-1" />
                          ) : null}
                        </button>
                        {item.blackSan ? (
                          <button
                            type="button"
                            className="mv flex items-center justify-start text-left"
                            onClick={() => {
                              setCurrentMoveIndex(item.moveNumber)
                            }}
                          >
                            <span>{item.blackSan}</span>
                            {item.blackQuality ? (
                              <QualityGlyph
                                quality={item.blackQuality}
                                size="sm"
                                className="ml-1"
                              />
                            ) : null}
                          </button>
                        ) : (
                          <span />
                        )}
                      </li>
                    )
                  })}
                </ol>
                <p className="px-2 pt-3 pb-2 text-xs text-muted-foreground">
                  1–0 · Stockfish 1200 resigned
                </p>
              </div>
            )}

            {/* Bottom Controls for Stepping */}
            <div className="border-t p-3">
              <div className="grid grid-cols-4 gap-1">
                <SimpleTooltip content="First move (Home)">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="First move"
                    onClick={handleStepFirst}
                  >
                    <ChevronsLeft className="size-4" aria-hidden="true" />
                  </Button>
                </SimpleTooltip>
                <SimpleTooltip content="Previous move (←)">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Previous move"
                    onClick={handleStepPrev}
                  >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                  </Button>
                </SimpleTooltip>
                <SimpleTooltip content="Next move (→)">
                  <Button variant="ghost" size="sm" aria-label="Next move" onClick={handleStepNext}>
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </Button>
                </SimpleTooltip>
                <SimpleTooltip content="Last move (End)">
                  <Button variant="ghost" size="sm" aria-label="Last move" onClick={handleStepLast}>
                    <ChevronsRight className="size-4" aria-hidden="true" />
                  </Button>
                </SimpleTooltip>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
