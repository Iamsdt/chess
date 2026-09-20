import { toLocalDate, toTimestamp, type LocalDate, type Timestamp } from '../primitives'

/**
 * Shared ground for every fixture.
 *
 * Why fixed values rather than `Date.now()` and random ids: these factories are
 * used by every other sprint's tests, and a fixture that changes between runs
 * turns a golden-file diff into noise.
 */

/** 2026-09-19T12:00:00Z — the Saturday the prototype's Today screen shows. */
export const FIXTURE_NOW: Timestamp = toTimestamp(1_789_819_200_000)
export const FIXTURE_TODAY: LocalDate = toLocalDate('2026-09-19')
export const FIXTURE_TIME_ZONE = 'Europe/London'

/** Why: one place decides how an override merges, so every factory behaves alike. */
export function withOverrides<T extends object>(base: T, overrides?: Partial<T>): T {
  return overrides === undefined ? base : { ...base, ...overrides }
}

/** Why: shifting a fixture's clock is the single most common override. */
export function fixtureTimeAfter(minutes: number): Timestamp {
  return toTimestamp(FIXTURE_NOW + minutes * 60_000)
}
