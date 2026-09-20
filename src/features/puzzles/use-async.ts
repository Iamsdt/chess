import { useCallback, useEffect, useState } from 'react'

/**
 * One async read, with the three states every screen owes the user.
 *
 * `@/data`'s live-query hooks cover "one repository call, re-run on write". These screens
 * need something else: several calls whose results are folded together by the pure
 * modules (rating, mastery, curriculum), refreshed when the screen asks. Rather than
 * chaining live queries — which would re-run the whole fold on every unrelated write —
 * this runs the fold once and exposes `reload`.
 *
 * `load` must be memoised by the caller (`useCallback`): it is the dependency, so an
 * inline function would re-fetch on every render.
 */
export type AsyncStatus = 'loading' | 'ready' | 'error'

export interface AsyncState<T> {
  readonly status: AsyncStatus
  readonly data: T | undefined
  /** A sentence the user can act on, never a stack trace. */
  readonly error: string | null
  readonly reload: () => void
}

interface Internal<T> {
  readonly status: AsyncStatus
  readonly data: T | undefined
  readonly error: string | null
}

export function useAsyncData<T>(load: () => Promise<T>): AsyncState<T> {
  const [state, setState] = useState<Internal<T>>({
    status: 'loading',
    data: undefined,
    error: null,
  })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let live = true
    load()
      .then((data) => {
        if (live) setState({ status: 'ready', data, error: null })
      })
      .catch((cause: unknown) => {
        if (!live) return
        setState({
          status: 'error',
          data: undefined,
          error: cause instanceof Error ? cause.message : 'Something went wrong reading your data.',
        })
      })
    return () => {
      live = false
    }
  }, [load, nonce])

  const reload = useCallback(() => {
    setState((current) => ({ ...current, status: 'loading', error: null }))
    setNonce((value) => value + 1)
  }, [])

  return { status: state.status, data: state.data, error: state.error, reload }
}
