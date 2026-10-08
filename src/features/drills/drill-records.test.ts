import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it } from 'vitest'

import { kvRepo } from '@/data'
import { toTimestamp } from '@/domain'

import {
  EMPTY_ENDGAME_RECORD,
  EMPTY_VISION_RECORD,
  VISION_RECORDS_KEY,
  applyEndgameOutcome,
  applyVisionScore,
  createDrillRecordsPort,
  emptyVisionRecords,
  masteredCount,
  type EndgameRecord,
} from './drill-records'
import { brokenRecords, realRecords } from './test-support'

import type { DrillOutcome } from './endgame-session'

const at = toTimestamp(1_700_000_000_000)
const win = (moves: number, stars: 1 | 2 | 3): DrillOutcome => ({
  kind: 'success',
  how: 'checkmate',
  moves,
  stars,
  overPar: stars < 3,
})
const loss: DrillOutcome = { kind: 'failed', reason: 'stalemate', moves: 5 }

describe('endgame records', () => {
  it('counts an attempt and a win, and remembers the best moves and stars', () => {
    const first = applyEndgameOutcome(EMPTY_ENDGAME_RECORD, win(14, 2), at)
    expect(first).toEqual({ attempts: 1, wins: 1, bestMoves: 14, stars: 2, lastPlayedAt: at })

    const better = applyEndgameOutcome(first, win(11, 3), at)
    expect(better).toMatchObject({ attempts: 2, wins: 2, bestMoves: 11, stars: 3 })

    const worse = applyEndgameOutcome(better, win(20, 1), at)
    expect(worse).toMatchObject({ attempts: 3, wins: 3, bestMoves: 11, stars: 3 })
  })

  it('counts a failure as an attempt without touching the best', () => {
    const won = applyEndgameOutcome(EMPTY_ENDGAME_RECORD, win(9, 3), at)
    const lost = applyEndgameOutcome(won, loss, at)
    expect(lost).toMatchObject({ attempts: 2, wins: 1, bestMoves: 9, stars: 3 })
  })

  it('ignores a drill that is still in play', () => {
    const same = applyEndgameOutcome(EMPTY_ENDGAME_RECORD, { kind: 'playing' }, at)
    expect(same).toBe(EMPTY_ENDGAME_RECORD)
  })

  it('counts mastered drills as the ones with three stars', () => {
    const record = (stars: number): EndgameRecord => ({ ...EMPTY_ENDGAME_RECORD, stars })
    expect(masteredCount({ a: record(3), b: record(2), c: record(3), d: record(0) })).toBe(2)
    expect(masteredCount({})).toBe(0)
  })
})

describe('vision records', () => {
  it('keeps the best score and counts plays', () => {
    const first = applyVisionScore(EMPTY_VISION_RECORD, 12, at)
    expect(first).toEqual({ plays: 1, best: 12, lastScore: 12, lastPlayedAt: at })
    const lower = applyVisionScore(first, 7, at)
    expect(lower).toEqual({ plays: 2, best: 12, lastScore: 7, lastPlayedAt: at })
  })
})

describe('the records port over the kv table', () => {
  beforeEach(async () => {
    await kvRepo.clear()
  })

  it('starts empty rather than failing', async () => {
    const port = realRecords()
    const endgames = await port.readEndgames()
    expect(endgames).toEqual({ ok: true, value: {} })
    const vision = await port.readVision()
    expect(vision).toEqual({ ok: true, value: emptyVisionRecords() })
  })

  it('persists a result and reads it back after the table is reopened', async () => {
    const port = createDrillRecordsPort(kvRepo, () => at)
    const saved = await port.recordEndgame('kr-vs-k', win(13, 3))
    expect(saved.ok && saved.value['kr-vs-k']).toMatchObject({ attempts: 1, bestMoves: 13 })

    const again = await createDrillRecordsPort(kvRepo).readEndgames()
    expect(again.ok && again.value['kr-vs-k']?.stars).toBe(3)
  })

  it('keeps each drill’s record separate', async () => {
    const port = realRecords()
    await port.recordEndgame('kq-vs-k', win(9, 3))
    const second = await port.recordEndgame('lucena', loss)
    expect(second.ok && Object.keys(second.value).sort()).toEqual(['kq-vs-k', 'lucena'])
  })

  it('persists vision scores per mode', async () => {
    const port = createDrillRecordsPort(kvRepo, () => at)
    await port.recordVision('knight', 4)
    const second = await port.recordVision('knight', 2)
    expect(second.ok && second.value.knight).toMatchObject({ plays: 2, best: 4, lastScore: 2 })
    expect(second.ok && second.value.square.plays).toBe(0)
  })

  it('treats a stored value that no longer validates as nothing yet', async () => {
    await kvRepo.putRaw([
      { key: VISION_RECORDS_KEY.name, value: { square: 'garbage' }, updatedAt: at },
    ])
    const port = realRecords()
    const vision = await port.readVision()
    expect(vision).toEqual({ ok: true, value: emptyVisionRecords() })
  })

  it('reports a closed database as an error value', async () => {
    const port = brokenRecords()
    const read = await port.readEndgames()
    expect(read.ok).toBe(false)
    const write = await port.recordVision('square', 3)
    expect(write.ok).toBe(false)
    if (!write.ok) expect(write.error.code).toBe('io')
  })
})
