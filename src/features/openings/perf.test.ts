import { describe, expect, it } from 'vitest'

import { chooseOpponentReply, startRun } from './drill'
import { computeCoverage, startCoverage } from './gaps'
import { ecoDistribution } from './popularity'
import { emptyTree, testContext } from './test-helpers'
import {
  addLine,
  addMove,
  annotate,
  deleteSubtree,
  findTranspositions,
  lineEnds,
  setMainLine,
  subtreeOf,
  treeStats,
  type RepertoireTree,
} from './tree'

/** Thirteen legal lines that branch early and often, 200+ nodes in all. */
const LINES = [
  'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1 a6 Bb3 Ba7 h3 h6 Nbd2 Re8',
  'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4 exd4 O-O d6 cxd4 Bb6 Nc3 Na5 Bg5 f6',
  'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 d4 exd4 O-O Be7 Re1 O-O Nxf7 Rxf7 Bxd5 Qxd5',
  'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Nb8 d4 Nbd7',
  'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7 Qe2 Nd5 c4 Ba6 b3 g6 Bb2 Bg7',
  'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6 f3 Be7 Qd2 O-O O-O-O Nbd7',
  'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6 Nc3 Bg7 Be3 Nf6 Bc4 O-O Bb3 d6 f3 Bd7 Qd2 Rc8',
  'e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7 Bxe7 Qxe7 f4 O-O Nf3 c5 Qd2 Nc6 dxc5 Nxc5',
  'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5 Be3 Nd7 O-O Ne7 c3 Nc6 Nbd2 Qb6 b3 Be4',
  'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 b6 cxd5 exd5 Bd3 Bb7 O-O Nbd7',
  'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7 Ne1 Nd7 Be3 f5',
  'd4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2 Bd6 Bg3 O-O Bd3 Qe7 O-O b6 Ne5 Bb7',
  'c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5 cxd5 Nxd5 Bg2 Nb6 O-O Be7 a3 O-O b4 f6 d3 Be6',
]

function build(): RepertoireTree {
  const ctx = testContext()
  let tree = emptyTree('white', ctx)
  for (const line of LINES) {
    // Drop black's last move so every line ends on one of white's own.
    const edit = addLine(tree, tree.rootId, line.split(' ').slice(0, -1), ctx)
    if (!edit.ok) throw new Error(edit.error.message)
    tree = edit.value.tree
  }
  return tree
}

function elapsed(work: () => void): number {
  const started = performance.now()
  work()
  return performance.now() - started
}

describe('a 200-node repertoire', () => {
  const tree = build()

  it('really has 200 nodes', () => {
    expect(tree.nodes.size).toBeGreaterThanOrEqual(200)
  })

  it('edits, annotates, promotes, deletes and scans transpositions within a frame or two', () => {
    const target = lineEnds(tree)[3]
    if (target === undefined) throw new Error('no line')
    expect(elapsed(() => addMove(tree, target.id, 'a3'))).toBeLessThan(30)
    expect(elapsed(() => annotate(tree, target.id, { comment: 'plan' }))).toBeLessThan(30)
    expect(elapsed(() => setMainLine(tree, target.id))).toBeLessThan(30)
    const e4 = subtreeOf(tree, tree.rootId)[1]
    if (e4 === undefined) throw new Error('no e4')
    expect(elapsed(() => deleteSubtree(tree, e4.id))).toBeLessThan(30)
    expect(elapsed(() => findTranspositions(tree))).toBeLessThan(30)
    expect(elapsed(() => treeStats(tree))).toBeLessThan(30)
  })

  it('estimates cold coverage in small slices and re-runs warm in a frame', () => {
    const run = startCoverage(tree, ecoDistribution)
    let longest = 0
    let slices = 0
    for (let done = false; !done; slices += 1) {
      const started = performance.now()
      done = run.step(8)
      longest = Math.max(longest, performance.now() - started)
    }
    expect(slices).toBeGreaterThan(1)
    // One position's estimate is the unit of work. The widest one, the reply to 1.e4 with
    // 19 named answers, is the worst case and runs once per session.
    expect(longest).toBeLessThan(250)
    expect(run.report().checkedPositions).toBeGreaterThan(20)

    let report = run.report()
    const warm = elapsed(() => {
      report = computeCoverage(tree, ecoDistribution)
    })
    expect(warm).toBeLessThan(50)
    expect(report.coveragePercent).toBeGreaterThanOrEqual(0)
  })

  it('starts a drill run and picks a reply instantly', () => {
    const target = lineEnds(tree)[0]
    if (target === undefined) throw new Error('no line')
    expect(elapsed(() => startRun(tree, target.id, ecoDistribution, Math.random))).toBeLessThan(30)
    const root = tree.nodes.get(tree.rootId)
    if (root === undefined) throw new Error('no root')
    expect(chooseOpponentReply(root, [], ecoDistribution, Math.random)).toBeUndefined()
  })
})
