import { describe, expect, it } from 'vitest'

import { parsePgn } from '@/chess'
import { makeGame, makeGameMeta, makeMoveRecord, toFen, toGameId, toSan, toUci } from '@/domain'
import type { Game } from '@/domain'

import {
  blobPgnSource,
  createPgnChunker,
  fingerprintGame,
  gameToPgnGame,
  lastGameBoundary,
  parsePgnStream,
  parsePgnTimestamp,
  parseTimeControl,
  pgnGameToGame,
  resolveYouPlay,
  serializeGames,
  terminationFromHeaders,
  textPgnSource,
} from './pgn-import'

import type { ImportedBatch } from './pgn-import'

/**
 * The parser's contract, driven directly rather than through a worker.
 *
 * jsdom has no `Worker`, so this file tests the code the worker runs — which is all of
 * it, the worker itself being a twelve-line message loop. `pgn-port.test.ts` covers the
 * protocol between the two.
 */

const MOVES = [
  '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7',
  '1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Be7',
  '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6',
  '1. c4 e5 2. Nc3 Nf6 3. g3 Bb4',
] as const

const RESULTS = ['1-0', '0-1', '1/2-1/2', '*'] as const

/** A tiny xorshift so a failing fuzz case is reproducible from its seed alone. */
function rng(seed: number): () => number {
  let state = seed | 0 || 1
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return Math.abs(state) / 2 ** 31
  }
}

interface GeneratedGame {
  readonly text: string
  readonly white: string
  readonly black: string
}

function generateGame(random: () => number, at: number): GeneratedGame {
  const white = `white_${String(at)}`
  const black = `black_${String(at)}`
  const result = RESULTS[Math.floor(random() * RESULTS.length)] ?? '1-0'
  const moves = MOVES[Math.floor(random() * MOVES.length)] ?? MOVES[0]
  const headers = [
    `[Event "Fuzz ${String(at)}"]`,
    `[Site "https://lichess.org/${String(at).padStart(8, 'a')}"]`,
    `[Date "2024.0${String((at % 9) + 1)}.1${String(at % 10)}"]`,
    `[White "${white}"]`,
    `[Black "${black}"]`,
    `[Result "${result}"]`,
    random() > 0.5 ? `[TimeControl "${String(60 * (1 + (at % 10)))}+${String(at % 5)}"]` : null,
    random() > 0.6 ? '[Termination "Normal"]' : null,
    random() > 0.7 ? `[WhiteElo "${String(1000 + (at % 900))}"]` : null,
  ].filter((line): line is string => line !== null)

  const decorated = random() > 0.5 ? `{Opening remarks} ${moves}` : moves
  const annotated = random() > 0.7 ? decorated.replace(' e5', ' e5 $1 {solid}') : decorated
  const blanks = random() > 0.5 ? '\n\n' : '\n'
  return { text: `${headers.join('\n')}\n${blanks}${annotated} ${result}\n`, white, black }
}

async function collect(
  text: string,
  options: { readonly chunkChars?: number } = {},
): Promise<{ games: Game[]; batches: ImportedBatch[] }> {
  const games: Game[] = []
  const batches: ImportedBatch[] = []
  const result = await parsePgnStream(
    textPgnSource(text, options.chunkChars ?? 97),
    { source: 'pgn-import', batchSize: 7 },
    (batch) => {
      batches.push(batch)
      games.push(...batch.games)
    },
  )
  expect(result.ok).toBe(true)
  return { games, batches }
}

describe('the streaming chunker', () => {
  it('only cuts after a result token', () => {
    const text = '[Event "A"]\n\n1. e4 e5 1-0\n\n[Event "B"]\n\n1. d4'
    const cut = lastGameBoundary(text)
    expect(cut).toBeGreaterThan(0)
    expect(text.slice(0, cut).trimEnd().endsWith('1-0')).toBe(true)
  })

  it('refuses to cut inside a game', () => {
    expect(lastGameBoundary('[Event "A"]\n[Site "x"]\n\n1. e4 e5')).toBe(0)
  })

  it('holds text back until a whole game has arrived', () => {
    const chunker = createPgnChunker()
    expect(chunker.push('[Event "A"]\n\n1. e4 e5 ')).toBeNull()
    expect(chunker.push('1-0\n\n[Event "B"]\n\n1. d4')).toContain('1-0')
    expect(chunker.flush()).toContain('[Event "B"]')
  })
})

describe('parsing a PGN stream', () => {
  it('finds every game however the chunks fall', async () => {
    const random = rng(20_20)
    const generated = Array.from({ length: 23 }, (_, at) => generateGame(random, at))
    const text = generated.map((game) => game.text).join('\n')

    for (const chunkChars of [11, 64, 512, 65_536]) {
      const { games } = await collect(text, { chunkChars })
      expect(games).toHaveLength(generated.length)
      expect(games.map((game) => game.meta.white.name)).toEqual(generated.map((game) => game.white))
    }
  })

  it('reports progress that only ever moves forward', async () => {
    const random = rng(7)
    const text = Array.from({ length: 30 }, (_, at) => generateGame(random, at).text).join('\n')
    const { batches } = await collect(text, { chunkChars: 128 })
    expect(batches.length).toBeGreaterThan(1)
    let last = -1
    for (const batch of batches) {
      expect(batch.bytesRead).toBeGreaterThanOrEqual(last)
      expect(batch.totalBytes).toBe(text.length)
      last = batch.bytesRead
    }
    expect(last).toBeLessThanOrEqual(text.length)
  })

  it('skips a broken game and keeps the rest', async () => {
    const good = generateGame(rng(3), 1).text
    const broken = '[Event "Broken"]\n[White "a"]\n[Black "b"]\n[Result "1-0"]\n\n1. e4 e9 1-0\n'
    const { games, batches } = await collect(`${good}\n${broken}\n${good.replace('_1', '_2')}`)
    expect(games).toHaveLength(2)
    expect(batches.flatMap((batch) => batch.skipped)).toHaveLength(1)
  })

  it('never throws on hostile input', async () => {
    const random = rng(99)
    const corruptions = [
      (text: string) => text.replace('"', ''),
      (text: string) => text.replace('\n', ''),
      (text: string) => text.slice(0, Math.floor(text.length * random())),
      (text: string) => text.replace('1.', '1...'),
      (text: string) => `${text}{unclosed comment`,
      (text: string) => text.replace('[Result', '[Resul t'),
      (text: string) => `${text}(((`,
      (text: string) => text.replaceAll('e4', 'z9'),
    ]
    for (let seed = 1; seed <= 40; seed += 1) {
      const local = rng(seed)
      const base = generateGame(local, seed).text
      const corrupt = corruptions[seed % corruptions.length]
      const text = corrupt === undefined ? base : corrupt(base)
      const outcome = await parsePgnStream(
        textPgnSource(text, 32),
        { source: 'pgn-import' },
        () => undefined,
      )
      expect(typeof outcome.ok).toBe('boolean')
    }
  })

  /**
   * jsdom's `Blob` implements neither `stream()` nor `text()`, so a file is stood in for
   * here. Both arms of `blobPgnSource` are exercised: the streaming one a browser takes,
   * and the `text()` fallback for the webviews that have no `Blob.stream`.
   */
  it.each([
    ['a streaming blob', true],
    ['a blob without stream()', false],
  ])('reads a file through %s', async (_name, streaming) => {
    const text = generateGame(rng(5), 4).text
    const bytes = new TextEncoder().encode(text)
    const blob = (streaming
      ? {
          size: bytes.byteLength,
          stream: () =>
            new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(bytes.slice(0, 20))
                controller.enqueue(bytes.slice(20))
                controller.close()
              },
            }),
        }
      : { size: bytes.byteLength, text: () => Promise.resolve(text) }) as unknown as Blob

    const games: Game[] = []
    const result = await parsePgnStream(blobPgnSource(blob), { source: 'pgn-import' }, (batch) => {
      games.push(...batch.games)
    })
    expect(result.ok).toBe(true)
    expect(games).toHaveLength(1)
  })

  it('calls an empty PGN an error rather than an empty success', async () => {
    const result = await parsePgnStream(
      textPgnSource('   \n\n'),
      { source: 'pgn-import' },
      () => undefined,
    )
    expect(result.ok).toBe(false)
  })
})

describe('reading a game out of its headers', () => {
  const headersFor = (extra: string): string =>
    `[Event "Club"]\n[Site "https://lichess.org/abcd1234"]\n[Date "2024.03.09"]\n[UTCTime "18:04:05"]\n[White "bishop_bard"]\n[Black "knightowl77"]\n[WhiteElo "1412"]\n[Result "1-0"]\n${extra}\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 1-0\n`

  it('maps the roster onto a stored game', () => {
    const parsed = parsePgn(headersFor('[TimeControl "600+5"]'))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const game = pgnGameToGame(parsed.value[0]!, headersFor('[TimeControl "600+5"]'), {
      source: 'lichess',
      you: 'bishop_bard',
    })
    expect(game.ok).toBe(true)
    if (!game.ok) return
    expect(game.value.meta.youPlay).toBe('white')
    expect(game.value.meta.white.kind).toBe('you')
    expect(game.value.meta.white.rating).toBe(1412)
    expect(game.value.meta.externalId).toBe('abcd1234')
    expect(game.value.meta.externalUrl).toBe('https://lichess.org/abcd1234')
    expect(game.value.meta.timeControl).toEqual({
      kind: 'increment',
      initialMs: 600_000,
      incrementMs: 5_000,
    })
    expect(game.value.meta.plyCount).toBe(5)
    expect(game.value.meta.opening?.name).toContain('Ruy')
  })

  it('puts the importing player on the black side when that is where they are', () => {
    expect(resolveYouPlay({ White: 'a', Black: 'b' }, 'B')).toBe('black')
    expect(resolveYouPlay({ White: 'a', Black: 'b' }, 'nobody')).toBe('white')
    expect(resolveYouPlay({ White: 'a', Black: 'b' }, undefined)).toBe('white')
  })

  it('reads the clock formats all three providers write', () => {
    expect(parseTimeControl('-')).toEqual({ kind: 'untimed' })
    expect(parseTimeControl(undefined)).toEqual({ kind: 'untimed' })
    expect(parseTimeControl('180+2')).toEqual({
      kind: 'increment',
      initialMs: 180_000,
      incrementMs: 2_000,
    })
    expect(parseTimeControl('600')).toEqual({
      kind: 'increment',
      initialMs: 600_000,
      incrementMs: 0,
    })
    expect(parseTimeControl('1/259200')).toEqual({ kind: 'correspondence', daysPerMove: 3 })
  })

  it('dates games in UTC and shrugs at a missing date', () => {
    expect(parsePgnTimestamp('2024.03.09', '18:04:05')).toBe(Date.UTC(2024, 2, 9, 18, 4, 5))
    expect(parsePgnTimestamp('????.??.??', undefined)).toBeUndefined()
    expect(parsePgnTimestamp(undefined, undefined)).toBeUndefined()
  })

  it('reads "Normal" as a resignation when somebody won', () => {
    expect(terminationFromHeaders({ Termination: 'Normal' }, '1-0', false)).toBe('resignation')
    expect(terminationFromHeaders({ Termination: 'Normal' }, '1-0', true)).toBe('checkmate')
    expect(terminationFromHeaders({ Termination: 'Time forfeit' }, '0-1', false)).toBe('timeout')
    expect(terminationFromHeaders({}, '*', false)).toBe('in-progress')
  })
})

describe('the import fingerprint', () => {
  const text = '[White "a"]\n[Black "b"]\n[Date "2024.01.01"]\n[Result "1-0"]\n\n1. e4 e5 1-0\n'

  it('is identical for the same game exported twice', () => {
    const first = parsePgn(text)
    const second = parsePgn(text.replaceAll('\n\n', '\n\n\n').replace('1. e4 e5', '1.e4 e5'))
    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(fingerprintGame(first.value[0]!)).toBe(fingerprintGame(second.value[0]!))
  })

  it('differs when the moves differ', () => {
    const other = parsePgn(text.replace('1. e4 e5', '1. d4 d5'))
    const base = parsePgn(text)
    expect(other.ok && base.ok).toBe(true)
    if (!other.ok || !base.ok) return
    expect(fingerprintGame(base.value[0]!)).not.toBe(fingerprintGame(other.value[0]!))
  })
})

describe('serializing games back out', () => {
  it('gives back the PGN a game was imported with', () => {
    const game = makeGame({ pgn: '[Event "Kept"]\n\n1. e4 e5 1-0\n' })
    const text = serializeGames([game])
    expect(text.ok).toBe(true)
    if (!text.ok) return
    expect(text.value).toContain('[Event "Kept"]')
  })

  it('rebuilds a PGN for a game that never had one', () => {
    const meta = makeGameMeta({ plyCount: 2, result: '1-0' })
    const stored = makeGame({
      meta,
      moves: [
        makeMoveRecord({
          gameId: meta.id,
          ply: 0,
          moveNumber: 1,
          color: 'white',
          san: toSan('e4'),
          uci: toUci('e2e4'),
        }),
        makeMoveRecord({
          gameId: meta.id,
          ply: 1,
          moveNumber: 1,
          color: 'black',
          san: toSan('e5'),
          uci: toUci('e7e5'),
        }),
      ],
    })
    const game: Game = { meta: stored.meta, moves: stored.moves }
    const rebuilt = gameToPgnGame(game)
    expect(rebuilt.ok).toBe(true)
    if (!rebuilt.ok) return
    expect(rebuilt.value.headers.White).toBe(stored.meta.white.name)
    const text = serializeGames([game])
    expect(text.ok).toBe(true)
    if (!text.ok) return
    expect(text.value).toContain(stored.meta.result)
  })

  it('refuses to invent a game whose stored moves are illegal', () => {
    const meta = makeGameMeta({
      id: toGameId('game-bad'),
      initialFen: toFen('8/8/8/8/8/8/8/K6k w - - 0 1'),
    })
    const game: Game = {
      meta,
      moves: makeGame().moves.map((move) => ({ ...move, gameId: meta.id })),
    }
    expect(gameToPgnGame(game).ok).toBe(false)
  })
})
