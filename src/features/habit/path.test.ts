import { describe, expect, it } from 'vitest'

import { pathProgress, planPath, type PathInput } from './path'

function input(overrides: Partial<PathInput> = {}): PathInput {
  return {
    todayKinds: [],
    dueMistakes: 0,
    totalMistakes: 0,
    weakestTheme: undefined,
    unreviewedGames: 0,
    dailyMinutes: 5,
    ...overrides,
  }
}

const ids = (steps: ReturnType<typeof planPath>) => steps.map((step) => step.id)

describe('planPath', () => {
  it('gives a brand-new user something to do and nothing they cannot', () => {
    expect(ids(planPath(input()))).toEqual(['daily-puzzle', 'puzzles'])
  })

  it('builds a longer day from a longer goal', () => {
    expect(ids(planPath(input({ dailyMinutes: 15 })))).toEqual(['daily-puzzle', 'puzzles', 'play'])
  })

  it('aims the puzzles at the weakest theme once there is one', () => {
    const steps = planPath(input({ weakestTheme: 'Mate in 2' }))
    expect(steps[1]).toMatchObject({ id: 'weak-theme', title: 'Sharpen mate in 2' })
  })

  it('puts due mistakes in the plan, capped at five, and says how long they take', () => {
    const steps = planPath(input({ totalMistakes: 30, dueMistakes: 12 }))
    const mistakes = steps.find((step) => step.id === 'mistakes')
    expect(mistakes).toMatchObject({
      title: 'Give 5 mistakes a second chance',
      minutes: 4,
      done: false,
      href: '/mistakes',
    })
  })

  it('speaks in the singular for one mistake', () => {
    expect(
      planPath(input({ totalMistakes: 1, dueMistakes: 1 })).find((s) => s.id === 'mistakes')?.title,
    ).toBe('Give a mistake a second chance')
  })

  it('counts the Mistake Bank as done when nothing is due, and leaves it out when it is empty', () => {
    const caughtUp = planPath(input({ totalMistakes: 8, dueMistakes: 0 })).find(
      (s) => s.id === 'mistakes',
    )
    expect(caughtUp).toMatchObject({ done: true, title: 'Mistake Bank: all caught up' })
    expect(ids(planPath(input({ totalMistakes: 0 })))).not.toContain('mistakes')
  })

  it('suggests reviewing an unreviewed game before playing another', () => {
    const steps = planPath(
      input({ unreviewedGames: 2, dailyMinutes: 30, totalMistakes: 3, dueMistakes: 3 }),
    )
    expect(ids(steps)).toEqual(['daily-puzzle', 'puzzles', 'mistakes', 'review'])
  })

  it('never plans more than four steps', () => {
    const steps = planPath(
      input({
        weakestTheme: 'Fork',
        totalMistakes: 9,
        dueMistakes: 9,
        unreviewedGames: 3,
        dailyMinutes: 30,
      }),
    )
    expect(steps.length).toBeLessThanOrEqual(4)
  })

  it('marks a step done from today’s sessions', () => {
    const steps = planPath(
      input({ todayKinds: ['daily-puzzle', 'adaptive-puzzles', 'sparring'], dailyMinutes: 15 }),
    )
    expect(steps.map((step) => step.done)).toEqual([true, true, true])
  })

  it('does not treat a different kind of practice as the step', () => {
    const steps = planPath(input({ todayKinds: ['lesson', 'vision-drill'] }))
    expect(steps.every((step) => !step.done)).toBe(true)
  })
})

describe('pathProgress', () => {
  it('counts what is done, finds the next step and totals the minutes left', () => {
    const steps = planPath(input({ todayKinds: ['daily-puzzle'], dailyMinutes: 15 }))
    expect(pathProgress(steps)).toEqual({ done: 1, total: 3, activeIndex: 1, minutesLeft: 15 })
  })

  it('reports a finished day', () => {
    const steps = planPath(input({ todayKinds: ['daily-puzzle', 'theme-puzzles'] }))
    expect(pathProgress(steps)).toEqual({ done: 2, total: 2, activeIndex: -1, minutesLeft: 0 })
  })
})
