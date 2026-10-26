import { SeedsSchema, type DatasetRow, type SeedRow } from './contract'

/**
 * The training export: the seed examples followed by whatever the user logged.
 *
 * Why the seeds go in: a fine-tune wants the hand-written examples and the real ones in one file,
 * and `source` tells the trainer which is which. Seed rows have no probabilities and no model.
 */

export function seedRows(seeds: readonly SeedRow[], createdAt: Date = new Date()): DatasetRow[] {
  const stamp = createdAt.toISOString()
  return seeds.map((seed) => ({
    text: seed.text,
    screen: null,
    labels: seed.labels,
    source: 'seed' as const,
    model_id: null,
    probs: null,
    created_at: stamp,
  }))
}

/** One JSON object per line, newline-terminated, as `datasets` and pandas both expect. */
export function toJsonl(rows: readonly DatasetRow[]): string {
  return rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length > 0 ? '\n' : '')
}

export async function loadSeeds(): Promise<SeedRow[]> {
  const { default: seeds } = await import('./seeds.json')
  return SeedsSchema.parse(seeds)
}

export interface TrainingExport {
  readonly text: string
  readonly seedCount: number
  readonly loggedCount: number
}

/** Seeds first, then the logged rows oldest first. Pure: the caller supplies both halves. */
export function buildTrainingExport(
  seeds: readonly SeedRow[],
  logged: readonly DatasetRow[],
  createdAt: Date = new Date(),
): TrainingExport {
  const rows = [...seedRows(seeds, createdAt), ...logged]
  return { text: toJsonl(rows), seedCount: seeds.length, loggedCount: logged.length }
}

export function trainingFileName(date: Date = new Date()): string {
  return `chess-king-decisions-${date.toISOString().slice(0, 10)}.jsonl`
}
