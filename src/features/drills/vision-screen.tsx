import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  Check,
  Crosshair,
  EyeOff,
  RotateCcw,
  Route,
  ScanEye,
  X,
  Zap,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { Board } from '@/board'
import { Button, Input, SimpleTooltip, toast } from '@/design'
import {
  emptyBoardShapes,
  toFen,
  toSquare,
  type BoardShapes,
  type Fen,
  type Square,
} from '@/domain'

const VISION_FEN: Fen = toFen(
  'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 w - - 1 7',
)

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const

const SQUARE_POOL: readonly Square[] = [
  toSquare('g5'),
  toSquare('e4'),
  toSquare('c6'),
  toSquare('f3'),
  toSquare('d5'),
  toSquare('b4'),
  toSquare('h7'),
  toSquare('a6'),
  toSquare('f7'),
  toSquare('c3'),
]

export interface LastAttemptItem {
  readonly id: string
  readonly text: string
  readonly correct: boolean
}

/**
 * S18 · Board Vision Drill (`/drills/vision`) — ported from `prototype/vision.html`.
 *
 * Timed coordinate trainer:
 * - Board with coordinates hidden to build internal spatial board vision
 * - High-speed square identification via file/rank buttons or direct keyboard typing
 * - Streak multiplier, timer countdown, score tracking, and mistake feedback
 * - Additional vision drill cards (Find all checks, Knight route, Blindfold move)
 */
export function VisionScreen() {
  const [orientation, setOrientation] = useState<'white' | 'black'>('white')
  const [timeLeft, setTimeLeft] = useState<number>(38)
  const [score, setScore] = useState<number>(14)
  const [streak, setStreak] = useState<number>(6)
  const [squareNumber, setSquareNumber] = useState<number>(15)
  const [targetSquare, setTargetSquare] = useState<Square>(toSquare('g5'))
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [selectedRank, setSelectedRank] = useState<string | null>(null)
  const [typedInput, setTypedInput] = useState<string>('')

  const [lastThree, setLastThree] = useState<readonly LastAttemptItem[]>([
    { id: '1', text: 'c6', correct: true },
    { id: '2', text: 'f3', correct: true },
    { id: '3', text: 'd6, not d5', correct: false },
  ])

  const boardShapes: BoardShapes = useMemo(
    () => ({
      ...emptyBoardShapes(),
      highlight: [targetSquare],
    }),
    [targetSquare],
  )

  const handleCheck = (guess: string) => {
    const cleanGuess = guess.trim().toLowerCase()
    if (!cleanGuess) return

    const isCorrect = cleanGuess === targetSquare.toLowerCase()

    if (isCorrect) {
      setScore((s) => s + 1)
      setStreak((st) => st + 1)
      setSquareNumber((n) => n + 1)
      setLastThree((prev) => [
        { id: String(Date.now()), text: cleanGuess, correct: true },
        ...prev.slice(0, 2),
      ])
      toast(`Correct, ${cleanGuess}. +1`)

      // Advance to next square from the pool
      const nextIndex = (squareNumber + 1) % SQUARE_POOL.length
      setTargetSquare(SQUARE_POOL[nextIndex] ?? toSquare('e4'))
    } else {
      setStreak(0)
      setLastThree((prev) => [
        {
          id: String(Date.now()),
          text: `${cleanGuess}, not ${targetSquare}`,
          correct: false,
        },
        ...prev.slice(0, 2),
      ])
      toast(`Not quite: that was ${targetSquare}`)
    }

    setSelectedFile(null)
    setSelectedRank(null)
    setTypedInput('')
  }

  const handleSelectFile = (file: string) => {
    if (selectedRank) {
      handleCheck(file + selectedRank)
    } else {
      setSelectedFile(file)
    }
  }

  const handleSelectRank = (rank: string) => {
    if (selectedFile) {
      handleCheck(selectedFile + rank)
    } else {
      setSelectedRank(rank)
    }
  }

  const handleSubmitTyped = (e: React.SyntheticEvent) => {
    e.preventDefault()
    handleCheck(typedInput)
  }

  const handleRestart = () => {
    setTimeLeft(60)
    setScore(0)
    setStreak(0)
    setSquareNumber(1)
    setTargetSquare(toSquare('g5'))
    setSelectedFile(null)
    setSelectedRank(null)
    setTypedInput('')
    toast('Restarted. Fresh minute.')
  }

  return (
    <main className="min-h-full">
      {/* Sticky Header */}
      <header className="sticky top-0 z-10 flex h-14 items-center gap-1.5 border-b bg-background/85 px-3 backdrop-blur sm:gap-2 sm:px-4 lg:px-6">
        <Button asChild variant="ghost" size="sm" className="h-9 px-2 text-xs sm:px-3 sm:text-sm">
          <Link to="/puzzles">
            <ArrowLeft className="mr-1 size-4" aria-hidden="true" />
            <span className="max-sm:hidden">Puzzles</span>
          </Link>
        </Button>
        <div className="mx-0.5 h-5 w-px bg-border sm:mx-1" />
        <h1
          aria-label="Board vision"
          className="flex min-w-0 items-center gap-1.5 text-sm font-bold sm:gap-2 sm:text-base"
        >
          <ScanEye className="size-4 shrink-0 text-cta" aria-hidden="true" />
          <span className="truncate">Name the square</span>
        </h1>
        <span className="badge max-sm:hidden">1 min</span>
        <div className="ml-auto flex items-center gap-1">
          <div className="seg text-xs max-sm:hidden" aria-label="Board orientation" role="group">
            <button
              type="button"
              className={orientation === 'white' ? 'is-active' : ''}
              onClick={() => {
                setOrientation('white')
              }}
            >
              As White
            </button>
            <button
              type="button"
              className={orientation === 'black' ? 'is-active' : ''}
              onClick={() => {
                setOrientation('black')
              }}
            >
              As Black
            </button>
          </div>
          <SimpleTooltip content="Restart drill">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Restart drill"
              className="h-9 px-2 text-xs text-muted-foreground sm:px-3 sm:text-sm"
              onClick={handleRestart}
            >
              <RotateCcw className="mr-1 size-4" aria-hidden="true" />
              <span className="max-sm:hidden">Restart</span>
            </Button>
          </SimpleTooltip>
        </div>
      </header>

      {/* Main Grid: Board & Drill Controls */}
      <div className="grid gap-4 p-3 sm:gap-5 sm:p-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Left Column: Board */}
        <section className="flex justify-center" aria-label="Vision board">
          <div className="w-full max-w-[min(100%,calc(100dvh-180px),560px)] space-y-2 sm:space-y-2.5">
            <div className="overflow-hidden rounded-xl shadow-[0_18px_40px_-18px_rgba(30,40,30,.45)] ring-1 ring-border">
              <Board
                fen={VISION_FEN}
                orientation={orientation}
                coordinates={false}
                movable="none"
                shapes={boardShapes}
                label="Board without coordinates, one square circled"
              />
            </div>
            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <EyeOff className="size-3.5" aria-hidden="true" />
              Coordinates are off for this drill
            </p>
          </div>
        </section>

        {/* Right Column: Time, Score, Pickers, Input */}
        <aside
          className="card flex min-h-0 flex-col overflow-hidden lg:max-h-[calc(100dvh-56px-48px)]"
          aria-label="Drill panel"
        >
          {/* Top Score Bar */}
          <div className="grid grid-cols-3 border-b text-center">
            <div className="p-2.5 sm:p-3">
              <div className="label text-[11px] sm:text-xs">Time</div>
              <div
                className="clock is-running mx-auto mt-0.5 w-fit font-mono text-base font-bold sm:mt-1 sm:text-lg"
                role="timer"
                aria-label="Time left"
              >
                0:{String(timeLeft).padStart(2, '0')}
              </div>
            </div>
            <div className="border-x p-2.5 sm:p-3">
              <div className="label text-[11px] sm:text-xs">Score</div>
              <div className="mt-0.5 font-display text-2xl leading-8 font-bold tabular-nums sm:mt-1 sm:text-3xl sm:leading-9">
                {String(score)}
              </div>
            </div>
            <div className="p-2.5 sm:p-3">
              <div className="label text-[11px] sm:text-xs">Streak</div>
              <div className="mt-0.5 inline-flex items-center gap-1 font-display text-2xl leading-8 font-bold text-emerald-600 tabular-nums sm:mt-1 sm:text-3xl sm:leading-9 dark:text-emerald-400">
                <Zap className="size-4 sm:size-5" aria-hidden="true" />
                <span>{String(streak)}</span>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4 sm:space-y-5 sm:p-5">
            <div className="text-center">
              <p className="label">Square {String(squareNumber)}</p>
              <h2 className="mt-1 font-display text-xl leading-tight font-bold sm:text-2xl md:text-[26px]">
                Which square is circled?
              </h2>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                Pick a file, then a rank. Or just type it.
              </p>
            </div>

            {/* File Selector */}
            <fieldset>
              <legend className="label mb-1.5">File</legend>
              <div className="grid grid-cols-8 gap-1">
                {FILES.map((f) => (
                  <Button
                    key={f}
                    type="button"
                    variant="outline"
                    className={`h-9 min-h-[38px] px-0 font-mono text-sm sm:h-10 sm:text-base ${
                      selectedFile === f
                        ? 'border-primary bg-primary font-bold text-primary-foreground'
                        : ''
                    }`}
                    onClick={() => {
                      handleSelectFile(f)
                    }}
                  >
                    {f}
                  </Button>
                ))}
              </div>
            </fieldset>

            {/* Rank Selector */}
            <fieldset>
              <legend className="label mb-1.5">Rank</legend>
              <div className="grid grid-cols-8 gap-1">
                {RANKS.map((r) => (
                  <Button
                    key={r}
                    type="button"
                    variant="outline"
                    className={`h-9 min-h-[38px] px-0 font-mono text-sm sm:h-10 sm:text-base ${
                      selectedRank === r
                        ? 'border-primary bg-primary font-bold text-primary-foreground'
                        : ''
                    }`}
                    onClick={() => {
                      handleSelectRank(r)
                    }}
                  >
                    {r}
                  </Button>
                ))}
              </div>
            </fieldset>

            {/* Direct Type Form */}
            <form className="flex gap-2" onSubmit={handleSubmitTyped}>
              <label className="sr-only" htmlFor="sq-input">
                Type the square
              </label>
              <Input
                id="sq-input"
                className="h-10 flex-1 font-mono text-sm uppercase"
                placeholder="Type it, e.g. e4"
                maxLength={2}
                autoComplete="off"
                value={typedInput}
                onChange={(e) => {
                  setTypedInput(e.target.value)
                }}
              />
              <Button type="submit" className="h-10 px-4 sm:px-5">
                Check
              </Button>
            </form>

            {/* Last Three Badges */}
            <div className="rounded-xl bg-muted/60 p-3">
              <div className="label">Last three</div>
              <div className="mt-2 flex flex-wrap gap-1.5 font-mono text-xs">
                {lastThree.map((item) => (
                  <span
                    key={item.id}
                    className={`badge ${
                      item.correct
                        ? 'badge-soft'
                        : 'border-transparent bg-cta-soft font-medium text-cta'
                    }`}
                  >
                    {item.correct ? (
                      <Check className="mr-1 size-3" aria-hidden="true" />
                    ) : (
                      <X className="mr-1 size-3" aria-hidden="true" />
                    )}
                    {item.text}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t p-3 text-center text-xs text-muted-foreground">
            Your best: <b className="font-semibold text-foreground">19</b> in a minute · 5 to go
          </div>
        </aside>
      </div>

      {/* More Vision Drills Section */}
      <section className="px-3 pb-8 sm:px-4 lg:px-6" aria-labelledby="drills-h">
        <h2 id="drills-h" className="font-display text-lg font-bold sm:text-xl">
          More vision drills
        </h2>
        <div className="mt-3 grid gap-3 sm:mt-4 sm:grid-cols-2 sm:gap-4 md:grid-cols-3">
          <button
            type="button"
            className="card card-hover flex cursor-pointer items-start gap-3 p-4 text-left transition hover:border-ring/60 sm:p-5"
            onClick={() => {
              toast('Find all checks starts after this drill')
            }}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cta-soft text-cta">
              <Crosshair className="size-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block font-display text-base font-bold sm:text-lg">
                Find all checks
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground sm:text-sm">
                Tap every checking move before the clock ends. Builds the &quot;checks first&quot;
                habit.
              </span>
              <span className="mt-2 block text-xs text-muted-foreground">Best: 9 positions</span>
            </span>
          </button>

          <button
            type="button"
            className="card card-hover flex cursor-pointer items-start gap-3 p-4 text-left transition hover:border-ring/60 sm:p-5"
            onClick={() => {
              toast('Knight route starts after this drill')
            }}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-sky text-sky-ink">
              <Route className="size-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block font-display text-base font-bold sm:text-lg">
                Knight route
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground sm:text-sm">
                Get the knight from one square to another in the fewest jumps.
              </span>
              <span className="mt-2 block text-xs text-muted-foreground">Best: 12 routes</span>
            </span>
          </button>

          <button
            type="button"
            className="card card-hover flex cursor-pointer items-start gap-3 p-4 text-left transition hover:border-ring/60 sm:p-5 sm:max-md:col-span-2"
            onClick={() => {
              toast('Blindfold move starts after this drill')
            }}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lilac text-lilac-ink">
              <EyeOff className="size-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block font-display text-base font-bold sm:text-lg">
                Blindfold move
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground sm:text-sm">
                Hear a short line of moves, then say where the piece ends up.
              </span>
              <span className="mt-2 block text-xs text-muted-foreground">New · try it</span>
            </span>
          </button>
        </div>
      </section>
    </main>
  )
}
