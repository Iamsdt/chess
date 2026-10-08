import { Eye, EyeOff, Forward } from 'lucide-react'
import { useState } from 'react'

import { Board } from '@/board'
import { Button, Input, toast } from '@/design'
import { emptyBoardShapes, type Square } from '@/domain'

import { pushAttempt, type AttemptBadge } from './attempt-badges'
import {
  BLINDFOLD_LINES,
  blindfoldAnswer,
  blindfoldFinalFen,
  pickLine,
  type BlindfoldLine,
} from './blindfold'
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
import { parseSquareGuess } from './vision-squares'

type Phase = 'reading' | 'answering' | 'revealed'

/** Moves as a numbered list: `1. e4 e5  2. Nf3 Nc6`. */
function numberedMoves(moves: readonly string[]): string {
  const pairs: string[] = []
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push(`${String(i / 2 + 1)}. ${moves[i] ?? ''} ${moves[i + 1] ?? ''}`.trim())
  }
  return pairs.join('   ')
}

/** "Blindfold move": read a line, lose the board, then say where one piece ended up. */
export function BlindfoldRound({ orientation, record, onComplete }: VisionRoundProps) {
  const { random } = useDrillPorts()
  const round = useRound(ROUND_SECONDS.blindfold, record.best, onComplete)
  const [line, setLine] = useState<BlindfoldLine>(() => pickLine(random, null))
  const [phase, setPhase] = useState<Phase>('reading')
  const [typed, setTyped] = useState('')
  const [badges, setBadges] = useState<readonly AttemptBadge[]>([])

  const answer: Square | null = blindfoldAnswer(line)
  const finalFen = blindfoldFinalFen(line)

  const nextLine = () => {
    setLine((previous) => pickLine(random, previous))
    setPhase('reading')
    setTyped('')
  }

  const submit = () => {
    const guess = parseSquareGuess(typed)
    if (typed.trim() === '') return
    if (answer !== null && guess === answer) {
      round.point()
      setBadges((prev) => pushAttempt(prev, answer, true))
      toast(`Correct, ${answer}. +1`)
    } else {
      round.miss()
      setBadges((prev) =>
        pushAttempt(prev, `${typed.trim().toLowerCase()}, not ${answer ?? '?'}`, false),
      )
      toast(`Not quite: it ended on ${answer ?? 'an unknown square'}`)
    }
    setPhase('revealed')
  }

  return (
    <>
      <BoardColumn
        width={BOARD_WIDTH}
        caption={phase === 'revealed' ? 'The position after the line.' : 'The board is hidden.'}
      >
        {phase === 'revealed' && finalFen !== null ? (
          <Board
            fen={finalFen}
            orientation={orientation}
            movable="none"
            shapes={{ ...emptyBoardShapes(), focus: answer === null ? [] : [answer] }}
            label="The position after the line, with the answer circled"
          />
        ) : (
          <div className="grid aspect-square place-items-center bg-muted/60 text-muted-foreground">
            <div className="space-y-2 text-center">
              <EyeOff className="mx-auto size-8" aria-hidden="true" />
              <p className="text-sm font-medium">Board hidden</p>
            </div>
          </div>
        )}
      </BoardColumn>

      <VisionPanel
        round={round}
        record={record}
        unit="answers"
        startLabel="Start the round"
        intro="You get a short line of moves. Memorise it, hide the board, and say where one piece ended up."
      >
        <div className="text-center">
          <p className="label">Line {String(BLINDFOLD_LINES.indexOf(line) + 1)}</p>
          <h2 className="mt-1 font-display text-xl leading-tight font-bold sm:text-2xl md:text-[26px]">
            Where is the {line.pieceName} now?
          </h2>
        </div>

        {phase === 'reading' ? (
          <>
            <p
              className="rounded-xl bg-muted/60 p-3 text-center font-mono text-sm leading-relaxed"
              aria-label="The moves"
            >
              {numberedMoves(line.moves)}
            </p>
            <Button
              type="button"
              className="h-10 w-full"
              onClick={() => {
                setPhase('answering')
              }}
            >
              <EyeOff className="mr-1.5 size-4" aria-hidden="true" />
              Hide the moves
            </Button>
          </>
        ) : null}

        {phase === 'answering' ? (
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              submit()
            }}
          >
            <label className="sr-only" htmlFor="blindfold-input">
              Type the square
            </label>
            <Input
              id="blindfold-input"
              className="h-10 flex-1 font-mono text-sm uppercase"
              placeholder="Type it, e.g. f3"
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
        ) : null}

        {phase === 'revealed' ? (
          <Button type="button" className="h-10 w-full" onClick={nextLine}>
            <Eye className="mr-1.5 size-4" aria-hidden="true" />
            Next line
          </Button>
        ) : null}

        {phase !== 'revealed' ? (
          <Button type="button" variant="ghost" className="h-9 w-full text-xs" onClick={nextLine}>
            <Forward className="mr-1.5 size-3.5" aria-hidden="true" />
            Skip this line
          </Button>
        ) : null}

        <AttemptStrip badges={badges} />
      </VisionPanel>
    </>
  )
}
