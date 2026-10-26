import type {
  CoachPositionContext,
  CoachTaughtItem,
  CoachTone,
  EngineLine,
  GameMeta,
  Profile,
  Timestamp,
} from '@/domain'

import { describeEngineLine, estimateTokens } from '../runtime/system-prompt'

import { gameLine, positionLine, taughtLine, userLine } from './layers'
import { clipText, stripPgnHeaders, trimMovetext } from './movetext'
import { threadBudget } from './thread'

import type { CoachContextBase } from '../components/coach-panel'

/**
 * S21b · The context builder (coach-agent.md §6): the five layers under one fixed budget.
 *
 * Why packing runs in a fixed order and not by size: "newest and most relevant first" is a
 * ranking, and the ranking is the same as the one the system prompt drops by, so a context that
 * fits here is not trimmed again there. The position is first and is never skipped, because a
 * question about the board with no board in it is the failure this exists to prevent.
 */

/**
 * No provider in `models.ts` reports its context window, so the ceiling is a default sized for
 * the smallest model a user is likely to point Sage at, and for a cost that stays small when
 * every question carries it. Anything more is the learner's choice, not the app's.
 */
export const CONTEXT_TOKEN_BUDGET = 6_000

/**
 * Sage's identity, hard rules, mode and tone. The system prompt never drops them, so the layers
 * must not be given the room they occupy.
 */
const PROMPT_RESERVE_TOKENS = 800

const MAX_ENGINE_LINES = 3
const MAX_WEAK_THEMES = 5
const MAX_TAUGHT = 12
const MAX_RECENT_GAMES = 3
const SUMMARY_MAX_TOKENS = 200
/** The PGN may take at most this share of what is left when it is packed. */
const PGN_SHARE = 0.5
const MS_PER_DAY = 86_400_000

/** What the screen in front of the learner says is on the board. */
export interface CoachScreenSnapshot {
  readonly position?: CoachPositionContext
  /** Movetext of the game under discussion; tags are dropped and the tail kept to fit. */
  readonly pgn?: string
  /** The analysis board's lines. Only sent when `allowEngineLines` is on and no puzzle is active. */
  readonly engineLines?: readonly EngineLine[]
  /** `theme` and `rating` stay out until the solver itself shows them. */
  readonly activePuzzle?: NonNullable<CoachContextBase['activePuzzle']>
}

/** A Taught row as stored; the builder turns it into the model-facing item. */
export interface TaughtRecord {
  readonly label: string
  readonly count: number
  readonly lastTaughtAt: Timestamp
}

export interface BuildContextInput {
  readonly screen: string
  readonly tone: CoachTone
  readonly now: Timestamp
  readonly snapshot?: CoachScreenSnapshot | undefined
  readonly profile?: Pick<Profile, 'displayName' | 'puzzleRating' | 'sparringRating' | 'goals'>
  /** Hidden by the learner from "What Sage sees": rating, goals, weak themes and games stay home. */
  readonly profileHidden?: boolean
  readonly weakThemes?: readonly string[]
  readonly recentGames?: readonly GameMeta[]
  readonly taught?: readonly TaughtRecord[]
  readonly summary?: string | undefined
  readonly tokenBudget?: number
}

/** Tokens left after the fixed prompt and the chat's own share. */
function layerRoom(tokenBudget: number): number {
  return Math.max(0, tokenBudget - PROMPT_RESERVE_TOKENS - threadBudget(tokenBudget))
}

export function buildCoachContext(input: BuildContextInput): CoachContextBase {
  const tokenBudget = input.tokenBudget ?? CONTEXT_TOKEN_BUDGET
  const snapshot = input.snapshot
  let room = layerRoom(tokenBudget)
  /** Spends `tokens` if they fit. Why a closure: every layer asks the same question. */
  const take = (tokens: number): boolean => {
    if (tokens > room) return false
    room -= tokens
    return true
  }

  // Turn: the position is spent unconditionally; the rest competes for what is left.
  if (snapshot?.position !== undefined) room -= estimateTokens(positionLine(snapshot.position))

  const puzzleActive = snapshot?.activePuzzle !== undefined
  // Engine lines would hand over a puzzle's solution, so an active puzzle never carries them.
  const engineLines: EngineLine[] = []
  if (!puzzleActive) {
    for (const line of (snapshot?.engineLines ?? []).slice(0, MAX_ENGINE_LINES)) {
      if (!take(estimateTokens(describeEngineLine(line, snapshot?.position?.fen)))) break
      engineLines.push(line)
    }
  }

  const shared = input.profileHidden !== true
  const user =
    shared && input.profile !== undefined && take(estimateTokens(userLine(input.profile)))
      ? {
          displayName: input.profile.displayName,
          puzzleRating: input.profile.puzzleRating,
          sparringRating: input.profile.sparringRating,
          ...(input.profile.goals.length === 0 ? {} : { goals: input.profile.goals }),
        }
      : undefined

  const movetext = snapshot?.pgn === undefined ? '' : stripPgnHeaders(snapshot.pgn)
  const pgnRoom = Math.floor(room * PGN_SHARE)
  const pgn = movetext === '' || pgnRoom < 1 ? undefined : trimMovetext(movetext, pgnRoom)
  if (pgn !== undefined) room -= estimateTokens(pgn)

  const taught: CoachTaughtItem[] = []
  for (const record of (input.taught ?? []).slice(0, MAX_TAUGHT)) {
    const item: CoachTaughtItem = {
      label: record.label,
      daysAgo: Math.max(0, Math.floor((input.now - record.lastTaughtAt) / MS_PER_DAY)),
      times: record.count,
    }
    if (!take(estimateTokens(taughtLine(item)))) break
    taught.push(item)
  }

  const weakThemes: string[] = []
  if (shared) {
    for (const theme of (input.weakThemes ?? []).slice(0, MAX_WEAK_THEMES)) {
      if (!take(estimateTokens(theme) + 1)) break
      weakThemes.push(theme)
    }
  }

  const summaryText = input.summary?.trim() ?? ''
  const summaryRoom = Math.min(SUMMARY_MAX_TOKENS, room)
  const summary =
    summaryText === '' || summaryRoom < 1 ? undefined : clipText(summaryText, summaryRoom)
  if (summary !== undefined) room -= estimateTokens(summary)

  const recentGames: GameMeta[] = []
  if (shared) {
    for (const game of (input.recentGames ?? []).slice(0, MAX_RECENT_GAMES)) {
      if (!take(estimateTokens(gameLine(game)))) break
      recentGames.push(game)
    }
  }

  return {
    screen: input.screen,
    tone: input.tone,
    ...(snapshot?.position === undefined ? {} : { position: snapshot.position }),
    ...(pgn === undefined ? {} : { pgn }),
    engineLines,
    recentGames,
    weakThemes,
    ...(snapshot?.activePuzzle === undefined ? {} : { activePuzzle: snapshot.activePuzzle }),
    ...(user === undefined ? {} : { user }),
    ...(taught.length === 0 ? {} : { taught }),
    ...(summary === undefined ? {} : { summary }),
    tokenBudget,
  }
}
