import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it } from 'vitest'

import { gamesRepo } from '@/data'

import { EXPORT_PAGE_SIZE, exportGame, exportGames, pgnFileName } from './export-service'
import { importPgn } from './import-service'
import { parsePgnStream, serializeGames, textPgnSource } from './pgn-import'

import type { PgnPort } from './pgn-port'

/** The same calls the worker makes, made here instead — jsdom has no `Worker`. */
const port: PgnPort = {
  parse: (source, options, onBatch, signal) =>
    source.kind === 'text'
      ? parsePgnStream(textPgnSource(source.text), options, onBatch, signal)
      : Promise.reject(new Error('this test only pastes text')),
  serialize: (games) => Promise.resolve(serializeGames(games)),
  close: () => undefined,
}

const FILE = [
  '[Event "One"]\n[Site "https://lichess.org/aaaa1111"]\n[Date "2024.03.09"]\n[White "a"]\n[Black "b"]\n[Result "1-0"]\n\n1. e4 e5 1-0\n',
  '[Event "Two"]\n[Site "https://lichess.org/bbbb2222"]\n[Date "2024.03.10"]\n[White "c"]\n[Black "d"]\n[Result "0-1"]\n\n1. d4 d5 0-1\n',
].join('\n')

beforeEach(async () => {
  await gamesRepo.clear()
  await importPgn(
    { kind: 'text', text: FILE },
    { source: 'lichess' },
    { pgn: port, games: gamesRepo },
  )
})

describe('exporting', () => {
  it('writes every stored game into one file', async () => {
    const result = await exportGames({}, { pgn: port, games: gamesRepo })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.count).toBe(2)
    expect(result.value.text).toContain('[Event "One"]')
    expect(result.value.text).toContain('[Event "Two"]')
  })

  it('honours the filter the table is showing', async () => {
    const result = await exportGames({ source: 'chesscom' }, { pgn: port, games: gamesRepo })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('not-found')
  })

  it('exports one game on its own', async () => {
    const rows = await gamesRepo.list()
    const first = rows[0]
    expect(first).toBeDefined()
    if (first === undefined) return
    const result = await exportGame(first.id, { pgn: port, games: gamesRepo })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toContain(first.white.name)
  })

  it('reports progress a page at a time', async () => {
    const seen: number[] = []
    await exportGames(
      {},
      {
        pgn: port,
        games: gamesRepo,
        onProgress: (done) => {
          seen.push(done)
        },
      },
    )
    expect(seen).toEqual([2])
    expect(EXPORT_PAGE_SIZE).toBeGreaterThan(1)
  })

  it('stops when the caller cancels', async () => {
    const controller = new AbortController()
    controller.abort()
    const result = await exportGames({}, { pgn: port, games: gamesRepo, signal: controller.signal })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('cancelled')
  })

  it('dates the file so two exports never collide silently', () => {
    expect(pgnFileName()).toMatch(/^chess-king-games-\d{4}-\d{2}-\d{2}\.pgn$/)
  })
})
