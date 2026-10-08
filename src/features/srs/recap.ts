import { uciLineToSan, uciToSan } from '@/chess'
import type { EngineScore, MistakeEntry, San } from '@/domain'
import { formatScore } from '@/features/analysis/score-format'

/**
 * The "why you missed it" recap, built only from what was stored when the mistake was
 * made. No engine runs here: the card must explain itself offline and instantly.
 */

/** How many moves of the engine line the recap prints; past that it stops being a hint. */
const LINE_MOVES = 5

export interface Recap {
  readonly playedSan: San
  readonly bestSan: San
  /** The better line in SAN, starting with the best move. Empty if it did not replay. */
  readonly line: readonly San[]
  /** One calm sentence on how the position changed, or `null` when no engine saw it. */
  readonly evalNote: string | null
  readonly explanation: string
  /** True when the card came from a skipped puzzle: there was no move of the user's to show. */
  readonly skipped: boolean
}

/** A score seen from the other side of the board. */
function flip(score: EngineScore): EngineScore {
  return score.kind === 'cp'
    ? { kind: 'cp', value: -score.value }
    : { kind: 'mate', moves: -score.moves }
}

/**
 * Both evals from the player's point of view.
 *
 * Why `evalAfter` is flipped: it was read with the opponent to move, so the sign is theirs.
 */
function evalNote(mistake: MistakeEntry): string | null {
  if (mistake.source !== 'game-review') return null
  const before = formatScore(mistake.evalBefore, 'white')
  const after = formatScore(flip(mistake.evalAfter), 'white')
  return `Before your move the position was about ${before} for you. After it, about ${after}.`
}

export function buildRecap(mistake: MistakeEntry): Recap {
  const line = uciLineToSan(mistake.fen, mistake.solution.slice(0, LINE_MOVES))
  const best = uciToSan(mistake.fen, mistake.bestUci)
  return {
    playedSan: mistake.playedSan,
    bestSan: best.ok ? best.value : mistake.bestSan,
    line: line.ok ? line.value : [],
    evalNote: evalNote(mistake),
    explanation: mistake.explanation,
    skipped: mistake.playedUci === mistake.bestUci,
  }
}
