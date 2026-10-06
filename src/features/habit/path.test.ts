import { describe, expect, it } from 'vitest'

import { pathProgress, planPath, type PathInput } from './path'

function input(overrides: Partial<PathInput> = {}): PathInput {
  return {
    todayKinds: [],
    dueMistakes: 0,
    totalMistakes: 0,
    weakestTheme: undefined,
    nextLesson: undefined,
    reviewTarget: undefined,
    reviewedToday: false,
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
    const steps = planPath(input({ weakestTheme: { id: 'mateIn2', label: 'Mate in 2' } }))
    expect(steps[1]).toMatchObject({
      id: 'weak-theme',
      title: 'Sharpen mate in 2',
      launch: { kind: 'theme-puzzles', theme: 'mateIn2' },
    })
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
      input({
        reviewTarget: { id: 'g1', opponent: 'Stockfish 1200' },
        dailyMinutes: 30,
        totalMistakes: 3,
        dueMistakes: 3,
      }),
    )
    expect(ids(steps)).toEqual(['daily-puzzle', 'puzzles', 'mistakes', 'review'])
  })

  it('never plans more than four steps', () => {
    const steps = planPath(
      input({
        weakestTheme: { id: 'fork', label: 'Fork' },
        totalMistakes: 9,
        dueMistakes: 9,
        reviewTarget: { id: 'g1', opponent: 'Stockfish 1200' },
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

describe('planPath · starting practice directly', () => {
  it('starts the daily puzzle and the adaptive set, not just a menu', () => {
    const steps = planPath(input())
    expect(steps[0]?.launch).toEqual({ kind: 'daily-puzzle' })
    expect(steps[1]?.launch).toEqual({ kind: 'adaptive-puzzles' })
  })

  it('leaves a launch off the steps that are not puzzles', () => {
    const steps = planPath(input({ totalMistakes: 3, dueMistakes: 3, dailyMinutes: 15 }))
    expect(steps.filter((step) => step.launch === undefined).map((s) => s.id)).toEqual([
      'mistakes',
      'play',
    ])
  })
})

describe('planPath · lessons', () => {
  const nextLesson = { id: 'lesson-forks', title: 'Forks', minutes: 6 }

  it('puts the next lesson in the day, after the daily puzzle, naming the lesson to open', () => {
    const steps = planPath(input({ nextLesson }))
    expect(ids(steps)).toEqual(['daily-puzzle', 'lesson', 'puzzles'])
    expect(steps[1]).toMatchObject({
      title: 'Lesson: Forks',
      minutes: 6,
      href: '/learn/lesson',
      lessonId: 'lesson-forks',
      done: false,
    })
  })

  it('is done once a lesson session happened today, and not for other practice', () => {
    expect(planPath(input({ nextLesson, todayKinds: ['lesson'] }))[1]?.done).toBe(true)
    expect(planPath(input({ nextLesson, todayKinds: ['vision-drill'] }))[1]?.done).toBe(false)
  })

  it('leaves the lesson out when there is none to offer', () => {
    expect(ids(planPath(input()))).not.toContain('lesson')
  })

  it('keeps the day to four steps with a lesson, and keeps due mistakes in it', () => {
    const steps = planPath(
      input({
        nextLesson,
        totalMistakes: 9,
        dueMistakes: 9,
        reviewTarget: { id: 'g1', opponent: 'Stockfish 1200' },
        dailyMinutes: 30,
      }),
    )
    expect(steps).toHaveLength(4)
    expect(ids(steps)).toEqual(['daily-puzzle', 'lesson', 'puzzles', 'mistakes'])
  })
})

describe('planPath · reviewing a game', () => {
  const reviewTarget = { id: 'game-7', opponent: 'Stockfish 1200' }

  it('names the game to review and opens that one', () => {
    const step = planPath(input({ reviewTarget })).find((candidate) => candidate.id === 'review')
    expect(step).toMatchObject({
      title: 'Review your game against Stockfish 1200',
      href: '/games/review',
      gameId: 'game-7',
      done: false,
    })
  })

  it('is done once a game has been reviewed today, even with more waiting', () => {
    const step = planPath(input({ reviewTarget, reviewedToday: true })).find(
      (s) => s.id === 'review',
    )
    expect(step?.done).toBe(true)
  })

  it('keeps the ticked step when the reviewed game was the last one to review', () => {
    const step = planPath(input({ reviewedToday: true })).find((s) => s.id === 'review')
    expect(step).toMatchObject({ title: 'Review a game', done: true })
    expect(step?.gameId).toBeUndefined()
  })

  it('suggests a game to play only when there is nothing to review', () => {
    expect(ids(planPath(input({ reviewTarget, dailyMinutes: 30 })))).not.toContain('play')
    expect(ids(planPath(input({ dailyMinutes: 30 })))).toContain('play')
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
