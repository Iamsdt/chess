import { describe, expect, it } from 'vitest'

import { FIXTURE_NOW, toPuzzleId, toTimestamp, type PuzzleId } from '@/domain'

import {
  configFor,
  currentPuzzleId,
  fromResumeState,
  livesLeft,
  progressDots,
  RUSH_DURATIONS_MS,
  RUSH_LIVES,
  sessionReducer,
  sessionSummary,
  startSession,
  timeLeftMs,
  toResumeState,
  type PuzzleResult,
  type SessionState,
} from './session'

const ids: PuzzleId[] = Array.from({ length: 12 }, (_unused, index) =>
  toPuzzleId(`p${String(index)}`),
)

function result(overrides: Partial<PuzzleResult> = {}): PuzzleResult {
  return {
    puzzleId: ids[0] ?? toPuzzleId('p0'),
    solved: true,
    firstTry: true,
    skipped: false,
    hintUsed: null,
    durationMs: 12_000,
    ratingDelta: 8,
    theme: 'fork',
    rating: 1400,
    ...overrides,
  }
}

const start = (kind: Parameters<typeof configFor>[0] = 'adaptive-puzzles', options = {}) =>
  startSession(configFor(kind, options), ids, FIXTURE_NOW)

const record = (state: SessionState, overrides: Partial<PuzzleResult> = {}) =>
  sessionReducer(state, {
    type: 'result',
    result: result({
      puzzleId: currentPuzzleId(state) ?? ids[0] ?? toPuzzleId('p0'),
      ...overrides,
    }),
    at: FIXTURE_NOW,
  })

describe('the three numbers that make a mode', () => {
  it('gives an adaptive set a goal, no clock and no strikes', () => {
    expect(configFor('adaptive-puzzles')).toMatchObject({
      goal: 10,
      timeLimitMs: null,
      lives: null,
      strictMoves: false,
    })
  })

  it('gives Puzzle Rush a clock and three strikes', () => {
    expect(configFor('puzzle-rush', { duration: '5min' })).toMatchObject({
      goal: null,
      timeLimitMs: RUSH_DURATIONS_MS['5min'],
      lives: RUSH_LIVES,
      strictMoves: true,
    })
  })

  it('gives Survival the strikes without the clock', () => {
    expect(configFor('puzzle-survival')).toMatchObject({ timeLimitMs: null, lives: RUSH_LIVES })
  })

  it('carries the theme through a theme set', () => {
    expect(configFor('theme-puzzles', { theme: 'fork' })).toMatchObject({ theme: 'fork', goal: 10 })
  })
})

describe('running a set', () => {
  it('counts the streak and remembers the best one', () => {
    let state = start()
    state = record(state)
    state = record(state)
    expect(state.streak).toBe(2)

    state = record(state, { solved: false, firstTry: false })
    expect(state.streak).toBe(0)
    expect(state.bestStreak).toBe(2)
  })

  it('moves through the queue one puzzle at a time', () => {
    const state = record(record(start()))

    expect(currentPuzzleId(state)).toBe(ids[2])
    expect(state.results).toHaveLength(2)
  })

  it('finishes when the goal is met', () => {
    let state = start('adaptive-puzzles', { goal: 3 })
    state = record(record(record(state)))

    expect(state.status).toBe('finished')
    expect(state.endedAt).toBe(FIXTURE_NOW)
    expect(sessionReducer(state, { type: 'result', result: result(), at: FIXTURE_NOW })).toBe(state)
  })

  it('finishes when the queue runs dry', () => {
    let state = startSession(
      configFor('adaptive-puzzles', { goal: 10 }),
      [ids[0] ?? toPuzzleId('p0')],
      FIXTURE_NOW,
    )
    state = record(state)

    expect(state.status).toBe('finished')
    expect(currentPuzzleId(state)).toBeNull()
  })

  it('takes more puzzles when an open-ended run needs them, ignoring duplicates', () => {
    const state = sessionReducer(start('puzzle-survival'), {
      type: 'enqueue',
      ids: [ids[0] ?? toPuzzleId('p0'), toPuzzleId('fresh')],
    })

    expect(state.queue).toHaveLength(ids.length + 1)
  })
})

describe('the timed modes', () => {
  it('runs out of strikes after three misses', () => {
    let state = start('puzzle-rush')
    for (let miss = 0; miss < RUSH_LIVES; miss += 1) {
      expect(state.status).toBe('running')
      state = record(state, { solved: false, firstTry: false })
    }

    expect(livesLeft(state)).toBe(0)
    expect(state.status).toBe('finished')
  })

  it('runs out of time on the clock', () => {
    const state = sessionReducer(start('puzzle-rush', { duration: '3min' }), {
      type: 'tick',
      elapsedMs: RUSH_DURATIONS_MS['3min'],
      at: toTimestamp(FIXTURE_NOW + RUSH_DURATIONS_MS['3min']),
    })

    expect(timeLeftMs(state)).toBe(0)
    expect(state.status).toBe('finished')
  })

  it('never lets the clock run backwards, whatever the tab did while hidden', () => {
    let state = sessionReducer(start('puzzle-rush'), {
      type: 'tick',
      elapsedMs: 40_000,
      at: FIXTURE_NOW,
    })
    state = sessionReducer(state, { type: 'tick', elapsedMs: 10_000, at: FIXTURE_NOW })

    expect(state.elapsedMs).toBe(40_000)
  })

  it('has no clock and no strikes to lose in an adaptive set', () => {
    const state = start()

    expect(timeLeftMs(state)).toBeNull()
    expect(livesLeft(state)).toBeNull()
  })
})

describe('what the screens read back', () => {
  it('shows a dot per puzzle: done, current, still to come', () => {
    const state = record(record(start('adaptive-puzzles', { goal: 5 })), {
      solved: false,
      firstTry: false,
    })

    expect(progressDots(state)).toEqual(['solved', 'missed', 'current', 'todo', 'todo'])
  })

  it('sums the session the summary screen shows', () => {
    let state = start('adaptive-puzzles', { goal: 4 })
    state = record(state, { durationMs: 11_000, ratingDelta: 9 })
    state = record(state, { solved: false, firstTry: false, ratingDelta: -4 })
    state = record(state, {
      hintUsed: 'nudge',
      firstTry: false,
      ratingDelta: 3,
      durationMs: 40_000,
    })
    state = sessionReducer(state, { type: 'tick', elapsedMs: 252_000, at: FIXTURE_NOW })
    const summary = sessionSummary(state)

    expect(summary).toMatchObject({
      attempted: 3,
      solved: 2,
      missed: 1,
      firstTry: 1,
      hintsUsed: 1,
      ratingDelta: 8,
      durationMs: 252_000,
    })
    expect(summary.accuracy).toBeCloseTo(2 / 3, 6)
    expect(summary.bestMoment?.durationMs).toBe(11_000)
  })

  it('has nothing to report before the first attempt', () => {
    expect(sessionSummary(start()).accuracy).toBeNull()
    expect(sessionSummary(start()).bestMoment).toBeNull()
  })
})

describe('surviving a reload', () => {
  it('round-trips a half-finished session through the stored resume state', () => {
    const state = record(record(start()), { solved: false, firstTry: false })
    const restored = fromResumeState(toResumeState(state))

    expect(restored.ok).toBe(true)
    if (restored.ok) {
      expect(restored.value).toEqual(state)
      expect(currentPuzzleId(restored.value)).toBe(ids[2])
    }
  })

  it('refuses a record written by a different build rather than guessing', () => {
    expect(fromResumeState({ version: 99, session: {} }).ok).toBe(false)
    expect(fromResumeState(undefined).ok).toBe(false)
    expect(fromResumeState({ version: 1, session: { queue: ['p1'] } }).ok).toBe(false)
  })
})
