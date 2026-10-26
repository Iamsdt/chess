import 'fake-indexeddb/auto'

import { afterEach, describe, expect, it } from 'vitest'

import { DatasetRowSchema, toTimestamp } from '@/domain'

import { exportBackup, restoreBackup, parseBackup } from '../backup'
import { createDb, type ChessKingDb } from '../db'

import { createDecisionsRepository, type NewDecision } from './decisions'

let counter = 0
let db: ChessKingDb | undefined

afterEach(() => {
  db?.close()
  db = undefined
})

function setup() {
  counter += 1
  db = createDb(`decisions-test-${String(counter)}`)
  return { database: db, repo: createDecisionsRepository(db) }
}

function sample(id: string, overrides: Partial<NewDecision> = {}): NewDecision {
  return {
    id,
    text: `question ${id}`,
    screen: 'puzzle',
    modelId: 'minilm-l6-prototype@1',
    latencyMs: 12,
    probs: {
      mode: { 'puzzle-nudger': 0.7, grandmaster: 0.3 },
      wants_solution: 0.8,
      needs_engine: 0.2,
    },
    ...overrides,
  }
}

describe('decisions repository', () => {
  it('adds a decision with pseudo-labels derived from its probabilities', async () => {
    const { repo } = setup()
    const added = await repo.add(sample('a'))
    expect(added.ok).toBe(true)
    const stored = await repo.get('a')
    expect(stored).toMatchObject({
      text: 'question a',
      corrected: 0,
      correction: null,
      labels: { mode: 'puzzle-nudger', wants_solution: 1, needs_engine: 0 },
    })
  })

  it('lists newest first and honours the limit', async () => {
    const { database, repo } = setup()
    await repo.add(sample('old'))
    await database.decisions.update('old', { createdAt: toTimestamp(1) })
    await repo.add(sample('new'))
    expect((await repo.list()).map((r) => r.id)).toEqual(['new', 'old'])
    expect((await repo.list(1)).map((r) => r.id)).toEqual(['new'])
  })

  it('correct merges keys, flags the row and later corrections win', async () => {
    const { repo } = setup()
    await repo.add(sample('a'))
    const first = await repo.correct('a', { mode: 'grandmaster', wants_solution: 0 })
    expect(first.ok).toBe(true)
    const second = await repo.correct('a', { wants_solution: 1, off_topic: 0 })
    expect(second.ok && second.value.correction).toEqual({
      mode: 'grandmaster',
      wants_solution: 1,
      off_topic: 0,
    })
    expect((await repo.get('a'))?.corrected).toBe(1)
  })

  it('correcting a row that does not exist is a not-found result', async () => {
    const { repo } = setup()
    const outcome = await repo.correct('missing', { mode: 'tutor' })
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.error.code).toBe('not-found')
  })

  it('counts totals and corrections, and clear empties the log', async () => {
    const { repo } = setup()
    await repo.add(sample('a'))
    await repo.add(sample('b'))
    await repo.correct('b', { mode: 'tutor' })
    expect(await repo.count()).toEqual({ total: 2, corrected: 1 })
    expect((await repo.clear()).ok).toBe(true)
    expect(await repo.count()).toEqual({ total: 0, corrected: 0 })
  })

  it('exports predicted rows with pseudo-labels and corrected rows with the correction on top', async () => {
    const { database, repo } = setup()
    await repo.add(sample('p'))
    await database.decisions.update('p', { createdAt: toTimestamp(1000) })
    await repo.add(sample('c'))
    await database.decisions.update('c', { createdAt: toTimestamp(2000) })
    await repo.correct('c', { mode: 'tutor', needs_engine: 1 })

    const rows = await repo.exportRows()
    expect(rows.map((row) => DatasetRowSchema.safeParse(row).success)).toEqual([true, true])
    expect(rows[0]).toMatchObject({
      text: 'question p',
      screen: 'puzzle',
      source: 'predicted',
      model_id: 'minilm-l6-prototype@1',
      labels: { mode: 'puzzle-nudger', wants_solution: 1, needs_engine: 0 },
      created_at: '1970-01-01T00:00:01.000Z',
    })
    expect(rows[0]?.probs?.mode?.['puzzle-nudger']).toBe(0.7)
    expect(rows[1]).toMatchObject({
      source: 'corrected',
      // Corrected keys override; the rest keep the model's prediction.
      labels: { mode: 'tutor', needs_engine: 1, wants_solution: 1 },
    })
  })
})

describe('decisions in backups', () => {
  it('round-trips through a backup file', async () => {
    const { database, repo } = setup()
    await repo.add(sample('a'))
    await repo.correct('a', { mode: 'tutor' })
    const exported = await exportBackup(database)
    expect(exported.ok && exported.value.report.counts.decisions).toBe(1)
    if (!exported.ok) return

    const other = createDb(`decisions-restore-${String(counter)}`)
    try {
      const restored = await restoreBackup(
        JSON.parse(JSON.stringify(exported.value.file)),
        {},
        other,
      )
      expect(restored.ok).toBe(true)
      const row = await other.decisions.get('a')
      expect(row).toMatchObject({ corrected: 1, correction: { mode: 'tutor' } })
    } finally {
      other.close()
    }
  })

  it('a backup written before the decisions table existed still parses', async () => {
    const { database } = setup()
    const exported = await exportBackup(database)
    if (!exported.ok) throw new Error('export failed')
    const { decisions: _decisions, ...legacyData } = exported.value.file.data
    const parsed = parseBackup({ ...exported.value.file, data: legacyData })
    expect(parsed.ok && parsed.value.data.decisions).toEqual([])
  })
})
