import type { SessionKind } from '@/domain'

/**
 * S24 · Today's path: the next two to four things worth doing, in order.
 *
 * Pure, so every plan can be tested against a handful of situations. The planner only
 * proposes what the app can actually do and can tell afterwards whether it was done:
 * a step is "done" when a practice session of the matching kind exists today, or — for
 * the Mistake Bank — when nothing is waiting any more.
 */

export type PathStepId =
  'daily-puzzle' | 'weak-theme' | 'puzzles' | 'lesson' | 'mistakes' | 'play' | 'review'

export type PathLink = '/puzzles' | '/mistakes' | '/play' | '/games/review' | '/learn/lesson'

/** Which puzzle set a step starts, so "Start" lands on a puzzle and not on a menu. */
export type PuzzleLaunch =
  | { readonly kind: 'daily-puzzle' }
  | { readonly kind: 'theme-puzzles'; readonly theme: string }
  | { readonly kind: 'adaptive-puzzles' }

export interface PathStep {
  readonly id: PathStepId
  readonly title: string
  readonly detail: string
  readonly minutes: number
  readonly done: boolean
  readonly href: PathLink
  /** Set on puzzle steps: the set to open before going to the solver. */
  readonly launch?: PuzzleLaunch
  /** Set on the lesson step: which lesson to open. */
  readonly lessonId?: string
  /** Set on the review step: which game to open. */
  readonly gameId?: string
}

export interface PathInput {
  /** Kinds of the practice sessions that happened today (any state but abandoned). */
  readonly todayKinds: readonly SessionKind[]
  /** Mistake cards due now, and how many mistakes the bank holds in all. */
  readonly dueMistakes: number
  readonly totalMistakes: number
  /** The theme the user is weakest at, when there is enough data to say. */
  readonly weakestTheme: { readonly id: string; readonly label: string } | undefined
  /** The lesson worth doing next, if any is installed and unfinished. */
  readonly nextLesson:
    { readonly id: string; readonly title: string; readonly minutes: number } | undefined
  /** The most recent game that has not been reviewed, if there is one. */
  readonly reviewTarget: { readonly id: string; readonly opponent: string } | undefined
  /** A game was reviewed today, so the step counts as done. */
  readonly reviewedToday: boolean
  readonly dailyMinutes: number
}

const MAX_STEPS = 4
const MISTAKES_PER_SESSION = 5

function didToday(input: PathInput, ...kinds: SessionKind[]): boolean {
  return input.todayKinds.some((kind) => kinds.includes(kind))
}

export function planPath(input: PathInput): PathStep[] {
  const steps: PathStep[] = [
    {
      id: 'daily-puzzle',
      title: 'Daily puzzle',
      detail: 'One position, the same all day. A quick warm-up.',
      minutes: 2,
      done: didToday(input, 'daily-puzzle'),
      href: '/puzzles',
      launch: { kind: 'daily-puzzle' },
    },
  ]

  if (input.nextLesson !== undefined) {
    steps.push({
      id: 'lesson',
      title: `Lesson: ${input.nextLesson.title}`,
      detail: 'Learn it by playing the moves. It picks up where you left off.',
      minutes: input.nextLesson.minutes,
      done: didToday(input, 'lesson'),
      href: '/learn/lesson',
      lessonId: input.nextLesson.id,
    })
  }

  if (input.weakestTheme !== undefined) {
    const name = input.weakestTheme.label.toLowerCase()
    steps.push({
      id: 'weak-theme',
      title: `Sharpen ${name}`,
      detail: `A few ${name} puzzles: the theme you solve least often first time.`,
      minutes: 5,
      done: didToday(input, 'theme-puzzles', 'adaptive-puzzles'),
      href: '/puzzles',
      launch: { kind: 'theme-puzzles', theme: input.weakestTheme.id },
    })
  } else {
    steps.push({
      id: 'puzzles',
      title: 'Solve a few puzzles',
      detail: 'Picked to be hard enough to learn from. Your rating finds its level.',
      minutes: 5,
      done: didToday(input, 'theme-puzzles', 'adaptive-puzzles'),
      href: '/puzzles',
      launch: { kind: 'adaptive-puzzles' },
    })
  }

  if (input.totalMistakes > 0) {
    const count = Math.min(input.dueMistakes, MISTAKES_PER_SESSION)
    steps.push({
      id: 'mistakes',
      title:
        input.dueMistakes === 0
          ? 'Mistake Bank: all caught up'
          : `Give ${count === 1 ? 'a mistake' : `${String(count)} mistakes`} a second chance`,
      detail:
        input.dueMistakes === 0
          ? 'Nothing is due. They come back when it is time.'
          : 'Recall them now and they come back later, further apart, until they are yours.',
      minutes: Math.max(1, Math.ceil(count * 0.8)),
      done: input.dueMistakes === 0,
      href: '/mistakes',
    })
  }

  // A finished game that was never reviewed is the best use of ten minutes there is; a game
  // reviewed today keeps its step, ticked, so the day reads as what was actually done.
  if ((input.reviewTarget !== undefined || input.reviewedToday) && steps.length < MAX_STEPS) {
    steps.push({
      id: 'review',
      title:
        input.reviewTarget === undefined
          ? 'Review a game'
          : `Review your game against ${input.reviewTarget.opponent}`,
      detail: 'Find the one moment that decided it, and keep the idea.',
      minutes: 5,
      done: input.reviewedToday,
      href: '/games/review',
      ...(input.reviewTarget === undefined ? {} : { gameId: input.reviewTarget.id }),
    })
  } else if (input.dailyMinutes >= 15 && steps.length < MAX_STEPS) {
    // Otherwise a game fills the time for anyone with a goal of 15 minutes or more.
    steps.push({
      id: 'play',
      title: 'Play a game against Stockfish',
      detail: 'Practice that counts: it is rated, and reviewed afterwards.',
      minutes: 10,
      done: didToday(input, 'sparring'),
      href: '/play',
    })
  }

  return steps.slice(0, MAX_STEPS)
}

export interface PathProgress {
  readonly done: number
  readonly total: number
  /** Index of the first step still to do, or `-1` when every step is done. */
  readonly activeIndex: number
  readonly minutesLeft: number
}

export function pathProgress(steps: readonly PathStep[]): PathProgress {
  const remaining = steps.filter((step) => !step.done)
  return {
    done: steps.length - remaining.length,
    total: steps.length,
    activeIndex: steps.findIndex((step) => !step.done),
    minutesLeft: remaining.reduce((sum, step) => sum + step.minutes, 0),
  }
}
