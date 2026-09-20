import { Globe, Loader2, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Switch } from '@/design'
import type { Fen, Uci } from '@/domain'

import { EXPLORER_SOURCE_LABEL, lookupExplorer, type ExplorerReport } from './explorer'

/**
 * The opening explorer — the one place this app talks to a server.
 *
 * It is off until the player switches it on, it says out loud where the numbers
 * come from, and a failure is reported as "offline", not as a broken screen. The
 * board never waits for it: the lookup lives entirely inside this panel.
 */

/** Long enough that clicking through a line does not fire a request per move. */
const LOOKUP_DEBOUNCE_MS = 250

interface ExplorerState {
  readonly status: 'idle' | 'loading' | 'ready' | 'failed'
  readonly report: ExplorerReport | null
  readonly error: string | null
}

const IDLE: ExplorerState = { status: 'idle', report: null, error: null }
const LOADING: ExplorerState = { status: 'loading', report: null, error: null }

interface KeyedState {
  readonly key: string
  readonly state: ExplorerState
}

export interface ExplorerPanelProps {
  readonly fen: Fen
  readonly enabled: boolean
  readonly onToggle: (enabled: boolean) => void
  readonly onPlayMove: (uci: Uci) => void
  /** Injected by tests; the real panel uses the browser's `fetch`. */
  readonly fetchImpl?: typeof globalThis.fetch | undefined
  readonly isOnline?: (() => boolean) | undefined
}

export function ExplorerPanel({
  fen,
  enabled,
  onToggle,
  onPlayMove,
  fetchImpl,
  isOnline,
}: ExplorerPanelProps) {
  const [latest, setLatest] = useState<KeyedState | null>(null)
  const key = String(fen)

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    let live = true

    const timer = window.setTimeout(() => {
      void lookupExplorer(fen, {
        signal: controller.signal,
        ...(fetchImpl === undefined ? {} : { fetchImpl }),
        ...(isOnline === undefined ? {} : { isOnline }),
      }).then((result) => {
        if (!live) return
        setLatest({
          key,
          state: result.ok
            ? { status: 'ready', report: result.value, error: null }
            : { status: 'failed', report: null, error: result.error.message },
        })
      })
    }, LOOKUP_DEBOUNCE_MS)

    return () => {
      live = false
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [fen, enabled, fetchImpl, isOnline, key])

  const state: ExplorerState = !enabled ? IDLE : latest?.key === key ? latest.state : LOADING

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
        <Globe className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="flex-1">{EXPLORER_SOURCE_LABEL} · online lookup, optional</span>
        <Switch
          size="sm"
          checked={enabled}
          onCheckedChange={onToggle}
          aria-label="Look this position up online"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {!enabled ? (
          <p className="px-4 py-6 text-xs text-muted-foreground">
            The explorer sends the position on the board — and nothing else — to lichess.org to
            count how masters have played it. Everything else in Chess King stays on your device.
          </p>
        ) : state.status === 'loading' ? (
          <p
            className="flex items-center gap-2 px-4 py-6 text-xs text-muted-foreground"
            role="status"
          >
            <Loader2
              className="size-3.5 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            Looking this position up…
          </p>
        ) : state.status === 'failed' ? (
          <p
            className="flex items-center gap-2 px-4 py-6 text-xs text-muted-foreground"
            role="status"
          >
            <WifiOff className="size-3.5 shrink-0" aria-hidden="true" />
            {state.error ?? 'The explorer is unavailable.'}
          </p>
        ) : state.report === null || state.report.moves.length === 0 ? (
          <p className="px-4 py-6 text-xs text-muted-foreground">
            No master games reached this position.
          </p>
        ) : (
          <>
            <table className="w-full text-sm">
              <caption className="sr-only">Master games from this position</caption>
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-4 py-2 font-medium">
                    Move
                  </th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">
                    Games
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    White / Draw / Black
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {state.report.moves.map((move) => (
                  <tr key={move.uci} className="hover:bg-muted/40">
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        className="font-mono font-semibold hover:underline"
                        onClick={() => {
                          onPlayMove(move.uci)
                        }}
                      >
                        {move.san}
                      </button>
                    </td>
                    <td className="px-2 py-2 text-right text-muted-foreground tabular-nums">
                      {move.games.toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      <div
                        className="flex h-4 overflow-hidden rounded text-[9px] leading-4 font-semibold ring-1 ring-border"
                        aria-label={`White ${String(move.whitePercent)}%, draw ${String(move.drawPercent)}%, Black ${String(move.blackPercent)}%`}
                      >
                        <span
                          className="bg-white pl-1 text-[#1b2620]"
                          style={{ width: `${String(move.whitePercent)}%` }}
                        >
                          {String(move.whitePercent)}
                        </span>
                        <span
                          className="bg-muted-foreground/45 pl-1 text-white"
                          style={{ width: `${String(move.drawPercent)}%` }}
                        >
                          {String(move.drawPercent)}
                        </span>
                        <span
                          className="bg-[#3b4a44] pl-1 text-white"
                          style={{ width: `${String(move.blackPercent)}%` }}
                        >
                          {String(move.blackPercent)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-4 py-3 text-xs text-muted-foreground">
              {state.report.totalGames.toLocaleString()} master games reached this position. Turn
              the lookup off to stay fully offline.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
