import { describe, expect, it } from 'vitest'

import { START_FEN, toFen } from '@/domain'

import {
  formatFen,
  fullmoveNumberOf,
  halfmoveClockOf,
  normalizeFen,
  parseFen,
  sideToMoveOf,
  validateFen,
  withCounters,
} from './fen'

const KIWIPETE = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1'

describe('parseFen', () => {
  it('takes the starting position apart', () => {
    const parsed = parseFen(START_FEN)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value).toEqual({
      placement: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
      sideToMove: 'white',
      castling: 'KQkq',
      enPassant: null,
      halfmoveClock: 0,
      fullmoveNumber: 1,
    })
  })

  it('reads the side to move in this app’s vocabulary, never chess.js’s', () => {
    const parsed = parseFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1')
    expect(parsed.ok && parsed.value.sideToMove).toBe('black')
  })

  it('keeps the en-passant square as a branded square', () => {
    const parsed = parseFen('rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2')
    expect(parsed.ok && parsed.value.enPassant).toBe('c6')
  })

  it('tolerates runs of whitespace, because pasted FENs have them', () => {
    const parsed = parseFen('  rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR   w  KQkq -  0 1 ')
    expect(parsed.ok).toBe(true)
  })

  it.each([
    ['too few fields', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -'],
    ['seven ranks', 'rnbqkbnr/pppppppp/8/8/8/8/RNBQKBNR w KQkq - 0 1'],
    ['a rank that is not eight files', 'rnbqkbnr/ppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'],
    ['no black king', 'rnbq1bnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'],
    ['a nonsense side to move', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR x KQkq - 0 1'],
  ])('rejects %s as a value, not an exception', (_name, fen) => {
    const parsed = parseFen(fen)
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.error.code).toBe('validation')
    expect(parsed.error.where).toBe('FEN')
  })
})

describe('validateFen', () => {
  it('accepts positions the structural schema alone would pass', () => {
    expect(validateFen(KIWIPETE).ok).toBe(true)
  })

  it('rejects a pawn on the first rank, which is structurally fine and illegal', () => {
    const invalid = validateFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNP w KQkq - 0 1')
    expect(invalid.ok).toBe(false)
  })

  it('rejects an en-passant square no pawn could have skipped over', () => {
    expect(validateFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq e6 0 1').ok).toBe(false)
  })
})

describe('normalizeFen', () => {
  it('puts castling rights back into KQkq order', () => {
    const normalized = normalizeFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w qkQK - 0 1')
    expect(normalized.ok && normalized.value).toBe(START_FEN)
  })

  it('collapses whitespace', () => {
    const normalized = normalizeFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR   w KQkq - 0 1')
    expect(normalized.ok && normalized.value).toBe(START_FEN)
  })

  it('is idempotent, which is what makes it safe as a cache key', () => {
    const once = normalizeFen(KIWIPETE)
    expect(once.ok).toBe(true)
    if (!once.ok) return
    const twice = normalizeFen(once.value)
    expect(twice.ok && twice.value).toBe(once.value)
  })
})

describe('field readers', () => {
  it('reads the side to move, the clock and the move number', () => {
    const fen = toFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R b KQkq - 7 23')
    expect(sideToMoveOf(fen)).toBe('black')
    expect(halfmoveClockOf(fen)).toBe(7)
    expect(fullmoveNumberOf(fen)).toBe(23)
  })
})

describe('formatFen and withCounters', () => {
  it('round-trips every field', () => {
    const parsed = parseFen(KIWIPETE)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const rebuilt = formatFen(parsed.value)
    expect(rebuilt.ok && rebuilt.value).toBe(KIWIPETE)
  })

  it('resets the counters a position inherited from the game it came from', () => {
    const fen = toFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 44 90')
    const reset = withCounters(fen, { halfmoveClock: 0, fullmoveNumber: 1 })
    expect(reset.ok && halfmoveClockOf(reset.value)).toBe(0)
    expect(reset.ok && fullmoveNumberOf(reset.value)).toBe(1)
  })

  it('leaves a counter alone when it is not given', () => {
    const fen = toFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 44 90')
    const changed = withCounters(fen, { halfmoveClock: 3 })
    expect(changed.ok && fullmoveNumberOf(changed.value)).toBe(90)
  })
})
