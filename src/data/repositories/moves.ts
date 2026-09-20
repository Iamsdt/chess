import {
  MoveRecordSchema,
  type Result,
  type GameId,
  type MoveQuality,
  type MoveRecord,
} from '@/domain'

import { runWrite, validateMany, writeValidated } from '../internal'

import type { ChessKingDb } from '../db'

/**
 * Moves, kept apart from their game so the library never pays for them.
 *
 * The table's primary key is `[gameId+ply]`, so "the moves of this game, in
 * order" is a range scan of the key itself — no index lookup and no sort.
 */
export interface MovesRepository {
  get: (gameId: GameId, ply: number) => Promise<MoveRecord | undefined>
  /** Ordered by ply, which the primary key already guarantees. */
  listForGame: (gameId: GameId) => Promise<MoveRecord[]>
  /** S13's key moments: only the plies whose quality is in `qualities`. */
  listByQuality: (gameId: GameId, qualities: readonly MoveQuality[]) => Promise<MoveRecord[]>
  countForGame: (gameId: GameId) => Promise<number>
  /** A resumable review writes one ply at a time, so this is a hot path. */
  put: (move: MoveRecord) => Promise<Result<MoveRecord>>
  putMany: (moves: readonly MoveRecord[]) => Promise<Result<number>>
  removeForGame: (gameId: GameId) => Promise<Result<number>>
}

export function createMovesRepository(db: ChessKingDb): MovesRepository {
  const ofGame = (gameId: GameId) =>
    db.moves.where('[gameId+ply]').between([gameId, 0], [gameId, Infinity], true, true)

  return {
    get: (gameId, ply) => db.moves.get([gameId, ply]),

    listForGame: (gameId) => ofGame(gameId).toArray(),

    listByQuality: async (gameId, qualities) => {
      if (qualities.length === 0) return []
      const pairs = qualities.map((quality) => [gameId, quality])
      const rows = await db.moves.where('[gameId+quality]').anyOf(pairs).toArray()
      return rows.sort((left, right) => left.ply - right.ply)
    },

    countForGame: (gameId) => ofGame(gameId).count(),

    put: (move) =>
      writeValidated(MoveRecordSchema, move, 'moves.put', async (validated) => {
        await db.moves.put(validated)
        return validated
      }),

    putMany: async (moves) => {
      const validated = validateMany(MoveRecordSchema, moves, 'moves.putMany')
      if (!validated.ok) return validated
      return runWrite('moves.putMany', async () => {
        await db.moves.bulkPut(validated.value)
        return validated.value.length
      })
    },

    removeForGame: (gameId) => runWrite('moves.removeForGame', () => ofGame(gameId).delete()),
  }
}
