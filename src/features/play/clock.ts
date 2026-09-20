import { oppositeColor } from '@/domain'
import type { Color, DurationMs, TimeControl, Timestamp } from '@/domain'

/**
 * The two clocks, as a value rather than as a running timer.
 *
 * Why no `setInterval` in here: a timer that *is* the state cannot be reloaded,
 * cannot be replayed in a test and drifts whenever the tab is throttled. Instead
 * the state records what each side had left at the instant `since`, and every
 * reader asks {@link remainingAt} for the live figure. A ticking UI is then just a
 * render loop over a pure function, and a page reload is a `since` of "now".
 */

export interface ClockState {
  readonly whiteMs: DurationMs
  readonly blackMs: DurationMs
  /** Whose clock is running, or `null` when the game is not in progress. */
  readonly runningFor: Color | null
  /** The instant `whiteMs`/`blackMs` were true. */
  readonly since: Timestamp
  readonly incrementMs: DurationMs
  /** `false` for an untimed game, where every reader short-circuits. */
  readonly timed: boolean
}

/** Under this much left, the clock turns urgent and the low-time sound fires once. */
export const LOW_TIME_MS = 30_000

export function createClock(control: TimeControl, startedAt: Timestamp): ClockState {
  if (control.kind !== 'increment') {
    return {
      whiteMs: 0,
      blackMs: 0,
      runningFor: null,
      since: startedAt,
      incrementMs: 0,
      timed: false,
    }
  }
  return {
    whiteMs: control.initialMs,
    blackMs: control.initialMs,
    runningFor: null,
    since: startedAt,
    incrementMs: control.incrementMs,
    timed: true,
  }
}

/** Why a separate verb from `createClock`: the first move is what starts a clock,
 *  not the arrival on the screen, so a player who reads the position loses nothing. */
export function startClock(clock: ClockState, forColor: Color, at: Timestamp): ClockState {
  if (!clock.timed) return clock
  return { ...clock, runningFor: forColor, since: at }
}

export function stopClock(clock: ClockState, at: Timestamp): ClockState {
  if (!clock.timed || clock.runningFor === null) return { ...clock, runningFor: null }
  const settled = settle(clock, at)
  return { ...settled, runningFor: null }
}

/** What `color` has left if the wall clock reads `at`. Never negative. */
export function remainingAt(clock: ClockState, color: Color, at: Timestamp): DurationMs {
  const stored = color === 'white' ? clock.whiteMs : clock.blackMs
  if (!clock.timed || clock.runningFor !== color) return stored
  return Math.max(0, stored - Math.max(0, at - clock.since))
}

/** Move the elapsed time out of the running side's budget and into the record. */
function settle(clock: ClockState, at: Timestamp): ClockState {
  const running = clock.runningFor
  if (running === null) return clock
  const left = remainingAt(clock, running, at)
  return running === 'white'
    ? { ...clock, whiteMs: left, since: at }
    : { ...clock, blackMs: left, since: at }
}

/**
 * Apply a completed move: charge the mover for their think, pay the increment and
 * hand the clock to the other side.
 *
 * The increment is paid even on the move that reaches zero, because it is paid on
 * *completing* a move and the flag is checked before the move is accepted.
 */
export function applyMoveToClock(clock: ClockState, mover: Color, at: Timestamp): ClockState {
  if (!clock.timed) return clock
  const settled = settle(clock, at)
  const left = (mover === 'white' ? settled.whiteMs : settled.blackMs) + clock.incrementMs
  const paid = mover === 'white' ? { ...settled, whiteMs: left } : { ...settled, blackMs: left }
  return { ...paid, runningFor: oppositeColor(mover), since: at }
}

/**
 * Put both clocks back to a ply boundary and hand the move to `toMove`.
 *
 * Why it restores rather than recomputes: a takeback gives the *thinking time
 * back* as well as taking the increment away, which is the forgiving reading and
 * the one a sparring partner wants. The pair comes from the machine's per-ply
 * record, so two takebacks in a row are as exact as one.
 */
export function rewindClock(
  clock: ClockState,
  to: { readonly whiteMs: DurationMs; readonly blackMs: DurationMs },
  toMove: Color,
  at: Timestamp,
): ClockState {
  if (!clock.timed) return clock
  return { ...clock, whiteMs: to.whiteMs, blackMs: to.blackMs, runningFor: toMove, since: at }
}

/** Who, if anyone, has run out. Checked on every tick and before every move. */
export function flaggedAt(clock: ClockState, at: Timestamp): Color | null {
  if (!clock.timed || clock.runningFor === null) return null
  return remainingAt(clock, clock.runningFor, at) <= 0 ? clock.runningFor : null
}

export function isLowTime(clock: ClockState, color: Color, at: Timestamp): boolean {
  return clock.timed && remainingAt(clock, color, at) <= LOW_TIME_MS
}

/** `9:12`, or `0:08.4` once every tenth matters. Why here: the clock strip and the
 *  game-over dialog print the same figure and must agree on the rounding. */
export function formatClock(ms: DurationMs): string {
  const safe = Math.max(0, ms)
  const totalSeconds = Math.floor(safe / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (safe < 20_000) {
    const tenths = Math.floor((safe % 1000) / 100)
    return `${String(minutes)}:${String(seconds).padStart(2, '0')}.${String(tenths)}`
  }
  return `${String(minutes)}:${String(seconds).padStart(2, '0')}`
}

/** `10 + 5`, `Untimed`, `3 days/move` — the label the setup summary and the game
 *  header both show. */
export function formatTimeControl(control: TimeControl): string {
  if (control.kind === 'untimed') return 'Untimed'
  if (control.kind === 'correspondence') {
    return `${String(control.daysPerMove)} day${control.daysPerMove === 1 ? '' : 's'}/move`
  }
  const minutes = Math.round(control.initialMs / 60_000)
  const increment = Math.round(control.incrementMs / 1000)
  return `${String(minutes)} + ${String(increment)}`
}
