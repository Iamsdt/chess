import { timestampFromDate, toTimestamp, type ReviewGrade, type SrsCard } from '@/domain'

/**
 * FSRS-6, the scheduler behind every spaced-repetition card in the app.
 *
 * Pure on purpose: a card and a grade go in, a card comes out, and the clock is an
 * argument. That is what lets the reference vectors in `fsrs.test.ts` pin the maths and
 * lets the openings drill (S17) reuse the same scheduler without knowing about chess.
 *
 * Formulas follow the FSRS-6 specification and the `py-fsrs` v6 reference implementation
 * (open-spaced-repetition). `w[n]` below is `DEFAULT_FSRS_PARAMS[n]`, and `G` is the grade
 * as 1 (again) .. 4 (easy).
 *
 * - Forgetting curve:      R(t, S) = (1 + FACTOR * t / S) ^ -w20,  FACTOR = 0.9^(-1/w20) - 1
 * - Interval for target r: I(r, S) = S / FACTOR * (r^(-1/w20) - 1)
 * - Initial stability:     S0(G) = w[G - 1]
 * - Initial difficulty:    D0(G) = w4 - e^(w5 * (G - 1)) + 1
 * - Next difficulty:       D' = w7 * D0(4) + (1 - w7) * (D + dD * (10 - D) / 9),  dD = -w6 * (G - 3)
 * - Recall stability:      S' = S * (1 + e^w8 * (11 - D) * S^-w9 * (e^(w10 * (1 - R)) - 1) * hard * easy)
 *                          with hard = w15 for Hard and easy = w16 for Easy, else 1
 * - Forget stability:      S' = min(w11 * D^-w12 * ((S + 1)^w13 - 1) * e^(w14 * (1 - R)), S / e^(w17 * w18))
 * - Same-day stability:    S' = S * e^(w17 * (G - 3 + w18)) * S^-w19, never below S for Good or Easy
 *
 * What this module adds to the specification, and why:
 * - Learning steps (1 and 10 minutes, relearning 10) as in `py-fsrs`, so a brand-new card
 *   is seen twice in a sitting before it is trusted with a day-scale interval.
 * - No interval fuzz. Fuzz hides a bug in a golden test and buys nothing for a bank this small.
 * - A `mastered` state, which FSRS does not have. See `MASTERY_STREAK`.
 */

/** The published FSRS-6 default weights, 21 of them, as shipped by py-fsrs 6 (checked by
 *  `fsrs-reference.test.ts`). */
export const DEFAULT_FSRS_PARAMS: readonly number[] = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835,
  0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
]

export interface FsrsConfig {
  readonly params: readonly number[]
  /** The recall probability an interval is aimed at. */
  readonly desiredRetention: number
  /** Minutes between the first sightings of a new card. */
  readonly learningSteps: readonly number[]
  /** Minutes before a lapsed card is shown again. */
  readonly relearningSteps: readonly number[]
  /** Longest interval the scheduler will grant, in days. */
  readonly maxIntervalDays: number
}

export const DEFAULT_FSRS_CONFIG: FsrsConfig = {
  params: DEFAULT_FSRS_PARAMS,
  desiredRetention: 0.9,
  learningSteps: [1, 10],
  relearningSteps: [10],
  maxIntervalDays: 36_500,
}

/**
 * Spaced recalls in a row that take a card out of the rotation.
 *
 * Why only day-scale recalls count: a card can be answered twice inside the same minute
 * while its learning steps run, and that is not remembering. The bank's promise,
 * "recalled three times in a row", is about coming back on another day and still knowing it.
 */
export const MASTERY_STREAK = 3

const MIN_DIFFICULTY = 1
const MAX_DIFFICULTY = 10
const MIN_STABILITY = 0.001
const MS_PER_MINUTE = 60_000
const MS_PER_DAY = 86_400_000

/** `w[index]`, where a short parameter list is a programmer error caught by the tests. */
function weight(params: readonly number[], index: number): number {
  return params[index] ?? Number.NaN
}

const GRADE_VALUE: Readonly<Record<ReviewGrade, 1 | 2 | 3 | 4>> = {
  again: 1,
  hard: 2,
  good: 3,
  easy: 4,
}

/** FACTOR in the forgetting curve; chosen so that R(S, S) = 0.9. */
function curveFactor(params: readonly number[]): number {
  const decay = -weight(params, 20)
  return Math.pow(0.9, 1 / decay) - 1
}

/** Probability of recall after `elapsedDays` for a card of the given stability. */
export function retrievability(
  stability: number,
  elapsedDays: number,
  params: readonly number[] = DEFAULT_FSRS_PARAMS,
): number {
  if (stability <= 0) return 0
  const decay = -weight(params, 20)
  return Math.pow(1 + (curveFactor(params) * elapsedDays) / stability, decay)
}

/** Whole days to wait so recall has fallen to `desiredRetention`, within the config's bounds. */
export function nextInterval(stability: number, config: FsrsConfig = DEFAULT_FSRS_CONFIG): number {
  const decay = -weight(config.params, 20)
  const days =
    (stability / curveFactor(config.params)) * (Math.pow(config.desiredRetention, 1 / decay) - 1)
  return Math.min(Math.max(Math.round(days), 1), config.maxIntervalDays)
}

export function initialStability(
  grade: ReviewGrade,
  params: readonly number[] = DEFAULT_FSRS_PARAMS,
) {
  return Math.max(weight(params, GRADE_VALUE[grade] - 1), MIN_STABILITY)
}

function rawInitialDifficulty(g: number, params: readonly number[]): number {
  return weight(params, 4) - Math.exp(weight(params, 5) * (g - 1)) + 1
}

function clampDifficulty(value: number): number {
  return Math.min(Math.max(value, MIN_DIFFICULTY), MAX_DIFFICULTY)
}

export function initialDifficulty(
  grade: ReviewGrade,
  params: readonly number[] = DEFAULT_FSRS_PARAMS,
): number {
  return clampDifficulty(rawInitialDifficulty(GRADE_VALUE[grade], params))
}

/** Linear damping keeps hard cards from piling up at 10, then mean reversion pulls toward D0(4). */
export function nextDifficulty(
  difficulty: number,
  grade: ReviewGrade,
  params: readonly number[] = DEFAULT_FSRS_PARAMS,
): number {
  const delta = -weight(params, 6) * (GRADE_VALUE[grade] - 3)
  const damped = difficulty + (delta * (MAX_DIFFICULTY - difficulty)) / 9
  const reverted =
    weight(params, 7) * rawInitialDifficulty(4, params) + (1 - weight(params, 7)) * damped
  return clampDifficulty(reverted)
}

/** Stability after a successful review that happened on a later day. */
export function recallStability(
  input: { difficulty: number; stability: number; retrievability: number; grade: ReviewGrade },
  params: readonly number[] = DEFAULT_FSRS_PARAMS,
): number {
  const { difficulty, stability, grade } = input
  const hardPenalty = grade === 'hard' ? weight(params, 15) : 1
  const easyBonus = grade === 'easy' ? weight(params, 16) : 1
  const growth =
    Math.exp(weight(params, 8)) *
    (11 - difficulty) *
    Math.pow(stability, -weight(params, 9)) *
    (Math.exp(weight(params, 10) * (1 - input.retrievability)) - 1) *
    hardPenalty *
    easyBonus
  return Math.max(stability * (1 + growth), MIN_STABILITY)
}

/** Stability after a lapse: what survives of the old memory, never more than before. */
export function forgetStability(
  input: { difficulty: number; stability: number; retrievability: number },
  params: readonly number[] = DEFAULT_FSRS_PARAMS,
): number {
  const { difficulty, stability } = input
  const longTerm =
    weight(params, 11) *
    Math.pow(difficulty, -weight(params, 12)) *
    (Math.pow(stability + 1, weight(params, 13)) - 1) *
    Math.exp(weight(params, 14) * (1 - input.retrievability))
  const shortTerm = stability / Math.exp(weight(params, 17) * weight(params, 18))
  return Math.max(Math.min(longTerm, shortTerm), MIN_STABILITY)
}

/** Stability after a review on the same day as the last one (learning steps, retries). */
export function shortTermStability(
  stability: number,
  grade: ReviewGrade,
  params: readonly number[] = DEFAULT_FSRS_PARAMS,
): number {
  const g = GRADE_VALUE[grade]
  const grown =
    stability *
    Math.exp(weight(params, 17) * (g - 3 + weight(params, 18))) *
    Math.pow(stability, -weight(params, 19))
  // As in py-fsrs: a same-day pass (Hard, Good or Easy) never lowers stability; only Again can.
  return Math.max(g >= 2 ? Math.max(grown, stability) : grown, MIN_STABILITY)
}

/** Whole days between two instants, the way the reference counts them. */
function wholeDaysBetween(from: number, to: number): number {
  return Math.max(Math.floor((to - from) / MS_PER_DAY), 0)
}

/** Recall probability of a card right now, for the bank's "how well do I know this". */
export function cardRetrievability(
  card: SrsCard,
  now: Date,
  params: readonly number[] = DEFAULT_FSRS_PARAMS,
): number {
  if (card.lastReviewedAt === null || card.state === 'new') return 0
  return retrievability(
    card.stability,
    wholeDaysBetween(card.lastReviewedAt, now.getTime()),
    params,
  )
}

type StepResult =
  | { readonly kind: 'stay'; readonly step: number; readonly minutes: number }
  | { readonly kind: 'graduate' }

/**
 * Where a card in the (re)learning steps goes next.
 *
 * Again restarts the steps; Hard repeats the step (the first step waits a little longer);
 * Good advances; Easy graduates at once. Mirrors `py-fsrs`.
 */
function nextStep(steps: readonly number[], step: number, grade: ReviewGrade): StepResult {
  const first = steps[0]
  if (first === undefined) return { kind: 'graduate' }
  if (grade === 'easy') return { kind: 'graduate' }
  if (grade === 'again') return { kind: 'stay', step: 0, minutes: first }
  if (grade === 'hard') {
    const here = steps[step] ?? first
    if (step === 0) {
      const second = steps[1]
      return {
        kind: 'stay',
        step: 0,
        minutes: second === undefined ? first * 1.5 : (first + second) / 2,
      }
    }
    return { kind: 'stay', step, minutes: here }
  }
  const advanced = step + 1
  const upcoming = steps[advanced]
  return upcoming === undefined
    ? { kind: 'graduate' }
    : { kind: 'stay', step: advanced, minutes: upcoming }
}

interface Memory {
  readonly stability: number
  readonly difficulty: number
}

/** Stability and difficulty after this review, before any scheduling decision. */
function updateMemory(
  card: SrsCard,
  grade: ReviewGrade,
  elapsedDays: number,
  config: FsrsConfig,
): Memory {
  const { params } = config
  if (card.state === 'new' || card.stability <= 0) {
    return {
      stability: initialStability(grade, params),
      difficulty: initialDifficulty(grade, params),
    }
  }
  const difficulty = nextDifficulty(card.difficulty, grade, params)
  const stability = memoryStability(card, grade, elapsedDays, params)
  return { stability, difficulty }
}

function memoryStability(
  card: SrsCard,
  grade: ReviewGrade,
  elapsedDays: number,
  params: readonly number[],
): number {
  if (elapsedDays < 1) return shortTermStability(card.stability, grade, params)
  const recall = retrievability(card.stability, elapsedDays, params)
  if (grade === 'again') {
    return forgetStability(
      { difficulty: card.difficulty, stability: card.stability, retrievability: recall },
      params,
    )
  }
  return recallStability(
    { difficulty: card.difficulty, stability: card.stability, retrievability: recall, grade },
    params,
  )
}

/** The consecutive-recall counter: only day-scale successes count, a lapse resets it. */
function nextStreak(card: SrsCard, grade: ReviewGrade, elapsedDays: number): number {
  if (grade === 'again') return 0
  if (grade === 'hard' || elapsedDays < 1) return card.consecutiveCorrect
  return card.consecutiveCorrect + 1
}

/**
 * Review a card and return its next state. The input is not modified.
 *
 * @param card the card as stored
 * @param grade how the recall went
 * @param now when the review happened
 * @param config scheduler settings; the published defaults unless a test or a setting overrides them
 */
export function reviewCard(
  card: SrsCard,
  grade: ReviewGrade,
  now: Date,
  config: FsrsConfig = DEFAULT_FSRS_CONFIG,
): SrsCard {
  const at = now.getTime()
  const stamp = timestampFromDate(now)
  const elapsedDays = card.lastReviewedAt === null ? 0 : wholeDaysBetween(card.lastReviewedAt, at)
  const memory = updateMemory(card, grade, elapsedDays, config)
  const streak = nextStreak(card, grade, elapsedDays)

  const common = {
    stability: memory.stability,
    difficulty: memory.difficulty,
    lastReviewedAt: stamp,
    elapsedDays,
    reps: card.reps + 1,
    updatedAt: stamp,
  }

  const inSteps = card.state === 'new' || card.state === 'learning' || card.state === 'relearning'
  if (inSteps || grade === 'again') {
    const relearning = card.state === 'relearning' || (!inSteps && grade === 'again')
    const steps = relearning ? config.relearningSteps : config.learningSteps
    const currentStep = card.learningStep ?? 0
    const lapses = !inSteps && grade === 'again' ? card.lapses + 1 : card.lapses
    const result = nextStep(steps, currentStep, grade)
    if (result.kind === 'stay') {
      return {
        ...card,
        ...common,
        state: relearning ? 'relearning' : 'learning',
        due: toTimestamp(at + result.minutes * MS_PER_MINUTE),
        scheduledDays: 0,
        lapses,
        learningStep: result.step,
        consecutiveCorrect: streak,
        masteredAt: null,
      }
    }
    return graduate(card, common, {
      at,
      streak,
      lapses,
      config,
      days: nextInterval(memory.stability, config),
    })
  }

  return graduate(card, common, {
    at,
    streak,
    lapses: card.lapses,
    config,
    days: nextInterval(memory.stability, config),
  })
}

/** Moves a card onto the day-scale schedule, and out of the rotation if it has earned it. */
function graduate(
  card: SrsCard,
  common: Pick<
    SrsCard,
    'stability' | 'difficulty' | 'lastReviewedAt' | 'elapsedDays' | 'reps' | 'updatedAt'
  >,
  schedule: { at: number; streak: number; lapses: number; config: FsrsConfig; days: number },
): SrsCard {
  const mastered = schedule.streak >= MASTERY_STREAK
  return {
    ...card,
    ...common,
    state: mastered ? 'mastered' : 'review',
    due: toTimestamp(schedule.at + schedule.days * MS_PER_DAY),
    scheduledDays: schedule.days,
    lapses: schedule.lapses,
    learningStep: null,
    consecutiveCorrect: schedule.streak,
    masteredAt: mastered ? (card.masteredAt ?? common.updatedAt) : null,
  }
}
