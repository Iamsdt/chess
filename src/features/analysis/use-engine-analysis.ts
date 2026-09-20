import { useEffect, useState } from 'react'

import type { EngineLine, Fen } from '@/domain'
import { engine as appEngine, type Engine } from '@/engine'

/**
 * S19 · the live engine, bound to whatever position is on the board.
 *
 * The whole point of this hook is the cleanup function. `engine.analyse` is an
 * async generator whose search dies with the `AbortSignal` it was given, so
 * aborting in the effect's teardown — which React runs synchronously before the
 * next effect and on unmount — is what makes "leaving the screen stops the search"
 * true rather than hopeful. Nothing else here is allowed to await first.
 *
 * Snapshots are stored against the request that produced them, so a result for the
 * position the player has just left is never painted: the stale key simply stops
 * matching and the hook reports "searching" again without an extra render.
 */

export type EngineAnalysisStatus = 'off' | 'searching' | 'complete' | 'error'

export interface EngineAnalysis {
  readonly status: EngineAnalysisStatus
  /** Ordered by `multipv`; empty until the first snapshot arrives. */
  readonly lines: readonly EngineLine[]
  readonly depth: number
  readonly error: string | null
}

const OFF: EngineAnalysis = { status: 'off', lines: [], depth: 0, error: null }
const STARTING: EngineAnalysis = { status: 'searching', lines: [], depth: 0, error: null }

interface KeyedAnalysis {
  readonly key: string
  readonly analysis: EngineAnalysis
}

export interface EngineAnalysisOptions {
  /** Injectable so component tests can drive a fake engine with no worker. */
  readonly engine?: Engine | undefined
  readonly fen: Fen
  readonly enabled: boolean
  readonly multiPv: number
  readonly depth?: number | undefined
  readonly movetimeMs?: number | undefined
}

export function useEngineAnalysis({
  engine = appEngine,
  fen,
  enabled,
  multiPv,
  depth,
  movetimeMs,
}: EngineAnalysisOptions): EngineAnalysis {
  const [latest, setLatest] = useState<KeyedAnalysis | null>(null)
  const key = `${fen}|${String(multiPv)}|${String(depth)}|${String(movetimeMs)}`

  useEffect(() => {
    if (!enabled) return

    const controller = new AbortController()
    let live = true

    const pump = async (): Promise<void> => {
      const stream = engine.analyse(fen, {
        lane: 'interactive',
        multiPv,
        signal: controller.signal,
        ...(depth === undefined ? {} : { depth }),
        ...(movetimeMs === undefined ? {} : { movetimeMs }),
      })
      for (;;) {
        const step = await stream.next()
        // A cancelled search must not paint: the board has already moved on.
        if (!live) return
        if (step.done) {
          const outcome = step.value
          setLatest((previous) => ({
            key,
            analysis: outcome.ok
              ? {
                  status: 'complete',
                  lines: outcome.value.lines,
                  depth: outcome.value.depth,
                  error: null,
                }
              : {
                  status: 'error',
                  lines: previous?.key === key ? previous.analysis.lines : [],
                  depth: previous?.key === key ? previous.analysis.depth : 0,
                  error: outcome.error.message,
                },
          }))
          return
        }
        setLatest({
          key,
          analysis: {
            status: 'searching',
            lines: step.value,
            depth: step.value[0]?.depth ?? 0,
            error: null,
          },
        })
      }
    }

    void pump()

    return () => {
      live = false
      controller.abort()
    }
  }, [engine, fen, enabled, multiPv, depth, movetimeMs, key])

  if (!enabled) return OFF
  return latest?.key === key ? latest.analysis : STARTING
}
