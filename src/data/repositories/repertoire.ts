import {
  err,
  now,
  ok,
  parseValid,
  positionKeyFromFen,
  RepertoireNodeSchema,
  type Result,
  type Color,
  type RepertoireNode,
  type RepertoireNodeId,
} from '@/domain'

import { notFound, runWrite, validateMany, writeValidated } from '../internal'

import type { ChessKingDb } from '../db'

/**
 * The repertoire, stored flat.
 *
 * Roots are the nodes at ply 0, which is why `[color+ply]` is indexed and
 * `parentId` — null on a root, and null is not an IndexedDB key — is not relied
 * on for finding them. `[color+positionKey]` is the transposition lookup: two
 * move orders reaching the same position collide on it by construction.
 */
export interface RepertoireRepository {
  get: (id: RepertoireNodeId) => Promise<RepertoireNode | undefined>
  getMany: (ids: readonly RepertoireNodeId[]) => Promise<RepertoireNode[]>
  /** One repertoire per colour, so this is "the openings you play as White". */
  listRoots: (color: Color) => Promise<RepertoireNode[]>
  listChildren: (id: RepertoireNodeId) => Promise<RepertoireNode[]>
  /** Every node of one colour — the editor loads the whole tree at once. */
  listByColor: (color: Color) => Promise<RepertoireNode[]>
  /** Transpositions: other nodes that reach the same position. */
  findByPosition: (color: Color, fen: string) => Promise<RepertoireNode[]>
  count: (color?: Color) => Promise<number>
  put: (node: RepertoireNode) => Promise<Result<RepertoireNode>>
  /** A PGN import writes a whole line in one transaction. */
  putMany: (nodes: readonly RepertoireNode[]) => Promise<Result<number>>
  update: (id: RepertoireNodeId, patch: Partial<RepertoireNode>) => Promise<Result<RepertoireNode>>
  /**
   * Deletes a node and everything under it, and unlinks it from its parent.
   *
   * Why the subtree goes too: a flat table has no cascade, and an orphaned node
   * would still answer the transposition query and corrupt the coverage stats.
   */
  removeSubtree: (id: RepertoireNodeId) => Promise<Result<number>>
  clear: () => Promise<Result<void>>
}

export function createRepertoireRepository(db: ChessKingDb): RepertoireRepository {
  async function collectSubtree(id: RepertoireNodeId): Promise<RepertoireNodeId[]> {
    const collected: RepertoireNodeId[] = []
    const pending: RepertoireNodeId[] = [id]
    while (pending.length > 0) {
      const next = pending.pop()
      if (next === undefined) break
      collected.push(next)
      const node = await db.repertoire.get(next)
      if (node !== undefined) pending.push(...node.childIds)
    }
    return collected
  }

  return {
    get: (id) => db.repertoire.get(id),

    getMany: async (ids) => {
      const rows = await db.repertoire.bulkGet([...ids])
      return rows.filter((row): row is RepertoireNode => row !== undefined)
    },

    listRoots: (color) => db.repertoire.where('[color+ply]').equals([color, 0]).toArray(),

    listChildren: async (id) => {
      const parent = await db.repertoire.get(id)
      if (parent === undefined) return []
      const rows = await db.repertoire.bulkGet(parent.childIds)
      return rows.filter((row): row is RepertoireNode => row !== undefined)
    },

    listByColor: (color) => db.repertoire.where('color').equals(color).sortBy('ply'),

    findByPosition: (color, fen) =>
      db.repertoire
        .where('[color+positionKey]')
        .equals([color, positionKeyFromFen(fen)])
        .toArray(),

    count: (color) =>
      color === undefined
        ? db.repertoire.count()
        : db.repertoire.where('color').equals(color).count(),

    put: (node) =>
      writeValidated(RepertoireNodeSchema, node, 'repertoire.put', async (validated) => {
        await db.repertoire.put(validated)
        return validated
      }),

    putMany: async (nodes) => {
      const validated = validateMany(RepertoireNodeSchema, nodes, 'repertoire.putMany')
      if (!validated.ok) return validated
      return runWrite('repertoire.putMany', async () => {
        await db.repertoire.bulkPut(validated.value)
        return validated.value.length
      })
    },

    update: async (id, patch) => {
      const outcome = await runWrite('repertoire.update', () =>
        db.transaction('rw', db.repertoire, async (): Promise<Result<RepertoireNode>> => {
          const existing = await db.repertoire.get(id)
          if (existing === undefined) return err(notFound('repertoire.update', id))
          const parsed = parseValid(
            RepertoireNodeSchema,
            { ...existing, ...patch, updatedAt: patch.updatedAt ?? now() },
            'repertoire.update',
          )
          if (!parsed.ok) return parsed
          await db.repertoire.put(parsed.value)
          return ok(parsed.value)
        }),
      )
      return outcome.ok ? outcome.value : outcome
    },

    removeSubtree: (id) =>
      runWrite('repertoire.removeSubtree', () =>
        db.transaction('rw', db.repertoire, async () => {
          const node = await db.repertoire.get(id)
          if (node === undefined) return 0
          const ids = await collectSubtree(id)
          if (node.parentId !== null) {
            const parent = await db.repertoire.get(node.parentId)
            if (parent !== undefined) {
              await db.repertoire.put({
                ...parent,
                childIds: parent.childIds.filter((child) => child !== id),
                updatedAt: now(),
              })
            }
          }
          await db.repertoire.bulkDelete(ids)
          return ids.length
        }),
      ),

    clear: () => runWrite('repertoire.clear', () => db.repertoire.clear()),
  }
}
