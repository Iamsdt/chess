import { useEffect, useId, useRef } from 'react'
import { create } from 'zustand'

import type { CoachScreenSnapshot } from './build-context'

/**
 * The screen → Sage channel: what is on the board right now.
 *
 * Why a store and not a prop: the screen that knows the position and the panel that needs it sit
 * in different branches of the shell, and the shell may not import a feature's internals. A
 * screen writes here through `usePublishCoachContext`; the shell's coach slot reads.
 *
 * Why an owner: when the route changes, the next screen's first publish can run before the last
 * screen's cleanup. Clearing only your own snapshot means a late cleanup cannot erase the
 * newcomer's.
 */
interface ScreenContextState {
  readonly owner: string | null
  readonly snapshot: CoachScreenSnapshot | null
  publish: (owner: string, snapshot: CoachScreenSnapshot) => void
  /** Clear by anyone: "What Sage sees" → Turn → Clear. The next publish brings it back. */
  clear: () => void
  release: (owner: string) => void
}

export const useCoachScreenStore = create<ScreenContextState>()((set, get) => ({
  owner: null,
  snapshot: null,
  publish: (owner, snapshot) => {
    set({ owner, snapshot })
  },
  clear: () => {
    set({ owner: null, snapshot: null })
  },
  release: (owner) => {
    if (get().owner === owner) set({ owner: null, snapshot: null })
  },
}))

/**
 * Tell Sage what this screen is showing. One call per screen; `null` publishes nothing (a screen
 * still loading, or between puzzles).
 *
 * Why the snapshot is compared by value: a screen builds it inline on every render, and the
 * position it describes changes far less often than the screen renders. Keying the effect on the
 * serialised snapshot publishes once per real change instead of once per render.
 */
export function usePublishCoachContext(snapshot: CoachScreenSnapshot | null): void {
  const owner = useId()
  const key = snapshot === null ? '' : JSON.stringify(snapshot)
  const latest = useRef(snapshot)

  useEffect(() => {
    latest.current = snapshot
  })

  useEffect(() => {
    const { publish, release } = useCoachScreenStore.getState()
    if (latest.current === null) release(owner)
    else publish(owner, latest.current)
  }, [owner, key])

  useEffect(() => {
    const { release } = useCoachScreenStore.getState()
    return () => {
      release(owner)
    }
  }, [owner])
}
