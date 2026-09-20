import { describe, expect, it } from 'vitest'

import { EcoCodeSchema, START_FEN } from '@/domain'

import {
  detectOpening,
  detectOpeningFromMoves,
  ECO_TABLE_SIZE,
  ecoTableSize,
  isBookPosition,
  lookupOpening,
} from './eco'
import { createGame, playMoves, type ChessGame } from './game'

function after(...moves: string[]): ChessGame {
  const start = createGame()
  if (!start.ok) throw new Error('the starting position is not legal')
  const played = playMoves(start.value, moves)
  if (!played.ok) throw new Error(`fixture moves are not legal: ${played.error.message}`)
  return played.value
}

describe('the bundled table', () => {
  it('parsed every row the generator wrote', () => {
    expect(ecoTableSize()).toBe(ECO_TABLE_SIZE)
  })

  it('holds only well-formed ECO codes', () => {
    const opening = lookupOpening(after('e4').fen)
    expect(opening).toBeDefined()
    expect(EcoCodeSchema.safeParse(opening?.eco).success).toBe(true)
  })

  it('does not name the starting position, because no one has played an opening yet', () => {
    expect(isBookPosition(START_FEN)).toBe(false)
  })
})

describe('detectOpening', () => {
  it('names an opening after a single move', () => {
    const opening = detectOpening(after('e4'))
    expect(opening?.name).toContain("King's Pawn")
  })

  it('prefers the deepest match, because that is what the players actually played', () => {
    const sicilian = detectOpening(after('e4', 'c5'))
    const najdorf = detectOpening(
      after('e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'),
    )
    expect(sicilian?.name).toBe('Sicilian Defense')
    expect(sicilian?.variation).toBeUndefined()
    expect(najdorf?.eco).toBe('B90')
    expect(najdorf?.variation).toContain('Najdorf')
  })

  it('reports where the game left the book', () => {
    const opening = detectOpening(after('e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6'))
    expect(opening?.bookExitPly).toBe(8)
  })

  it('recognises a transposition, because it matches positions and not move orders', () => {
    // 1.e4 e5 2.Nf3 Nc6 3.Bc4 and 1.e4 e5 2.Bc4 Nc6 3.Nf3 are the same position.
    const direct = detectOpening(after('e4', 'e5', 'Nf3', 'Nc6', 'Bc4'))
    const transposed = detectOpening(after('e4', 'e5', 'Bc4', 'Nc6', 'Nf3'))
    expect(direct).not.toBeNull()
    expect(transposed?.eco).toBe(direct?.eco)
    expect(transposed?.name).toBe(direct?.name)
  })

  it('returns null for a position no opening reaches', () => {
    const start = createGame('8/8/4k3/8/8/4K3/8/8 w - - 0 1')
    expect(start.ok).toBe(true)
    if (!start.ok) return
    expect(detectOpening(start.value)).toBeNull()
  })

  it('splits the upstream name into a family and a variation', () => {
    const opening = detectOpening(after('d4', 'd5', 'Bf4'))
    expect(opening?.name).toBe("Queen's Pawn Game")
    expect(opening?.variation).toBe('Accelerated London System')
  })
})

describe('detectOpeningFromMoves', () => {
  it('works from a bare list of moves, which is what an importer has', () => {
    const opening = detectOpeningFromMoves(['e4', 'c6', 'd4', 'd5'])
    expect(opening.ok).toBe(true)
    if (!opening.ok) return
    expect(opening.value?.name).toBe('Caro-Kann Defense')
  })

  it('accepts UCI just as readily as SAN', () => {
    const opening = detectOpeningFromMoves(['e2e4', 'c7c6', 'd2d4', 'd7d5'])
    expect(opening.ok && opening.value?.name).toBe('Caro-Kann Defense')
  })

  it('errors rather than guessing when the moves are not legal', () => {
    const opening = detectOpeningFromMoves(['e4', 'e4'])
    expect(opening.ok).toBe(false)
    if (opening.ok) return
    expect(opening.error.where).toBe('opening detection')
  })
})

describe('coverage of the openings the app names on screen', () => {
  // Every opening written into the approved prototype must resolve, or a screen lies.
  it.each([
    ['Italian Game', ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'], 'Italian Game'],
    ['Giuoco Pianissimo', ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'd3'], 'Giuoco Pianissimo'],
    ['Ruy Lopez', ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'], 'Ruy Lopez'],
    ['Two Knights', ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'], 'Two Knights'],
    ['Vienna Game', ['e4', 'e5', 'Nc3'], 'Vienna Game'],
    ['Philidor', ['e4', 'e5', 'Nf3', 'd6'], 'Philidor'],
    ['French Defense', ['e4', 'e6'], 'French Defense'],
    ["King's Gambit", ['e4', 'e5', 'f4'], "King's Gambit"],
    ['Caro-Kann', ['e4', 'c6'], 'Caro-Kann'],
    ['Sicilian Alapin', ['e4', 'c5', 'c3'], 'Alapin'],
    [
      'Sicilian Najdorf',
      ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'],
      'Najdorf',
    ],
    ["Queen's Gambit Declined", ['d4', 'd5', 'c4', 'e6'], "Queen's Gambit Declined"],
    ['Slav Defence', ['d4', 'd5', 'c4', 'c6'], 'Slav Defense'],
    ['London System', ['d4', 'Nf6', 'Nf3', 'd5', 'Bf4'], 'London System'],
    ["King's Indian Defence", ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7'], "King's Indian"],
  ])('names the %s', (_label, moves, expected) => {
    const opening = detectOpeningFromMoves(moves)
    expect(opening.ok).toBe(true)
    if (!opening.ok || opening.value === null) throw new Error(`${_label} was not named`)
    const full = `${opening.value.name}${opening.value.variation ?? ''}`
    expect(full).toContain(expected)
  })
})
