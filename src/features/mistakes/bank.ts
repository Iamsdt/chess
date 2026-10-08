import type { MistakeEntry, MoveQuality, SrsCard, SrsState } from '@/domain'
import { calendarDaysUntil, dueLabel } from '@/features/srs/format'
import { MASTERY_STREAK } from '@/features/srs/fsrs'

/**
 * The Mistake Bank as the screen shows it: rows, theme chips, the schedule strip and the
 * mastery pipeline, all derived from stored mistakes and their cards.
 *
 * Pure so the counts a person reads ("3 tomorrow") can be tested without a database.
 */

const MS_PER_DAY = 86_400_000

export type SortOrder = 'due' | 'newest' | 'game'

export interface BankRow {
  readonly id: MistakeEntry['id']
  readonly mistake: MistakeEntry
  readonly theme: string
  readonly themeLabel: string
  readonly themeTone: string
  readonly dueText: string
  readonly isDue: boolean
  readonly dueAt: number
  readonly origin: string
  readonly quality: MoveQuality
  readonly recallStreak: number
  readonly stateLabel: string
  /** True when the entry came from a puzzle that was skipped, so there is no move of theirs. */
  readonly skipped: boolean
}

export interface ThemeChip {
  readonly id: string
  readonly label: string
  readonly count: number
}

export interface ScheduleStrip {
  readonly today: number
  readonly tomorrow: number
  readonly inThreeDays: number
  readonly thisWeek: number
}

export interface Pipeline {
  readonly new: number
  readonly learning: number
  readonly reviewing: number
  readonly mastered: number
}

export interface Bank {
  readonly rows: readonly BankRow[]
  readonly chips: readonly ThemeChip[]
  readonly strip: ScheduleStrip
  readonly pipeline: Pipeline
  readonly dueCount: number
  readonly newDue: number
  readonly seenDue: number
  readonly masteredThisWeek: number
  readonly total: number
}

/** `backRankMate` -> `Back rank mate`. Themes arrive as Lichess camelCase ids. */
export function themeLabel(theme: string): string {
  const spaced = theme
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

const TONES = [
  'bg-lilac text-lilac-ink',
  'bg-accent text-accent-foreground',
  'bg-sky text-sky-ink',
  'bg-reward-soft text-reward-ink',
] as const

/** A stable colour per theme, so "Forks" is the same chip every visit. */
function toneFor(theme: string): string {
  let hash = 0
  for (const char of theme) hash = (hash * 31 + char.charCodeAt(0)) % TONES.length
  return TONES[hash] ?? TONES[0]
}

const STATE_LABEL: Record<SrsState, string> = {
  new: 'New',
  learning: 'Learning',
  review: 'Reviewing',
  relearning: 'Relearning',
  mastered: 'Mastered',
}

function stateLabel(card: SrsCard | undefined, now: Date): string {
  if (card === undefined || card.state === 'new') return 'New'
  if (card.state === 'mastered') return 'Mastered'
  if (card.due <= now.getTime()) return STATE_LABEL[card.state]
  const days = Math.max(calendarDaysUntil(card.due, now), 0)
  return days <= 1 ? 'Next tomorrow' : `Next in ${String(days)} days`
}

const primaryTheme = (mistake: MistakeEntry): string => mistake.themes[0] ?? 'tactic'

/** Cards for mistakes only: an opening-line card has no row on this screen. */
function mistakeCards(cards: readonly SrsCard[]): Map<string, SrsCard> {
  const byMistake = new Map<string, SrsCard>()
  for (const card of cards) {
    if (card.subject.kind === 'mistake') byMistake.set(card.subject.mistakeId, card)
  }
  return byMistake
}

export function buildBank(
  mistakes: readonly MistakeEntry[],
  cards: readonly SrsCard[],
  now: Date,
): Bank {
  const byMistake = mistakeCards(cards)
  const weekAgo = now.getTime() - 7 * MS_PER_DAY

  const rows: BankRow[] = mistakes.map((mistake) => {
    const card = byMistake.get(mistake.id)
    const dueAt = card?.due ?? mistake.createdAt
    const mastered = card?.state === 'mastered'
    const theme = primaryTheme(mistake)
    return {
      id: mistake.id,
      mistake,
      theme,
      themeLabel: themeLabel(theme),
      themeTone: toneFor(theme),
      dueText: mastered ? 'Mastered' : dueLabel(dueAt, now),
      isDue: !mastered && dueAt <= now.getTime(),
      dueAt,
      origin: mistake.originLabel ?? `Move ${String(mistake.moveNumber ?? 1)}`,
      quality: mistake.quality,
      recallStreak: Math.min(card?.consecutiveCorrect ?? 0, MASTERY_STREAK),
      stateLabel: stateLabel(card, now),
      skipped: mistake.playedUci === mistake.bestUci,
    }
  })

  const live = rows.filter((row) => byMistake.get(row.id)?.state !== 'mastered')
  const days = (row: BankRow): number => calendarDaysUntil(row.dueAt, now)
  const strip: ScheduleStrip = {
    today: live.filter((row) => row.isDue || days(row) <= 0).length,
    tomorrow: live.filter((row) => !row.isDue && days(row) === 1).length,
    inThreeDays: live.filter((row) => days(row) >= 2 && days(row) <= 3).length,
    thisWeek: live.filter((row) => days(row) >= 4 && days(row) <= 7).length,
  }

  const states = rows.map((row) => byMistake.get(row.id)?.state ?? 'new')
  const count = (...wanted: SrsState[]): number =>
    states.filter((state) => wanted.includes(state)).length
  const pipeline: Pipeline = {
    new: count('new'),
    learning: count('learning', 'relearning'),
    reviewing: count('review'),
    mastered: count('mastered'),
  }

  const dueRows = rows.filter((row) => row.isDue)
  const seenDue = dueRows.filter((row) => (byMistake.get(row.id)?.reps ?? 0) > 0).length

  const themeCounts = new Map<string, number>()
  for (const row of rows) themeCounts.set(row.theme, (themeCounts.get(row.theme) ?? 0) + 1)
  const chips: ThemeChip[] = [
    { id: 'all', label: 'All', count: rows.length },
    ...[...themeCounts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([id, total]) => ({ id, label: themeLabel(id), count: total })),
  ]

  return {
    rows,
    chips,
    strip,
    pipeline,
    dueCount: dueRows.length,
    newDue: dueRows.length - seenDue,
    seenDue,
    masteredThisWeek: cards.filter(
      (card) =>
        card.subject.kind === 'mistake' && card.masteredAt !== null && card.masteredAt >= weekAgo,
    ).length,
    total: rows.length,
  }
}

/** Filter by theme, then order. Never mutates the bank. */
export function arrangeRows(rows: readonly BankRow[], theme: string, order: SortOrder): BankRow[] {
  const kept = theme === 'all' ? [...rows] : rows.filter((row) => row.theme === theme)
  switch (order) {
    case 'due':
      return kept.sort((left, right) => left.dueAt - right.dueAt)
    case 'newest':
      return kept.sort((left, right) => right.mistake.createdAt - left.mistake.createdAt)
    case 'game':
      return kept.sort(
        (left, right) =>
          left.origin.localeCompare(right.origin) ||
          (left.mistake.ply ?? 0) - (right.mistake.ply ?? 0),
      )
  }
}

/** A rough, honest session length: under a minute a card, never less than one. */
export function estimateMinutes(cards: number): number {
  return Math.max(Math.round(cards * 0.75), 1)
}
