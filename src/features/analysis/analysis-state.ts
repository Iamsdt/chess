import { z } from 'zod'

import { defineKvKey, kvRepo } from '@/data'
import { ColorSchema, now, TimestampSchema, type Result } from '@/domain'

import { VariationTreeSchema, type VariationTree } from './variation-tree'

/**
 * S19 · what the analysis board remembers between visits.
 *
 * "The variation tree survives reload" is a merge gate, so the tree, the cursor and
 * the panel's dials are one versioned record in the `kv` table. A record that no
 * longer validates is dropped rather than migrated: the cost of losing a scratch
 * position is a fresh board, and the cost of trusting it is a screen that cannot
 * render.
 */

export interface SearchLimit {
  readonly id: string
  readonly label: string
  readonly group: 'Depth' | 'Time'
  readonly depth?: number
  readonly movetimeMs?: number
}

/**
 * The depth and time dials, as a closed list.
 *
 * Why presets rather than a free number: an analysis search holds a worker for as
 * long as it runs, and the lane budget in §5 is easier to defend when the longest
 * search a player can ask for is known in advance.
 */
export const SEARCH_LIMITS: readonly SearchLimit[] = [
  { id: 'depth-16', label: 'Depth 16', group: 'Depth', depth: 16 },
  { id: 'depth-20', label: 'Depth 20', group: 'Depth', depth: 20 },
  { id: 'depth-24', label: 'Depth 24', group: 'Depth', depth: 24 },
  { id: 'depth-30', label: 'Depth 30', group: 'Depth', depth: 30 },
  { id: 'time-1000', label: '1 second', group: 'Time', movetimeMs: 1000 },
  { id: 'time-3000', label: '3 seconds', group: 'Time', movetimeMs: 3000 },
  { id: 'time-10000', label: '10 seconds', group: 'Time', movetimeMs: 10_000 },
]

export const DEFAULT_SEARCH_LIMIT_ID = 'depth-24'

export function searchLimitById(id: string): SearchLimit {
  return (
    SEARCH_LIMITS.find((limit) => limit.id === id) ??
    SEARCH_LIMITS.find((limit) => limit.id === DEFAULT_SEARCH_LIMIT_ID) ?? {
      id: DEFAULT_SEARCH_LIMIT_ID,
      label: 'Depth 24',
      group: 'Depth',
      depth: 24,
    }
  )
}

export const MIN_MULTI_PV = 1
export const MAX_MULTI_PV = 5
export const DEFAULT_MULTI_PV = 3

export const AnalysisSettingsSchema = z.object({
  engineEnabled: z.boolean(),
  multiPv: z.number().int().min(MIN_MULTI_PV).max(MAX_MULTI_PV),
  limitId: z.string().min(1),
  orientation: ColorSchema,
  /** Off until the player asks for it: it is the one feature that leaves the device. */
  explorerEnabled: z.boolean(),
})
export type AnalysisSettings = z.infer<typeof AnalysisSettingsSchema>

export const DEFAULT_ANALYSIS_SETTINGS: AnalysisSettings = {
  engineEnabled: true,
  multiPv: DEFAULT_MULTI_PV,
  limitId: DEFAULT_SEARCH_LIMIT_ID,
  orientation: 'white',
  explorerEnabled: false,
}

export const ANALYSIS_SNAPSHOT_VERSION = 1

export const AnalysisSnapshotSchema = z.object({
  version: z.literal(ANALYSIS_SNAPSHOT_VERSION),
  tree: VariationTreeSchema,
  settings: AnalysisSettingsSchema,
  savedAt: TimestampSchema,
})
export type AnalysisSnapshot = z.infer<typeof AnalysisSnapshotSchema>

/** The one `kv` row this screen owns. Namespaced so a later sprint cannot collide. */
export const ANALYSIS_BOARD_KEY = defineKvKey('analysis:board', AnalysisSnapshotSchema)

/** `undefined` when nothing was saved, or when what was saved no longer validates. */
export async function loadAnalysisSnapshot(): Promise<AnalysisSnapshot | undefined> {
  return kvRepo.get(ANALYSIS_BOARD_KEY)
}

export async function saveAnalysisSnapshot(
  tree: VariationTree,
  settings: AnalysisSettings,
): Promise<Result<AnalysisSnapshot>> {
  return kvRepo.set(ANALYSIS_BOARD_KEY, {
    version: ANALYSIS_SNAPSHOT_VERSION,
    tree,
    settings,
    savedAt: now(),
  })
}
