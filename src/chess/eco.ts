import {
  domainError,
  err,
  ok,
  positionKeyFromFen,
  type EcoCode,
  type Fen,
  type OpeningRef,
  type Result,
} from '@/domain'

import { ECO_TABLE, ECO_TABLE_SIZE } from './eco-table'
import { createGame, playMoves, positionsOf, type ChessGame, type MoveInput } from './game'

/**
 * Naming the opening a game is in.
 *
 * Detection is by *position*, not by move order. That is the whole point: a player who
 * reaches the Italian through 1.e4 e5 2.Bc4 Nc6 3.Nf3 should be told they are in the
 * Italian, and a repertoire built on one move order should recognise the other. The key
 * is a FEN's first four fields, which is exactly `positionKeyFromFen()` in `@/domain`, so
 * the opening table and the repertoire's transposition index agree by construction.
 */

/** One row of the bundled table. */
export interface EcoEntry {
  readonly eco: EcoCode
  /** The opening family, e.g. `Sicilian Defense`. */
  readonly name: string
  /** Everything after the family, e.g. `Najdorf Variation, Poisoned Pawn`. */
  readonly variation?: string
  /** The full upstream name, so a search box can match on what people actually type. */
  readonly fullName: string
  readonly positionKey: string
}

/**
 * How deep a position may be and still be looked up.
 *
 * Why a cap at all: a middlegame can wander back through a position the table happens to
 * name, and reporting move 40 as the end of the opening would be nonsense. The deepest row
 * in the upstream data is 36 plies, so nothing real is lost.
 */
const MAX_BOOK_PLY = 40

const ECO_PATTERN = /^[A-E][0-9]{2}$/

let table: Map<string, EcoEntry> | null = null

/**
 * Parse the bundled table on first use, not at import.
 *
 * Why lazy: most screens never name an opening, and a route that only plays a game should
 * not pay for two thousand rows. Once built the map is kept for the life of the tab.
 */
function ecoTable(): Map<string, EcoEntry> {
  if (table !== null) return table
  const built = new Map<string, EcoEntry>()
  for (const line of ECO_TABLE.split('\n')) {
    const first = line.indexOf('|')
    const second = line.indexOf('|', first + 1)
    if (first < 0 || second < 0) continue
    const eco = line.slice(0, first)
    const fullName = line.slice(first + 1, second)
    const positionKey = line.slice(second + 1)
    if (!ECO_PATTERN.test(eco) || fullName === '' || positionKey === '') continue
    const split = fullName.indexOf(': ')
    built.set(positionKey, {
      eco,
      name: split < 0 ? fullName : fullName.slice(0, split),
      ...(split < 0 ? {} : { variation: fullName.slice(split + 2) }),
      fullName,
      positionKey,
    })
  }
  table = built
  return built
}

/** Why exported: a test asserts the parsed row count against the generated constant. */
export function ecoTableSize(): number {
  return ecoTable().size
}

/** The table's own declared size, from the file that generated it. */
export { ECO_TABLE_SIZE }

/** Look one position up. `undefined` means "not a named opening", not "not a chess position". */
export function lookupOpening(fen: Fen): EcoEntry | undefined {
  return ecoTable().get(positionKeyFromFen(fen))
}

/** Why the review needs this: a move played inside the book is never blamed on the player. */
export function isBookPosition(fen: Fen): boolean {
  return ecoTable().has(positionKeyFromFen(fen))
}

function toOpeningRef(entry: EcoEntry, bookExitPly: number): OpeningRef {
  return {
    eco: entry.eco,
    name: entry.name,
    ...(entry.variation === undefined ? {} : { variation: entry.variation }),
    bookExitPly,
  }
}

/**
 * Name the opening a sequence of positions reached.
 *
 * The *deepest* match wins rather than the first, because openings are named by how far
 * into theory the players got: the Najdorf is a Sicilian, and saying "Sicilian" when both
 * sides played ten book moves throws away everything the review has to teach.
 *
 * `bookExitPly` is the 0-based index of the first move that was no longer in the table —
 * the move the review screen labels "book until here".
 */
export function detectOpeningFromPositions(positions: readonly Fen[]): OpeningRef | null {
  const lookup = ecoTable()
  let deepest: { entry: EcoEntry; index: number } | null = null
  const limit = Math.min(positions.length, MAX_BOOK_PLY + 1)
  for (let index = 0; index < limit; index += 1) {
    const fen = positions[index]
    if (fen === undefined) continue
    const entry = lookup.get(positionKeyFromFen(fen))
    if (entry !== undefined) deepest = { entry, index }
  }
  return deepest === null ? null : toOpeningRef(deepest.entry, deepest.index)
}

/** The form the review and the library use, where the game is already in hand. */
export function detectOpening(game: ChessGame): OpeningRef | null {
  return detectOpeningFromPositions(positionsOf(game))
}

/**
 * The form an importer uses, where all that exists is a list of moves.
 *
 * Returns an error if the moves are not legal from `initialFen`, because a caller that
 * cannot replay the game has a bigger problem than an unnamed opening.
 */
export function detectOpeningFromMoves(
  moves: readonly MoveInput[],
  initialFen?: string,
): Result<OpeningRef | null> {
  const start = createGame(initialFen)
  if (!start.ok) return start
  const played = playMoves(start.value, moves.slice(0, MAX_BOOK_PLY))
  if (!played.ok) {
    return err(
      domainError('validation', 'These moves are not legal from the starting position', {
        where: 'opening detection',
        cause: played.error,
      }),
    )
  }
  return ok(detectOpening(played.value))
}
