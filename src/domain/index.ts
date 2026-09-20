/**
 * S03 · Domain contracts — the single source of truth every other sprint codes
 * against.
 *
 * Types come from `z.infer` of the schema beside them, so the compile-time shape
 * and the run-time check can never drift. Import from `@/domain`; the individual
 * modules are an implementation detail.
 *
 * Conventions this layer guarantees:
 * - Every instant is a branded `Timestamp` (epoch milliseconds). Calendar days,
 *   which streaks and the heatmap need, are a branded `LocalDate` (`YYYY-MM-DD`).
 * - Ids, FENs, SAN, UCI and squares are branded; mint them through their
 *   `toXxx()` constructor or through a schema that contains them.
 * - Data crossing a runtime boundary goes through `assertValid` or `parseValid`.
 * - Failures at a boundary are `Result` values, not exceptions.
 */
export * from './assert'
export * from './board'
export * from './coach'
export * from './content'
export * from './engine'
export * from './enums'
export * from './fixtures'
export * from './game'
export * from './ids'
export * from './jobs'
export * from './lesson'
export * from './openings'
export * from './primitives'
export * from './profile'
export * from './puzzle'
export * from './result'
export * from './share'
export * from './srs'
