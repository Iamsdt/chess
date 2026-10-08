import { uciToSan } from '@/chess'
import { mistakesRepo, newMistakeId, srsCardsRepo } from '@/data'
import {
  err,
  domainError,
  now,
  ok,
  type Fen,
  type MistakeEntry,
  type Puzzle,
  type Result,
  type Uci,
} from '@/domain'

import { newCardFrom } from './cards'

/**
 * Putting a failed puzzle into the Mistake Bank.
 *
 * Kept free of the puzzle feature's own types so `@/features/puzzles` can call it without
 * the two features importing each other: everything it needs arrives as plain values.
 */

export interface MissedPuzzle {
  readonly puzzle: Puzzle
  /** The position the user was looking at when they missed: later than the start on a long line. */
  readonly fen: Fen
  /** Index into `puzzle.solution` of the move that was expected. Even: it is the user's move. */
  readonly cursor: number
  /** Every move the user tried on this puzzle, wrong ones included. */
  readonly played: readonly Uci[]
}

/**
 * The first move that was not the line's, or `null` if every try was right (a skip).
 *
 * Why replay the line: `played` mixes right moves with wrong ones, and only the first wrong
 * one is "what you played".
 */
export function firstWrongMove(played: readonly Uci[], solution: readonly Uci[]): Uci | null {
  let expected = 0
  for (const move of played) {
    if (move === solution[expected]) expected += 2
    else return move
  }
  return null
}

function colorToMove(fen: Fen): 'white' | 'black' {
  return fen.split(' ')[1] === 'b' ? 'black' : 'white'
}

async function bankMissedPuzzle(missed: MissedPuzzle): Promise<Result<MistakeEntry | undefined>> {
  const { puzzle } = missed
  const existing = await mistakesRepo.findByPuzzle(puzzle.id)
  if (existing !== undefined) return ok(undefined)

  const remaining = puzzle.solution.slice(missed.cursor)
  const bestUci = remaining[0]
  if (bestUci === undefined) {
    return err(
      domainError('validation', 'The puzzle had no move left to bank', { where: puzzle.id }),
    )
  }
  const best = uciToSan(missed.fen, bestUci)
  if (!best.ok) return best

  const playedUci = firstWrongMove(missed.played, puzzle.solution) ?? bestUci
  const playedSan = playedUci === bestUci ? best : uciToSan(missed.fen, playedUci)
  if (!playedSan.ok) return playedSan

  const at = now()
  const id = newMistakeId()
  const card = newCardFrom({ kind: 'mistake', mistakeId: id }, new Date(at))
  const entry: MistakeEntry = {
    id,
    createdAt: at,
    updatedAt: at,
    source: 'puzzle',
    puzzleId: puzzle.id,
    fen: missed.fen,
    yourColor: colorToMove(missed.fen),
    playedSan: playedSan.value,
    playedUci,
    bestSan: best.value,
    bestUci,
    solution: remaining,
    quality: 'miss',
    // A puzzle has no engine reading; the recap leaves evals out for this source.
    evalBefore: { kind: 'cp', value: 0 },
    evalAfter: { kind: 'cp', value: 0 },
    themes: [puzzle.theme],
    explanation: puzzle.explanation,
    originLabel: `Puzzle · ${puzzle.title}`,
    srsCardId: card.id,
  }

  const added = await mistakesRepo.add(entry)
  if (!added.ok) return added
  const stored = await srsCardsRepo.put(card)
  if (!stored.ok) return stored
  return ok(added.value)
}

/**
 * Banks a failed puzzle: one mistake entry and one new card, once per puzzle.
 *
 * A puzzle missed again is already in the bank, so nothing is added: the card's own
 * schedule decides when it returns, and a second copy would be asked twice a day.
 * Never throws: a storage failure comes back as a value, because the caller is a
 * fire-and-forget side effect of finishing a puzzle and must not break the solver.
 *
 * @returns the entry, or `undefined` if the puzzle was already banked
 */
export async function captureMissedPuzzle(
  missed: MissedPuzzle,
): Promise<Result<MistakeEntry | undefined>> {
  try {
    return await bankMissedPuzzle(missed)
  } catch (error: unknown) {
    return err(
      domainError('io', error instanceof Error ? error.message : 'The mistake could not be saved', {
        where: 'srs.captureMissedPuzzle',
        cause: error,
      }),
    )
  }
}
