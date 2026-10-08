import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it } from 'vitest'

import { applyMove, createGame } from '@/chess'
import { mistakesRepo, srsCardsRepo } from '@/data'
import { makePuzzle, toPuzzleId, toUci } from '@/domain'

import { captureMissedPuzzle, firstWrongMove } from './capture'
import { reviewCard } from './fsrs'

const puzzle = makePuzzle()
const [first, reply, last] = puzzle.solution

beforeEach(async () => {
  await mistakesRepo.clear()
  await srsCardsRepo.clear()
})

describe('firstWrongMove', () => {
  const line = [toUci('f6f3'), toUci('g2g1'), toUci('f3e2')]

  it('is the first try that was not the line’s move', () => {
    expect(firstWrongMove([toUci('f6e7')], line)).toBe('f6e7')
    expect(firstWrongMove([toUci('f6f3'), toUci('f3h1')], line)).toBe('f3h1')
  })

  it('is null when every try was right, which is what a skip looks like', () => {
    expect(firstWrongMove([], line)).toBeNull()
    expect(firstWrongMove([toUci('f6f3')], line)).toBeNull()
  })
})

describe('captureMissedPuzzle', () => {
  it('banks a missed puzzle with a new card that is due now', async () => {
    const result = await captureMissedPuzzle({
      puzzle,
      fen: puzzle.fen,
      cursor: 0,
      played: [toUci('f6e7')],
    })
    expect(result.ok).toBe(true)
    const entries = await mistakesRepo.list()
    expect(entries).toHaveLength(1)
    const entry = entries[0]
    expect(entry?.source).toBe('puzzle')
    expect(entry?.puzzleId).toBe(puzzle.id)
    expect(entry?.playedSan).toBe('Qe7')
    expect(entry?.bestSan).toBe('Qf3+')
    expect(entry?.bestUci).toBe(first)
    expect(entry?.yourColor).toBe('black')
    expect(entry?.themes).toEqual(['fork'])
    expect(entry?.solution).toEqual(puzzle.solution)

    const card =
      entry?.srsCardId === undefined ? undefined : await srsCardsRepo.get(entry.srsCardId)
    expect(card?.state).toBe('new')
    expect(card?.subject).toEqual({ kind: 'mistake', mistakeId: entry?.id })
    expect(card === undefined ? 0 : card.due).toBeLessThanOrEqual(Date.now())
    expect(await srsCardsRepo.countDue({ kind: 'mistake' })).toBe(1)
  })

  it('banks a skip with the best move as the “played” move and flags nothing else', async () => {
    await captureMissedPuzzle({ puzzle, fen: puzzle.fen, cursor: 0, played: [] })
    const [entry] = await mistakesRepo.list()
    expect(entry?.playedUci).toBe(first)
  })

  it('banks from the point the user reached on a longer line', async () => {
    const start = createGame(puzzle.fen)
    if (!start.ok || first === undefined || reply === undefined || last === undefined) {
      throw new Error('fixture puzzle should replay')
    }
    const afterFirst = applyMove(start.value, first)
    if (!afterFirst.ok) throw new Error('first move should be legal')
    const afterReply = applyMove(afterFirst.value, reply)
    if (!afterReply.ok) throw new Error('reply should be legal')

    await captureMissedPuzzle({
      puzzle,
      fen: afterReply.value.fen,
      cursor: 2,
      played: [first, toUci('f3h1')],
    })
    const [entry] = await mistakesRepo.list()
    expect(entry?.fen).toBe(afterReply.value.fen)
    expect(entry?.solution).toEqual([last])
    expect(entry?.bestUci).toBe(last)
    expect(entry?.playedUci).toBe('f3h1')
  })

  it('banks a puzzle once, however often it is missed', async () => {
    const miss = { puzzle, fen: puzzle.fen, cursor: 0, played: [toUci('f6e7')] }
    await captureMissedPuzzle(miss)
    const again = await captureMissedPuzzle(miss)
    expect(again.ok && again.value).toBeUndefined()
    expect(await mistakesRepo.count()).toBe(1)
    expect(await srsCardsRepo.listAll()).toHaveLength(1)
  })

  it('returns an error value, never a throw, when the position cannot be read', async () => {
    const result = await captureMissedPuzzle({
      puzzle: { ...puzzle, id: toPuzzleId('broken') },
      fen: puzzle.fen,
      cursor: 9,
      played: [],
    })
    expect(result.ok).toBe(false)
  })

  it('leaves a card the scheduler can review straight away', async () => {
    await captureMissedPuzzle({ puzzle, fen: puzzle.fen, cursor: 0, played: [toUci('f6e7')] })
    const [card] = await srsCardsRepo.listAll('mistake')
    expect(card).toBeDefined()
    if (card === undefined) return
    expect(reviewCard(card, 'good', new Date()).state).toBe('learning')
  })
})
