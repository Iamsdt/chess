import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { BoardMove } from '@/board'
import { toSquare, type Square } from '@/domain'

import {
  canTakeBack,
  DEFENDER_MOVETIME_MS,
  isDefenderTurn,
  isUserTurn,
  playUserMove,
  requestDefenderMove,
  startSession,
  takeBack,
  type DrillEnginePort,
  type DrillOutcome,
  type DrillSession,
} from './endgame-session'

import type { EndgameDrill } from './endgame-drills'

/**
 * The React half of a drill: the pure session plus the one thing that happens in time,
 * the engine's reply.
 *
 * The reply effect is keyed on the session itself, so a takeback (a new session value)
 * aborts the search in flight and the next render asks about the position that is
 * really on the board.
 */

export interface EndgameDrillController {
  readonly session: DrillSession | null
  /** The engine is working out its reply. */
  readonly thinking: boolean
  /** The engine failed to answer; `retry` asks again. */
  readonly engineError: string | null
  readonly startError: string | null
  readonly canTakeBack: boolean
  readonly play: (move: BoardMove) => boolean
  readonly takeBack: () => void
  readonly retry: () => void
  /** Where the engine would move from, for a hint that does not give the move away. */
  readonly hintSquare: (signal?: AbortSignal) => Promise<Square | null>
}

export function useEndgameDrill(
  drill: EndgameDrill,
  engine: DrillEnginePort,
  onFinished: (outcome: DrillOutcome) => void,
): EndgameDrillController {
  const started = useMemo(() => startSession(drill), [drill])
  const [session, setSession] = useState<DrillSession | null>(started.ok ? started.value : null)
  const [engineError, setEngineError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const finishedRef = useRef(onFinished)
  useEffect(() => {
    finishedRef.current = onFinished
  }, [onFinished])

  useEffect(() => {
    if (session === null || !isDefenderTurn(session)) return
    const controller = new AbortController()
    void requestDefenderMove(session, engine, controller.signal).then(
      (result) => {
        if (controller.signal.aborted) return
        if (result.ok) {
          setEngineError(null)
          setSession(result.value)
        } else {
          setEngineError(result.error.message)
        }
      },
      () => {
        if (!controller.signal.aborted) setEngineError('The engine could not answer.')
      },
    )
    return () => {
      controller.abort()
    }
  }, [session, engine, attempt])

  // Recorded once per outcome *value*: a strict-mode double run sees the same object.
  const recorded = useRef<DrillOutcome | null>(null)
  const outcome = session?.outcome ?? null
  useEffect(() => {
    if (outcome === null || outcome.kind === 'playing' || recorded.current === outcome) return
    recorded.current = outcome
    finishedRef.current(outcome)
  }, [outcome])

  const play = useCallback(
    (move: BoardMove): boolean => {
      if (session === null) return false
      const next = playUserMove(session, move)
      if (!next.ok) return false
      setEngineError(null)
      setSession(next.value)
      return true
    },
    [session],
  )

  const undo = useCallback(() => {
    if (session === null) return
    const next = takeBack(session)
    if (!next.ok) return
    setEngineError(null)
    setSession(next.value)
  }, [session])

  const retry = useCallback(() => {
    setEngineError(null)
    setAttempt((value) => value + 1)
  }, [])

  const hintSquare = useCallback(
    async (signal?: AbortSignal): Promise<Square | null> => {
      if (session === null || !isUserTurn(session)) return null
      const answer = await engine.bestMove(session.game.fen, {
        lane: 'play',
        elo: null,
        movetimeMs: DEFENDER_MOVETIME_MS,
        ...(signal === undefined ? {} : { signal }),
      })
      if (!answer.ok || answer.value.move === null) return null
      return toSquare(answer.value.move.slice(0, 2))
    },
    [session, engine],
  )

  return {
    session,
    thinking: session !== null && isDefenderTurn(session) && engineError === null,
    engineError,
    startError: started.ok ? null : started.error.message,
    canTakeBack: session !== null && canTakeBack(session),
    play,
    takeBack: undo,
    retry,
    hintSquare,
  }
}
