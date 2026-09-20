import { type EngineLane, type Timestamp } from '@/domain'

import { type EngineCapabilities } from './capabilities'

/**
 * What the engine is doing right now, for the devtools panel S11 will build.
 *
 * Why a snapshot rather than an event stream: the panel repaints on a timer and
 * only ever wants "what is true now". Nothing here is used to make decisions —
 * the pool owns its own state — so it can be sampled and dropped freely.
 */

export type EngineWorkerState = 'starting' | 'idle' | 'searching' | 'failed'

export interface EngineWorkerTelemetry {
  readonly id: string
  readonly index: number
  readonly state: EngineWorkerState
  readonly threads: number
  /** The lane of the search in progress, or `null` when idle. */
  readonly lane: EngineLane | null
  readonly depth: number
  readonly nps: number | null
  readonly timeMs: number | null
}

export interface EngineLaneTelemetry {
  readonly queued: number
  readonly running: number
}

export interface EngineSearchCounters {
  readonly completed: number
  readonly cancelled: number
  readonly timedOut: number
  /** Searches a higher lane pushed off an engine and that were then restarted. */
  readonly preempted: number
  readonly failed: number
}

export interface EngineTelemetry {
  readonly capabilities: EngineCapabilities
  readonly workers: readonly EngineWorkerTelemetry[]
  readonly lanes: Readonly<Record<EngineLane, EngineLaneTelemetry>>
  readonly searches: EngineSearchCounters
  readonly updatedAt: Timestamp
}

export type EngineTelemetryListener = (telemetry: EngineTelemetry) => void

/** Why spelled out: the `Record` makes the compiler notice a new lane here. */
export function emptyLaneTelemetry(): Record<EngineLane, EngineLaneTelemetry> {
  return {
    play: { queued: 0, running: 0 },
    interactive: { queued: 0, running: 0 },
    batch: { queued: 0, running: 0 },
  }
}
