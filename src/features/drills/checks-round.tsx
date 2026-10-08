import { Forward } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import { Board, type BoardHandle, type BoardMove } from '@/board'
import { createGame, legalMoves } from '@/chess'
import { Button, toast } from '@/design'
import { emptyBoardShapes, type BoardShapes, type Square } from '@/domain'

import { pushAttempt, type AttemptBadge } from './attempt-badges'
import { checkingMoves, findCheck, shuffledPositions } from './find-checks'
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

/** "Find all checks": every checking move in the position, before the clock ends. */
export function ChecksRound({ orientation, record, onComplete }: VisionRoundProps) {
  const { random } = useDrillPorts()
  const boardRef = useRef<BoardHandle>(null)
  const round = useRound(ROUND_SECONDS.checks, record.best, onComplete)
  const positions = useMemo(() => shuffledPositions(random), [random])
  const [index, setIndex] = useState(0)
  const [found, setFound] = useState<readonly string[]>([])
  const [badges, setBadges] = useState<readonly AttemptBadge[]>([])

  const position = positions[index % positions.length]
  const checks = useMemo(
    () => (position === undefined ? [] : checkingMoves(position.fen)),
    [position],
  )

  const legal = useMemo(() => {
    const map = new Map<Square, Square[]>()
    if (position === undefined) return map
    const game = createGame(position.fen)
    if (!game.ok) return map
    for (const move of legalMoves(game.value)) {
      const targets = map.get(move.from)
      if (targets === undefined) map.set(move.from, [move.to])
      else targets.push(move.to)
    }
    return map
  }, [position])

  const turn =
    position === undefined ? 'white' : position.fen.split(' ')[1] === 'b' ? 'black' : 'white'

  const next = () => {
    setIndex((value) => value + 1)
    setFound([])
  }

  const handleMove = (move: BoardMove) => {
    const hit = findCheck(checks, move.from, move.to)
    if (hit === undefined) {
      round.miss()
      boardRef.current?.flash('error')
      setBadges((prev) => pushAttempt(prev, `${move.from}${move.to}`, false))
      toast('That move does not give check')
      return
    }
    if (found.includes(hit.uci)) {
      toast(`${hit.san} is already found`)
      return
    }
    round.point()
    boardRef.current?.flash('success')
    setBadges((prev) => pushAttempt(prev, hit.san, true))
    const total = [...found, hit.uci]
    if (total.length >= checks.length) {
      toast('Every check found. Next position.')
      next()
    } else {
      setFound(total)
    }
  }

  const shapes: BoardShapes = emptyBoardShapes()

  return (
    <>
      <BoardColumn width={BOARD_WIDTH}>
        {position === undefined ? null : (
          <Board
            ref={boardRef}
            fen={position.fen}
            orientation={orientation}
            movable={round.status === 'running' ? turn : 'none'}
            legalMoves={legal}
            onMove={handleMove}
            shapes={shapes}
            label={`Position ${String(index + 1)}. ${turn === 'white' ? 'White' : 'Black'} to move. Find every checking move.`}
          />
        )}
      </BoardColumn>

      <VisionPanel
        round={round}
        record={record}
        unit="checks"
        startLabel="Start the round"
        intro="Find every move that gives check in each position. Tap a piece, then its square."
      >
        <div className="text-center">
          <p className="label">Position {String(index + 1)}</p>
          <h2 className="mt-1 font-display text-xl leading-tight font-bold sm:text-2xl md:text-[26px]">
            Find all the checks
          </h2>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            {String(found.length)} of {String(checks.length)} found for{' '}
            {turn === 'white' ? 'White' : 'Black'}.
          </p>
        </div>
        <Button type="button" variant="outline" className="h-10 w-full" onClick={next}>
          <Forward className="mr-1.5 size-4" aria-hidden="true" />
          Skip this position
        </Button>
        <AttemptStrip badges={badges} />
      </VisionPanel>
    </>
  )
}
