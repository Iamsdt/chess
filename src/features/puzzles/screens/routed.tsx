import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'

import { PuzzleRushScreen as RushRunner } from './puzzle-rush'
import { PuzzleSolver } from './puzzle-solver'
import { PuzzlesHub } from './puzzles-hub'
import { SessionSummary } from './session-summary'

import type { NavigateTo, PuzzlePath } from './navigation'

/**
 * The four zero-prop components S04's route table mounts.
 *
 * They exist only to bind the router: every screen underneath takes a `navigate`
 * callback, so it renders in a test without a router around it, and this file is the one
 * place in the feature that imports `@tanstack/react-router`.
 */
function useNavigatePuzzles(): NavigateTo {
  const navigate = useNavigate()
  return useCallback(
    (path: PuzzlePath) => {
      void navigate({ to: path })
    },
    [navigate],
  )
}

export function PuzzlesHubScreen() {
  const navigate = useNavigatePuzzles()
  return <PuzzlesHub navigate={navigate} />
}

export function PuzzleSolverScreen() {
  const navigate = useNavigatePuzzles()
  return <PuzzleSolver navigate={navigate} />
}

export function PuzzleRushScreen() {
  const navigate = useNavigatePuzzles()
  return <RushRunner navigate={navigate} />
}

export function SessionSummaryScreen() {
  const navigate = useNavigatePuzzles()
  return <SessionSummary navigate={navigate} />
}
