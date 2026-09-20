/**
 * Whether the default engine has anywhere to run.
 *
 * Stockfish lives in a Web Worker, so a browser that has workers blocked — by a
 * policy, an extension, or a host that never implemented them — cannot analyse at
 * all. Asking once, and saying so on screen, is better than a spinner that never
 * resolves. A screen that was handed its own engine skips this: an injected engine
 * brings its own transport.
 */
export function canRunDefaultEngine(): boolean {
  return typeof Worker === 'function'
}
