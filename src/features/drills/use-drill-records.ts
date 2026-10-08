import { useCallback, useEffect, useState } from 'react'

import type { Result } from '@/domain'

/** Loading, failed or ready: the three states a screen must draw for stored data. */
export type RecordsState<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly records: T }

export interface RecordsHandle<T> {
  readonly state: RecordsState<T>
  /** Re-read after a failure. */
  readonly reload: () => void
  /** Adopt a table a write already returned, without a second read. */
  readonly adopt: (records: T) => void
}

/**
 * Reads a records table once on mount.
 *
 * `read` must be stable (a port method); the hook keys its effect on it so a screen
 * that rebuilds the callback every render would loop.
 */
export function useDrillRecords<T>(read: () => Promise<Result<T>>): RecordsHandle<T> {
  const [state, setState] = useState<RecordsState<T>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const leaving = new AbortController()
    void read().then(
      (result) => {
        if (leaving.signal.aborted) return
        setState(
          result.ok
            ? { status: 'ready', records: result.value }
            : { status: 'error', message: result.error.message },
        )
      },
      () => {
        if (leaving.signal.aborted) return
        setState({ status: 'error', message: 'Your drill records could not be opened.' })
      },
    )
    return () => {
      leaving.abort()
    }
  }, [read, attempt])

  const reload = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((value) => value + 1)
  }, [])

  const adopt = useCallback((records: T) => {
    setState({ status: 'ready', records })
  }, [])

  return { state, reload, adopt }
}
