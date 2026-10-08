import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'

import { repertoireRepo } from '@/data'
import type { Color } from '@/domain'

import { APP_DEPS } from './deps'
import { startCoverage, type CoverageReport } from './gaps'
import { distributionFor, type OpponentMove } from './popularity'
import { loadLines, type LineSummary, type OpeningsDeps } from './service'
import { buildTree, type RepertoireTree } from './tree'

/**
 * Live repertoire data for the screens.
 *
 * `undefined` while the first read is in flight and `null` once it found no tree: the
 * first is a loading state, the second the empty state, and they must not be confused.
 */
export interface Trees {
  readonly white: RepertoireTree | null
  readonly black: RepertoireTree | null
}

export function useTrees(): Trees | undefined {
  const white = useLiveQuery(() => repertoireRepo.listByColor('white'), [])
  const black = useLiveQuery(() => repertoireRepo.listByColor('black'), [])
  return useMemo(() => {
    if (white === undefined || black === undefined) return undefined
    return { white: buildTree('white', white), black: buildTree('black', black) }
  }, [white, black])
}

export function treeOf(trees: Trees, color: Color): RepertoireTree | null {
  return color === 'white' ? trees.white : trees.black
}

/** Every line of a tree with its card; re-runs when a review changes a card. */
export function useLines(
  tree: RepertoireTree | null,
  deps: OpeningsDeps = APP_DEPS,
): readonly LineSummary[] | undefined {
  return useLiveQuery(
    () => (tree === null ? Promise.resolve([]) : loadLines(deps, tree)),
    [tree, deps],
  )
}

export interface CoverageState {
  readonly report: CoverageReport | null
  readonly running: boolean
  readonly checked: number
}

interface CoverageResult {
  readonly tree: RepertoireTree | null
  readonly explorer: ReadonlyMap<string, readonly OpponentMove[]> | undefined
  readonly report: CoverageReport | null
  readonly checked: number
}

const SLICE_MS = 8

/**
 * The gaps report, computed in small slices after each edit.
 *
 * Why timers and not a worker: the walk needs the tree and a cache of estimates that
 * live on this thread, and an 8 ms slice between timers keeps input responsive. The last
 * finished report stays on screen while the next one is computed, so editing never
 * blanks the panel; `running` says it is out of date.
 */
export function useCoverage(
  tree: RepertoireTree | null,
  explorer?: ReadonlyMap<string, readonly OpponentMove[]>,
): CoverageState {
  const [state, setState] = useState<CoverageResult>({
    tree: null,
    explorer: undefined,
    report: null,
    checked: 0,
  })

  useEffect(() => {
    if (tree === null) return undefined
    const run = startCoverage(tree, distributionFor(explorer))
    let timer: ReturnType<typeof setTimeout> | undefined
    let cancelled = false
    const tick = (): void => {
      if (cancelled) return
      const done = run.step(SLICE_MS)
      if (done) {
        setState({ tree, explorer, report: run.report(), checked: run.checked() })
        return
      }
      setState((previous) => ({ ...previous, checked: run.checked() }))
      timer = setTimeout(tick, 0)
    }
    timer = setTimeout(tick, 0)
    return () => {
      cancelled = true
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [tree, explorer])

  const settled = state.tree === tree && state.explorer === explorer
  return {
    report: tree === null ? null : state.report,
    running: tree !== null && !settled,
    checked: state.checked,
  }
}
