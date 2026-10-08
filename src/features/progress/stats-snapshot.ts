import { z } from 'zod'

import { defineKvKey, type GameRow, type PracticeSession } from '@/data'
import {
  localDateOf,
  type MistakeEntry,
  type Profile,
  type PuzzleAttempt,
  type StreakState,
  type Timestamp,
} from '@/domain'

import type { ProgressModel, TimeRange } from './progress-stats'

/**
 * S22 · The precomputed Growth rows.
 *
 * The `rebuild-stats` job aggregates every attempt, session and game once and parks the
 * result in `kv`, so opening Growth is a read rather than a pass over the whole history.
 * The snapshot carries a signature of the rows it was built from: when the signature or
 * the day no longer matches, the screen ignores it and aggregates live, so a stale row can
 * never show a wrong number.
 */

/** Why a helper: a field typed `T | undefined` is stored either present or absent. */
const maybe = <S extends z.ZodType>(schema: S) => z.union([schema, z.undefined()])

const ChartPointSchema = z.object({ x: z.number(), y: z.number(), value: z.number() })

const ChartSchema = z.object({
  line: z.string(),
  area: z.string(),
  gridlines: z.array(z.object({ y: z.number(), label: z.string() })),
  first: ChartPointSchema,
  last: ChartPointSchema,
  table: z.array(z.object({ at: z.number(), value: z.number() })),
})

const SkillSchema = z.object({
  theme: z.string(),
  attempts: z.number(),
  score: z.number(),
  previous: maybe(z.number()),
})

const RadarSchema = z.object({
  rings: z.array(z.string()),
  axes: z.array(z.object({ x: z.number(), y: z.number() })),
  current: z.string(),
  previous: maybe(z.string()),
  dots: z.array(z.object({ x: z.number(), y: z.number() })),
  labels: z.array(
    z.object({
      x: z.number(),
      y: z.number(),
      anchor: z.enum(['start', 'middle', 'end']),
      text: z.string(),
      value: z.number(),
    }),
  ),
})

const HeatmapSchema = z.object({
  weeks: z.array(
    z.array(
      z.object({
        kind: z.enum(['none', 'low', 'med', 'high', 'max', 'freeze', 'future']),
        title: z.string(),
      }),
    ),
  ),
  months: z.array(z.object({ label: z.string(), weeks: z.number() })),
  practicedDays: z.number(),
  longestStreak: z.number(),
  currentStreak: z.number(),
  freezesUsed: z.number(),
  averageSessionMs: maybe(z.number()),
  daysThisMonth: z.object({ practiced: z.number(), elapsed: z.number() }),
  busiestWeekday: maybe(z.string()),
  favouriteHour: maybe(z.number()),
})

const MilestoneBase = {
  id: z.string(),
  title: z.string(),
  description: z.string(),
  icon: z.enum(['puzzle', 'flower', 'rating', 'review', 'mistake']),
}

const GardenSchema = z.object({
  stageIndex: z.number(),
  level: z.number(),
  practicedDays: z.number(),
  next: maybe(
    z.object({
      id: z.enum(['seed', 'sprout', 'sapling', 'bloom', 'tree']),
      label: z.string(),
      days: z.number(),
    }),
  ),
  daysToNext: z.number(),
  watered: z.boolean(),
  minutesToWater: z.number(),
})

const ModelSchema: z.ZodType<ProgressModel> = z.object({
  metrics: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
      delta: z.string(),
      tone: z.enum(['success', 'neutral']),
      icon: z.enum(['up', 'down', 'rotate', 'none']),
    }),
  ),
  puzzleChart: maybe(ChartSchema),
  puzzleCount: z.number(),
  accuracyChart: maybe(ChartSchema),
  gameCount: z.number(),
  skills: z.array(SkillSchema),
  radar: maybe(RadarSchema),
  heatmap: HeatmapSchema,
  garden: GardenSchema,
  earned: z.array(z.object({ ...MilestoneBase, earnedOn: z.string() })),
  pending: z.array(
    z.object({
      ...MilestoneBase,
      current: z.number(),
      total: z.number(),
      currentDisplay: z.string(),
    }),
  ),
  window: z.object({ from: z.number(), to: z.number() }),
})

export interface StatsSnapshot {
  readonly version: 1
  readonly generatedAt: number
  /** The local day it was built on; the garden and heatmap are only right for that day. */
  readonly day: string
  readonly timeZone: string
  readonly signature: string
  readonly models: Readonly<Record<TimeRange, ProgressModel>>
}

export const StatsSnapshotSchema: z.ZodType<StatsSnapshot> = z.object({
  version: z.literal(1),
  generatedAt: z.number(),
  day: z.string(),
  timeZone: z.string(),
  signature: z.string(),
  models: z.object({ '30d': ModelSchema, '90d': ModelSchema, all: ModelSchema }),
})

export const STATS_SNAPSHOT_KEY = defineKvKey('stats:progress', StatsSnapshotSchema)

export interface SignatureParts {
  readonly attempts: readonly PuzzleAttempt[]
  readonly sessions: readonly PracticeSession[]
  readonly games: readonly GameRow[]
  readonly mistakes: readonly MistakeEntry[]
  readonly profile: Profile | undefined
  readonly streak: StreakState | undefined
}

/**
 * A cheap fingerprint of everything the model reads.
 *
 * Counts plus the newest attempt and the total practice time catch every append; the reviewed-game count and the
 * ratings catch the two in-place edits that change a chart without changing a count.
 */
export function statsSignature(parts: SignatureParts): string {
  const newest = (values: readonly number[]): number => values.reduce((a, b) => Math.max(a, b), 0)
  return [
    parts.attempts.length,
    newest(parts.attempts.map((a) => a.endedAt)),
    parts.sessions.length,
    parts.sessions.reduce((sum, s) => sum + s.durationMs, 0),
    parts.games.length,
    parts.games.filter((g) => g.accuracy !== undefined).length,
    parts.mistakes.length,
    parts.profile?.puzzleRating ?? 0,
    parts.streak?.current ?? 0,
    parts.streak?.freezeDaysUsed.length ?? 0,
  ].join(':')
}

/** The model for one range, or `undefined` when the snapshot no longer describes the rows. */
export function modelFromSnapshot(
  snapshot: StatsSnapshot | undefined,
  range: TimeRange,
  context: { readonly signature: string; readonly now: Timestamp; readonly timeZone: string },
): ProgressModel | undefined {
  if (snapshot === undefined) return undefined
  if (snapshot.signature !== context.signature) return undefined
  if (snapshot.timeZone !== context.timeZone) return undefined
  if (snapshot.day !== localDateOf(context.now, context.timeZone)) return undefined
  return snapshot.models[range]
}
