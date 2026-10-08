import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * A round clock for the vision drills.
 *
 * It stores a deadline and recomputes the time left from the wall clock on every
 * tick, so a throttled background tab cannot make a minute last longer than a minute.
 */

/** Often enough that the displayed second never lags by more than a frame or two. */
const TICK_MS = 200

/** Whole seconds left, rounded up so the clock reads 0:01 until it is truly over. */
export function remainingSeconds(deadlineMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000))
}

/** `m:ss`, which is what the prototype's clock shows. */
export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(whole / 60)
  return `${String(minutes)}:${String(whole % 60).padStart(2, '0')}`
}

export type CountdownStatus = 'idle' | 'running' | 'expired'

export interface Countdown {
  readonly status: CountdownStatus
  readonly remaining: number
  readonly start: () => void
  readonly reset: () => void
}

export function useCountdown(durationSeconds: number, onExpire?: () => void): Countdown {
  const [deadline, setDeadline] = useState<number | null>(null)
  const [remaining, setRemaining] = useState(durationSeconds)
  const [status, setStatus] = useState<CountdownStatus>('idle')

  const expireRef = useRef(onExpire)
  useEffect(() => {
    expireRef.current = onExpire
  }, [onExpire])

  useEffect(() => {
    if (deadline === null) return
    const handle = window.setInterval(() => {
      const left = remainingSeconds(deadline, Date.now())
      setRemaining(left)
      if (left > 0) return
      window.clearInterval(handle)
      setStatus('expired')
      expireRef.current?.()
    }, TICK_MS)
    return () => {
      window.clearInterval(handle)
    }
  }, [deadline])

  const start = useCallback(() => {
    setRemaining(durationSeconds)
    setStatus('running')
    setDeadline(Date.now() + durationSeconds * 1000)
  }, [durationSeconds])

  const reset = useCallback(() => {
    setDeadline(null)
    setRemaining(durationSeconds)
    setStatus('idle')
  }, [durationSeconds])

  return { status, remaining, start, reset }
}
