import { Undo2 } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import { Board, type BoardHandle, type BoardMove } from '@/board'
import { Button, toast } from '@/design'
import { emptyBoardShapes, type BoardShapes, type Square } from '@/domain'

import { pushAttempt, type AttemptBadge } from './attempt-badges'
import {
  KNIGHT_ROUTE_BLOCKED,
  isShortestRoute,
  knightMoves,
  knightRouteFen,
  pickKnightRoute,
  type KnightRoute,
} from './knight-route'
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

/**
 * "Knight route": reach the target in the fewest jumps. A route that arrives but takes
 * extra jumps is told the shortest length and scores nothing, because the whole drill
 * is the habit of finding the short way.
 */
export function KnightRound({ orientation, record, onComplete }: VisionRoundProps) {
  const { random } = useDrillPorts()
  const boardRef = useRef<BoardHandle>(null)
  const round = useRound(ROUND_SECONDS.knight, record.best, onComplete)
  const [route, setRoute] = useState<KnightRoute>(() => pickKnightRoute(random, null))
  const [path, setPath] = useState<readonly Square[]>([route.from])
  const [badges, setBadges] = useState<readonly AttemptBadge[]>([])

  const at = path.at(-1) ?? route.from

  const legal = useMemo(
    () => new Map<Square, readonly Square[]>([[at, knightMoves(at, KNIGHT_ROUTE_BLOCKED)]]),
    [at],
  )

  const shapes: BoardShapes = useMemo(
    () => ({ ...emptyBoardShapes(), focus: [route.to], highlight: [...path] }),
    [route.to, path],
  )

  const nextRoute = (previous: KnightRoute) => {
    const fresh = pickKnightRoute(random, previous)
    setRoute(fresh)
    setPath([fresh.from])
  }

  const handleMove = (move: BoardMove) => {
    const walked = [...path, move.to]
    setPath(walked)
    if (move.to !== route.to) return
    const jumps = walked.length - 1
    if (isShortestRoute(walked, route)) {
      round.point()
      boardRef.current?.flash('success')
      setBadges((prev) => pushAttempt(prev, `${route.from}→${route.to} in ${String(jumps)}`, true))
      toast(`Shortest route: ${String(jumps)} jumps. +1`)
    } else {
      round.miss()
      boardRef.current?.flash('error')
      setBadges((prev) =>
        pushAttempt(
          prev,
          `${route.from}→${route.to}: ${String(jumps)}, not ${String(route.jumps)}`,
          false,
        ),
      )
      toast(`Reached it in ${String(jumps)}, but ${String(route.jumps)} was possible`)
    }
    nextRoute(route)
  }

  return (
    <>
      <BoardColumn
        width={BOARD_WIDTH}
        caption="The kings sit on a1 and h8 and are never in the way."
      >
        <Board
          ref={boardRef}
          fen={knightRouteFen(at)}
          orientation={orientation}
          movable={round.status === 'running' ? 'white' : 'none'}
          legalMoves={legal}
          onMove={handleMove}
          shapes={round.status === 'running' ? shapes : emptyBoardShapes()}
          label={`Knight on ${at}. Reach ${route.to}.`}
        />
      </BoardColumn>

      <VisionPanel
        round={round}
        record={record}
        unit="routes"
        startLabel="Start the round"
        intro="Jump the knight to the circled square in as few moves as possible."
      >
        <div className="text-center">
          <p className="label">Route</p>
          <h2 className="mt-1 font-display text-xl leading-tight font-bold sm:text-2xl md:text-[26px]">
            {route.from} to {route.to}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Jumps so far: {String(path.length - 1)}. Only the shortest route scores.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full"
          disabled={path.length < 2}
          onClick={() => {
            setPath((prev) => prev.slice(0, -1))
          }}
        >
          <Undo2 className="mr-1.5 size-4" aria-hidden="true" />
          Undo last jump
        </Button>
        <AttemptStrip badges={badges} />
      </VisionPanel>
    </>
  )
}
