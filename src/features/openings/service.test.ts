import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it } from 'vitest'

import { repertoireRepo, srsCardsRepo } from '@/data'

import { gradeRun, playMove, startRun, type DrillRun } from './drill'
import { createFakeScheduler } from './fake-scheduler'
import { ecoDistribution } from './popularity'
import {
  addMoveAndSave,
  deleteAndSave,
  dueLines,
  importPgnLines,
  isRepertoireEmpty,
  loadLines,
  loadTree,
  recordRun,
  seedStarter,
  setMainLineAndSave,
  type OpeningsDeps,
} from './service'
import { findBySanPath, lineEnds } from './tree'

const deps: OpeningsDeps = { repertoire: repertoireRepo, srsCards: srsCardsRepo }

beforeEach(async () => {
  await repertoireRepo.clear()
  await srsCardsRepo.clear()
})

function must<T>(value: T | undefined | null): T {
  if (value === undefined || value === null) throw new Error('expected a value')
  return value
}

describe('seeding and the empty state', () => {
  it('is empty until the user asks for the starter, then holds both colours with cards', async () => {
    expect(await isRepertoireEmpty(deps)).toBe(true)
    const seeded = await seedStarter(deps)
    expect(seeded.ok && seeded.value).toBe(3)
    expect(await isRepertoireEmpty(deps)).toBe(false)
    const white = must(await loadTree(deps, 'white'))
    const black = must(await loadTree(deps, 'black'))
    expect(lineEnds(white).length).toBeGreaterThan(5)
    expect(lineEnds(black).length).toBe(6)
    const lines = await loadLines(deps, black)
    expect(lines.every((line) => line.card?.subject.kind === 'opening')).toBe(true)
    expect(await deps.srsCards.countDue({ kind: 'opening' })).toBeGreaterThan(10)
  })

  it('re-adding an opening does not duplicate nodes or cards', async () => {
    await seedStarter(deps, ['caro-kann'])
    const before = await deps.repertoire.count('black')
    const cards = await deps.srsCards.countsByState()
    await seedStarter(deps, ['caro-kann'])
    expect(await deps.repertoire.count('black')).toBe(before)
    expect(await deps.srsCards.countsByState()).toEqual(cards)
  })
})

describe('editing keeps cards in step with lines', () => {
  it('extending a line moves its card; deleting a branch removes its cards', async () => {
    await seedStarter(deps, ['caro-kann'])
    const tree = must(await loadTree(deps, 'black'))
    const hLine = must(findBySanPath(tree, ['e4', 'c6', 'd4', 'd5', 'e5', 'Bf5', 'h4', 'h5']))
    const oldCard = must(hLine.srsCardId)

    const extended = await addMoveAndSave(deps, tree, hLine.id, 'g4')
    if (!extended.ok) throw new Error(extended.error.message)
    expect(await deps.srsCards.get(oldCard)).toBeUndefined()
    const afterTree = extended.value.tree
    const stillThere = must(afterTree.nodes.get(hLine.id))
    expect(stillThere.srsCardId).toBeUndefined()
    const added = must(
      findBySanPath(afterTree, ['e4', 'c6', 'd4', 'd5', 'e5', 'Bf5', 'h4', 'h5', 'g4']),
    )
    expect(added.isYourMove).toBe(false)

    const e5 = must(findBySanPath(afterTree, ['e4', 'c6', 'd4', 'd5', 'e5']))
    const cardsBefore = lineEnds(afterTree).length
    const deleted = await deleteAndSave(deps, afterTree, e5.id)
    if (!deleted.ok) throw new Error(deleted.error.message)
    expect(lineEnds(deleted.value.tree).length).toBeLessThan(cardsBefore)
    const stored = await deps.repertoire.listByColor('black')
    expect(stored.map((row) => row.id)).not.toContain(e5.id)
    const remaining = await loadLines(deps, deleted.value.tree)
    expect(remaining.every((line) => line.card !== undefined)).toBe(true)
  })

  it('persists main-line changes', async () => {
    await seedStarter(deps, ['caro-kann'])
    const tree = must(await loadTree(deps, 'black'))
    const nc3 = must(findBySanPath(tree, ['e4', 'c6', 'Nc3']))
    const promoted = await setMainLineAndSave(deps, tree, nc3.id)
    if (!promoted.ok) throw new Error(promoted.error.message)
    const reloaded = must(await loadTree(deps, 'black'))
    expect(must(reloaded.nodes.get(nc3.id)).isMainLine).toBe(true)
  })
})

describe('PGN import', () => {
  it('merges lines into the colour tree and cards the new ones', async () => {
    const report = await importPgnLines(
      deps,
      'white',
      `[Event "x"]\n\n1. d4 d5 2. c4 e6 3. Nc3 Nf6 (3... c6 4. Nf3) 4. Bg5 *`,
    )
    if (!report.ok) throw new Error(report.error.message)
    expect(report.value.created).toBe(9)
    const tree = must(await loadTree(deps, 'white'))
    expect(
      lineEnds(tree)
        .map((node) => node.san)
        .sort(),
    ).toEqual(['Bg5', 'Nf3'])
    expect(await deps.srsCards.countDue({ kind: 'opening' })).toBe(2)
  })

  it('returns an error value for a broken PGN and leaves storage alone', async () => {
    const report = await importPgnLines(deps, 'white', '1. e4 e5 2. Ke4 *')
    expect(report.ok).toBe(false)
    expect(await deps.repertoire.count()).toBe(0)
  })
})

describe('drill feeds the scheduler', () => {
  it('records a clean run as a review of the line it ended on, and the card leaves the queue', async () => {
    await seedStarter(deps, ['caro-kann'])
    const tree = must(await loadTree(deps, 'black'))
    const scheduler = createFakeScheduler()
    const at = new Date()
    const lines = await loadLines(deps, tree)
    const queue = dueLines(lines, scheduler, new Date(at.getTime() + 1000))
    const target = must(queue[0]).node

    let run: DrillRun = startRun(tree, target.id, ecoDistribution, () => 0)
    let guard = 0
    while (run.status === 'your-move' && guard < 20) {
      guard += 1
      const move = must(tree.nodes.get(run.currentId))
      const next = must(move.childIds[0])
      const child = must(tree.nodes.get(next))
      run = playMove(run, must(child.uci), 1500, ecoDistribution, () => 0).run
    }
    expect(run.status).toBe('complete')
    expect(gradeRun(run)).toBe('easy')

    const outcome = await recordRun(deps, scheduler, run, new Date(at.getTime() + 2000))
    if (!outcome.ok) throw new Error(outcome.error.message)
    const recorded = must(outcome.value)
    expect(recorded.grade).toBe('easy')
    expect(recorded.card.reps).toBe(1)
    const stored = must(await deps.srsCards.get(recorded.card.id))
    expect(stored.state).toBe('review')
    const requeue = dueLines(await loadLines(deps, tree), scheduler, new Date(at.getTime() + 3000))
    expect(requeue.map((line) => line.card?.id)).not.toContain(recorded.card.id)
  })
})
