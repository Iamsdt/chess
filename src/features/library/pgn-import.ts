import {
  createGame,
  detectOpeningFromPositions,
  mainLine,
  parsePgnGame,
  playMoves,
  serializePgnGames,
  splitPgnGames,
  toMoveRecords,
  type PgnGame,
  type PgnMoveNode,
} from '@/chess'
import {
  GameSchema,
  START_FEN,
  domainError,
  err,
  now,
  ok,
  parseValid,
  toGameId,
  toTimestamp,
  type Color,
  type Game,
  type GameId,
  type GameMeta,
  type GameResult,
  type GameSource,
  type GameTermination,
  type OpeningRef,
  type PlayerRef,
  type DomainError,
  type Result,
  type TimeControl,
} from '@/domain'

import type { PgnImportOptions, SkippedGame } from './worker-protocol'

/**
 * Turning a PGN file into games the library can store — the whole of it, off the main
 * thread.
 *
 * This module owns no PGN grammar: S06 parses (`parsePgnGame`), splits (`splitPgnGames`)
 * and writes (`serializePgnGames`) every byte. What lives here is the two things S06
 * deliberately does not do, because they are the library's business and not chess's:
 *
 * - **Where one game ends and the next begins in a half-arrived stream.** A 5 MB file
 *   reaches the worker in 64 KB pieces, and a piece almost never lands on a game
 *   boundary. `createPgnChunker` finds a point that is provably between games and hands
 *   everything before it to S06 — so S06 still does the splitting, just on a prefix that
 *   is known to be complete.
 * - **What a `[White "…"]` header means to this app.** Result, termination, clock, ECO,
 *   which side is "you", and the identity a re-import must recognise.
 *
 * Nothing in here touches storage, React or `postMessage`; the worker is a message loop
 * around these functions, and every test drives them directly.
 */

/** Games per `batch` message. Chosen so a batch is a repaint, not a stall. */
export const DEFAULT_BATCH_SIZE = 50

/** How much text the parser pulls from a string source at a time. */
export const TEXT_CHUNK_CHARS = 64 * 1024

const RESULT_TAIL = /(?:1-0|0-1|1\/2-1\/2|\*)$/

/**
 * A random id in S05's `game_<32 hex>` format.
 *
 * Why not `newGameId` from `@/data`: this code runs inside a worker, and importing the
 * repositories would link Dexie and the whole persistence layer into a bundle whose only
 * job is to read text. The format is S05's; only the entropy is minted here.
 */
function newImportedGameId(): GameId {
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return toGameId(`game_${hex}`)
}

/**
 * Find the last position in `text` that is certainly a boundary between two games.
 *
 * The test is deliberately conservative: a line that opens a header tag, preceded by
 * text whose last token is a game result. A `[` inside an unterminated comment therefore
 * cannot fool it, and the cost of being wrong in the other direction — not finding a
 * boundary — is only that the buffer grows until the next chunk arrives.
 *
 * Returns 0 when no boundary is available yet.
 */
export function lastGameBoundary(text: string): number {
  let index = text.length
  while (index > 0) {
    const at = text.lastIndexOf('\n[', index - 1)
    if (at < 0) return 0
    const head = text.slice(0, at).trimEnd()
    if (head !== '' && RESULT_TAIL.test(head)) return at + 1
    index = at
  }
  return 0
}

export interface PgnChunker {
  /** Feed the next piece of file; get back whole-game text ready for `splitPgnGames`. */
  push: (text: string) => string | null
  /** Whatever is left when the stream ends. */
  flush: () => string | null
}

/** Why a factory and not a generator: the worker pushes, it does not pull. */
export function createPgnChunker(): PgnChunker {
  let buffer = ''
  return {
    push(text) {
      buffer += text
      const cut = lastGameBoundary(buffer)
      if (cut <= 0) return null
      const ready = buffer.slice(0, cut)
      buffer = buffer.slice(cut)
      return ready.trim() === '' ? null : ready
    },
    flush() {
      const rest = buffer
      buffer = ''
      return rest.trim() === '' ? null : rest
    },
  }
}

/**
 * A stable identity for a game that carries no provider id.
 *
 * Why it exists: "re-import creates no duplicates" has to hold for a PGN file too, and a
 * file has nothing unique in it. Hashing the parts a re-export cannot change — the
 * starting position, the date, the two names, the result and the moves — gives the same
 * key for the same game however the exporter reformatted it. It is FNV-1a, not a
 * cryptographic hash: the cost of a collision is one game not imported, and a 64-bit
 * space makes that vanishingly unlikely for a personal library.
 */
export function fingerprintGame(game: PgnGame): string {
  const headers = game.headers
  const body = [
    game.initialFen,
    headers.UTCDate ?? headers.Date ?? '',
    headers.White ?? '',
    headers.Black ?? '',
    game.result,
    mainLine(game)
      .map((move) => move.san)
      .join(' '),
  ].join('|')
  return `${fnv1a(body, 0x811c9dc5)}${fnv1a(body, 0x9e3779b1)}`
}

function fnv1a(input: string, seed: number): string {
  let hash = seed >>> 0
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

const TRAILING_SEGMENT = /([^/]+)\/?$/

/** Why: the dedupe key and the "open on Lichess" link are the same header, read twice. */
export function externalRefFromHeaders(
  source: GameSource,
  headers: Readonly<Record<string, string>>,
): { externalId?: string; externalUrl?: string } {
  const url =
    source === 'chesscom' ? (headers.Link ?? headers.Site) : (headers.Site ?? headers.Link)
  if (url === undefined || !/^https?:\/\//.test(url)) return {}
  const segment = TRAILING_SEGMENT.exec(url)?.[1]
  if (segment === undefined || segment === '') return { externalUrl: url }
  // A Lichess move-specific link is the 8-character game id plus a colour suffix.
  const id = /^[A-Za-z0-9]{12}$/.test(segment) ? segment.slice(0, 8) : segment
  return { externalId: id, externalUrl: url }
}

function parseRating(value: string | undefined): number | undefined {
  if (value === undefined) return undefined
  const rating = Number.parseInt(value, 10)
  return Number.isInteger(rating) && rating >= 0 && rating <= 4000 ? rating : undefined
}

const ENGINE_NAME = /stockfish|komodo|leela|lc0|\bbot\b|engine/i

function playerRef(name: string | undefined, elo: string | undefined, isYou: boolean): PlayerRef {
  const label = name === undefined || name.trim() === '' ? 'Unknown' : name.trim()
  const rating = parseRating(elo)
  const kind = isYou ? 'you' : ENGINE_NAME.test(label) ? 'engine' : 'human'
  return { kind, name: label, ...(rating === undefined ? {} : { rating }) }
}

/**
 * Which side the importing player was on.
 *
 * Every "you" label on every screen reads `youPlay`, so guessing badly is worse than
 * admitting ignorance — but the schema has no "neither", and White is the side a
 * single-player PGN is overwhelmingly exported from. The import panel asks for the
 * username precisely so this is not a guess.
 */
export function resolveYouPlay(
  headers: Readonly<Record<string, string>>,
  you: string | undefined,
): Color {
  if (you === undefined || you.trim() === '') return 'white'
  const needle = you.trim().toLowerCase()
  if ((headers.Black ?? '').trim().toLowerCase() === needle) return 'black'
  return 'white'
}

const PGN_DATE = /^(\d{4})\.(\d{2})\.(\d{2})$/
const PGN_TIME = /^(\d{2}):(\d{2}):(\d{2})$/

/** Why UTC and not local: a PGN date has no zone, and a drifting one breaks date filters. */
export function parsePgnTimestamp(
  date: string | undefined,
  time: string | undefined,
): number | undefined {
  const day = date === undefined ? null : PGN_DATE.exec(date)
  if (day === null) return undefined
  const [, year, month, dayOfMonth] = day
  if (year === undefined || month === undefined || dayOfMonth === undefined) return undefined
  const clock = time === undefined ? null : PGN_TIME.exec(time)
  const hours = clock?.[1] ?? '00'
  const minutes = clock?.[2] ?? '00'
  const seconds = clock?.[3] ?? '00'
  const value = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(dayOfMonth),
    Number(hours),
    Number(minutes),
    Number(seconds),
  )
  return Number.isFinite(value) && value >= 0 ? value : undefined
}

const INCREMENT = /^(\d+)\+(\d+)$/
const CORRESPONDENCE = /^\d+\/(\d+)$/

/** Why: `600+5`, `1/259200` and `-` are all legal, and only one of them means "no clock". */
export function parseTimeControl(value: string | undefined): TimeControl {
  const raw = (value ?? '').trim()
  if (raw === '' || raw === '-' || raw === '?') return { kind: 'untimed' }
  const increment = INCREMENT.exec(raw)
  if (increment !== null) {
    const initial = Number(increment[1])
    const step = Number(increment[2])
    return { kind: 'increment', initialMs: initial * 1000, incrementMs: step * 1000 }
  }
  const correspondence = CORRESPONDENCE.exec(raw)
  if (correspondence !== null) {
    const seconds = Number(correspondence[1])
    return { kind: 'correspondence', daysPerMove: Math.max(1, Math.round(seconds / 86_400)) }
  }
  if (/^\d+$/.test(raw)) return { kind: 'increment', initialMs: Number(raw) * 1000, incrementMs: 0 }
  return { kind: 'untimed' }
}

/**
 * How the game ended, from what the exporter was willing to say.
 *
 * Lichess and Chess.com both write `Termination: Normal` for a resignation, so a decisive
 * result with no mate on the board is read as one. `unknown` is reserved for the case
 * where even that inference is unsafe.
 */
export function terminationFromHeaders(
  headers: Readonly<Record<string, string>>,
  result: GameResult,
  endedInMate: boolean,
): GameTermination {
  if (endedInMate) return 'checkmate'
  const text = (headers.Termination ?? '').toLowerCase()
  if (text.includes('time')) return 'timeout'
  if (text.includes('abandon')) return 'abandoned'
  if (text.includes('stalemate')) return 'stalemate'
  if (text.includes('insufficient')) return 'insufficient-material'
  if (text.includes('repetition')) return 'threefold-repetition'
  if (text.includes('fifty')) return 'fifty-move-rule'
  if (text.includes('agree')) return 'agreement'
  if (text.includes('resign')) return 'resignation'
  if (result === '*') return 'in-progress'
  if (result === '1/2-1/2') return 'agreement'
  if (text === '' || text.includes('normal') || text.includes('won')) return 'resignation'
  return 'unknown'
}

/** Why our own table wins: the library filters by ECO, and two sources would disagree. */
function openingOf(
  game: PgnGame,
  headers: Readonly<Record<string, string>>,
): OpeningRef | undefined {
  const positions = [game.initialFen, ...mainLine(game).map((move) => move.fenAfter)]
  const detected = detectOpeningFromPositions(positions)
  if (detected !== null) return detected
  const name = headers.Opening
  if (name === undefined || name.trim() === '') return undefined
  const eco = headers.ECO
  const variation = headers.Variation
  return {
    name: name.trim(),
    ...(eco !== undefined && /^[A-E][0-9]{2}$/.test(eco) ? { eco } : {}),
    ...(variation === undefined || variation.trim() === '' ? {} : { variation: variation.trim() }),
  }
}

/**
 * One parsed PGN game as the library stores it.
 *
 * The PGN text is kept on the row because export has to give back what came in, and
 * re-serialising a game from its move records loses every comment the annotator wrote.
 */
export function pgnGameToGame(
  game: PgnGame,
  pgnText: string,
  options: PgnImportOptions,
): Result<Game> {
  const headers = game.headers
  const id = newImportedGameId()
  const moves = toMoveRecords(game, id)
  const line = mainLine(game)
  const last = line.at(-1)
  const youPlay = resolveYouPlay(headers, options.you)
  const startedAt = parsePgnTimestamp(
    headers.UTCDate ?? headers.Date,
    headers.UTCTime ?? headers.Time,
  )
  const timestamp = startedAt === undefined ? now() : toTimestamp(startedAt)
  const external = externalRefFromHeaders(options.source, headers)
  const opening = openingOf(game, headers)

  const meta: GameMeta = {
    id,
    createdAt: now(),
    updatedAt: now(),
    startedAt: timestamp,
    source: options.source,
    externalId: external.externalId ?? fingerprintGame(game),
    ...(external.externalUrl === undefined ? {} : { externalUrl: external.externalUrl }),
    white: playerRef(headers.White, headers.WhiteElo, youPlay === 'white'),
    black: playerRef(headers.Black, headers.BlackElo, youPlay === 'black'),
    youPlay,
    result: game.result,
    termination: terminationFromHeaders(headers, game.result, last?.isCheckmate === true),
    timeControl: parseTimeControl(headers.TimeControl),
    initialFen: game.initialFen,
    finalFen: last?.fenAfter ?? game.initialFen,
    plyCount: line.length,
    ...(opening === undefined ? {} : { opening }),
    reviewState: 'not-reviewed',
    mistakeCount: 0,
    tags: [],
  }

  return parseValid(GameSchema, { meta, moves, pgn: pgnText }, 'library.pgnGameToGame')
}

/** Why a label and not the chunk: a skipped-game report must not carry the file with it. */
function labelOf(chunk: string): string {
  const white = /\[White\s+"([^"]*)"\]/.exec(chunk)?.[1]
  const black = /\[Black\s+"([^"]*)"\]/.exec(chunk)?.[1]
  if (white !== undefined || black !== undefined) return `${white ?? '?'} vs ${black ?? '?'}`
  return (chunk.trim().split('\n')[0] ?? 'Unreadable game').slice(0, 80)
}

export interface ImportedBatch {
  readonly games: readonly Game[]
  readonly skipped: readonly SkippedGame[]
  readonly bytesRead: number
  readonly totalBytes: number | null
  readonly gamesParsed: number
}

export interface PgnParseSummary {
  readonly gamesParsed: number
  readonly skippedCount: number
  readonly bytesRead: number
}

export type PgnBatchHandler = (batch: ImportedBatch) => void | Promise<void>

/** A piece of a PGN, with the byte cost of reading it so progress can be honest. */
export interface PgnChunk {
  readonly text: string
  readonly bytes: number
}

export interface PgnStreamSource {
  /** `null` when the size cannot be known before reading, as for a pasted string. */
  readonly totalBytes: number | null
  readonly chunks: () => AsyncIterable<PgnChunk>
}

/** Pasted text: already in memory, but still handed over in pieces so progress moves. */
export function textPgnSource(text: string, chunkChars = TEXT_CHUNK_CHARS): PgnStreamSource {
  return {
    totalBytes: text.length,
    chunks: async function* chunks() {
      for (let at = 0; at < text.length; at += chunkChars) {
        const piece = text.slice(at, at + chunkChars)
        yield { text: piece, bytes: piece.length }
        await Promise.resolve()
      }
    },
  }
}

/**
 * A file, read as a stream.
 *
 * Why the `blob.text()` fallback: `Blob.stream` is missing in some embedded webviews, and
 * a file the user chose must still import there — slower and without a byte-accurate
 * progress bar, but it must import.
 */
export function blobPgnSource(blob: Blob): PgnStreamSource {
  return {
    totalBytes: blob.size,
    chunks: async function* chunks() {
      if (typeof blob.stream !== 'function') {
        const text = await blob.text()
        yield { text, bytes: blob.size }
        return
      }
      const reader = blob.stream().getReader()
      const decoder = new TextDecoder()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) {
          const tail = decoder.decode()
          if (tail !== '') yield { text: tail, bytes: 0 }
          return
        }
        yield { text: decoder.decode(value, { stream: true }), bytes: value.byteLength }
      }
    },
  }
}

/**
 * Read a PGN stream and hand over whole games in batches.
 *
 * The handler is awaited before the next batch is parsed, so a slow consumer (the
 * database, on import) throttles the parser instead of being buried by it. Cancellation
 * is checked between games, which bounds it at one game rather than one file.
 */
export async function parsePgnStream(
  source: PgnStreamSource,
  options: PgnImportOptions,
  onBatch: PgnBatchHandler,
  signal?: AbortSignal,
): Promise<Result<PgnParseSummary>> {
  const chunker = createPgnChunker()
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE
  let pending: Game[] = []
  let skipped: SkippedGame[] = []
  let gamesParsed = 0
  let skippedCount = 0
  let bytesRead = 0
  let index = 0

  const flushBatch = async (): Promise<void> => {
    if (pending.length === 0 && skipped.length === 0) return
    const batch: ImportedBatch = {
      games: pending,
      skipped,
      bytesRead,
      totalBytes: source.totalBytes,
      gamesParsed,
    }
    pending = []
    skipped = []
    await onBatch(batch)
  }

  const consume = async (ready: string): Promise<boolean> => {
    for (const chunk of splitPgnGames(ready)) {
      if (signal?.aborted === true) return false
      const position = index
      index += 1
      const parsed = parsePgnGame(chunk)
      if (!parsed.ok) {
        skippedCount += 1
        skipped.push({ index: position, label: labelOf(chunk), reason: parsed.error.message })
        continue
      }
      const game = pgnGameToGame(parsed.value, chunk.trim(), options)
      if (!game.ok) {
        skippedCount += 1
        skipped.push({ index: position, label: labelOf(chunk), reason: game.error.message })
        continue
      }
      gamesParsed += 1
      pending.push(game.value)
      if (pending.length >= batchSize) await flushBatch()
    }
    return true
  }

  try {
    for await (const piece of source.chunks()) {
      if (signal?.aborted === true) return err(cancelled())
      bytesRead += piece.bytes
      const ready = chunker.push(piece.text)
      if (ready !== null && !(await consume(ready))) return err(cancelled())
    }
    const tail = chunker.flush()
    if (tail !== null && !(await consume(tail))) return err(cancelled())
    await flushBatch()
  } catch (cause: unknown) {
    const message = cause instanceof Error ? cause.message : 'The PGN could not be read'
    return err(domainError('io', message, { where: 'PGN import', cause }))
  }

  if (gamesParsed === 0 && skippedCount === 0) {
    return err(domainError('validation', 'There are no games in this PGN', { where: 'PGN import' }))
  }
  return ok({ gamesParsed, skippedCount, bytesRead })
}

function cancelled(): DomainError {
  return domainError('cancelled', 'The import was cancelled', { where: 'PGN import' })
}

/** The seven-tag roster plus what this app knows and a PGN reader elsewhere can use. */
function headersFromMeta(meta: GameMeta): Record<string, string> {
  const date = new Date(meta.startedAt)
  const pad = (value: number): string => String(value).padStart(2, '0')
  const headers: Record<string, string> = {
    Event: 'Chess King',
    Site: meta.externalUrl ?? 'Chess King',
    Date: `${String(date.getUTCFullYear())}.${pad(date.getUTCMonth() + 1)}.${pad(date.getUTCDate())}`,
    Round: '-',
    White: meta.white.name,
    Black: meta.black.name,
    Result: meta.result,
  }
  if (meta.white.rating !== undefined) headers.WhiteElo = String(meta.white.rating)
  if (meta.black.rating !== undefined) headers.BlackElo = String(meta.black.rating)
  if (meta.opening?.eco !== undefined) headers.ECO = meta.opening.eco
  if (meta.opening !== undefined) headers.Opening = meta.opening.name
  if (meta.termination !== 'unknown') headers.Termination = meta.termination
  if (meta.initialFen !== START_FEN) {
    headers.SetUp = '1'
    headers.FEN = meta.initialFen
  }
  return headers
}

/**
 * Rebuild a PGN for a game that was not imported from one.
 *
 * The moves are replayed through S06 rather than printed from the stored SAN, because
 * `serializePgn` writes a move tree and replaying is the only honest way to produce one —
 * and it fails loudly if the stored moves are not legal, which is worth knowing.
 */
export function gameToPgnGame(game: Game): Result<PgnGame> {
  const start = createGame(game.meta.initialFen)
  if (!start.ok) return start
  const played = playMoves(
    start.value,
    game.moves.map((move) => move.san),
  )
  if (!played.ok) return played
  const nodes: PgnMoveNode[] = played.value.history.map((move, at) => {
    const record = game.moves[at]
    const comment = record?.comment
    const nag = record?.nag
    return {
      move,
      nags: nag === undefined ? [] : [nag],
      ...(comment === undefined || comment === '' ? {} : { comment }),
      variations: [],
    }
  })
  return ok({
    headers: headersFromMeta(game.meta),
    initialFen: game.meta.initialFen,
    moves: nodes,
    result: game.meta.result,
  })
}

/**
 * Serialize games for export, preferring the PGN they arrived with.
 *
 * Why the stored text wins: an imported game's comments, variations and clock annotations
 * are in that string and nowhere else, and an export that quietly dropped them would make
 * "your games are yours" untrue.
 */
export function serializeGames(games: readonly Game[]): Result<string> {
  const parts: string[] = []
  for (const game of games) {
    if (game.pgn !== undefined && game.pgn.trim() !== '') {
      parts.push(`${game.pgn.trim()}\n`)
      continue
    }
    const converted = gameToPgnGame(game)
    if (!converted.ok) return converted
    parts.push(serializePgnGames([converted.value]))
  }
  return ok(parts.join('\n'))
}
