import { describe, expect, expectTypeOf, it } from 'vitest'

import {
  ClockTimeSchema,
  EcoCodeSchema,
  FenSchema,
  LocalDateSchema,
  PercentSchema,
  RatingSchema,
  SanSchema,
  SquareSchema,
  START_FEN,
  TimestampSchema,
  UciSchema,
  isStructurallyValidFen,
  localDateOf,
  now,
  timestampFromDate,
  timestampToDate,
  toFen,
  toLocalDate,
  toSan,
  toSquare,
  toTimestamp,
  toUci,
  type Fen,
  type San,
  type Timestamp,
  type Uci,
} from './primitives'

describe('Fen', () => {
  const valid = [
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    '5r2/p4rk1/1p1p1qpp/3Qb3/2P1N3/6P1/PP2RPKP/R7 b - - 6 21',
    'rnbqkbnr/pp2pppp/2p5/3pP3/8/8/PPPP1PPP/RNBQKBNR b KQkq d6 0 3',
  ]

  it.each(valid)('accepts %s', (fen) => {
    expect(toFen(fen)).toBe(fen)
  })

  const invalid: readonly (readonly [string, string])[] = [
    ['too few ranks', 'rnbqkbnr/pppppppp/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'],
    [
      'a rank that does not add to eight',
      'rnbqkbnr/ppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    ],
    ['no black king', 'rnbq1bnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'],
    ['two white kings', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBKR w KQkq - 0 1'],
    ['a bad side to move', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR x KQkq - 0 1'],
    ['nonsense castling', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w XY - 0 1'],
    [
      'an impossible en passant square',
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq e4 0 1',
    ],
    ['a missing field', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0'],
    ['an empty string', ''],
  ]

  it.each(invalid)('rejects %s', (_reason, fen) => {
    expect(isStructurallyValidFen(fen)).toBe(false)
    expect(FenSchema.safeParse(fen).success).toBe(false)
  })

  it('names the field when it fails inside an object', () => {
    const result = FenSchema.safeParse('nope')
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Not a well-formed six-field FEN')
  })

  it('exposes the start position as a ready-made Fen', () => {
    expect(START_FEN).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
  })
})

describe('San', () => {
  const valid = ['e4', 'Nf3', 'Nbd2', 'exd5', 'Qxb7+', 'O-O', 'O-O-O#', 'e8=Q', 'cxb8=Q+', 'R1e2']

  it.each(valid)('accepts %s', (san) => {
    expect(toSan(san)).toBe(san)
  })

  const invalid = ['e9', 'Xf3', '', 'e4!!', 'O-O-O-O', 'Nf3??', 'ee4']

  it.each(invalid)('rejects %s', (san) => {
    expect(SanSchema.safeParse(san).success).toBe(false)
  })
})

describe('Uci', () => {
  it.each(['e2e4', 'g7g8q', 'a1h8'])('accepts %s', (uci) => {
    expect(toUci(uci)).toBe(uci)
  })

  it.each(['e2e9', 'e2e4k', 'Nf3', '', 'e2e'])('rejects %s', (uci) => {
    expect(UciSchema.safeParse(uci).success).toBe(false)
  })
})

describe('Square', () => {
  it('accepts a board square', () => {
    expect(toSquare('e4')).toBe('e4')
  })

  it.each(['e9', 'i4', 'e', ''])('rejects %s', (square) => {
    expect(SquareSchema.safeParse(square).success).toBe(false)
  })
})

describe('Timestamp', () => {
  it('round-trips epoch milliseconds', () => {
    expect(toTimestamp(1_789_819_200_000)).toBe(1_789_819_200_000)
  })

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects %s', (value) => {
    expect(TimestampSchema.safeParse(value).success).toBe(false)
  })

  it('converts to and from Date without drift', () => {
    const date = new Date('2026-09-19T12:00:00Z')
    const stamp = timestampFromDate(date)
    expect(timestampToDate(stamp).toISOString()).toBe('2026-09-19T12:00:00.000Z')
  })

  it('reads the clock through one function', () => {
    expect(now()).toBeGreaterThan(0)
  })
})

describe('LocalDate', () => {
  it('accepts a calendar day', () => {
    expect(toLocalDate('2026-09-19')).toBe('2026-09-19')
  })

  it.each(['2026-13-19', '19-09-2026', '2026-09-19T00:00:00Z', ''])('rejects %s', (value) => {
    expect(LocalDateSchema.safeParse(value).success).toBe(false)
  })

  it('answers "which day is it there" rather than "which day is it here"', () => {
    // 2026-09-19T23:30Z is already the 20th in Tokyo and still the 19th in Los Angeles.
    const instant = toTimestamp(Date.parse('2026-09-19T23:30:00Z'))
    expect(localDateOf(instant, 'Asia/Tokyo')).toBe('2026-09-20')
    expect(localDateOf(instant, 'America/Los_Angeles')).toBe('2026-09-19')
  })
})

describe('bounded numbers', () => {
  it('bounds a rating', () => {
    expect(RatingSchema.parse(1482)).toBe(1482)
    expect(RatingSchema.safeParse(-1).success).toBe(false)
    expect(RatingSchema.safeParse(4001).success).toBe(false)
    expect(RatingSchema.safeParse(1482.5).success).toBe(false)
  })

  it('bounds a percentage', () => {
    expect(PercentSchema.parse(78.6)).toBe(78.6)
    expect(PercentSchema.safeParse(101).success).toBe(false)
  })

  it('checks an ECO code', () => {
    expect(EcoCodeSchema.parse('C54')).toBe('C54')
    expect(EcoCodeSchema.safeParse('F54').success).toBe(false)
    expect(EcoCodeSchema.safeParse('C5').success).toBe(false)
  })

  it('checks a reminder time', () => {
    expect(ClockTimeSchema.parse('20:00')).toBe('20:00')
    expect(ClockTimeSchema.safeParse('24:00').success).toBe(false)
    expect(ClockTimeSchema.safeParse('8:00').success).toBe(false)
  })
})

describe('primitive brands', () => {
  it('keeps the four look-alike chess strings apart', () => {
    expectTypeOf<Fen>().not.toExtend<San>()
    expectTypeOf<San>().not.toExtend<Uci>()
    expectTypeOf<Uci>().not.toExtend<San>()
    expectTypeOf<string>().not.toExtend<Fen>()
  })

  it('keeps a timestamp apart from a bare number', () => {
    expectTypeOf<number>().not.toExtend<Timestamp>()
    expectTypeOf<Timestamp>().toExtend<number>()
  })
})
