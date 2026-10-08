import { useCallback, useRef, useState } from 'react'

import { useCountdown, type CountdownStatus } from './use-countdown'

/**
 * A timed, scored round: the clock plus the two counters every vision drill shares.
 *
 * `point` and `miss` do nothing unless the round is running, so a late click after the
 * buzzer cannot nudge a score that has already been saved.
 */

export interface Round {
  readonly status: CountdownStatus
  readonly remaining: number
  readonly score: number
  readonly streak: number
  /** The stored best as it stood when this round began, to tell a record from a repeat. */
  readonly bestBefore: number
  readonly point: () => void
  readonly miss: () => void
  readonly start: () => void
}

export function useRound(
  durationSeconds: number,
  storedBest: number,
  onComplete: (score: number) => void,
): Round {
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  // The expiry callback runs from a timer, where the `score` of the render that
  // started the round would be stale; the ref always holds the latest.
  const scoreRef = useRef(0)
  const [bestBefore, setBestBefore] = useState(storedBest)
  const countdown = useCountdown(durationSeconds, () => {
    onComplete(scoreRef.current)
  })
  const { status } = countdown

  const point = useCallback(() => {
    if (status !== 'running') return
    scoreRef.current += 1
    setScore(scoreRef.current)
    setStreak((value) => value + 1)
  }, [status])

  const miss = useCallback(() => {
    if (status !== 'running') return
    setStreak(0)
  }, [status])

  const { start: startClock } = countdown
  const start = useCallback(() => {
    scoreRef.current = 0
    setScore(0)
    setStreak(0)
    setBestBefore(storedBest)
    startClock()
  }, [startClock, storedBest])

  return { status, remaining: countdown.remaining, score, streak, bestBefore, point, miss, start }
}
