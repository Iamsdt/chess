import { toSquare, type Square } from '@/domain'

/**
 * Square-naming helpers for the vision drills. Pure, and random only through an
 * injected `random`, so a test can ask for "the third target" and get the same one.
 */

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const
export const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const

/** File-major, a1 first: the order is part of the contract for reproducible picks. */
export const ALL_SQUARES: readonly Square[] = FILES.flatMap((file) =>
  RANKS.map((rank) => toSquare(`${file}${rank}`)),
)

/** `a`–`h` → 0–7. */
export function fileIndex(square: Square): number {
  return FILES.findIndex((file) => file === square[0])
}

/** `1`–`8` → 0–7. */
export function rankIndex(square: Square): number {
  return RANKS.findIndex((rank) => rank === square[1])
}

/** Builds a square from indices, or `null` when either is off the board. */
export function squareAt(file: number, rank: number): Square | null {
  const f = FILES[file]
  const r = RANKS[rank]
  if (f === undefined || r === undefined) return null
  return toSquare(`${f}${r}`)
}

/**
 * Reads what the player typed or tapped. Whitespace and case are forgiven; anything
 * that is not a square is `null` and costs the player nothing.
 */
export function parseSquareGuess(text: string): Square | null {
  const clean = text.trim().toLowerCase()
  return ALL_SQUARES.find((square) => square === clean) ?? null
}

/**
 * A random square that is never the one just shown, so two rounds in a row cannot
 * hand the player the same answer.
 */
export function pickSquare(random: () => number, previous: Square | null): Square {
  const index = Math.min(ALL_SQUARES.length - 1, Math.floor(random() * ALL_SQUARES.length))
  const picked = ALL_SQUARES[index] ?? ALL_SQUARES[0]
  if (picked === undefined) throw new Error('The board has no squares')
  if (picked !== previous) return picked
  const next = ALL_SQUARES[(index + 1) % ALL_SQUARES.length]
  return next ?? picked
}
