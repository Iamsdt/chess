import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it } from 'vitest'

import { gamesRepo } from '@/data'
import { err, ok, domainError } from '@/domain'
import type { Result } from '@/domain'

import { importFromFeed, importPgn } from './import-service'
import { blobPgnSource, parsePgnStream, serializeGames, textPgnSource } from './pgn-import'

import type { FeedChunk, ImportProgress } from './import-service'
import type { PgnPort } from './pgn-port'

/**
 * Dedupe, end to end, against a real IndexedDB.
 *
 * `fake-indexeddb` plus the app's own repository is the honest version of this test: the
 * `[source+externalId]` index doing the work is S05's, and a fake repository would prove
 * nothing about it.
 */

/** The same calls the worker makes, made here instead — jsdom has no `Worker`. */
function localPort(): PgnPort {
  return {
    parse: (source, options, onBatch, signal) =>
      parsePgnStream(
        source.kind === 'text' ? textPgnSource(source.text, 64) : blobPgnSource(source.blob),
        options,
        onBatch,
        signal,
      ),
    serialize: (games) => Promise.resolve(serializeGames(games)),
    close: () => undefined,
  }
}

const GAME_ONE =
  '[Event "One"]\n[Site "https://lichess.org/aaaa1111"]\n[Date "2024.03.09"]\n[White "bishop_bard"]\n[Black "rival"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 1-0\n'
const GAME_TWO =
  '[Event "Two"]\n[Site "https://lichess.org/bbbb2222"]\n[Date "2024.03.10"]\n[White "rival"]\n[Black "bishop_bard"]\n[Result "0-1"]\n\n1. d4 d5 2. c4 e6 0-1\n'
const BROKEN = '[Event "Broken"]\n[White "x"]\n[Black "y"]\n[Result "1-0"]\n\n1. e4 e9 1-0\n'

const FILE = `${GAME_ONE}\n${GAME_TWO}`

async function runImport(text: string, progress?: ImportProgress[]) {
  return importPgn(
    { kind: 'text', text },
    { source: 'lichess', you: 'bishop_bard' },
    {
      pgn: localPort(),
      games: gamesRepo,
      ...(progress === undefined
        ? {}
        : {
            onProgress: (value: ImportProgress) => {
              progress.push(value)
            },
          }),
    },
  )
}

beforeEach(async () => {
  await gamesRepo.clear()
})

describe('importing a PGN', () => {
  it('stores each game once', async () => {
    const report = await runImport(FILE)
    expect(report.ok).toBe(true)
    if (!report.ok) return
    expect(report.value.imported).toBe(2)
    expect(report.value.duplicates).toBe(0)
    expect(await gamesRepo.count()).toBe(2)
  })

  it('imports nothing the second time', async () => {
    await runImport(FILE)
    const again = await runImport(FILE)
    expect(again.ok).toBe(true)
    if (!again.ok) return
    expect(again.value.imported).toBe(0)
    expect(again.value.duplicates).toBe(2)
    expect(await gamesRepo.count()).toBe(2)
  })

  it('collapses a game that appears twice in one file', async () => {
    const report = await runImport(`${GAME_ONE}\n${GAME_ONE}`)
    expect(report.ok).toBe(true)
    if (!report.ok) return
    expect(report.value.imported).toBe(1)
    expect(report.value.duplicates).toBe(1)
  })

  it('does not overwrite a review when the same game is imported again', async () => {
    const first = await runImport(GAME_ONE)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const id = first.value.gameIds[0]
    expect(id).toBeDefined()
    if (id === undefined) return
    await gamesRepo.setReviewState(id, 'reviewed')

    await runImport(GAME_ONE)
    const row = await gamesRepo.get(id)
    expect(row?.reviewState).toBe('reviewed')
  })

  it('dedupes a PGN with no provider id by its content', async () => {
    const plain = '[White "a"]\n[Black "b"]\n[Date "2024.01.01"]\n[Result "1-0"]\n\n1. e4 e5 1-0\n'
    const options = { source: 'pgn-import' } as const
    const deps = { pgn: localPort(), games: gamesRepo }
    const first = await importPgn({ kind: 'text', text: plain }, options, deps)
    const second = await importPgn(
      { kind: 'text', text: plain.replace('1. e4 e5', '1.e4   e5') },
      options,
      deps,
    )
    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(first.value.imported).toBe(1)
    expect(second.value.imported).toBe(0)
    expect(second.value.duplicates).toBe(1)
  })

  it('reports the game it could not read and keeps the others', async () => {
    const report = await runImport(`${GAME_ONE}\n${BROKEN}\n${GAME_TWO}`)
    expect(report.ok).toBe(true)
    if (!report.ok) return
    expect(report.value.imported).toBe(2)
    expect(report.value.skippedCount).toBe(1)
    expect(report.value.skipped[0]?.label).toBe('x vs y')
  })

  it('narrates progress and finishes on "done"', async () => {
    const progress: ImportProgress[] = []
    await runImport(FILE, progress)
    expect(progress.length).toBeGreaterThan(0)
    expect(progress.at(-1)?.phase).toBe('done')
    expect(progress.at(-1)?.imported).toBe(2)
    let last = -1
    for (const step of progress) {
      expect(step.bytesRead).toBeGreaterThanOrEqual(last)
      last = step.bytesRead
    }
  })

  it('stops when the caller cancels', async () => {
    const controller = new AbortController()
    controller.abort()
    const report = await importPgn(
      { kind: 'text', text: FILE },
      { source: 'lichess' },
      { pgn: localPort(), games: gamesRepo, signal: controller.signal },
    )
    expect(report.ok).toBe(false)
    if (report.ok) return
    expect(report.error.code).toBe('cancelled')
  })
})

describe('importing from a provider feed', () => {
  const feedOf = (...chunks: readonly Result<FeedChunk>[]) =>
    async function* feed() {
      for (const chunk of chunks) yield await Promise.resolve(chunk)
    }

  it('imports every chunk and dedupes across them', async () => {
    const report = await importFromFeed(
      feedOf(
        ok({ label: '2024-03', pgn: GAME_ONE, index: 1, total: 2 }),
        ok({ label: '2024-04', pgn: `${GAME_TWO}\n${GAME_ONE}`, index: 2, total: 2 }),
      ),
      { source: 'lichess', you: 'bishop_bard' },
      { pgn: localPort(), games: gamesRepo },
    )
    expect(report.ok).toBe(true)
    if (!report.ok) return
    expect(report.value.imported).toBe(2)
    expect(report.value.duplicates).toBe(1)
  })

  it('tolerates a month with no games in it', async () => {
    const report = await importFromFeed(
      feedOf(
        ok({ label: '2024-03', pgn: '', index: 1, total: 2 }),
        ok({ label: '2024-04', pgn: GAME_ONE, index: 2, total: 2 }),
      ),
      { source: 'chesscom' },
      { pgn: localPort(), games: gamesRepo },
    )
    expect(report.ok).toBe(true)
    if (!report.ok) return
    expect(report.value.imported).toBe(1)
  })

  it('stops at the first network failure', async () => {
    const report = await importFromFeed(
      feedOf(
        ok({ label: '2024-03', pgn: GAME_ONE, index: 1, total: 2 }),
        err(domainError('network', 'rate limited')),
      ),
      { source: 'chesscom' },
      { pgn: localPort(), games: gamesRepo },
    )
    expect(report.ok).toBe(false)
    if (report.ok) return
    expect(report.error.code).toBe('network')
  })

  it('says so when the account has nothing at all', async () => {
    const report = await importFromFeed(
      feedOf(),
      { source: 'chesscom' },
      {
        pgn: localPort(),
        games: gamesRepo,
      },
    )
    expect(report.ok).toBe(false)
    if (report.ok) return
    expect(report.error.code).toBe('not-found')
  })
})
