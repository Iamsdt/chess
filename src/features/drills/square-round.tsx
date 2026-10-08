import { EyeOff } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Board } from '@/board'
import { Button, Input, toast } from '@/design'
import { emptyBoardShapes, toFen, type BoardShapes, type Fen, type Square } from '@/domain'

import { pushAttempt, type AttemptBadge } from './attempt-badges'
import { useDrillPorts } from './ports'
import { useRound } from './use-round'
import { ROUND_SECONDS } from './vision-modes'
import {
  AttemptStrip,
  BOARD_WIDTH,
  BoardColumn,
  VisionPanel,
  type VisionRoundProps,
} from './vision-parts'
import { FILES, RANKS, parseSquareGuess, pickSquare } from './vision-squares'

/** A busy middlegame, so the circled square has pieces around it to read against. */
const VISION_FEN: Fen = toFen(
  'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 w - - 1 7',
)

/** "Name the square": a coordinate-free board, one circled square, a minute on the clock. */
export function SquareRound({ orientation, record, onComplete }: VisionRoundProps) {
  const { random } = useDrillPorts()
  const round = useRound(ROUND_SECONDS.square, record.best, onComplete)
  const [target, setTarget] = useState<Square>(() => pickSquare(random, null))
  const [answered, setAnswered] = useState(0)
  const [file, setFile] = useState<string | null>(null)
  const [rank, setRank] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [badges, setBadges] = useState<readonly AttemptBadge[]>([])

  const shapes: BoardShapes = useMemo(() => ({ ...emptyBoardShapes(), focus: [target] }), [target])

  const check = (guess: string) => {
    const square = parseSquareGuess(guess)
    if (guess.trim() === '') return
    if (square === target) {
      round.point()
      setBadges((prev) => pushAttempt(prev, target, true))
      toast(`Correct, ${target}. +1`)
      setTarget(pickSquare(random, target))
    } else {
      round.miss()
      setBadges((prev) => pushAttempt(prev, `${guess.trim().toLowerCase()}, not ${target}`, false))
      toast(`Not quite: that was ${target}`)
    }
    setAnswered((value) => value + 1)
    setFile(null)
    setRank(null)
    setTyped('')
  }

  const chooseFile = (value: string) => {
    if (rank === null) setFile(value)
    else check(value + rank)
  }
  const chooseRank = (value: string) => {
    if (file === null) setRank(value)
    else check(file + value)
  }

  return (
    <>
      <BoardColumn
        width={BOARD_WIDTH}
        caption={
          <>
            <EyeOff className="size-3.5" aria-hidden="true" />
            Coordinates are off for this drill
          </>
        }
      >
        <Board
          fen={VISION_FEN}
          orientation={orientation}
          coordinates={false}
          movable="none"
          shapes={round.status === 'running' ? shapes : emptyBoardShapes()}
          label="Board without coordinates, one square circled"
        />
      </BoardColumn>

      <VisionPanel
        round={round}
        record={record}
        unit="in a minute"
        startLabel="Start the minute"
        intro="One square is circled at a time. Name it as fast as you can."
      >
        <div className="text-center">
          <p className="label">Square {String(answered + 1)}</p>
          <h2 className="mt-1 font-display text-xl leading-tight font-bold sm:text-2xl md:text-[26px]">
            Which square is circled?
          </h2>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Pick a file, then a rank. Or just type it.
          </p>
        </div>

        <fieldset>
          <legend className="label mb-1.5">File</legend>
          <div className="grid grid-cols-8 gap-1">
            {FILES.map((f) => (
              <Button
                key={f}
                type="button"
                variant="outline"
                aria-pressed={file === f}
                className={`h-9 min-h-[38px] px-0 font-mono text-sm sm:h-10 sm:text-base ${
                  file === f ? 'border-primary bg-primary font-bold text-primary-foreground' : ''
                }`}
                onClick={() => {
                  chooseFile(f)
                }}
              >
                {f}
              </Button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="label mb-1.5">Rank</legend>
          <div className="grid grid-cols-8 gap-1">
            {RANKS.map((r) => (
              <Button
                key={r}
                type="button"
                variant="outline"
                aria-pressed={rank === r}
                className={`h-9 min-h-[38px] px-0 font-mono text-sm sm:h-10 sm:text-base ${
                  rank === r ? 'border-primary bg-primary font-bold text-primary-foreground' : ''
                }`}
                onClick={() => {
                  chooseRank(r)
                }}
              >
                {r}
              </Button>
            ))}
          </div>
        </fieldset>

        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            check(typed)
          }}
        >
          <label className="sr-only" htmlFor="sq-input">
            Type the square
          </label>
          <Input
            id="sq-input"
            className="h-10 flex-1 font-mono text-sm uppercase"
            placeholder="Type it, e.g. e4"
            maxLength={2}
            autoComplete="off"
            value={typed}
            onChange={(event) => {
              setTyped(event.target.value)
            }}
          />
          <Button type="submit" className="h-10 px-4 sm:px-5">
            Check
          </Button>
        </form>

        <AttemptStrip badges={badges} />
      </VisionPanel>
    </>
  )
}
