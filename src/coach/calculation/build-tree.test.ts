import { afterEach, describe, expect, it } from 'vitest'

import { createGame, legalMoves } from '@/chess'
import { toFen, type EngineLine, type Fen } from '@/domain'
import { createScriptedEngine, type EngineScript } from '@/coach/testing/scripted-engine'

import { buildCalculationTree, TREE_MAX_PLIES, TREE_NODE_BUDGET, toCoachEval } from './build-tree'
import { childrenMap, replayTree } from './tree-model'

/** Tactical moves look bad to this engine, quiet ones are ranked alphabetically and close. */
const quietEngine =
  (
    score = (san: string, index: number): number =>
      /[x+]/.test(san) ? -200 : index < 3 ? 40 - 10 * index : -500,
  ): EngineScript =>
  (request) => {
    const game = createGame(request.fen)
    if (!game.ok) return {}
    const ranked = legalMoves(game.value)
      .map((move) => ({ move, san: String(move.san) }))
      .sort((a, b) => a.san.localeCompare(b.san))
      .map(({ move, san }, index) => ({ move, cp: score(san, index) }))
      .sort((a, b) => b.cp - a.cp)
      .slice(0, request.multiPv)
    const lines: EngineLine[] = ranked.map(({ move, cp }, index) => ({
      multipv: index + 1,
      depth: 12,
      score: { kind: 'cp', value: cp },
      pv: [move.uci],
    }))
    return { lines, depth: 12 }
  }

const KNIGHTS = toFen('r1bqkb1r/pppp1ppp/2n2n2/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R w KQkq - 5 4')

let current: ReturnType<typeof createScriptedEngine> | undefined
afterEach(async () => {
  await current?.dispose()
  current = undefined
})

function build(
  fen: Fen,
  script: EngineScript,
  options?: Parameters<typeof buildCalculationTree>[2],
) {
  current = createScriptedEngine(script)
  return buildCalculationTree(current.engine, fen, options)
}

describe('buildCalculationTree', () => {
  it('offers the top three moves plus the tempting checks and captures that fail', async () => {
    const result = await build(KNIGHTS, quietEngine())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const roots = result.value.filter((node) => node.parentId === null)
    expect(roots.map((node) => node.tag).filter((tag) => tag === 'tempting')).toHaveLength(2)
    expect(roots).toHaveLength(5)
    expect(roots.filter((node) => node.tag === 'tempting').map((node) => node.san)).toEqual(
      expect.arrayContaining(['Nxf7', 'Bxf7+']),
    )
  })

  it('produces a tree the rules can replay, within the node and ply budget', async () => {
    const result = await build(KNIGHTS, quietEngine())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const nodes = result.value
    expect(nodes.length).toBeLessThanOrEqual(TREE_NODE_BUDGET)

    const replay = replayTree({
      kind: 'calculation',
      title: 't',
      fen: KNIGHTS,
      orientation: 'white',
      nodes,
    })
    expect(replay.illegal).toEqual([])
    const plies = [...replay.positions.values()].map((position) => position.ply)
    expect(Math.max(...plies)).toBeLessThanOrEqual(TREE_MAX_PLIES)

    const ids = new Set(nodes.map((node) => node.id))
    expect(ids.size).toBe(nodes.length)
    for (const node of nodes) {
      if (node.parentId !== null) expect(ids.has(node.parentId)).toBe(true)
    }
  })

  it('answers with the best reply and a second one only when it is close', async () => {
    const result = await build(KNIGHTS, quietEngine())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const kids = childrenMap(result.value)
    const replay = replayTree({
      kind: 'calculation',
      title: 't',
      fen: KNIGHTS,
      orientation: 'white',
      nodes: result.value,
    })
    for (const node of result.value) {
      const children = kids.get(node.id) ?? []
      const ply = replay.positions.get(node.id)?.ply ?? 0
      // Our own continuations: best move only.
      if (ply % 2 === 0) expect(children.length).toBeLessThanOrEqual(1)
      else expect(children.length).toBeLessThanOrEqual(2)
    }
    // Quiet replies are 10 apart, so at least one candidate got two replies.
    expect([...kids.values()].some((group) => group.length === 2)).toBe(true)
  })

  it('records why every leaf stopped', async () => {
    const result = await build(KNIGHTS, quietEngine())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const parents = new Set(result.value.map((node) => node.parentId))
    for (const leaf of result.value.filter((node) => !parents.has(node.id))) {
      expect(leaf.stop).toBeDefined()
    }
  })

  it('stops a branch at mate', async () => {
    const mateIn1 = toFen('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1')
    const result = await build(
      mateIn1,
      quietEngine((san) => (san.endsWith('#') ? 5_000 : 0)),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.find((node) => node.san === 'Ra8#')).toMatchObject({
      parentId: null,
      stop: 'mate',
    })
  })

  it('fails when stopped, and on a finished game', async () => {
    const controller = new AbortController()
    controller.abort()
    const stopped = await build(KNIGHTS, quietEngine(), { signal: controller.signal })
    expect(stopped.ok).toBe(false)

    const over = await build(toFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'), quietEngine())
    expect(over.ok).toBe(false)
  })
})

describe('toCoachEval', () => {
  it('turns a side-to-move score into a white-centred eval', () => {
    expect(toCoachEval({ kind: 'cp', value: 30 }, 'white')).toEqual({ cp: 30 })
    expect(toCoachEval({ kind: 'cp', value: 30 }, 'black')).toEqual({ cp: -30 })
    expect(toCoachEval({ kind: 'mate', moves: 3 }, 'black')).toEqual({ mate: -3 })
  })
})
