import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { gamesRepo } from '@/data'
import type { GameFilter, GameRow } from '@/data'
import { domainError, type DomainError } from '@/domain'

import { LIBRARY_ROW_LIMIT } from './library-filters'
import { createWorkerPgnPort } from './pgn-port'

import type { PgnPort } from './pgn-port'

/**
 * The screen's data, as hooks.
 *
 * Why these call the repository directly instead of `useGames` from `@/data`: that hook
 * is built on `useLiveQuery`, which re-throws a failed query *during render*. On this
 * screen a database that will not open would take the whole route down with it, and §5
 * asks every screen for an error state — not an error boundary. Reading explicitly costs
 * cross-tab liveness, which this screen does not need: it reloads after its own imports,
 * and nothing else writes games while it is open.
 */

export type RowsState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly rows: readonly GameRow[] }
  | { readonly status: 'error'; readonly error: DomainError }

export interface LibraryRows {
  readonly state: RowsState
  /** Called after an import so the table shows what just landed. */
  readonly reload: () => void
}

export function useGameRows(filter: GameFilter): LibraryRows {
  const [loaded, setLoaded] = useState<{
    readonly filter: GameFilter
    readonly token: number
    readonly state: RowsState
  } | null>(null)
  const [token, setToken] = useState(0)
  const page = useMemo(() => ({ limit: LIBRARY_ROW_LIMIT }), [])

  useEffect(() => {
    let live = true
    gamesRepo.list(filter, page).then(
      (rows) => {
        if (live) setLoaded({ filter, token, state: { status: 'ready', rows } })
      },
      (cause: unknown) => {
        if (!live) return
        const message = cause instanceof Error ? cause.message : 'The library could not be read'
        setLoaded({
          filter,
          token,
          state: { status: 'error', error: domainError('io', message, { where: 'games.list' }) },
        })
      },
    )
    return () => {
      live = false
    }
  }, [filter, page, token])

  const reload = useCallback(() => {
    setToken((value) => value + 1)
  }, [])

  /**
   * Loading is derived, not stored.
   *
   * Setting a "loading" flag from inside the effect would mean a second render for every
   * query; comparing the answer in hand against the query that is current says the same
   * thing for free, and can never get stuck showing a spinner for a finished request.
   */
  const state: RowsState =
    loaded !== null && loaded.filter === filter && loaded.token === token
      ? loaded.state
      : { status: 'loading' }

  return { state, reload }
}

/**
 * The PGN worker, started on first use and terminated on the way out.
 *
 * Why a getter rather than a value: the worker must not start when the bundle is
 * imported — every route that merely links here would pay for it, and it is idle until
 * the user pastes something. Returning a getter also survives React's development
 * double-mount, which closes the port once before the screen settles; the next call
 * simply starts a fresh one.
 */
export function usePgnPort(create: () => PgnPort = createWorkerPgnPort): () => PgnPort {
  const createRef = useRef(create)
  const ref = useRef<PgnPort | null>(null)

  useEffect(
    () => () => {
      ref.current?.close()
      ref.current = null
    },
    [],
  )

  return useCallback(() => (ref.current ??= createRef.current()), [])
}
