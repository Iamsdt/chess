import type { CoachDecision, CoachMode } from '@/domain'

/** What each mode is called and does, for the header chip and its menu (coach-agent.md §3). */
export const MODE_INFO: Readonly<Record<CoachMode, { label: string; blurb: string }>> = {
  companion: {
    label: 'Companion',
    blurb: 'Quiet during a game; warns only if you are about to hang material.',
  },
  grandmaster: { label: 'Grandmaster', blurb: 'Thinks aloud on the board, six steps.' },
  teacher: { label: 'Teacher', blurb: 'Tells the story of a game and names the one lesson.' },
  tutor: { label: 'Tutor', blurb: 'Explains the current lesson idea another way.' },
  'puzzle-nudger': { label: 'Puzzle nudger', blurb: 'Hints only, three levels, no spoilers.' },
  planner: { label: 'Planner', blurb: 'Builds your path and weekly plan from your data.' },
  'open-qa': { label: 'Open Q&A', blurb: 'Any chess question, read-only.' },
  visualization: { label: 'Visualization', blurb: 'Picture-it exercises with the board hidden.' },
  paused: { label: 'Paused', blurb: 'Off for fair play during a live game.' },
}

/** Which mode a screen opens in; the user can override it from the header. */
const MODE_BY_SCREEN: Readonly<Record<string, CoachMode>> = {
  'play-game': 'companion',
  review: 'teacher',
  games: 'teacher',
  puzzle: 'puzzle-nudger',
  today: 'planner',
  progress: 'planner',
  analysis: 'grandmaster',
  vision: 'visualization',
  endgames: 'visualization',
  lesson: 'tutor',
  live: 'paused',
}

export function defaultModeFor(screenId: string): CoachMode {
  return MODE_BY_SCREEN[screenId] ?? 'open-qa'
}

/** How sure the decision model must be before its mode replaces the screen's default. */
export const DECISION_MODE_MIN_PROB = 0.45

/** Modes the decision model never overrides: they exist for fair play during a live game. */
const FIXED_MODES: ReadonlySet<CoachMode> = new Set(['companion', 'paused'])

/**
 * The mode a question is answered in: the decision model's pick when it is confident enough,
 * otherwise what the screen opens in.
 *
 * Why live-game modes win: Companion and Paused are fair-play rules (coach-agent.md §3), not
 * routing preferences. A classifier that guessed "grandmaster" must not be able to turn them off.
 */
export function modeFromDecision(
  decision: Pick<CoachDecision, 'mode'> | undefined,
  screenId: string,
): CoachMode {
  const fallback = defaultModeFor(screenId)
  if (decision === undefined || FIXED_MODES.has(fallback)) return fallback
  return decision.mode.prob >= DECISION_MODE_MIN_PROB ? decision.mode.label : fallback
}
