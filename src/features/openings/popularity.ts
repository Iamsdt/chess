import { z } from 'zod'

import { applyMove, createGame, isBookPosition, legalMoves } from '@/chess'
import { domainError, err, ok, positionKeyFromFen, type Fen, type Result } from '@/domain'

import { isOpponentToMove, subtreeOf, type RepertoireTree } from './tree'

/**
 * How often opponents choose each reply, from two sources that degrade into one another.
 *
 * The ECO table has names but no game counts, so the offline estimate is a theory-depth
 * proxy: a reply that leads to a named position, weighted by how many named replies the
 * position after it has. Well-trodden lines branch more in the table than side-lines, so
 * the ranking is sensible even though the percentages are an estimate. The optional
 * explorer replaces the estimate with real frequencies when it is reachable.
 */

export interface OpponentMove {
  readonly san: string
  readonly uci: string
  /** Share of opponents choosing this reply, 0-100. */
  readonly popularity: number
  readonly fenAfter: Fen
}

/** Answers "what do opponents play here?" for one position. */
export type MoveDistribution = (fen: Fen) => readonly OpponentMove[]

/** Replies below this share are noise, not a hole in the repertoire. */
export const DEFAULT_MEANINGFUL_SHARE = 10

const memo = new Map<string, readonly OpponentMove[]>()

function bookChildren(fen: Fen): number {
  const started = createGame(fen)
  if (!started.ok) return 0
  let count = 0
  for (const move of legalMoves(started.value)) {
    const played = applyMove(started.value, move.uci)
    if (played.ok && isBookPosition(played.value.fen)) count += 1
  }
  return count
}

/**
 * Named replies from a position, weighted by theory depth. Empty outside the book,
 * which callers read as "unknown" rather than "nobody plays anything".
 */
export function ecoDistribution(fen: Fen): readonly OpponentMove[] {
  const key = positionKeyFromFen(fen)
  const cached = memo.get(key)
  if (cached !== undefined) return cached
  const started = createGame(fen)
  if (!started.ok) return []
  const candidates: { san: string; uci: string; fenAfter: Fen; weight: number }[] = []
  for (const move of legalMoves(started.value)) {
    const played = applyMove(started.value, move.uci)
    if (!played.ok || !isBookPosition(played.value.fen)) continue
    candidates.push({
      san: move.san,
      uci: move.uci,
      fenAfter: played.value.fen,
      weight: 1 + bookChildren(played.value.fen),
    })
  }
  const total = candidates.reduce((sum, item) => sum + item.weight, 0)
  const result = candidates
    .map((item) => ({
      san: item.san,
      uci: item.uci,
      fenAfter: item.fenAfter,
      popularity: total === 0 ? 0 : Math.round((item.weight / total) * 100),
    }))
    .sort((a, b) => b.popularity - a.popularity)
  memo.set(key, result)
  return result
}

/** The opponent's choices after a node, with the explorer's numbers when it supplied them. */
export function distributionFor(
  explorer: ReadonlyMap<string, readonly OpponentMove[]> | undefined,
): MoveDistribution {
  return (fen) => {
    const fromExplorer = explorer?.get(positionKeyFromFen(fen))
    return fromExplorer !== undefined && fromExplorer.length > 0
      ? fromExplorer
      : ecoDistribution(fen)
  }
}

const ExplorerResponseSchema = z.object({
  moves: z.array(
    z.object({
      uci: z.string(),
      san: z.string(),
      white: z.number().int().min(0),
      draws: z.number().int().min(0),
      black: z.number().int().min(0),
    }),
  ),
})

export type FetchLike = (input: string, init?: { signal?: AbortSignal }) => Promise<Response>

export interface ExplorerPort {
  lookup: (fen: Fen, signal?: AbortSignal) => Promise<Result<readonly OpponentMove[]>>
}

const EXPLORER_URL = 'https://explorer.lichess.ovh/lichess'
const EXPLORER_TIMEOUT_MS = 6000

/**
 * A client for the public Lichess opening explorer, limited to club-level games.
 *
 * Why a port: the screen must work offline and without sending positions anywhere, so
 * the explorer is something the user switches on, and every failure is a value the caller
 * turns into "using the built-in estimate".
 */
export function createLichessExplorer(
  fetchImpl: FetchLike = (input, init) => fetch(input, init),
  isOnline: () => boolean = () => globalThis.navigator.onLine,
): ExplorerPort {
  return {
    async lookup(fen, signal) {
      if (!isOnline()) return err(domainError('network', 'You are offline', { where: 'explorer' }))
      const controller = new AbortController()
      const timer = setTimeout(() => {
        controller.abort()
      }, EXPLORER_TIMEOUT_MS)
      signal?.addEventListener('abort', () => {
        controller.abort()
      })
      try {
        const query = new URLSearchParams({
          fen,
          ratings: '1200,1400,1600',
          speeds: 'blitz,rapid,classical',
          moves: '8',
          topGames: '0',
          recentGames: '0',
        })
        const response = await fetchImpl(`${EXPLORER_URL}?${query.toString()}`, {
          signal: controller.signal,
        })
        if (!response.ok) {
          return err(
            domainError('io', `The explorer answered ${String(response.status)}`, {
              where: 'explorer',
            }),
          )
        }
        const parsed = ExplorerResponseSchema.safeParse(await response.json())
        if (!parsed.success) {
          return err(
            domainError('validation', 'The explorer reply was not understood', {
              where: 'explorer',
            }),
          )
        }
        const rows = parsed.data.moves.map((row) => ({
          ...row,
          games: row.white + row.draws + row.black,
        }))
        const total = rows.reduce((sum, row) => sum + row.games, 0)
        const played = createGame(fen)
        if (!played.ok || total === 0) return ok([])
        const moves: OpponentMove[] = []
        for (const row of rows) {
          const next = applyMove(played.value, row.uci)
          if (!next.ok) continue
          moves.push({
            san: row.san,
            uci: row.uci,
            fenAfter: next.value.fen,
            popularity: Math.round((row.games / total) * 100),
          })
        }
        return ok(moves)
      } catch (cause: unknown) {
        return err(
          domainError('io', 'The explorer could not be reached', { where: 'explorer', cause }),
        )
      } finally {
        clearTimeout(timer)
      }
    },
  }
}

export type ExplorerStatus = 'off' | 'ok' | 'offline'

export interface ExplorerSnapshot {
  readonly byPosition: ReadonlyMap<string, readonly OpponentMove[]>
  readonly status: ExplorerStatus
}

/**
 * Fetches real frequencies for every position where the opponent is to move.
 *
 * Why it gives up at the first failure: if the network is gone, thirty more requests
 * will not change that, and the caller falls back to the estimate for all of them.
 */
export async function prefetchExplorer(
  tree: RepertoireTree,
  port: ExplorerPort,
  signal?: AbortSignal,
): Promise<ExplorerSnapshot> {
  const byPosition = new Map<string, readonly OpponentMove[]>()
  for (const node of subtreeOf(tree, tree.rootId)) {
    if (!isOpponentToMove(tree, node)) continue
    if (byPosition.has(node.positionKey)) continue
    const looked = await port.lookup(node.fen, signal)
    if (!looked.ok) return { byPosition, status: byPosition.size > 0 ? 'ok' : 'offline' }
    byPosition.set(node.positionKey, looked.value)
  }
  return { byPosition, status: 'ok' }
}
