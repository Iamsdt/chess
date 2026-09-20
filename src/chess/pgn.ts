import {
  domainError,
  err,
  ok,
  START_FEN,
  type Fen,
  type GameId,
  type GameResult,
  type MoveRecord,
  type Result,
} from '@/domain'

import { validateFen } from './fen'
import { applyMove, createGame, type ChessGame, type PlayedMove } from './game'

/**
 * Reading and writing PGN, including the parts chess.js drops on the floor.
 *
 * Why this is not `chess.js`'s `loadPgn`. chess.js parses a PGN by *playing* it, so what
 * survives is one line of moves; variations are discarded, and an annotated game loses
 * everything that made it worth annotating. Openings (S17), lessons (S16) and the analysis
 * board (S19) are all about the branches, so this module keeps the movetext as a tree.
 *
 * Everything here is a `Result`. A PGN is the most hostile input this app accepts — it is
 * hand-typed, pasted out of forums, exported by six programs that each read the standard
 * differently — and a malformed one is a message to the user, never an exception.
 *
 * What is supported: the seven-tag roster and any other headers, `FEN`/`SetUp` starting
 * positions, brace and semicolon comments, numeric annotation glyphs, the `!?` suffix
 * shorthand, recursive variations to any depth, multiple games in one file, and the `%`
 * line-escape. What is not: PGN's `<>` reserved tokens, which are skipped, and the
 * pathological case of a comment containing an unbalanced brace, which the standard
 * forbids.
 */

/** The standard glyphs, and the suffixes people actually type instead of them. */
const SUFFIX_NAGS: Readonly<Record<string, number>> = {
  '!': 1,
  '?': 2,
  '!!': 3,
  '??': 4,
  '!?': 5,
  '?!': 6,
}

const RESULTS: Readonly<Record<string, GameResult | undefined>> = {
  '1-0': '1-0',
  '0-1': '0-1',
  '1/2-1/2': '1/2-1/2',
  '*': '*',
}

/** One move in the tree: what was played, what was said about it, and what else was tried. */
export interface PgnMoveNode {
  readonly move: PlayedMove
  /** Numeric annotation glyphs, in the order they appeared. `$1` is `!`, `$4` is `??`. */
  readonly nags: readonly number[]
  /** The comment that followed the move, with the braces removed and whitespace collapsed. */
  readonly comment?: string
  /** Alternatives to *this* move, each a line starting from the position before it. */
  readonly variations: readonly (readonly PgnMoveNode[])[]
}

export interface PgnGame {
  readonly headers: Readonly<Record<string, string>>
  /** From the `FEN` header when there is one, otherwise the standard array. */
  readonly initialFen: Fen
  /** The main line. Alternatives hang off the move they replace. */
  readonly moves: readonly PgnMoveNode[]
  readonly result: GameResult
  /** A comment before the first move — where annotators put the game's introduction. */
  readonly comment?: string
}

type Token =
  | { readonly kind: 'move'; readonly value: string }
  | { readonly kind: 'nag'; readonly value: number }
  | { readonly kind: 'comment'; readonly value: string }
  | { readonly kind: 'variation-start' }
  | { readonly kind: 'variation-end' }
  | { readonly kind: 'result'; readonly value: GameResult }

const WORD_END = new Set([' ', '\t', '\r', '\n', '{', '}', '(', ')', ';', '$', '<', '>'])

const HEADER_LINE = /^\[\s*([A-Za-z0-9_]+)\s+"((?:[^"\\]|\\.)*)"\s*\]\s*$/

/**
 * Split a file into one chunk per game.
 *
 * The rule the standard implies and every real file follows: a header line that arrives
 * after movetext starts a new game. Blank lines alone are not enough — plenty of exporters
 * put one in the middle of a long movetext.
 */
export function splitPgnGames(text: string): string[] {
  const games: string[] = []
  let current: string[] = []
  let seenMovetext = false
  for (const line of text.split(/\r?\n/)) {
    const isHeader = HEADER_LINE.test(line.trim())
    if (isHeader && seenMovetext) {
      games.push(current.join('\n'))
      current = []
      seenMovetext = false
    }
    if (!isHeader && line.trim() !== '' && !line.startsWith('%')) seenMovetext = true
    current.push(line)
  }
  if (current.join('').trim() !== '') games.push(current.join('\n'))
  return games.filter((game) => game.trim() !== '')
}

function unescapeHeaderValue(value: string): string {
  return value.replace(/\\(["\\])/g, '$1')
}

function parseHeaders(chunk: string): { headers: Record<string, string>; movetext: string } {
  const headers: Record<string, string> = {}
  const rest: string[] = []
  let inHeaders = true
  for (const line of chunk.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (inHeaders && trimmed === '') continue
    const match = inHeaders ? HEADER_LINE.exec(trimmed) : null
    if (match !== null) {
      const key = match[1]
      const value = match[2]
      if (key !== undefined && value !== undefined) headers[key] = unescapeHeaderValue(value)
      continue
    }
    inHeaders = false
    rest.push(line)
  }
  return { headers, movetext: rest.join('\n') }
}

function tokenize(movetext: string): Result<Token[]> {
  const tokens: Token[] = []
  let index = 0
  let atLineStart = true

  while (index < movetext.length) {
    const char = movetext[index] ?? ''

    if (char === '\n') {
      index += 1
      atLineStart = true
      continue
    }
    if (char === ' ' || char === '\t' || char === '\r') {
      index += 1
      continue
    }
    // PGN's escape mechanism: a `%` in column 1 comments out the rest of the line.
    if (char === '%' && atLineStart) {
      const end = movetext.indexOf('\n', index)
      index = end < 0 ? movetext.length : end
      continue
    }
    atLineStart = false

    if (char === '{') {
      const end = movetext.indexOf('}', index)
      if (end < 0) {
        return err(
          domainError('validation', 'A comment was opened with { and never closed', {
            where: 'PGN movetext',
          }),
        )
      }
      tokens.push({ kind: 'comment', value: movetext.slice(index + 1, end).trim() })
      index = end + 1
      continue
    }
    if (char === ';') {
      const end = movetext.indexOf('\n', index)
      const stop = end < 0 ? movetext.length : end
      tokens.push({ kind: 'comment', value: movetext.slice(index + 1, stop).trim() })
      index = stop
      continue
    }
    if (char === '<') {
      // Reserved for future expansion by the standard; skip it rather than guess.
      const end = movetext.indexOf('>', index)
      index = end < 0 ? movetext.length : end + 1
      continue
    }
    if (char === '(') {
      tokens.push({ kind: 'variation-start' })
      index += 1
      continue
    }
    if (char === ')') {
      tokens.push({ kind: 'variation-end' })
      index += 1
      continue
    }
    if (char === '$') {
      let end = index + 1
      while (end < movetext.length && /[0-9]/.test(movetext[end] ?? '')) end += 1
      const value = Number(movetext.slice(index + 1, end))
      if (Number.isFinite(value) && end > index + 1) tokens.push({ kind: 'nag', value })
      index = end
      continue
    }

    let end = index
    while (end < movetext.length && !WORD_END.has(movetext[end] ?? '')) end += 1
    const word = movetext.slice(index, end)
    index = end
    if (word === '') {
      index += 1
      continue
    }

    const result = RESULTS[word]
    if (result !== undefined) {
      tokens.push({ kind: 'result', value: result })
      continue
    }
    // `12.`, `12...` and `...` are move numbers; the move may be glued to them.
    const stripped = word.replace(/^\d*\.+/, '')
    if (stripped === '') continue

    const suffix = /[!?]+$/.exec(stripped)
    const san = suffix === null ? stripped : stripped.slice(0, suffix.index)
    if (san !== '') tokens.push({ kind: 'move', value: san })
    if (suffix !== null) {
      const nag = SUFFIX_NAGS[suffix[0]]
      if (nag !== undefined) tokens.push({ kind: 'nag', value: nag })
    }
  }
  return ok(tokens)
}

/** A line being built: the moves so far, and the position each of them was reached from. */
interface Frame {
  readonly nodes: MutableNode[]
  /** `positions[i]` is the game *after* `nodes[i]`; `base` is the one before `nodes[0]`. */
  readonly positions: ChessGame[]
  readonly base: ChessGame
}

interface MutableNode {
  readonly move: PlayedMove
  nags: number[]
  comment?: string
  variations: MutableNode[][]
}

function freeze(nodes: readonly MutableNode[]): PgnMoveNode[] {
  return nodes.map((node) => ({
    move: node.move,
    nags: node.nags,
    ...(node.comment === undefined ? {} : { comment: node.comment }),
    variations: node.variations.map(freeze),
  }))
}

function appendComment(existing: string | undefined, addition: string): string {
  if (addition === '') return existing ?? ''
  return existing === undefined || existing === '' ? addition : `${existing} ${addition}`
}

/** Parse exactly one game. Use `parsePgn` for a file that may hold several. */
export function parsePgnGame(text: string): Result<PgnGame> {
  const { headers, movetext } = parseHeaders(text)

  const fenHeader = headers.FEN
  const initial = fenHeader === undefined ? ok(START_FEN) : validateFen(fenHeader)
  if (!initial.ok) {
    return err(
      domainError(
        'validation',
        `The FEN header is not a legal position: ${initial.error.message}`,
        {
          where: 'PGN header',
        },
      ),
    )
  }

  const start = createGame(initial.value)
  if (!start.ok) return start

  const tokens = tokenize(movetext)
  if (!tokens.ok) return tokens

  const root: Frame = { nodes: [], positions: [], base: start.value }
  const stack: Frame[] = [root]
  let gameComment: string | undefined
  let result: GameResult = '*'

  for (const token of tokens.value) {
    const frame = stack[stack.length - 1]
    if (frame === undefined) break
    const last = frame.nodes[frame.nodes.length - 1]

    switch (token.kind) {
      case 'move': {
        const from = frame.positions[frame.positions.length - 1] ?? frame.base
        const played = applyMove(from, token.value)
        if (!played.ok) {
          return err(
            domainError(
              'validation',
              `"${token.value}" is not a legal move at half-move ${String(from.ply + 1)}`,
              { where: 'PGN movetext', cause: played.error },
            ),
          )
        }
        const move = played.value.history[played.value.history.length - 1]
        if (move === undefined) break
        frame.nodes.push({ move, nags: [], variations: [] })
        frame.positions.push(played.value)
        break
      }
      case 'nag': {
        if (last !== undefined) last.nags.push(token.value)
        break
      }
      case 'comment': {
        if (last === undefined) {
          if (stack.length === 1) gameComment = appendComment(gameComment, token.value)
        } else {
          last.comment = appendComment(last.comment, token.value)
        }
        break
      }
      case 'variation-start': {
        // A variation replaces the move just played, so it starts one position earlier.
        const base = frame.positions[frame.positions.length - 2] ?? frame.base
        stack.push({ nodes: [], positions: [], base })
        break
      }
      case 'variation-end': {
        const finished = stack.pop()
        const parent = stack[stack.length - 1]
        if (finished === undefined || parent === undefined) {
          return err(
            domainError('validation', 'A variation was closed with ) but never opened', {
              where: 'PGN movetext',
            }),
          )
        }
        const owner = parent.nodes[parent.nodes.length - 1]
        if (owner === undefined) {
          return err(
            domainError('validation', 'A variation appeared before any move to vary from', {
              where: 'PGN movetext',
            }),
          )
        }
        owner.variations.push(finished.nodes)
        break
      }
      case 'result': {
        result = token.value
        break
      }
    }
  }

  if (stack.length !== 1) {
    return err(
      domainError('validation', 'A variation was opened with ( and never closed', {
        where: 'PGN movetext',
      }),
    )
  }

  const headerResult = RESULTS[headers.Result ?? '']
  return ok({
    headers,
    initialFen: initial.value,
    moves: freeze(root.nodes),
    result: result === '*' ? (headerResult ?? '*') : result,
    ...(gameComment === undefined || gameComment === '' ? {} : { comment: gameComment }),
  })
}

/**
 * Parse a file of games.
 *
 * All or nothing: one broken game fails the import. A library that silently swallowed
 * game 40 of 200 would be worse than one that said which game it could not read — and the
 * error names the game and the half-move.
 */
export function parsePgn(text: string): Result<PgnGame[]> {
  const chunks = splitPgnGames(text)
  if (chunks.length === 0) {
    return err(domainError('validation', 'There are no games in this PGN', { where: 'PGN' }))
  }
  const games: PgnGame[] = []
  for (const [index, chunk] of chunks.entries()) {
    const parsed = parsePgnGame(chunk)
    if (!parsed.ok) {
      return err(
        domainError('validation', `Game ${String(index + 1)}: ${parsed.error.message}`, {
          where: parsed.error.where ?? 'PGN',
          cause: parsed.error,
        }),
      )
    }
    games.push(parsed.value)
  }
  return ok(games)
}

/** The order the standard requires the mandatory tags to appear in. */
const SEVEN_TAG_ROSTER = ['Event', 'Site', 'Date', 'Round', 'White', 'Black', 'Result'] as const

export interface SerializeOptions {
  /** Wrap the movetext at this column. The standard suggests 80; 0 means never wrap. */
  readonly maxWidth?: number
  readonly newline?: string
}

function escapeHeaderValue(value: string): string {
  return value.replace(/([\\"])/g, '\\$1')
}

function writeHeaders(game: PgnGame, newline: string): string {
  const headers: Record<string, string> = { ...game.headers, Result: game.result }
  if (game.initialFen !== START_FEN) {
    headers.SetUp = '1'
    headers.FEN = game.initialFen
  }
  const written = new Set<string>()
  const lines: string[] = []
  const push = (key: string): void => {
    const value = headers[key]
    if (value === undefined || written.has(key)) return
    written.add(key)
    lines.push(`[${key} "${escapeHeaderValue(value)}"]`)
  }
  for (const key of SEVEN_TAG_ROSTER) push(key)
  for (const key of Object.keys(headers).sort()) push(key)
  return lines.join(newline)
}

function writeMoveNumber(move: PlayedMove, forceBlack: boolean): string {
  if (move.color === 'white') return `${String(move.moveNumber)}.`
  return forceBlack ? `${String(move.moveNumber)}...` : ''
}

function writeLine(nodes: readonly PgnMoveNode[], words: string[], startForced: boolean): void {
  let forceNumber = startForced
  for (const node of nodes) {
    const number = writeMoveNumber(node.move, forceNumber)
    words.push(number === '' ? node.move.san : `${number} ${node.move.san}`)
    for (const nag of node.nags) words.push(`$${String(nag)}`)
    if (node.comment !== undefined && node.comment !== '') words.push(`{${node.comment}}`)
    for (const variation of node.variations) {
      const inner: string[] = []
      writeLine(variation, inner, true)
      words.push(`(${inner.join(' ')})`)
    }
    // After anything but a plain move, Black's move must reprint its number.
    forceNumber =
      node.nags.length > 0 ||
      (node.comment !== undefined && node.comment !== '') ||
      node.variations.length > 0
  }
}

function wrap(words: readonly string[], maxWidth: number, newline: string): string {
  if (maxWidth <= 0) return words.join(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    if (line === '') line = word
    else if (line.length + 1 + word.length <= maxWidth) line = `${line} ${word}`
    else {
      lines.push(line)
      line = word
    }
  }
  if (line !== '') lines.push(line)
  return lines.join(newline)
}

/**
 * Write a game back out as PGN.
 *
 * Round-trips: `parsePgnGame(serializePgn(g))` returns a game equal to `g`, which is what
 * makes export-then-reimport safe and what the tests assert on real annotated games.
 */
export function serializePgn(game: PgnGame, options: SerializeOptions = {}): string {
  const newline = options.newline ?? '\n'
  const maxWidth = options.maxWidth ?? 80
  const words: string[] = []
  if (game.comment !== undefined && game.comment !== '') words.push(`{${game.comment}}`)
  writeLine(game.moves, words, false)
  words.push(game.result)
  return `${writeHeaders(game, newline)}${newline}${newline}${wrap(words, maxWidth, newline)}${newline}`
}

/** Why: a file of games is one string, and joining them by hand drops the blank line. */
export function serializePgnGames(
  games: readonly PgnGame[],
  options: SerializeOptions = {},
): string {
  const newline = options.newline ?? '\n'
  return games.map((game) => serializePgn(game, options)).join(newline)
}

/** Flatten the main line, discarding the branches. What "play through this game" needs. */
export function mainLine(game: PgnGame): readonly PlayedMove[] {
  return game.moves.map((node) => node.move)
}

/**
 * Turn a parsed main line into the rows S05 stores and S13 reviews.
 *
 * The analysis fields are left unset on purpose: a game exists long before it is analysed,
 * and filling them with zeroes would make an unreviewed game look reviewed.
 */
export function toMoveRecords(game: PgnGame, gameId: GameId): MoveRecord[] {
  return game.moves.map((node) => {
    const move = node.move
    const comment = node.comment
    const nag = node.nags[0]
    return {
      gameId,
      ply: move.ply,
      moveNumber: move.moveNumber,
      color: move.color,
      san: move.san,
      uci: move.uci,
      fenBefore: move.fenBefore,
      fenAfter: move.fenAfter,
      ...(move.captured === undefined ? {} : { captured: move.captured }),
      ...(move.promotion === undefined ? {} : { promotion: move.promotion }),
      isCheck: move.isCheck,
      isCheckmate: move.isCheckmate,
      wasTakenBack: false,
      isBook: false,
      ...(nag === undefined ? {} : { nag }),
      ...(comment === undefined || comment === '' ? {} : { comment }),
    }
  })
}
