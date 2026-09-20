import { type EngineScore, type Wdl } from '@/domain'

/**
 * A strict reader for the subset of UCI that Stockfish 19 actually speaks.
 *
 * Why strict rather than "split on spaces and hope": an `info` record is a flat
 * token stream where several keys (`pv`, `string`, `refutation`) swallow the rest
 * of the line, and `score` is two tokens deep. A loose parser silently turns
 * `score mate 3` into a centipawn number or drops the second half of a PV, and the
 * eval bar lies. Anything this module does not understand comes back as
 * `{ kind: 'unknown' }` so the caller can log it instead of acting on a guess.
 *
 * Everything here is pure and string-in/value-out: it never touches a worker, so
 * it is cheap to test exhaustively against recorded engine output.
 */

/** One `option name … type …` advertisement from the engine's `uci` handshake. */
export interface UciOption {
  readonly name: string
  readonly type: 'check' | 'spin' | 'combo' | 'button' | 'string'
  readonly defaultValue?: string
  readonly min?: number
  readonly max?: number
}

/**
 * One parsed `info` record. Every field is optional because the engine emits
 * partial records constantly (`info depth 7 currmove e2e4 currmovenumber 1`).
 *
 * `pv` stays as plain strings: branding it as `Uci` is validation, which belongs
 * to `buildEngineLine` and the zod schemas, not to the tokenizer.
 */
export interface UciInfo {
  readonly depth?: number
  readonly selDepth?: number
  readonly multipv?: number
  readonly score?: EngineScore
  /** Set when the score is a fail-high/fail-low and so not yet trustworthy. */
  readonly bound?: 'lower' | 'upper'
  readonly nodes?: number
  readonly nps?: number
  readonly hashFull?: number
  readonly tbHits?: number
  readonly timeMs?: number
  readonly wdl?: Wdl
  readonly pv?: readonly string[]
  readonly currMove?: string
  readonly currMoveNumber?: number
}

export type UciMessage =
  | { readonly kind: 'id'; readonly field: 'name' | 'author'; readonly value: string }
  | { readonly kind: 'uciok' }
  | { readonly kind: 'readyok' }
  | { readonly kind: 'option'; readonly option: UciOption }
  | { readonly kind: 'info'; readonly info: UciInfo }
  | { readonly kind: 'info-string'; readonly text: string }
  | {
      readonly kind: 'bestmove'
      /** `null` for `bestmove (none)`, which is how Stockfish reports a finished game. */
      readonly move: string | null
      readonly ponder: string | null
    }
  | { readonly kind: 'unknown'; readonly line: string }

/** Writable mirror of `UciInfo`, so the walker can fill fields one at a time. */
type MutableInfo = { -readonly [K in keyof UciInfo]?: UciInfo[K] }

const UCI_MOVE = /^[a-h][1-8][a-h][1-8][qrbn]?$/

function toInt(token: string | undefined): number | undefined {
  if (token === undefined) return undefined
  if (!/^-?\d+$/.test(token)) return undefined
  return Number.parseInt(token, 10)
}

function toNonNegativeInt(token: string | undefined): number | undefined {
  const value = toInt(token)
  return value === undefined || value < 0 ? undefined : value
}

/**
 * Read `score cp -12 upperbound` / `score mate 3` starting at the token after
 * `score`. Returns how many tokens were consumed so the caller can continue.
 */
function readScore(tokens: readonly string[], start: number): { next: number; info: MutableInfo } {
  const kind = tokens[start]
  const value = toInt(tokens[start + 1])
  if (value === undefined || (kind !== 'cp' && kind !== 'mate')) return { next: start, info: {} }

  const info: MutableInfo = {
    score: kind === 'cp' ? { kind: 'cp', value } : { kind: 'mate', moves: value },
  }
  let next = start + 2
  const bound = tokens[next]
  if (bound === 'lowerbound' || bound === 'upperbound') {
    info.bound = bound === 'lowerbound' ? 'lower' : 'upper'
    next += 1
  }
  return { next, info }
}

/** Read the three permille numbers of `wdl 44 948 8`. */
function readWdl(tokens: readonly string[], start: number): { next: number; wdl?: Wdl } {
  const win = toNonNegativeInt(tokens[start])
  const draw = toNonNegativeInt(tokens[start + 1])
  const loss = toNonNegativeInt(tokens[start + 2])
  if (win === undefined || draw === undefined || loss === undefined) return { next: start }
  return { next: start + 3, wdl: { win, draw, loss } }
}

/**
 * Read a principal variation.
 *
 * Why it stops at the first non-move: `pv` runs to the end of the line in every
 * real engine, but a truncated or interleaved line must not smuggle a keyword
 * such as `string` into the move list.
 */
function readPv(tokens: readonly string[], start: number): { next: number; pv: string[] } {
  const pv: string[] = []
  let next = start
  while (next < tokens.length) {
    const token = tokens[next]
    if (token === undefined || !UCI_MOVE.test(token)) break
    pv.push(token)
    next += 1
  }
  return { next, pv }
}

function parseInfo(tokens: readonly string[]): UciMessage {
  const info: MutableInfo = {}
  let index = 0
  let understood = false

  while (index < tokens.length) {
    const key = tokens[index]
    index += 1
    if (key === undefined) break

    switch (key) {
      case 'string':
        // `info string …` is free text (NNUE banner, warnings) and ends the record.
        return { kind: 'info-string', text: tokens.slice(index).join(' ') }
      case 'depth': {
        const value = toNonNegativeInt(tokens[index])
        if (value !== undefined) {
          info.depth = value
          understood = true
        }
        index += 1
        break
      }
      case 'seldepth': {
        const value = toNonNegativeInt(tokens[index])
        if (value !== undefined) {
          info.selDepth = value
          understood = true
        }
        index += 1
        break
      }
      case 'multipv': {
        const value = toNonNegativeInt(tokens[index])
        if (value !== undefined && value >= 1) {
          info.multipv = value
          understood = true
        }
        index += 1
        break
      }
      case 'score': {
        const read = readScore(tokens, index)
        if (read.info.score !== undefined) {
          info.score = read.info.score
          if (read.info.bound !== undefined) info.bound = read.info.bound
          understood = true
        }
        index = read.next
        break
      }
      case 'wdl': {
        const read = readWdl(tokens, index)
        if (read.wdl !== undefined) {
          info.wdl = read.wdl
          understood = true
        }
        index = read.next
        break
      }
      case 'nodes': {
        const value = toNonNegativeInt(tokens[index])
        if (value !== undefined) {
          info.nodes = value
          understood = true
        }
        index += 1
        break
      }
      case 'nps': {
        const value = toNonNegativeInt(tokens[index])
        if (value !== undefined) {
          info.nps = value
          understood = true
        }
        index += 1
        break
      }
      case 'hashfull': {
        const value = toNonNegativeInt(tokens[index])
        if (value !== undefined) {
          info.hashFull = value
          understood = true
        }
        index += 1
        break
      }
      case 'tbhits': {
        const value = toNonNegativeInt(tokens[index])
        if (value !== undefined) {
          info.tbHits = value
          understood = true
        }
        index += 1
        break
      }
      case 'time': {
        const value = toNonNegativeInt(tokens[index])
        if (value !== undefined) {
          info.timeMs = value
          understood = true
        }
        index += 1
        break
      }
      case 'currmove': {
        const token = tokens[index]
        if (token !== undefined && UCI_MOVE.test(token)) {
          info.currMove = token
          understood = true
        }
        index += 1
        break
      }
      case 'currmovenumber': {
        const value = toNonNegativeInt(tokens[index])
        if (value !== undefined) {
          info.currMoveNumber = value
          understood = true
        }
        index += 1
        break
      }
      case 'pv': {
        const read = readPv(tokens, index)
        if (read.pv.length > 0) {
          info.pv = read.pv
          understood = true
        }
        index = read.next
        break
      }
      default:
        // `refutation`, `currline` and anything a future build adds: skip the key
        // and let the loop resynchronise on the next keyword it knows.
        break
    }
  }

  if (!understood) return { kind: 'unknown', line: `info ${tokens.join(' ')}` }
  return { kind: 'info', info }
}

function parseOption(tokens: readonly string[]): UciMessage {
  const line = `option ${tokens.join(' ')}`
  if (tokens[0] !== 'name') return { kind: 'unknown', line }

  const typeIndex = tokens.indexOf('type')
  if (typeIndex < 2) return { kind: 'unknown', line }
  const name = tokens.slice(1, typeIndex).join(' ')
  const type = tokens[typeIndex + 1]
  if (
    name === '' ||
    (type !== 'check' &&
      type !== 'spin' &&
      type !== 'combo' &&
      type !== 'button' &&
      type !== 'string')
  ) {
    return { kind: 'unknown', line }
  }

  const option: { -readonly [K in keyof UciOption]?: UciOption[K] } = { name, type }
  for (let index = typeIndex + 2; index < tokens.length; index += 1) {
    const key = tokens[index]
    const value = tokens[index + 1]
    if (key === 'default' && value !== undefined) {
      option.defaultValue = value
    } else if (key === 'min' || key === 'max') {
      const bound = toInt(value)
      if (bound !== undefined) {
        if (key === 'min') option.min = bound
        else option.max = bound
      }
    }
  }
  return { kind: 'option', option: { ...option, name, type } }
}

function parseBestMove(tokens: readonly string[]): UciMessage {
  const first = tokens[0]
  if (first === undefined) return { kind: 'unknown', line: 'bestmove' }
  const move = UCI_MOVE.test(first) ? first : null
  if (move === null && first !== '(none)' && first !== '0000') {
    return { kind: 'unknown', line: `bestmove ${tokens.join(' ')}` }
  }
  const ponderToken = tokens[1] === 'ponder' ? tokens[2] : undefined
  const ponder = ponderToken !== undefined && UCI_MOVE.test(ponderToken) ? ponderToken : null
  return { kind: 'bestmove', move, ponder }
}

/**
 * Parse one line of engine output.
 *
 * Blank lines and banners come back as `unknown`; nothing throws, because a
 * worker that dies on an unexpected line is worse than one that ignores it.
 */
export function parseUciLine(line: string): UciMessage {
  const trimmed = line.trim()
  if (trimmed === '') return { kind: 'unknown', line }
  const tokens = trimmed.split(/\s+/)
  const head = tokens[0]
  const rest = tokens.slice(1)

  switch (head) {
    case 'info':
      return parseInfo(rest)
    case 'bestmove':
      return parseBestMove(rest)
    case 'uciok':
      return { kind: 'uciok' }
    case 'readyok':
      return { kind: 'readyok' }
    case 'option':
      return parseOption(rest)
    case 'id': {
      const field = rest[0]
      const value = rest.slice(1).join(' ')
      if ((field === 'name' || field === 'author') && value !== '') {
        return { kind: 'id', field, value }
      }
      return { kind: 'unknown', line }
    }
    default:
      return { kind: 'unknown', line }
  }
}
