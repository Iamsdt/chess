import { toFen, toSquare, type Fen, type Square } from '@/domain'

import { FILES, RANKS, ALL_SQUARES, fileIndex, rankIndex, squareAt } from './vision-squares'

/**
 * The knight-route drill: getting a knight from one square to another in the fewest
 * jumps, with the "fewest" decided by breadth-first search rather than by a table.
 *
 * Why BFS and no formula: the board edge and the two parked kings make the shortest
 * route irregular (a corner square is famously awkward), and a search is both the
 * simplest correct answer and the one a test can check against by hand.
 */

const JUMPS: readonly (readonly [number, number])[] = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
]

/** The kings only exist because a board needs them; they sit out of the way. */
export const KNIGHT_ROUTE_KINGS: { readonly white: Square; readonly black: Square } = {
  white: toSquare('a1'),
  black: toSquare('h8'),
}

/** A knight may not land on a king, so neither square is part of any route. */
export const KNIGHT_ROUTE_BLOCKED: readonly Square[] = [
  KNIGHT_ROUTE_KINGS.white,
  KNIGHT_ROUTE_KINGS.black,
]

/** Routes shorter than this are a single jump, which teaches nothing. */
const MIN_JUMPS = 2
/** Routes longer than this are a puzzle about the corners, not about vision. */
const MAX_JUMPS = 5

export interface KnightRoute {
  readonly from: Square
  readonly to: Square
  /** The fewest jumps; what the player's route is judged against. */
  readonly jumps: number
}

/** Squares one knight jump from `from`, minus any in `blocked`. */
export function knightMoves(from: Square, blocked: readonly Square[] = []): readonly Square[] {
  const file = fileIndex(from)
  const rank = rankIndex(from)
  const targets: Square[] = []
  for (const [df, dr] of JUMPS) {
    const target = squareAt(file + df, rank + dr)
    if (target !== null && !blocked.includes(target)) targets.push(target)
  }
  return targets
}

export function isKnightStep(from: Square, to: Square): boolean {
  return knightMoves(from).includes(to)
}

/**
 * One shortest path, `from` first and `to` last, or `null` when `to` cannot be reached
 * (only possible if an endpoint is itself blocked).
 */
export function shortestKnightPath(
  from: Square,
  to: Square,
  blocked: readonly Square[] = [],
): readonly Square[] | null {
  if (blocked.includes(from) || blocked.includes(to)) return null
  const parents = new Map<Square, Square | null>([[from, null]])
  let frontier: Square[] = [from]
  while (frontier.length > 0 && !parents.has(to)) {
    const next: Square[] = []
    for (const square of frontier) {
      for (const target of knightMoves(square, blocked)) {
        if (parents.has(target)) continue
        parents.set(target, square)
        next.push(target)
      }
    }
    frontier = next
  }
  if (!parents.has(to)) return null
  const path: Square[] = []
  for (
    let at: Square | null | undefined = to;
    at !== null && at !== undefined;
    at = parents.get(at)
  ) {
    path.unshift(at)
  }
  return path
}

/** The fewest jumps from `from` to `to`, or `null` when unreachable. */
export function knightDistance(
  from: Square,
  to: Square,
  blocked: readonly Square[] = [],
): number | null {
  const path = shortestKnightPath(from, to, blocked)
  return path === null ? null : path.length - 1
}

/**
 * Whether a route is legal and as short as it can be. `route` lists every square the
 * knight stood on, starting square first.
 */
export function isShortestRoute(
  route: readonly Square[],
  target: KnightRoute,
  blocked: readonly Square[] = KNIGHT_ROUTE_BLOCKED,
): boolean {
  if (route[0] !== target.from || route.at(-1) !== target.to) return false
  for (let i = 1; i < route.length; i += 1) {
    const previous = route[i - 1]
    const square = route[i]
    if (previous === undefined || square === undefined) return false
    if (blocked.includes(square) || !isKnightStep(previous, square)) return false
  }
  const best = knightDistance(target.from, target.to, blocked)
  return best !== null && route.length - 1 === best
}

/** Three jumps apart, the awkward edge case: used only if the random search finds nothing. */
const FALLBACK_ROUTE: KnightRoute = { from: toSquare('b1'), to: toSquare('b2'), jumps: 3 }

/** A fresh route with a shortest length between two and five jumps. */
export function pickKnightRoute(random: () => number, previous: KnightRoute | null): KnightRoute {
  const open = ALL_SQUARES.filter((square) => !KNIGHT_ROUTE_BLOCKED.includes(square))
  const pick = (): Square => {
    const index = Math.min(open.length - 1, Math.floor(random() * open.length))
    return open[index] ?? toSquare('b1')
  }
  // The loop is bounded: most pairs are two to five jumps apart, and the final
  // fallback is a fixed pair that always is.
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const from = pick()
    const to = pick()
    const jumps = knightDistance(from, to, KNIGHT_ROUTE_BLOCKED)
    if (jumps === null || jumps < MIN_JUMPS || jumps > MAX_JUMPS) continue
    if (previous !== null && previous.from === from && previous.to === to) continue
    return { from, to, jumps }
  }
  return FALLBACK_ROUTE
}

/** The five fields after the placement that make a legal-looking FEN. */
const KNIGHT_FEN_TAIL = 'b - - 0 1'

/**
 * A board with one knight and the two parked kings.
 *
 * The knight is White's and Black is to move, so a knight that happens to attack the
 * black king stands in a legal position rather than an illegal one.
 */
export function knightRouteFen(knightAt: Square): Fen {
  const pieces = new Map<Square, string>([
    [KNIGHT_ROUTE_KINGS.white, 'K'],
    [KNIGHT_ROUTE_KINGS.black, 'k'],
    [knightAt, 'N'],
  ])
  const ranks: string[] = []
  for (let rank = RANKS.length - 1; rank >= 0; rank -= 1) {
    let text = ''
    let empty = 0
    for (const file of FILES) {
      const rankChar = RANKS[rank]
      const piece = rankChar === undefined ? undefined : pieces.get(toSquare(`${file}${rankChar}`))
      if (piece === undefined) {
        empty += 1
        continue
      }
      if (empty > 0) text += String(empty)
      empty = 0
      text += piece
    }
    if (empty > 0) text += String(empty)
    ranks.push(text)
  }
  return toFen(`${ranks.join('/')} ${KNIGHT_FEN_TAIL}`)
}
