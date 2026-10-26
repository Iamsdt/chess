import { estimateTokens } from '../runtime/system-prompt'

import type { PlayedMove } from '@/chess'

/**
 * Move lists as plain movetext, for the one part of the context that grows with the game.
 *
 * Why a helper of its own: three screens publish a game (play, analysis, review), and each holds
 * it differently — a rules history, a variation tree, a stored PGN. They all hand Sage the same
 * thing: `1. e4 e5 2. Nf3`, no headers, no clock comments.
 */

/** `1. e4 e5 2. Nf3`; a line that starts on Black's move opens with `12...`. */
export function movetextOf(history: readonly PlayedMove[]): string {
  return history
    .map((move, index) => {
      if (move.color === 'white') return `${String(move.moveNumber)}. ${move.san}`
      return index === 0 ? `${String(move.moveNumber)}... ${move.san}` : move.san
    })
    .join(' ')
}

/** Drops the `[Tag "value"]` header lines of a PGN: they cost tokens and say nothing about the position. */
export function stripPgnHeaders(pgn: string): string {
  return pgn
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('['))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Keeps the newest moves that fit, cutting at a word boundary and marking the cut.
 *
 * Why the tail: the moves nearest the position on the board are the ones a question is about.
 */
export function trimMovetext(movetext: string, tokens: number): string {
  if (estimateTokens(movetext) <= tokens) return movetext
  const keepChars = Math.max(0, tokens * 4 - 2)
  const tail = movetext.slice(movetext.length - keepChars)
  const boundary = tail.search(/\s/)
  return `… ${boundary === -1 ? '' : tail.slice(boundary + 1)}`.trimEnd()
}

/** Keeps the start of a text, for lists that are already newest first. */
export function clipText(text: string, tokens: number): string {
  if (estimateTokens(text) <= tokens) return text
  const clipped = text.slice(0, Math.max(0, tokens * 4 - 1))
  const boundary = clipped.search(/\s\S*$/)
  return `${boundary === -1 ? clipped : clipped.slice(0, boundary)}…`
}
