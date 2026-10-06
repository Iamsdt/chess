import { describe, expect, it } from 'vitest'

import type { PracticeSession } from '@/data'
import {
  FIXTURE_NOW,
  makeGameMeta,
  makeMistakeEntry,
  makeProfile,
  makePuzzleAttempt,
  makeStreakState,
  toAttemptId,
  toLocalDate,
  toMistakeId,
  toPuzzleId,
  toSessionId,
  toTimestamp,
} from '@/domain'

import {
  buildProgress,
  chartGeometry,
  formatDuration,
  gardenFor,
  radarGeometry,
  themeLabel,
  windowFor,
  type ProgressInput,
} from './progress-stats'

const DAY = 86_400_000
const NOW = FIXTURE_NOW // 2026-09-19 12:00 UTC, a Saturday
const ago = (days: number) => toTimestamp(NOW - days * DAY)

function input(overrides: Partial<ProgressInput> = {}): ProgressInput {
  return {
    now: NOW,
    range: '30d',
    timeZone: 'UTC',
    profile: makeProfile({ puzzleRating: 1482, sparringRating: 1180 }),
    streak: undefined,
    attempts: [],
    sessions: [],
    games: [],
    mistakes: [],
    themeOf: new Map(),
    ...overrides,
  }
}

function session(daysAgo: number, minutes: number, id = `s-${String(daysAgo)}`): PracticeSession {
  const startedAt = ago(daysAgo)
  return {
    id: toSessionId(id),
    kind: 'adaptive-puzzles',
    state: 'completed',
    day: toLocalDate(new Date(startedAt).toISOString().slice(0, 10)),
    startedAt,
    updatedAt: startedAt,
    endedAt: startedAt,
    durationMs: minutes * 60_000,
    itemsAttempted: 0,
    itemsCorrect: 0,
    resumeState: {},
  }
}

function attempt(
  daysAgo: number,
  id: string,
  patch: Partial<ReturnType<typeof makePuzzleAttempt>> = {},
) {
  return makePuzzleAttempt({
    id: toAttemptId(id),
    startedAt: ago(daysAgo),
    endedAt: ago(daysAgo),
    sessionId: undefined,
    ...patch,
  })
}

describe('formatDuration', () => {
  it('reads like a person would say it', () => {
    expect(formatDuration(0)).toBe('0m')
    expect(formatDuration(45 * 60_000)).toBe('45m')
    expect(formatDuration((6 * 60 + 10) * 60_000)).toBe('6h 10m')
  })
})

describe('windowFor', () => {
  it('has an equally long previous window, except for all time', () => {
    expect(windowFor('30d', NOW)).toEqual({ from: NOW - 30 * DAY, previousFrom: NOW - 60 * DAY })
    expect(windowFor('all', NOW)).toEqual({ from: 0, previousFrom: null })
  })
})

describe('buildProgress · an empty database', () => {
  it('invents nothing: no charts, no skills, no earned milestones', () => {
    const model = buildProgress(input({ profile: undefined }))
    expect(model.puzzleChart).toBeUndefined()
    expect(model.accuracyChart).toBeUndefined()
    expect(model.radar).toBeUndefined()
    expect(model.skills).toEqual([])
    expect(model.earned).toEqual([])
    expect(model.metrics.map((m) => m.value)).toEqual(['—', '—', '—', '—', '0', '0m'])
    expect(model.garden.stageIndex).toBe(0)
    expect(model.heatmap.practicedDays).toBe(0)
    expect(model.heatmap.weeks).toHaveLength(16)
    expect(model.heatmap.weeks.every((week) => week.length === 7)).toBe(true)
  })
})

describe('buildProgress · puzzle rating', () => {
  it('measures the change from the first rated attempt in the window', () => {
    const attempts = [
      attempt(20, 'a1', { ratingBefore: 1418, ratingAfter: 1430 }),
      attempt(10, 'a2', { ratingBefore: 1430, ratingAfter: 1460 }),
      attempt(1, 'a3', { ratingBefore: 1460, ratingAfter: 1482 }),
      // Unrated attempts and attempts outside the window must not move the numbers.
      attempt(5, 'a4', { rated: false, ratingBefore: 1, ratingAfter: 9 }),
      attempt(45, 'a5', { ratingBefore: 1200, ratingAfter: 1210 }),
    ]
    const model = buildProgress(input({ attempts }))
    expect(model.metrics[0]).toMatchObject({ value: '1482', delta: '+64 from 1418', icon: 'up' })
    expect(model.puzzleCount).toBe(3)
    expect(model.puzzleChart?.first.value).toBe(1430)
    expect(model.puzzleChart?.last.value).toBe(1482)
  })
})

describe('buildProgress · games', () => {
  it('averages the accuracy of reviewed games and compares with the window before', () => {
    const games = [
      makeGameMeta({ id: 'g1' as never, startedAt: ago(5), accuracy: { white: 80, black: 50 } }),
      makeGameMeta({ id: 'g2' as never, startedAt: ago(8), accuracy: { white: 70, black: 50 } }),
      makeGameMeta({ id: 'g3' as never, startedAt: ago(40), accuracy: { white: 60, black: 50 } }),
    ]
    const model = buildProgress(input({ games }))
    const accuracy = model.metrics[3]
    expect(accuracy).toMatchObject({ value: '75.0%', delta: '+15.0 pts', icon: 'up' })
    expect(model.gameCount).toBe(2)
  })

  it('counts sparring results as wins, draws and losses for the side the user played', () => {
    const games = [
      makeGameMeta({ id: 'g1' as never, startedAt: ago(2), youPlay: 'white', result: '1-0' }),
      makeGameMeta({ id: 'g2' as never, startedAt: ago(3), youPlay: 'black', result: '1-0' }),
      makeGameMeta({ id: 'g3' as never, startedAt: ago(4), result: '1/2-1/2' }),
    ]
    expect(buildProgress(input({ games })).metrics[1]?.delta).toBe('1W 1D 1L')
  })
})

describe('buildProgress · practice time', () => {
  it('adds sessions and loose attempts, never an attempt that belongs to a session', () => {
    const sessions = [session(2, 10)]
    const attempts = [
      attempt(2, 'in-session', { sessionId: toSessionId('s-2'), durationMs: 600_000 }),
      attempt(1, 'loose', { durationMs: 120_000 }),
    ]
    expect(buildProgress(input({ sessions, attempts })).metrics[5]?.value).toBe('12m')
  })

  it('paints the heatmap by minutes, marks freezes and leaves the future empty', () => {
    const sessions = [session(0, 3), session(1, 10), session(2, 20), session(3, 45)]
    const streak = makeStreakState({ freezeDaysUsed: [toLocalDate('2026-09-15')] })
    const { heatmap } = buildProgress(input({ sessions, streak }))
    const cells = heatmap.weeks.flat()
    const byTitle = (needle: string) => cells.find((cell) => cell.title.startsWith(needle))
    expect(byTitle('19 Sept')?.kind).toBe('low')
    expect(byTitle('18 Sept')?.kind).toBe('med')
    expect(byTitle('17 Sept')?.kind).toBe('high')
    expect(byTitle('16 Sept')?.kind).toBe('max')
    expect(byTitle('15 Sept')?.kind).toBe('freeze')
    expect(byTitle('20 Sept')?.kind).toBe('future')
    expect(heatmap.practicedDays).toBe(4)
    expect(heatmap.freezesUsed).toBe(1)
    // 16, 17, 18, 19 and the freeze on the 15th make one unbroken run.
    expect(heatmap.currentStreak).toBe(5)
    expect(heatmap.longestStreak).toBe(5)
  })

  it('keeps a run alive until the end of today even if today is still empty', () => {
    const { heatmap } = buildProgress(input({ sessions: [session(1, 10), session(2, 10)] }))
    expect(heatmap.currentStreak).toBe(2)
  })

  it('names the busiest weekday and the favourite hour', () => {
    const { heatmap } = buildProgress(
      input({ sessions: [session(0, 10), session(7, 10), session(1, 10)] }),
    )
    expect(heatmap.busiestWeekday).toBe('Saturdays')
    expect(heatmap.favouriteHour).toBe(12)
    expect(heatmap.averageSessionMs).toBe(600_000)
  })
})

describe('buildProgress · skills', () => {
  const themeOf = new Map([
    ['p-fork', 'fork'],
    ['p-pin', 'pin'],
    ['p-mate', 'mateIn2'],
    ['p-rare', 'skewer'],
  ])

  function many(
    daysAgo: number,
    puzzle: string,
    firstTries: number,
    total: number,
    prefix: string,
  ) {
    return Array.from({ length: total }, (_, i) =>
      attempt(daysAgo, `${prefix}-${String(i)}`, {
        puzzleId: toPuzzleId(puzzle),
        firstTry: i < firstTries,
      }),
    )
  }

  it('scores each theme by first-try solves and ignores themes with too few attempts', () => {
    const attempts = [
      ...many(3, 'p-fork', 4, 5, 'f'),
      ...many(3, 'p-pin', 1, 4, 'p'),
      ...many(3, 'p-mate', 3, 3, 'm'),
      ...many(3, 'p-rare', 1, 1, 'r'),
    ]
    const { skills, radar } = buildProgress(input({ attempts, themeOf }))
    expect(skills.map((s) => [s.theme, s.score])).toEqual([
      ['fork', 80],
      ['pin', 25],
      ['mateIn2', 100],
    ])
    expect(radar?.labels.map((l) => l.text)).toEqual(['Fork', 'Pin', 'Mate in 2'])
    expect(radar?.previous).toBeUndefined()
  })

  it('compares with the previous window when there is data for it', () => {
    const attempts = [
      ...many(3, 'p-fork', 4, 4, 'now'),
      ...many(40, 'p-fork', 1, 4, 'old'),
      ...many(3, 'p-pin', 2, 4, 'p'),
      ...many(3, 'p-mate', 2, 4, 'm'),
    ]
    const { skills, radar } = buildProgress(input({ attempts, themeOf }))
    expect(skills.find((s) => s.theme === 'fork')).toMatchObject({ score: 100, previous: 25 })
    expect(radar?.previous).toBeDefined()
  })

  it('draws no radar for fewer than three themes', () => {
    expect(
      radarGeometry([{ theme: 'fork', attempts: 5, score: 50, previous: undefined }]),
    ).toBeUndefined()
  })
})

describe('themeLabel', () => {
  it('turns Lichess theme ids into words', () => {
    expect(themeLabel('mateIn2')).toBe('Mate in 2')
    expect(themeLabel('discoveredAttack')).toBe('Discovered attack')
    expect(themeLabel('fork')).toBe('Fork')
  })
})

describe('chartGeometry', () => {
  const window = { from: 0, to: 100 }

  it('is undefined with no points and a single dot with one', () => {
    expect(chartGeometry([], window)).toBeUndefined()
    const one = chartGeometry([{ at: 50, value: 1400 }], window)
    expect(one?.first).toEqual(one?.last)
  })

  it('puts later points further right and higher ratings higher up, on a round axis', () => {
    const geometry = chartGeometry(
      [
        { at: 0, value: 1418 },
        { at: 100, value: 1482 },
      ],
      window,
    )
    expect(geometry?.last.x).toBeGreaterThan(geometry?.first.x ?? 0)
    expect(geometry?.last.y).toBeLessThan(geometry?.first.y ?? 0)
    expect(geometry?.gridlines.map((g) => g.label)).toEqual(['1500', '1450', '1400'])
  })
})

describe('gardenFor', () => {
  it('grows with days practised and says how far the next stage is', () => {
    expect(gardenFor(0)).toMatchObject({ stageIndex: 0, daysToNext: 3 })
    expect(gardenFor(12)).toMatchObject({ stageIndex: 2, daysToNext: 3, next: { id: 'bloom' } })
    expect(gardenFor(100)).toMatchObject({ stageIndex: 4, next: undefined, daysToNext: 0 })
  })
})

describe('buildProgress · milestones', () => {
  it('shows the highest tier reached and the next one with real progress', () => {
    const attempts = Array.from({ length: 12 }, (_, i) => attempt(12 - i, `m-${String(i)}`))
    const mistakes = [makeMistakeEntry({ id: toMistakeId('m1'), createdAt: ago(3) })]
    const model = buildProgress(input({ attempts, mistakes }))

    expect(model.earned.map((m) => m.title)).toContain('10 puzzles solved')
    expect(model.earned.map((m) => m.title)).toContain('First mistake saved')
    const next = model.pending.find((m) => m.id === 'puzzles-solved-50')
    expect(next).toMatchObject({ current: 12, total: 50, currentDisplay: '12 of 50 solved' })
    expect(model.pending.find((m) => m.id.startsWith('rating-'))).toMatchObject({ total: 1500 })
  })
})
