import { describe, expect, it } from 'vitest'

import { DatasetRowSchema } from '@/domain'

import { SeedsSchema, type DatasetRow } from './contract'
import { buildTrainingExport, loadSeeds, seedRows, toJsonl, trainingFileName } from './dataset'

const at = new Date('2026-10-21T12:00:00.000Z')

describe('seedRows', () => {
  it('turns seeds into dataset rows with no model and no probabilities', async () => {
    const rows = seedRows(await loadSeeds(), at)
    expect(rows.length).toBeGreaterThan(100)
    for (const row of rows) expect(DatasetRowSchema.safeParse(row).success).toBe(true)
    expect(rows[0]).toMatchObject({
      screen: null,
      source: 'seed',
      model_id: null,
      probs: null,
      created_at: '2026-10-21T12:00:00.000Z',
    })
  })
})

describe('JSONL export', () => {
  const logged: DatasetRow[] = [
    {
      text: 'tell me the move',
      screen: 'puzzle',
      labels: { mode: 'puzzle-nudger', wants_solution: 1 },
      source: 'corrected',
      model_id: 'minilm-l6-prototype@1',
      probs: { mode: { grandmaster: 0.6 }, wants_solution: 0.4 },
      created_at: '2026-10-21T11:00:00.000Z',
    },
  ]

  it('is one JSON object per line, newline-terminated, seeds first', () => {
    const seeds = SeedsSchema.parse([{ text: 'seed one', labels: { mode: 'tutor' } }])
    const built = buildTrainingExport(seeds, logged, at)
    const lines = built.text.trimEnd().split('\n')
    expect(built.text.endsWith('\n')).toBe(true)
    expect(lines).toHaveLength(2)
    expect(built.seedCount).toBe(1)
    expect(built.loggedCount).toBe(1)
    const parsed = lines.map((line) => DatasetRowSchema.parse(JSON.parse(line)))
    expect(parsed.map((row) => row.source)).toEqual(['seed', 'corrected'])
    expect(parsed[1]).toEqual(logged[0])
  })

  it('an empty export is an empty string', () => {
    expect(toJsonl([])).toBe('')
  })

  it('names the file by date', () => {
    expect(trainingFileName(at)).toBe('chess-king-decisions-2026-10-21.jsonl')
  })
})
