import type { GameFilter, GamesRepository } from '@/data'
import { domainError, err, ok, type GameId, type Game, type Result } from '@/domain'

import type { PgnPort } from './pgn-port'

/**
 * Export: your games are yours.
 *
 * Serializing runs in the same worker that imports, for the same reason — a game whose
 * PGN was never stored has to be replayed move by move through S06 before it can be
 * written out, and a thousand of those is not main-thread work.
 *
 * Games are fetched and serialized in pages so an export of a large library never holds
 * every move of every game in memory at once.
 */

/** Games loaded and serialized per round trip. Small enough to stay responsive. */
export const EXPORT_PAGE_SIZE = 50

export type SaveFile = (fileName: string, text: string) => void

export interface ExportDeps {
  readonly pgn: PgnPort
  readonly games: Pick<GamesRepository, 'getWithMoves' | 'list'>
  readonly onProgress?: (done: number, total: number) => void
  readonly signal?: AbortSignal
}

/** Why a date in the name: a user exports more than once, and two files must not collide. */
export function pgnFileName(prefix = 'chess-king-games'): string {
  const stamp = new Date().toISOString().slice(0, 10)
  return `${prefix}-${stamp}.pgn`
}

/**
 * Hand the text to the browser as a download.
 *
 * Kept behind `SaveFile` so the export logic can be tested without a DOM, and so a future
 * "save to a folder" (File System Access) is a swap rather than a rewrite.
 */
export const downloadFile: SaveFile = (fileName, text) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/x-chess-pgn' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/** One game, with its moves, ready to hand to the worker. */
async function loadGames(ids: readonly GameId[], deps: ExportDeps): Promise<Result<Game[]>> {
  const games: Game[] = []
  for (const id of ids) {
    const game = await deps.games.getWithMoves(id)
    if (game === undefined) {
      return err(domainError('not-found', 'That game is no longer in the library', { where: id }))
    }
    games.push(game)
  }
  return ok(games)
}

/** The "download this game" button on a row. */
export async function exportGame(id: GameId, deps: ExportDeps): Promise<Result<string>> {
  const loaded = await loadGames([id], deps)
  if (!loaded.ok) return loaded
  return deps.pgn.serialize(loaded.value)
}

export interface ExportSummary {
  readonly text: string
  readonly count: number
}

/** "Download all as PGN", honouring whatever filter the table is showing. */
export async function exportGames(
  filter: GameFilter,
  deps: ExportDeps,
): Promise<Result<ExportSummary>> {
  const rows = await deps.games.list(filter)
  if (rows.length === 0) {
    return err(domainError('not-found', 'There are no games to export', { where: 'library' }))
  }
  const parts: string[] = []
  for (let at = 0; at < rows.length; at += EXPORT_PAGE_SIZE) {
    if (deps.signal?.aborted === true) {
      return err(domainError('cancelled', 'The export was cancelled', { where: 'library' }))
    }
    const page = rows.slice(at, at + EXPORT_PAGE_SIZE)
    const loaded = await loadGames(
      page.map((row) => row.id),
      deps,
    )
    if (!loaded.ok) return loaded
    const text = await deps.pgn.serialize(loaded.value)
    if (!text.ok) return text
    parts.push(text.value)
    deps.onProgress?.(Math.min(at + EXPORT_PAGE_SIZE, rows.length), rows.length)
  }
  return ok({ text: parts.join('\n'), count: rows.length })
}
