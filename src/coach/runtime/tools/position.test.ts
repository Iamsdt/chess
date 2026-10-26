import { describe, expect, it } from 'vitest'

import { makeCoachContext, START_FEN } from '@/domain'
import { createScriptedEngine } from '@/coach/testing/scripted-engine'

import { positionTools } from './position'

import type { CoachToolEnv } from './types'
import type { ToolExecutionOptions } from '@ai-sdk/provider-utils'

const OPTIONS = { toolCallId: 'x', messages: [] } as unknown as ToolExecutionOptions<never>

const italian = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4'

function setUp(fen = START_FEN) {
  const scripted = createScriptedEngine(() => ({}))
  const env: CoachToolEnv = {
    context: makeCoachContext({ position: { fen: fen as never, orientation: 'white' } }),
    emit: () => undefined,
    signal: new AbortController().signal,
    engine: scripted.engine,
  }
  const tools = positionTools(env)
  const run = async (name: string, input: unknown): Promise<Record<string, unknown>> => {
    const tool = tools[name]
    const execute = tool?.execute as (i: unknown, o: unknown) => Promise<Record<string, unknown>>
    return execute(input, OPTIONS)
  }
  return { run, dispose: scripted.dispose }
}

describe('legalMoves', () => {
  it('lists the moves of the on-screen position', async () => {
    const { run, dispose } = setUp()
    const out = await run('legalMoves', {})
    expect(out.count).toBe(20)
    expect(out.moves).toContain('Nf3')
    expect(out.sideToMove).toBe('white')
    await dispose()
  })

  it('narrows to one square', async () => {
    const { run, dispose } = setUp()
    const out = await run('legalMoves', { square: 'g1' })
    expect(out.moves).toEqual(expect.arrayContaining(['Nf3', 'Nh3']))
    expect(out.count).toBe(2)
    await dispose()
  })

  it('fails on a bad FEN instead of throwing', async () => {
    const { run, dispose } = setUp()
    const out = await run('legalMoves', { fen: 'nonsense' })
    expect(out.error).toMatch(/Not a legal position/)
    await dispose()
  })
})

describe('playLine', () => {
  it('replays SAN and UCI and prints the line', async () => {
    const { run, dispose } = setUp()
    const out = await run('playLine', { moves: ['e4', 'e7e5', 'Nf3'] })
    expect(out.line).toBe('1. e4 e5 2. Nf3')
    expect(out.moves).toEqual(['e4', 'e5', 'Nf3'])
    expect(out.sideToMove).toBe('black')
    expect(out.finalFen).toContain(' b ')
    await dispose()
  })

  it('names the illegal move and offers legal ones', async () => {
    const { run, dispose } = setUp()
    const out = await run('playLine', { moves: ['e4', 'e4'] })
    expect(out.error).toMatch(/Move 2 "e4" is illegal/)
    expect(out.error).toMatch(/Legal moves: .*e5/)
    await dispose()
  })

  it('reports checkmate', async () => {
    const { run, dispose } = setUp()
    const out = await run('playLine', { moves: ['f3', 'e5', 'g4', 'Qh4#'] })
    expect(out.status).toBe('checkmate, black wins')
    await dispose()
  })
})

describe('positionFacts', () => {
  it('reports material, hanging pieces, files and structure', async () => {
    const { run, dispose } = setUp()
    const start = await run('positionFacts', {})
    expect(start.material).toMatchObject({ balance: 'level', whitePoints: 39 })
    expect(start.openFiles).toEqual([])
    expect(start.hangingPieces).toEqual({ white: [], black: [] })

    const open = await run('positionFacts', {
      fen: '4k3/8/8/8/8/8/P1P1PPPP/R3K2R w KQ - 0 1',
    })
    expect(open.openFiles).toEqual(['b', 'd'])
    expect(open.halfOpenFiles).toMatchObject({ black: ['a', 'c', 'e', 'f', 'g', 'h'], white: [] })
    expect(open.pawnStructure).toMatchObject({
      white: { passed: expect.arrayContaining(['a2']) },
    })
    expect(open.material).toMatchObject({ balance: 'White is up 16' })
    await dispose()
  })

  it('finds a hanging piece and counts the pawn shield', async () => {
    const { run, dispose } = setUp()
    const out = await run('positionFacts', { fen: '4k3/8/8/8/3n4/4P3/5PP1/6K1 w - - 0 1' })
    expect(out.hangingPieces).toEqual({ white: [], black: ['knight on d4'] })
    expect(out.kingSafety).toMatchObject({ white: { square: 'g1', pawnShield: 2 } })
    await dispose()
  })

  it('flags doubled and isolated pawns', async () => {
    const { run, dispose } = setUp()
    const out = await run('positionFacts', { fen: '4k3/8/8/8/8/2P5/P1P5/4K3 w - - 0 1' })
    expect(out.pawnStructure).toMatchObject({
      white: { doubled: ['c-file'], isolated: ['a-pawn', 'c-pawn'] },
    })
    await dispose()
  })
})

describe('identifyOpening', () => {
  it('names a position', async () => {
    const { run, dispose } = setUp(italian)
    const out = await run('identifyOpening', {})
    expect(out.opening).toMatchObject({ eco: 'C55' })
    await dispose()
  })

  it('names a move list', async () => {
    const { run, dispose } = setUp()
    const out = await run('identifyOpening', { moves: ['e4', 'c5'] })
    expect(out.opening).toMatchObject({ name: 'Sicilian Defense' })
    expect(out.summary).toMatch(/B20/)
    await dispose()
  })

  it('returns null for an unnamed position and fails on illegal moves', async () => {
    const { run, dispose } = setUp()
    const none = await run('identifyOpening', { fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1' })
    expect(none.opening).toBeNull()
    const bad = await run('identifyOpening', { moves: ['e5'] })
    expect(bad.error).toBeDefined()
    await dispose()
  })
})
