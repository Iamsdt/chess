import { describe, expect, it } from 'vitest'

import { START_FEN, toGameId } from '@/domain'

import {
  mainLine,
  parsePgn,
  parsePgnGame,
  serializePgn,
  splitPgnGames,
  toMoveRecords,
  type PgnGame,
} from './pgn'

const SIMPLE = `[Event "Casual game"]
[Site "?"]
[Date "2024.01.02"]
[Round "-"]
[White "Alice"]
[Black "Bob"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Bxc6 dxc6 1-0
`

const ANNOTATED = `[Event "Annotated"]
[White "Annotator"]
[Black "Reader"]
[Result "*"]

{A short introduction.} 1. e4 {The most popular first move.} e5 $1 2. Nf3?!
(2. Bc4 Nf6 {The Bishop's Opening by transposition.}) 2... Nc6 3. Bb5 *
`

function parse(text: string): PgnGame {
  const parsed = parsePgnGame(text)
  if (!parsed.ok) throw new Error(`fixture PGN did not parse: ${parsed.error.message}`)
  return parsed.value
}

describe('splitPgnGames', () => {
  it('splits on the header block that follows movetext', () => {
    expect(splitPgnGames(`${SIMPLE}\n${SIMPLE}`)).toHaveLength(2)
  })

  it('leaves a blank line inside a movetext alone', () => {
    const wrapped = SIMPLE.replace('3. Bb5', '\n3. Bb5')
    expect(splitPgnGames(wrapped)).toHaveLength(1)
  })

  it('accepts a game with no headers at all', () => {
    expect(splitPgnGames('1. e4 e5 2. Nf3 *')).toHaveLength(1)
  })
})

describe('parsePgnGame', () => {
  it('reads the headers and the main line', () => {
    const game = parse(SIMPLE)
    expect(game.headers.White).toBe('Alice')
    expect(game.headers.Date).toBe('2024.01.02')
    expect(game.result).toBe('1-0')
    expect(game.initialFen).toBe(START_FEN)
    expect(mainLine(game).map((move) => move.san)).toEqual([
      'e4',
      'e5',
      'Nf3',
      'Nc6',
      'Bb5',
      'a6',
      'Bxc6',
      'dxc6',
    ])
  })

  it('gives every move the position it was played from and the one it produced', () => {
    const game = parse(SIMPLE)
    const first = game.moves[0]?.move
    expect(first?.fenBefore).toBe(START_FEN)
    expect(first?.uci).toBe('e2e4')
    expect(game.moves[1]?.move.fenBefore).toBe(first?.fenAfter)
  })

  it('keeps comments, glyphs and the suffix shorthand', () => {
    const game = parse(ANNOTATED)
    expect(game.comment).toBe('A short introduction.')
    expect(game.moves[0]?.comment).toBe('The most popular first move.')
    expect(game.moves[1]?.nags).toEqual([1])
    // `?!` is the same thing as `$6`.
    expect(game.moves[2]?.nags).toEqual([6])
  })

  it('keeps a variation, and starts it from the position before the move it replaces', () => {
    const game = parse(ANNOTATED)
    const nf3 = game.moves[2]
    expect(nf3?.move.san).toBe('Nf3')
    expect(nf3?.variations).toHaveLength(1)
    const variation = nf3?.variations[0]
    expect(variation?.map((node) => node.move.san)).toEqual(['Bc4', 'Nf6'])
    expect(variation?.[0]?.move.fenBefore).toBe(nf3?.move.fenBefore)
    expect(variation?.[1]?.comment).toBe("The Bishop's Opening by transposition.")
  })

  it('reads nested variations', () => {
    const game = parse('1. e4 e5 2. Nf3 (2. f4 exf4 (2... Bc5 3. Nf3) 3. Nf3) 2... Nc6 *')
    const nf3 = game.moves[2]
    const inner = nf3?.variations[0]?.[1]?.variations[0]
    expect(inner?.map((node) => node.move.san)).toEqual(['Bc5', 'Nf3'])
  })

  it('starts from the FEN header when there is one', () => {
    const game = parse(`[FEN "8/P6k/8/8/8/8/7K/8 w - - 0 1"]
[SetUp "1"]
[Result "*"]

1. a8=Q Kg6 *
`)
    expect(game.initialFen).toBe('8/P6k/8/8/8/8/7K/8 w - - 0 1')
    expect(game.moves[0]?.move.promotion).toBe('q')
  })

  it('reads a semicolon comment to the end of the line', () => {
    const game = parse('1. e4 ; a rest-of-line comment\ne5 *')
    expect(game.moves[0]?.comment).toBe('a rest-of-line comment')
    expect(game.moves).toHaveLength(2)
  })

  it('ignores a line escaped with a percent sign', () => {
    const game = parse('%this line is not chess\n1. e4 e5 *')
    expect(mainLine(game)).toHaveLength(2)
  })

  it('unescapes a quoted header value', () => {
    const game = parse('[Event "The \\"Big\\" Open"]\n[Result "*"]\n\n1. e4 *')
    expect(game.headers.Event).toBe('The "Big" Open')
  })

  it('falls back to the Result header when the movetext has no result token', () => {
    const game = parse('[Result "0-1"]\n\n1. e4 e5')
    expect(game.result).toBe('0-1')
  })

  it.each([
    ['an illegal move', '1. e4 e4 *'],
    ['an unclosed comment', '1. e4 {never closed *'],
    ['an unopened variation', '1. e4 e5) *'],
    ['an unclosed variation', '1. e4 (1. d4 *'],
    ['an illegal FEN header', '[FEN "not a fen"]\n\n1. e4 *'],
  ])('reports %s as an error value, not an exception', (_name, text) => {
    const parsed = parsePgnGame(text)
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.error.code).toBe('validation')
  })

  it('names the move that could not be played', () => {
    // The rook on h8 cannot reach h4 through its own pawn.
    const parsed = parsePgnGame('1. e4 e5 2. Nf3 Rh4 *')
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.error.message).toContain('Rh4')
    expect(parsed.error.message).toContain('half-move 4')
  })
})

describe('parsePgn', () => {
  it('reads a file of several games', () => {
    const parsed = parsePgn(`${SIMPLE}\n${ANNOTATED}`)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value).toHaveLength(2)
    expect(parsed.value[1]?.headers.Event).toBe('Annotated')
  })

  it('fails the whole file and says which game broke', () => {
    const parsed = parsePgn(`${SIMPLE}\n[Event "Broken"]\n\n1. e4 e4 *`)
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.error.message).toContain('Game 2')
  })

  it('refuses an empty file', () => {
    expect(parsePgn('   \n\n').ok).toBe(false)
  })
})

describe('serializePgn', () => {
  it('round-trips a plain game', () => {
    const original = parse(SIMPLE)
    const again = parse(serializePgn(original))
    expect(again.result).toBe(original.result)
    expect(mainLine(again).map((move) => move.san)).toEqual(
      mainLine(original).map((move) => move.san),
    )
    expect(again.headers.White).toBe('Alice')
  })

  it('round-trips comments, glyphs and variations', () => {
    const original = parse(ANNOTATED)
    const again = parse(serializePgn(original))
    expect(again.comment).toBe(original.comment)
    expect(again.moves[0]?.comment).toBe(original.moves[0]?.comment)
    expect(again.moves[1]?.nags).toEqual(original.moves[1]?.nags)
    expect(again.moves[2]?.variations[0]?.map((node) => node.move.san)).toEqual(['Bc4', 'Nf6'])
  })

  it('reprints the move number for a Black move that follows an annotation', () => {
    const text = serializePgn(parse(ANNOTATED))
    expect(text).toContain('2... Nc6')
  })

  it('writes the FEN and SetUp headers for a non-standard start', () => {
    const game = parse(`[FEN "8/P6k/8/8/8/8/7K/8 w - - 0 1"]\n[Result "*"]\n\n1. a8=Q *`)
    const text = serializePgn(game)
    expect(text).toContain('[SetUp "1"]')
    expect(text).toContain('[FEN "8/P6k/8/8/8/8/7K/8 w - - 0 1"]')
    expect(parse(text).initialFen).toBe(game.initialFen)
  })

  it('escapes a quote in a header value so the file can be read back', () => {
    const game = parse('[Event "The \\"Big\\" Open"]\n[Result "*"]\n\n1. e4 *')
    expect(parse(serializePgn(game)).headers.Event).toBe('The "Big" Open')
  })

  it('wraps the movetext at the requested column', () => {
    const long = parse(SIMPLE)
    for (const line of serializePgn(long, { maxWidth: 40 }).split('\n')) {
      if (line.startsWith('[')) continue
      expect(line.length).toBeLessThanOrEqual(40)
    }
  })

  it('is stable: serializing twice changes nothing', () => {
    const once = serializePgn(parse(ANNOTATED))
    const twice = serializePgn(parse(once))
    expect(twice).toBe(once)
  })
})

describe('toMoveRecords', () => {
  it('produces one storable row per main-line move', () => {
    const records = toMoveRecords(parse(SIMPLE), toGameId('01J0000000000000000000000A'))
    expect(records).toHaveLength(8)
    const capture = records[6]
    expect(capture?.san).toBe('Bxc6')
    expect(capture?.ply).toBe(6)
    expect(capture?.color).toBe('white')
    expect(capture?.captured).toBe('n')
    expect(capture?.isBook).toBe(false)
  })

  it('leaves the analysis fields unset, because the game has not been reviewed', () => {
    const records = toMoveRecords(parse(SIMPLE), toGameId('01J0000000000000000000000A'))
    expect(records[0]?.quality).toBeUndefined()
    expect(records[0]?.evalBefore).toBeUndefined()
  })

  it('carries a comment and the first glyph across', () => {
    const records = toMoveRecords(parse(ANNOTATED), toGameId('01J0000000000000000000000A'))
    expect(records[0]?.comment).toBe('The most popular first move.')
    expect(records[1]?.nag).toBe(1)
  })
})
