import type { HintLevel, Timestamp } from '@/domain'

/**
 * Theme mastery: "how well do I see forks?", answered from the user's own attempts.
 *
 * Two decisions shape the numbers, and both exist to keep the answer honest on small
 * samples — which is the only sample size this screen ever has early on:
 *
 * - **A prior.** One solved fork is not 100% mastery. Every theme starts at
 *   {@link MASTERY_PRIOR} with the weight of {@link MASTERY_PRIOR_WEIGHT} attempts, so a
 *   theme has to be practised before it can claim to be strong — or be called weak.
 * - **Recency.** A fork missed in March says less than a fork missed on Tuesday, so each
 *   attempt is weighted by an exponential half-life. Mastery is a picture of now.
 */

/** One attempt, flattened to what mastery cares about. */
export interface ThemeAttemptRecord {
  readonly theme: string
  readonly solved: boolean
  /** The highest hint rung reached; a hinted solve is worth less than an unaided one. */
  readonly hintUsed: HintLevel | null
  readonly endedAt: Timestamp
}

export const MASTERY_PRIOR = 0.5
export const MASTERY_PRIOR_WEIGHT = 4

/** Days after which an attempt counts half as much. Roughly "the last fortnight matters". */
export const MASTERY_HALF_LIFE_DAYS = 14

/** What the hub's chips say about a theme. */
export type MasteryTone = 'needs-love' | 'steady' | 'strong'

export const NEEDS_LOVE_BELOW = 0.5
export const STRONG_FROM = 0.75

export interface ThemeMastery {
  readonly theme: string
  readonly attempted: number
  readonly solved: number
  /** 0–1, prior-smoothed and recency-weighted. */
  readonly mastery: number
  readonly tone: MasteryTone
  /** Change against the previous window, or `null` when there is not enough history. */
  readonly delta: number | null
  readonly lastAttemptedAt: Timestamp | null
}

export interface MasteryOptions {
  readonly now?: Timestamp | undefined
  readonly halfLifeDays?: number | undefined
  /** The window each side of the comparison used for {@link ThemeMastery.delta}. */
  readonly trendWindowDays?: number | undefined
}

const DAY_MS = 86_400_000

/** How much of a solve an attempt earns: unaided, hinted, or missed. */
export function attemptCredit(record: ThemeAttemptRecord): number {
  if (!record.solved) return 0
  if (record.hintUsed === null) return 1
  return record.hintUsed === 'nudge' ? 0.8 : 0.5
}

function toneOf(mastery: number): MasteryTone {
  if (mastery < NEEDS_LOVE_BELOW) return 'needs-love'
  return mastery >= STRONG_FROM ? 'strong' : 'steady'
}

function smoothed(weight: number, credit: number): number {
  return (credit + MASTERY_PRIOR * MASTERY_PRIOR_WEIGHT) / (weight + MASTERY_PRIOR_WEIGHT)
}

/** Mastery per theme, strongest last so the UI can show the weakest first. */
export function themeMastery(
  records: readonly ThemeAttemptRecord[],
  options: MasteryOptions = {},
): ThemeMastery[] {
  // A plain number, not a `Timestamp`: it is only ever subtracted, and defaulting it to
  // the newest attempt keeps the function pure for tests that pass historical data.
  const now: number =
    options.now ?? records.reduce((latest, record) => Math.max(latest, record.endedAt), 0)
  const halfLife = (options.halfLifeDays ?? MASTERY_HALF_LIFE_DAYS) * DAY_MS
  const trendWindow = (options.trendWindowDays ?? 30) * DAY_MS

  interface Bucket {
    weight: number
    credit: number
    attempted: number
    solved: number
    recentWeight: number
    recentCredit: number
    olderWeight: number
    olderCredit: number
    lastAttemptedAt: Timestamp | null
  }
  const buckets = new Map<string, Bucket>()

  for (const record of records) {
    const bucket = buckets.get(record.theme) ?? {
      weight: 0,
      credit: 0,
      attempted: 0,
      solved: 0,
      recentWeight: 0,
      recentCredit: 0,
      olderWeight: 0,
      olderCredit: 0,
      lastAttemptedAt: null,
    }
    const age = Math.max(now - record.endedAt, 0)
    const weight = 0.5 ** (age / halfLife)
    const credit = attemptCredit(record)

    bucket.weight += weight
    bucket.credit += weight * credit
    bucket.attempted += 1
    bucket.solved += record.solved ? 1 : 0
    if (age <= trendWindow) {
      bucket.recentWeight += 1
      bucket.recentCredit += credit
    } else if (age <= trendWindow * 2) {
      bucket.olderWeight += 1
      bucket.olderCredit += credit
    }
    if (bucket.lastAttemptedAt === null || record.endedAt > bucket.lastAttemptedAt) {
      bucket.lastAttemptedAt = record.endedAt
    }
    buckets.set(record.theme, bucket)
  }

  const list: ThemeMastery[] = []
  for (const [theme, bucket] of buckets) {
    const mastery = smoothed(bucket.weight, bucket.credit)
    const hasTrend = bucket.recentWeight >= 3 && bucket.olderWeight >= 3
    list.push({
      theme,
      attempted: bucket.attempted,
      solved: bucket.solved,
      mastery,
      tone: toneOf(mastery),
      delta: hasTrend
        ? smoothed(bucket.recentWeight, bucket.recentCredit) -
          smoothed(bucket.olderWeight, bucket.olderCredit)
        : null,
      lastAttemptedAt: bucket.lastAttemptedAt,
    })
  }

  return list.sort(
    (left, right) => left.mastery - right.mastery || left.theme.localeCompare(right.theme),
  )
}

/**
 * The themes a session should lean on.
 *
 * `minAttempts` keeps a theme seen once from being declared the user's weakness: the
 * prior already pulls a one-attempt theme toward the middle, and this stops the hub
 * announcing "today's focus" on the strength of a single unlucky puzzle.
 */
export function weakestThemes(
  mastery: readonly ThemeMastery[],
  count: number,
  minAttempts = 3,
): string[] {
  return mastery
    .filter((entry) => entry.attempted >= minAttempts && entry.mastery < STRONG_FROM)
    .slice(0, Math.max(count, 0))
    .map((entry) => entry.theme)
}

/** The hub's "solve rate, last 50": plain, unweighted, exactly what it says. */
export function recentSolveRate(
  records: readonly { readonly solved: boolean }[],
  window = 50,
): number | null {
  const slice = records.slice(-window)
  if (slice.length === 0) return null
  return slice.filter((record) => record.solved).length / slice.length
}
