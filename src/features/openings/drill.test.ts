import { describe, expect, it } from 'vitest'

import { makeSrsCard, toTimestamp } from '@/domain'

import {
  chooseOpponentReply,
  formatNextReview,
  giveUp,
  gradeRun,
  lineMastery,
  playMove,
  progressOf,
  startRun,
  takeHint,
  type DrillRun,
} from './drill'
import { ecoDistribution, type MoveDistribution } from './popularity'
import { emptyTree, testContext } from './test-helpers'
import { addLine, annotate, childrenOf, findBySanPath, type RepertoireTree } from './tree'

const none: MoveDistribution = () => []

function build(): RepertoireTree {
  const ctx = testContext()
  let tree = emptyTree('black', ctx)
  for (const line of [
    'e4 c6 d4 d5 e5 Bf5 Nf3 e6',
    'e4 c6 d4 d5 exd5 cxd5 Bd3 Nc6',
    'e4 c6 Nc3 d5 Nf3 Bg4',
  ]) {
    const edit = addLine(tree, tree.rootId, line.split(' '), ctx)
    if (!edit.ok) throw new Error(edit.error.message)
    tree = edit.value.tree
  }
  const c6 = findBySanPath(tree, ['e4', 'c6'])
  if (c6 === undefined) throw new Error('missing')
  const named = annotate(tree, c6.id, { openingName: 'Caro-Kann' }, ctx)
  if (!named.ok) throw new Error(named.error.message)
  tree = named.value.tree
  for (const [path, popularity] of [
    [['e4', 'c6', 'd4'], 70],
    [['e4', 'c6', 'Nc3'], 30],
  ] as const) {
    const node = findBySanPath(tree, path)
    if (node === undefined) throw new Error('missing')
    const edit = annotate(tree, node.id, { popularity }, ctx)
    if (!edit.ok) throw new Error(edit.error.message)
    tree = edit.value.tree
  }
  return tree
}

function id(tree: RepertoireTree, ...path: string[]) {
  const node = findBySanPath(tree, path)
  if (node === undefined) throw new Error('missing node')
  return node.id
}

describe('opponent replies', () => {
  it('follow the stored popularity, and a roll picks the matching reply', () => {
    const tree = build()
    const parent = findBySanPath(tree, ['e4', 'c6'])
    if (parent === undefined) throw new Error('missing')
    const kids = childrenOf(tree, parent.id)
    expect(chooseOpponentReply(parent, kids, none, () => 0.1)?.san).toBe('d4')
    expect(chooseOpponentReply(parent, kids, none, () => 0.8)?.san).toBe('Nc3')
  })

  it('over many rolls tracks the weights within tolerance', () => {
    const tree = build()
    const parent = findBySanPath(tree, ['e4', 'c6'])
    if (parent === undefined) throw new Error('missing')
    const kids = childrenOf(tree, parent.id)
    let seed = 7
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }
    let d4 = 0
    for (let i = 0; i < 2000; i += 1) {
      if (chooseOpponentReply(parent, kids, none, random)?.san === 'd4') d4 += 1
    }
    expect(d4 / 2000).toBeGreaterThan(0.65)
    expect(d4 / 2000).toBeLessThan(0.75)
  })

  it('steering toward the due line makes it more likely without forcing it', () => {
    const tree = build()
    const parent = findBySanPath(tree, ['e4', 'c6'])
    if (parent === undefined) throw new Error('missing')
    const kids = childrenOf(tree, parent.id)
    const steer = new Set([id(tree, 'e4', 'c6', 'Nc3')])
    // weights d4 70, Nc3 30*3=90 → a roll of 0.5 lands on Nc3, 0.2 still on d4.
    expect(chooseOpponentReply(parent, kids, none, () => 0.5, steer)?.san).toBe('Nc3')
    expect(chooseOpponentReply(parent, kids, none, () => 0.2, steer)?.san).toBe('d4')
  })

  it('falls back to the ECO estimate when a reply has no stored share', () => {
    let tree = build()
    const d4 = findBySanPath(tree, ['e4', 'c6', 'd4'])
    if (d4 === undefined) throw new Error('missing')
    const cleared = annotate(tree, d4.id, { popularity: null }, testContext())
    if (!cleared.ok) throw new Error(cleared.error.message)
    tree = cleared.value.tree
    const parent = findBySanPath(tree, ['e4', 'c6'])
    if (parent === undefined) throw new Error('missing')
    const picked = chooseOpponentReply(
      parent,
      childrenOf(tree, parent.id),
      ecoDistribution,
      () => 0,
    )
    expect(picked).toBeDefined()
  })
})

describe('a run', () => {
  function play(run: DrillRun, ...ucis: string[]): DrillRun {
    return ucis.reduce((current, uci) => playMove(current, uci, 1000, none, () => 0).run, run)
  }

  it('starts at the head, plays the opponent first, and completes on the last prepared move', () => {
    const tree = build()
    const target = id(tree, 'e4', 'c6', 'd4', 'd5', 'e5', 'Bf5', 'Nf3', 'e6')
    let run = startRun(tree, target, none, () => 0)
    expect(run.trail.map((step) => step.san)).toEqual(['d4'])
    expect(run.status).toBe('your-move')
    expect(progressOf(run)).toEqual({ done: 0, total: 3 })
    run = play(run, 'd7d5')
    expect(run.trail.map((step) => step.san)).toEqual(['d4', 'd5', 'e5'])
    run = play(run, 'c8f5', 'e7e6')
    expect(run.status).toBe('complete')
    expect(run.currentId).toBe(target)
    expect(gradeRun(run)).toBe('easy')
  })

  it('a wrong move costs a miss, keeps the position, and lists the prepared answers', () => {
    const tree = build()
    const target = id(tree, 'e4', 'c6', 'd4', 'd5', 'e5', 'Bf5', 'Nf3', 'e6')
    const run = startRun(tree, target, none, () => 0)
    const wrong = playMove(run, 'g8f6', 500, none, () => 0)
    expect(wrong.verdict.kind).toBe('wrong')
    expect(wrong.run.currentId).toBe(run.currentId)
    expect(wrong.run.misses).toBe(1)
    expect(wrong.verdict.kind === 'wrong' && wrong.verdict.expected.map((n) => n.san)).toEqual([
      'd5',
    ])
  })

  it('grades by misses, hints and pace', () => {
    const tree = build()
    const target = id(tree, 'e4', 'c6', 'Nc3', 'd5', 'Nf3', 'Bg4')
    const start = startRun(tree, target, none, () => 0.9)
    expect(start.trail.map((step) => step.san)).toEqual(['Nc3'])
    const finish = (r: DrillRun) =>
      playMove(playMove(r, 'd7d5', 1000, none, () => 0).run, 'c8g4', 1000, none, () => 0).run
    expect(gradeRun(finish(start))).toBe('easy')
    const slow = playMove(
      playMove(start, 'd7d5', 9000, none, () => 0).run,
      'c8g4',
      9000,
      none,
      () => 0,
    ).run
    expect(gradeRun(slow)).toBe('good')
    const hinted = takeHint(start)
    expect(hinted.hint?.san).toBe('d5')
    expect(gradeRun(finish(hinted.run))).toBe('hard')
    const oneMiss = playMove(start, 'a7a6', 0, none, () => 0).run
    expect(gradeRun(finish(oneMiss))).toBe('hard')
    const twoMisses = playMove(oneMiss, 'a7a5', 0, none, () => 0).run
    expect(gradeRun(finish(twoMisses))).toBe('again')
  })

  it('giving up grades the target line as again', () => {
    const tree = build()
    const target = id(tree, 'e4', 'c6', 'Nc3', 'd5', 'Nf3', 'Bg4')
    const run = giveUp(startRun(tree, target, none, () => 0.9))
    expect(gradeRun(run)).toBe('again')
  })

  it('a run that ends on an opponent move with no answer is not graded', () => {
    let tree = build()
    const edit = addLine(
      tree,
      tree.rootId,
      ['e4', 'c6', 'Nc3', 'd5', 'Nf3', 'Bg4', 'h3'],
      testContext(),
    )
    if (!edit.ok) throw new Error(edit.error.message)
    tree = edit.value.tree
    const run = play0(tree)
    expect(run.status).toBe('out-of-book')
    expect(gradeRun(run)).toBeNull()
  })

  function play0(tree: RepertoireTree): DrillRun {
    const target = id(tree, 'e4', 'c6', 'Nc3', 'd5', 'Nf3', 'Bg4')
    const run = startRun(tree, target, none, () => 0.9)
    return playMove(playMove(run, 'd7d5', 0, none, () => 0).run, 'c8g4', 0, none, () => 0).run
  }
})

describe('line list helpers', () => {
  it('maps card state to mastery and a readable next review', () => {
    const at = new Date('2026-01-10T09:00:00')
    const base = toTimestamp(at.getTime())
    expect(lineMastery(undefined)).toBe(0)
    expect(lineMastery(makeSrsCard({ state: 'new' }))).toBe(0)
    expect(lineMastery(makeSrsCard({ state: 'mastered' }))).toBe(100)
    expect(lineMastery(makeSrsCard({ state: 'review', stability: 10.5 }))).toBe(50)
    expect(formatNextReview(undefined, at)).toBe('new')
    expect(formatNextReview(makeSrsCard({ due: toTimestamp(base - 1) }), at)).toBe('now')
    expect(formatNextReview(makeSrsCard({ due: toTimestamp(base + 3_600_000) }), at)).toBe('today')
    expect(formatNextReview(makeSrsCard({ due: toTimestamp(base + 86_400_000) }), at)).toBe(
      'tomorrow',
    )
    expect(formatNextReview(makeSrsCard({ due: toTimestamp(base + 9 * 86_400_000) }), at)).toBe(
      'in 9 days',
    )
  })
})
