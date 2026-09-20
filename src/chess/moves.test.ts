import { describe, expect, it } from 'vitest'

import { START_FEN, toFen, toSquare } from '@/domain'

import { formatUci, parseUci, sanLineToUci, sanToUci, uciLineToSan, uciToSan } from './moves'

const AFTER_1_E4 = toFen('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1')

describe('parseUci', () => {
  it('splits a plain move', () => {
    const parsed = parseUci('e2e4')
    expect(parsed.ok && parsed.value).toEqual({ from: 'e2', to: 'e4' })
  })

  it('splits a promotion', () => {
    const parsed = parseUci('g7g8q')
    expect(parsed.ok && parsed.value).toEqual({ from: 'g7', to: 'g8', promotion: 'q' })
  })

  it('leaves promotion absent rather than undefined', () => {
    const parsed = parseUci('e2e4')
    expect(parsed.ok && Object.hasOwn(parsed.value, 'promotion')).toBe(false)
  })

  it.each(['e2e9', 'e2', 'e2e4k', 'Nf3', ''])('rejects %s as a value', (value) => {
    const parsed = parseUci(value)
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.error.code).toBe('validation')
  })
})

describe('formatUci', () => {
  it('round-trips through parseUci', () => {
    for (const uci of ['e2e4', 'g7g8q', 'a1h8']) {
      const parsed = parseUci(uci)
      expect(parsed.ok && formatUci(parsed.value)).toBe(uci)
    }
  })

  it('omits the promotion when there is none', () => {
    expect(formatUci({ from: toSquare('e2'), to: toSquare('e4') })).toBe('e2e4')
  })
})

describe('sanToUci', () => {
  it('needs the position, because SAN means nothing without one', () => {
    expect(sanToUci(START_FEN, 'Nf3').ok && sanToUci(START_FEN, 'Nf3')).toEqual({
      ok: true,
      value: 'g1f3',
    })
    expect(sanToUci(AFTER_1_E4, 'Nf3').ok).toBe(false)
  })

  it('reads castling, promotion and captures', () => {
    const castle = sanToUci(toFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), 'O-O')
    expect(castle.ok && castle.value).toBe('e1g1')
    const promote = sanToUci(toFen('8/P6k/8/8/8/8/7K/8 w - - 0 1'), 'a8=N')
    expect(promote.ok && promote.value).toBe('a7a8n')
  })

  it('forgives the sloppy spellings real PGN contains', () => {
    const zeroes = sanToUci(toFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), '0-0')
    expect(zeroes.ok && zeroes.value).toBe('e1g1')
  })

  it('returns an error for a move that is not legal here', () => {
    const invalid = sanToUci(START_FEN, 'Qxd8')
    expect(invalid.ok).toBe(false)
  })
})

describe('uciToSan', () => {
  it('translates back', () => {
    const san = uciToSan(START_FEN, 'g1f3')
    expect(san.ok && san.value).toBe('Nf3')
  })

  it('adds the check and mate marks SAN carries', () => {
    const mate = uciToSan(toFen('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1'), 'a1a8')
    expect(mate.ok && mate.value).toBe('Ra8#')
  })

  it('rejects a move that is not legal, and says which', () => {
    const invalid = uciToSan(START_FEN, 'e2e5')
    expect(invalid.ok).toBe(false)
    if (invalid.ok) return
    expect(invalid.error.message).toContain('e2e5')
  })
})

describe('whole lines', () => {
  it('translates a principal variation into readable moves', () => {
    const sans = uciLineToSan(START_FEN, ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5'])
    expect(sans.ok && sans.value).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'])
  })

  it('translates a line of SAN back into engine moves', () => {
    const ucis = sanLineToUci(START_FEN, ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'])
    expect(ucis.ok && ucis.value).toEqual(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5'])
  })

  it('fails on the first illegal move rather than truncating the line', () => {
    const sans = uciLineToSan(START_FEN, ['e2e4', 'e7e5', 'g1f6'])
    expect(sans.ok).toBe(false)
    if (sans.ok) return
    expect(sans.error.message).toContain('Move 3')
  })

  it('round-trips a full line both ways', () => {
    const line = ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6']
    const ucis = sanLineToUci(START_FEN, line)
    expect(ucis.ok).toBe(true)
    if (!ucis.ok) return
    const back = uciLineToSan(START_FEN, ucis.value)
    expect(back.ok && back.value).toEqual(line)
  })
})
