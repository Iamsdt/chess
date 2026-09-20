import { describe, expect, it } from 'vitest'

import { parseUciLine } from './uci'

/**
 * The parser is the one place a mis-read character becomes a wrong evaluation on
 * screen, so these cases are recorded output from `public/engine/`, not invented.
 */
describe('parseUciLine', () => {
  it('reads a full MultiPV info record', () => {
    const message = parseUciLine(
      'info depth 12 seldepth 17 multipv 1 score cp 34 wdl 67 928 5 nodes 15282 nps 545785 hashfull 4 time 28 pv e2e4 e7e5 g1f3',
    )
    expect(message).toEqual({
      kind: 'info',
      info: {
        depth: 12,
        selDepth: 17,
        multipv: 1,
        score: { kind: 'cp', value: 34 },
        wdl: { win: 67, draw: 928, loss: 5 },
        nodes: 15282,
        nps: 545785,
        hashFull: 4,
        timeMs: 28,
        pv: ['e2e4', 'e7e5', 'g1f3'],
      },
    })
  })

  it('keeps mate scores as mate, in both directions', () => {
    const winning = parseUciLine('info depth 20 multipv 1 score mate 3 pv d1h5')
    const losing = parseUciLine('info depth 20 multipv 1 score mate -2 pv d1h5')
    expect(winning).toMatchObject({ info: { score: { kind: 'mate', moves: 3 } } })
    expect(losing).toMatchObject({ info: { score: { kind: 'mate', moves: -2 } } })
  })

  it('flags a fail-high score as a bound so it is not shown as a line', () => {
    const message = parseUciLine('info depth 14 multipv 1 score cp 120 lowerbound nodes 9 pv e2e4')
    expect(message).toMatchObject({ info: { bound: 'lower', score: { kind: 'cp', value: 120 } } })
  })

  it('reads a promotion move in the principal variation', () => {
    expect(parseUciLine('info depth 9 score cp 900 pv a7a8q b8a8')).toMatchObject({
      info: { pv: ['a7a8q', 'b8a8'] },
    })
  })

  it('stops the principal variation at the first token that is not a move', () => {
    expect(parseUciLine('info depth 5 score cp 10 pv e2e4 nonsense e7e5')).toMatchObject({
      info: { pv: ['e2e4'] },
    })
  })

  it('reads progress records that carry no line', () => {
    expect(parseUciLine('info depth 7 currmove e2e4 currmovenumber 1')).toEqual({
      kind: 'info',
      info: { depth: 7, currMove: 'e2e4', currMoveNumber: 1 },
    })
  })

  it('treats info string as free text, not as a record', () => {
    expect(parseUciLine('info string NNUE evaluation using nn-61e7af4bb97d.nnue (1MiB)')).toEqual({
      kind: 'info-string',
      text: 'NNUE evaluation using nn-61e7af4bb97d.nnue (1MiB)',
    })
  })

  it('reads bestmove with and without a ponder move', () => {
    expect(parseUciLine('bestmove e2e4 ponder e7e5')).toEqual({
      kind: 'bestmove',
      move: 'e2e4',
      ponder: 'e7e5',
    })
    expect(parseUciLine('bestmove g1f3')).toEqual({ kind: 'bestmove', move: 'g1f3', ponder: null })
  })

  it('reads a finished game as a bestmove with no move', () => {
    expect(parseUciLine('bestmove (none)')).toEqual({ kind: 'bestmove', move: null, ponder: null })
  })

  it('reads the handshake', () => {
    expect(parseUciLine('id name Stockfish 19 Lite WASM Multithreaded')).toEqual({
      kind: 'id',
      field: 'name',
      value: 'Stockfish 19 Lite WASM Multithreaded',
    })
    expect(parseUciLine('uciok')).toEqual({ kind: 'uciok' })
    expect(parseUciLine('readyok')).toEqual({ kind: 'readyok' })
  })

  it('reads options whose names contain spaces', () => {
    expect(parseUciLine('option name Clear Hash type button')).toEqual({
      kind: 'option',
      option: { name: 'Clear Hash', type: 'button' },
    })
    expect(parseUciLine('option name Threads type spin default 1 min 1 max 32')).toEqual({
      kind: 'option',
      option: { name: 'Threads', type: 'spin', defaultValue: '1', min: 1, max: 32 },
    })
  })

  it('reports anything it cannot read rather than guessing', () => {
    expect(parseUciLine('')).toMatchObject({ kind: 'unknown' })
    expect(parseUciLine('Stockfish 19 Lite WASM by the Stockfish developers')).toMatchObject({
      kind: 'unknown',
    })
    expect(parseUciLine('info score cp')).toMatchObject({ kind: 'unknown' })
    expect(parseUciLine('bestmove nonsense')).toMatchObject({ kind: 'unknown' })
  })
})
