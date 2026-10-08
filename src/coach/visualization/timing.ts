/** Every delay the app controls (coach-agent.md §10.5: the app sets timing, the model only asks). */
export interface Timing {
  /** Between narrated moves. */
  readonly paceMs: number
  /** How long a position shows before it hides. */
  readonly flashMs: number
  /** How long Peek shows the real position. */
  readonly peekMs: number
  /** How long Anchors stay lit. */
  readonly anchorMs: number
  /** Between moves of the slow replay. */
  readonly replayMs: number
}

export const DEFAULT_TIMING: Timing = {
  paceMs: 1600,
  flashMs: 6000,
  peekMs: 2000,
  anchorMs: 2000,
  replayMs: 2400,
}
