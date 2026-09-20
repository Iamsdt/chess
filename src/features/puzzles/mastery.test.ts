import { describe, expect, it } from 'vitest'

import { FIXTURE_NOW, toTimestamp, type HintLevel } from '@/domain'

import {
  MASTERY_PRIOR,
  recentSolveRate,
  themeMastery,
  weakestThemes,
  type ThemeAttemptRecord,
} from './mastery'

const DAY = 86_400_000

function attempt(
  theme: string,
  solved: boolean,
  daysAgo = 0,
  hintUsed: HintLevel | null = null,
): ThemeAttemptRecord {
  return { theme, solved, hintUsed, endedAt: toTimestamp(FIXTURE_NOW - daysAgo * DAY) }
}

const now = FIXTURE_NOW

describe('theme mastery', () => {
  it('starts every theme near the middle rather than at 0 or 100', () => {
    const [fork] = themeMastery([attempt('fork', true)], { now })

    expect(fork?.mastery).toBeGreaterThan(MASTERY_PRIOR)
    expect(fork?.mastery).toBeLessThan(0.8)
    expect(fork?.attempted).toBe(1)
  })

  it('separates a theme the user sees from one they do not', () => {
    const records = [
      ...Array.from({ length: 12 }, () => attempt('pin', true)),
      ...Array.from({ length: 12 }, () => attempt('fork', false)),
    ]
    const [weakest, strongest] = themeMastery(records, { now })

    expect(weakest?.theme).toBe('fork')
    expect(weakest?.tone).toBe('needs-love')
    expect(strongest?.theme).toBe('pin')
    expect(strongest?.tone).toBe('strong')
  })

  it('counts a hinted solve as less than an unaided one', () => {
    const unaided = themeMastery(
      Array.from({ length: 10 }, () => attempt('fork', true)),
      { now },
    )
    const hinted = themeMastery(
      Array.from({ length: 10 }, () => attempt('fork', true, 0, 'square')),
      { now },
    )

    expect(hinted[0]?.mastery).toBeLessThan(unaided[0]?.mastery ?? 0)
  })

  it('weights the last fortnight above last season', () => {
    const improving = themeMastery(
      [
        ...Array.from({ length: 10 }, () => attempt('fork', false, 90)),
        ...Array.from({ length: 10 }, () => attempt('fork', true, 1)),
      ],
      { now },
    )

    expect(improving[0]?.mastery).toBeGreaterThan(0.75)
  })

  it('reports a trend only when both windows have enough attempts', () => {
    const thin = themeMastery([attempt('fork', true), attempt('fork', false, 45)], { now })
    expect(thin[0]?.delta).toBeNull()

    const trending = themeMastery(
      [
        ...Array.from({ length: 6 }, () => attempt('fork', false, 45)),
        ...Array.from({ length: 6 }, () => attempt('fork', true, 2)),
      ],
      { now },
    )
    expect(trending[0]?.delta ?? 0).toBeGreaterThan(0.2)
  })

  it('remembers when a theme was last practised', () => {
    const [fork] = themeMastery([attempt('fork', true, 3), attempt('fork', false, 9)], { now })

    expect(fork?.lastAttemptedAt).toBe(toTimestamp(FIXTURE_NOW - 3 * DAY))
  })

  it('has nothing to say about a user who has solved nothing', () => {
    expect(themeMastery([], { now })).toEqual([])
    expect(weakestThemes([], 3)).toEqual([])
    expect(recentSolveRate([])).toBeNull()
  })
})

describe('choosing what to work on', () => {
  const records = [
    ...Array.from({ length: 10 }, () => attempt('fork', false)),
    ...Array.from({ length: 10 }, () => attempt('skewer', false)),
    ...Array.from({ length: 10 }, () => attempt('pin', true)),
    attempt('deflection', false),
  ]

  it('names the weakest themes the user has actually practised', () => {
    expect(weakestThemes(themeMastery(records, { now }), 2)).toEqual(['fork', 'skewer'])
  })

  it('ignores a theme met once, so one unlucky puzzle is not a diagnosis', () => {
    expect(weakestThemes(themeMastery(records, { now }), 5)).not.toContain('deflection')
  })

  it('leaves out the themes that are already strong', () => {
    expect(weakestThemes(themeMastery(records, { now }), 5)).not.toContain('pin')
  })
})

describe('the hub headline number', () => {
  it('is the plain solve rate over the last N attempts', () => {
    const history = [
      ...Array.from({ length: 50 }, () => ({ solved: false })),
      ...Array.from({ length: 40 }, () => ({ solved: true })),
      ...Array.from({ length: 10 }, () => ({ solved: false })),
    ]

    expect(recentSolveRate(history, 50)).toBeCloseTo(0.8, 6)
    expect(recentSolveRate(history.slice(-4), 50)).toBe(0)
  })
})
