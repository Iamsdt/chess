import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { puzzlesRepo } from '@/data'
import { Button } from '@/design'
import type { Puzzle, SkillLevel } from '@/domain'
import type { GlickoRating } from '@/features/puzzles'
import { SolverBoard } from '@/features/puzzles/components/solver-board'
import {
  createSolve,
  playOpponentReply,
  playUserMove,
  type AttemptedMove,
  type SolveState,
} from '@/features/puzzles/solution'

import {
  PLACEMENT_COUNT,
  pickPlacementPuzzle,
  placementRating,
  placementSeed,
  type PlacementOutcome,
} from './placement'

/**
 * How far either side of the estimate to look, narrowest first.
 *
 * Why widen in steps rather than load a whole rating range: the puzzle table can hold
 * tens of thousands of rows, and placement needs one puzzle near the estimate at a time.
 */
const SEARCH_REACH = [25, 75, 200, 500, 1000] as const
const CANDIDATES_PER_SEARCH = 60
const REPLY_DELAY_MS = 450

export interface PlacementRunnerProps {
  readonly level: SkillLevel
  /** Called with the measured rating, or `null` when placement was skipped or had no puzzles. */
  readonly onDone: (rating: GlickoRating | null) => void
}

const NO_FOCUS: readonly never[] = []

/**
 * Five puzzles, one at a time, that measure where the first real session should start.
 *
 * Why it does not touch the attempt history: a placement puzzle is a measurement, and
 * counting it as practice would seed the theme stats and the repeat cooldown with answers
 * the user gave while being tested. Why a miss is final: placement has no hints and no
 * retries, so each result means the same thing.
 */
export function PlacementRunner({ level, onDone }: PlacementRunnerProps) {
  const seed = useMemo(() => placementSeed(level), [level])
  const [outcomes, setOutcomes] = useState<readonly PlacementOutcome[]>([])
  const [solve, setSolve] = useState<SolveState | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const asked = useRef(new Set<string>())
  const replyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // A ref so a parent that passes a fresh callback each render cannot restart the search.
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  }, [onDone])

  useEffect(
    () => () => {
      clearTimeout(replyTimer.current)
    },
    [],
  )

  const current = useMemo(() => placementRating(seed, outcomes), [seed, outcomes])
  const finished = outcomes.length >= PLACEMENT_COUNT
  const waitingForPuzzle = solve === null
  const answered = outcomes.length
  const estimate = current.rating

  // Draw the next puzzle at the running estimate whenever the previous one has been judged.
  useEffect(() => {
    if (finished || !waitingForPuzzle || unavailable) return
    const search = { cancelled: false }
    void (async () => {
      for (const reach of SEARCH_REACH) {
        const rows = await puzzlesRepo.select({
          minRating: Math.max(0, estimate - reach),
          maxRating: estimate + reach,
          excludeIds: [...asked.current] as Puzzle['id'][],
          limit: CANDIDATES_PER_SEARCH,
        })
        if (search.cancelled) return
        for (;;) {
          const next = pickPlacementPuzzle(rows, estimate, asked.current)
          if (next === undefined) break
          asked.current.add(next.id)
          const created = createSolve(next)
          if (created.ok) {
            setSolve(created.value)
            return
          }
        }
      }
      // Nothing near the estimate at any reach: the set is empty, or all of it was asked.
      if (answered === 0) setUnavailable(true)
      else doneRef.current(current)
    })().catch(() => {
      if (!search.cancelled) setUnavailable(true)
    })
    return () => {
      search.cancelled = true
    }
  }, [finished, waitingForPuzzle, unavailable, estimate, answered, current])

  const record = useCallback((puzzle: Puzzle, solved: boolean) => {
    // A pending opponent reply belongs to the puzzle being left, not the next one.
    clearTimeout(replyTimer.current)
    setOutcomes((list) => [...list, { puzzleRating: puzzle.rating, solved }])
    setSolve(null)
  }, [])

  const onMove = useCallback(
    (move: AttemptedMove) => {
      if (solve?.status !== 'solving') return
      const result = playUserMove(solve, move)
      if (result.verdict === 'missed') {
        record(solve.puzzle, false)
        return
      }
      if (result.verdict === 'solved') {
        setSolve(result.state)
        replyTimer.current = setTimeout(() => {
          record(solve.puzzle, true)
        }, REPLY_DELAY_MS)
        return
      }
      setSolve(result.state)
      replyTimer.current = setTimeout(() => {
        setSolve((state) => (state === null ? state : playOpponentReply(state)))
      }, REPLY_DELAY_MS)
    },
    [solve, record],
  )

  if (unavailable) {
    return (
      <div className="text-center" role="status">
        <p className="text-sm text-muted-foreground">
          The puzzle set is still loading on this device, so placement will have to wait. Your level
          answer is saved and puzzles will adapt as you solve.
        </p>
        <Button
          className="btn-cta mt-4 min-h-[44px]"
          onClick={() => {
            doneRef.current(null)
          }}
        >
          Continue to Today
        </Button>
      </div>
    )
  }

  if (finished) {
    return (
      <div className="text-center" role="status">
        <p className="eyebrow">Placement complete</p>
        <h2 className="mt-1 text-xl font-bold sm:text-2xl">
          Your puzzles start around {Math.round(current.rating)}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          It keeps adapting as you solve, so this is a starting point, not a verdict.
        </p>
        <Button
          className="btn-cta mt-5 min-h-[44px]"
          onClick={() => {
            doneRef.current(current)
          }}
        >
          Go to Today
        </Button>
      </div>
    )
  }

  return (
    <section aria-labelledby="placement-h" className="rise">
      <p className="eyebrow">
        Placement · puzzle {Math.min(outcomes.length + 1, PLACEMENT_COUNT)} of {PLACEMENT_COUNT}
      </p>
      <h2 id="placement-h" className="mt-1 text-xl font-bold sm:text-2xl">
        {solve === null || solve.userColor === 'white' ? 'White' : 'Black'} to move: find the best
        move
      </h2>
      <div className="mx-auto mt-4 w-full max-w-[440px]">
        <SolverBoard
          solve={solve}
          focus={NO_FOCUS}
          onMove={onMove}
          label="Placement puzzle board"
        />
      </div>
      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button
          variant="ghost"
          className="min-h-[44px] w-full sm:w-auto"
          onClick={() => {
            doneRef.current(outcomes.length === 0 ? null : current)
          }}
        >
          Skip placement
        </Button>
        <Button
          variant="outline"
          className="min-h-[44px] w-full sm:w-auto"
          disabled={solve === null}
          onClick={() => {
            if (solve !== null) record(solve.puzzle, false)
          }}
        >
          I don&apos;t know this one
        </Button>
      </div>
    </section>
  )
}
