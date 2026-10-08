import type { VisionMode } from './drill-records'

/** How long each round lasts, in seconds. */
export const ROUND_SECONDS: Readonly<Record<VisionMode, number>> = {
  square: 60,
  checks: 90,
  knight: 120,
  blindfold: 120,
}

/** What a score counts, for the "Your best" line. */
export const SCORE_UNITS: Readonly<Record<VisionMode, string>> = {
  square: 'in a minute',
  checks: 'checks',
  knight: 'routes',
  blindfold: 'answers',
}

export const MODE_TITLES: Readonly<Record<VisionMode, string>> = {
  square: 'Name the square',
  checks: 'Find all checks',
  knight: 'Knight route',
  blindfold: 'Blindfold move',
}

export const MODE_BLURBS: Readonly<Record<VisionMode, string>> = {
  square: 'Name the circled square on a board with no coordinates.',
  checks: 'Tap every checking move before the clock ends. Builds the "checks first" habit.',
  knight: 'Get the knight from one square to another in the fewest jumps.',
  blindfold: 'Read a short line of moves, hide the board, then say where the piece ends up.',
}

export function roundLabel(mode: VisionMode): string {
  const seconds = ROUND_SECONDS[mode]
  return seconds % 60 === 0 ? `${String(seconds / 60)} min` : `${String(seconds)} sec`
}
