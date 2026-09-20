/**
 * Fixture factories.
 *
 * Why they live in the domain rather than in each sprint's test folder: every
 * sprint builds against these before its upstream feature exists, and a second
 * copy of "a plausible game" would drift from the schema the moment either moved.
 *
 * Each factory returns the same value every time and takes an optional
 * `Partial<T>` of overrides, so a test states only the field it cares about.
 */
export * from './base'
export * from './chess'
export * from './learn'
export * from './puzzle'
export * from './srs'
export * from './user'
