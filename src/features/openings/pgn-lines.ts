import { z } from 'zod'

import { parsePgn, type PgnMoveNode } from '@/chess'
import { domainError, err, ok, START_FEN, type Result } from '@/domain'

import type { LineBranch } from './tree'

/**
 * PGN to repertoire branches.
 *
 * Why branches and not nodes: this runs in a worker for large files, and a plain
 * `{ san, comment, children }` tree crosses `postMessage` cheaply and is validated on
 * arrival. Turning it into repertoire rows needs the user's colour and existing tree,
 * which only the main thread has.
 */

export interface ParsedLines {
  readonly branches: readonly LineBranch[]
  readonly games: number
  /** Games skipped because they start from a custom position. */
  readonly skipped: number
}

/** Past this many characters the work goes to a worker; below it the round trip costs more. */
export const WORKER_THRESHOLD_CHARS = 20_000

export const LineBranchSchema: z.ZodType<LineBranch> = z.lazy(() =>
  z.object({
    san: z.string().min(1),
    comment: z.string().optional(),
    children: z.array(LineBranchSchema),
  }),
)

export const ParsedLinesSchema = z.object({
  branches: z.array(LineBranchSchema),
  games: z.number().int().min(0),
  skipped: z.number().int().min(0),
})

interface MutableBranch {
  san: string
  comment?: string
  children: MutableBranch[]
}

function mergeInto(siblings: MutableBranch[], node: MutableBranch): MutableBranch {
  const existing = siblings.find((candidate) => candidate.san === node.san)
  if (existing === undefined) {
    siblings.push(node)
    return node
  }
  if (existing.comment === undefined && node.comment !== undefined) existing.comment = node.comment
  return existing
}

/**
 * Lays one move list, with its variations, under a parent's children.
 *
 * Variations replace the move they hang off, so they start from the same parent as that
 * move. Games that share a prefix merge, which is what makes a chapter of ten lines one
 * tree and not ten.
 */
function addMoves(siblings: MutableBranch[], moves: readonly PgnMoveNode[]): void {
  let level = siblings
  for (const node of moves) {
    const branch: MutableBranch = {
      san: node.move.san,
      ...(node.comment === undefined ? {} : { comment: node.comment }),
      children: [],
    }
    const owner = mergeInto(level, branch)
    for (const variation of node.variations) addMoves(level, variation)
    level = owner.children
  }
}

/** Parses PGN text into a merged tree of lines from the standard starting position. */
export function parseLines(text: string): Result<ParsedLines> {
  const parsed = parsePgn(text)
  if (!parsed.ok) return parsed
  const roots: MutableBranch[] = []
  let games = 0
  let skipped = 0
  for (const game of parsed.value) {
    if (game.initialFen !== START_FEN) {
      skipped += 1
      continue
    }
    games += 1
    addMoves(roots, game.moves)
  }
  if (games === 0) {
    return err(
      domainError('validation', 'No game in this PGN starts from the standard position', {
        where: 'PGN',
      }),
    )
  }
  return ok({ branches: roots, games, skipped })
}
