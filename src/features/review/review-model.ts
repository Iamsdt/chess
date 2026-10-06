import { winPercentFromScore } from '@/chess'
import {
  oppositeColor,
  type Color,
  type EngineScore,
  type Fen,
  type GameMeta,
  type MoveQuality,
  type MoveRecord,
} from '@/domain'

/**
 * What the review screen needs from a reviewed game, as plain values.
 *
 * Pure so the screen only lays things out. Everything here reads fields the review wrote
 * onto the stored moves, so a game opens exactly as it was reviewed, offline, instantly.
 */

/** The position on the board after `ply` half-moves; 0 is the position the game began from. */
export function positionAt(moves: readonly MoveRecord[], ply: number): Fen | undefined {
  if (moves.length === 0) return undefined
  const clamped = Math.min(Math.max(ply, 0), moves.length)
  return clamped === 0 ? moves[0]?.fenBefore : moves[clamped - 1]?.fenAfter
}

export type Outcome = 'won' | 'lost' | 'drew' | 'unfinished'

/** The result from the user's side, which is the only way a person reads it. */
export function outcomeFor(meta: Pick<GameMeta, 'result' | 'youPlay'>): Outcome {
  if (meta.result === '1/2-1/2') return 'drew'
  if (meta.result === '*') return 'unfinished'
  const whiteWon = meta.result === '1-0'
  return whiteWon === (meta.youPlay === 'white') ? 'won' : 'lost'
}

const OUTCOME_WORDS: Readonly<Record<Outcome, string>> = {
  won: 'Won',
  lost: 'Lost',
  drew: 'Drawn',
  unfinished: 'Unfinished',
}

export function outcomeWord(outcome: Outcome): string {
  return OUTCOME_WORDS[outcome]
}

/**
 * A score the way a chess player writes it: `+0.3`, `−1.2`, `M3`, from White's side.
 *
 * `sideToMove` is whose turn it was in the position the score describes, because the
 * engine reports from the mover's point of view.
 */
export function formatEval(score: EngineScore | undefined, sideToMove: Color): string {
  if (score === undefined) return '—'
  const flip = sideToMove === 'white' ? 1 : -1
  if (score.kind === 'mate') {
    const moves = score.moves * flip
    return moves >= 0 ? `M${String(Math.abs(moves))}` : `−M${String(Math.abs(moves))}`
  }
  const pawns = (score.value * flip) / 100
  if (pawns === 0) return '0.0'
  return `${pawns > 0 ? '+' : '−'}${Math.abs(pawns).toFixed(1)}`
}

export interface Moment {
  readonly ply: number
  readonly move: MoveRecord
  /** Win percentage the user gave away on this move. */
  readonly swing: number
}

const TURNING_POINTS: ReadonlySet<MoveQuality> = new Set(['mistake', 'miss', 'blunder'])

/** The user's costliest moves, in the order they happened; theirs, not the opponent's. */
export function keyMomentsOf(moves: readonly MoveRecord[], youPlay: Color, limit = 4): Moment[] {
  const found: Moment[] = []
  for (const move of moves) {
    if (move.color !== youPlay || move.quality === undefined || !TURNING_POINTS.has(move.quality))
      continue
    if (move.evalBefore === undefined || move.evalAfter === undefined) continue
    const before = winPercentFromScore(move.evalBefore, move.color, move.color)
    const after = winPercentFromScore(move.evalAfter, oppositeColor(move.color), move.color)
    found.push({ ply: move.ply, move, swing: before - after })
  }
  return found
    .sort((a, b) => b.swing - a.swing)
    .slice(0, limit)
    .sort((a, b) => a.ply - b.ply)
}

export interface MovePair {
  readonly number: number
  readonly white: MoveRecord | undefined
  readonly black: MoveRecord | undefined
}

/** The move list as printed: `12. Nbd2 Re8`. A game that began on Black's move starts half-open. */
export function movePairs(moves: readonly MoveRecord[]): MovePair[] {
  const pairs = new Map<number, { white?: MoveRecord; black?: MoveRecord }>()
  for (const move of moves) {
    const entry = pairs.get(move.moveNumber) ?? {}
    entry[move.color] = move
    pairs.set(move.moveNumber, entry)
  }
  return [...pairs.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([number, entry]) => ({ number, white: entry.white, black: entry.black }))
}

/** Counts that read as a sentence: `1 blunder`, `3 mistakes`. */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${String(count)} ${count === 1 ? one : many}`
}
