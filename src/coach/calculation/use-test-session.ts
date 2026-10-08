import { useState } from 'react'

import type { AttemptReview, Pick } from './test-me-model'

/** Test me's attempt state; it lives in the dialog so switching tabs keeps it. */
export type TestStep = 'candidates' | 'calculate' | 'verdict' | 'reveal'
export type CalcMode = 'guided' | 'visualize'

export interface TestState {
  readonly step: TestStep
  readonly picks: readonly Pick[]
  readonly chosen: number | null
  readonly mode: CalcMode
  readonly active: number
  readonly review: AttemptReview | null
  /** Scores of finished attempts, newest last. */
  readonly attempts: readonly number[]
}

const FRESH: Omit<TestState, 'attempts'> = {
  step: 'candidates',
  picks: [],
  chosen: null,
  mode: 'guided',
  active: 0,
  review: null,
}

export interface TestSession {
  readonly state: TestState
  readonly set: (patch: Partial<TestState>) => void
  readonly updatePick: (index: number, patch: Partial<Pick>) => void
  readonly restart: () => void
}

/** Lives in the dialog, so switching to Explore and back does not lose the attempt. */
export function useTestSession(): TestSession {
  const [state, setState] = useState<TestState>({ ...FRESH, attempts: [] })
  return {
    state,
    set: (patch) => {
      setState((current) => ({ ...current, ...patch }))
    },
    updatePick: (index, patch) => {
      setState((current) => ({
        ...current,
        picks: current.picks.map((pick, i) => (i === index ? { ...pick, ...patch } : pick)),
      }))
    },
    restart: () => {
      setState((current) => ({ ...FRESH, attempts: current.attempts }))
    },
  }
}
