/**
 * S15 · SRS + Mistake Bank.
 *
 * The scheduler contract other features code against (S17's opening drill reuses it):
 * `reviewCard`, `buildDueQueue`, `newCardFrom` and the `ReviewGrade` type. The review
 * session screen is deliberately not exported here; the Mistakes screen imports it directly
 * so a drill that only schedules cards does not pull the board into its chunk.
 */
export type { ReviewGrade, SrsCard, SrsState, SrsSubject } from '@/domain'

export { isActive, newCardFrom } from './cards'
export { captureMissedPuzzle, firstWrongMove, type MissedPuzzle } from './capture'
export {
  cardRetrievability,
  DEFAULT_FSRS_CONFIG,
  DEFAULT_FSRS_PARAMS,
  MASTERY_STREAK,
  nextInterval,
  retrievability,
  reviewCard,
  type FsrsConfig,
} from './fsrs'
export { calendarDaysUntil, comesBackLabel, dueLabel } from './format'
export { EASY_WITHIN_MS, gradeAttempt, HARD_AFTER_MS, type Attempt } from './grade'
export { buildDueQueue, interleave, type QueueOptions } from './queue'
export { buildRecap, type Recap } from './recap'
export {
  currentItem,
  reduceSession,
  startSession,
  summarise,
  type AttemptOutcome,
  type ReviewAction,
  type ReviewItem,
  type ReviewPhase,
  type ReviewSessionState,
  type SessionSummary,
} from './session'
export {
  DAILY_NEW_CAP,
  DAILY_REVIEW_CAP,
  loadItemFor,
  loadReviewQueue,
  postponeDue,
  saveReviewedCard,
} from './store'
