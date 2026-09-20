import { useCallback, useEffect, useMemo, useState } from 'react'

import type { LegalMoveMap } from '@/board'
import { isCheck, legalMoves, type ChessGame, type LegalMove, type MoveInput } from '@/chess'
import { ok, START_FEN, toSquare, type Fen, type Result, type Square } from '@/domain'

import {
  DEFAULT_ANALYSIS_SETTINGS,
  loadAnalysisSnapshot,
  saveAnalysisSnapshot,
  type AnalysisSettings,
} from './analysis-state'
import { treeFromPgn } from './tree-pgn'
import {
  addMove,
  createVariationTree,
  deleteNode,
  gameAt,
  goTo,
  lastNodeId,
  nextNodeId,
  previousNodeId,
  promoteToMainLine,
  promoteVariation,
  type VariationNodeId,
  type VariationTree,
} from './variation-tree'

/**
 * S19 · everything the screen holds, in one hook.
 *
 * The tree itself is pure (`variation-tree.ts`); this is only the React skin around
 * it plus the `kv` row that makes it survive a reload. The rebuilt `ChessGame` is
 * memoised per tree because legal moves, check and repetition all need history that
 * a FEN has thrown away, and replaying a 40-move line costs far less than storing
 * one game object per node would.
 */

/** Long enough that dragging through a line writes once, short enough to survive a tab close. */
const SAVE_DEBOUNCE_MS = 400

export interface AnalysisBoard {
  /** `false` until the saved position has been read back; the engine waits for it. */
  readonly ready: boolean
  readonly tree: VariationTree
  readonly settings: AnalysisSettings
  readonly game: ChessGame | null
  readonly fen: Fen
  readonly legalMoveMap: LegalMoveMap
  readonly checkSquare: Square | null
  /** The last thing the player did that could not be done, in their words. */
  readonly problem: string | null
  play: (move: MoveInput) => void
  isPromotion: (from: Square, to: Square) => boolean
  select: (id: VariationNodeId | null) => void
  back: () => void
  forward: () => void
  toStart: () => void
  toEnd: () => void
  promote: (id: VariationNodeId) => void
  promoteToMain: (id: VariationNodeId) => void
  remove: (id: VariationNodeId) => void
  /** Replace the whole tree with an empty one rooted at this position. */
  loadFen: (fen: string) => Result<Fen>
  loadPgn: (text: string) => Result<VariationTree>
  updateSettings: (change: Partial<AnalysisSettings>) => void
  clearProblem: () => void
}

function emptyTree(): VariationTree {
  const tree = createVariationTree(START_FEN)
  // `START_FEN` is a constant the domain layer already validated, so this cannot fail.
  if (!tree.ok) throw new Error(tree.error.message)
  return tree.value
}

function movesByOrigin(moves: readonly LegalMove[]): LegalMoveMap {
  const map = new Map<Square, Square[]>()
  for (const move of moves) {
    const destinations = map.get(move.from)
    if (destinations === undefined) map.set(move.from, [move.to])
    else if (!destinations.includes(move.to)) destinations.push(move.to)
  }
  return map
}

function kingSquare(game: ChessGame): Square | null {
  if (!isCheck(game)) return null
  const board = game.fen.split(' ')[0] ?? ''
  const wanted = game.turn === 'white' ? 'K' : 'k'
  const ranks = board.split('/')
  for (const [rankIndex, rankText] of ranks.entries()) {
    let fileIndex = 0
    for (const char of rankText) {
      const skip = Number(char)
      if (!Number.isNaN(skip)) {
        fileIndex += skip
        continue
      }
      if (char === wanted) {
        const file = 'abcdefgh'[fileIndex]
        if (file !== undefined) return toSquare(`${file}${String(8 - rankIndex)}`)
      }
      fileIndex += 1
    }
  }
  return null
}

export function useAnalysisBoard(): AnalysisBoard {
  const [tree, setTree] = useState<VariationTree>(emptyTree)
  const [settings, setSettings] = useState<AnalysisSettings>(DEFAULT_ANALYSIS_SETTINGS)
  const [ready, setReady] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void loadAnalysisSnapshot().then(
      (snapshot) => {
        if (!live) return
        if (snapshot !== undefined) {
          setTree(snapshot.tree)
          setSettings(snapshot.settings)
        }
        setReady(true)
      },
      () => {
        // A storage failure must not cost the player the board; it costs them history.
        if (live) setReady(true)
      },
    )
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    const timer = window.setTimeout(() => {
      void saveAnalysisSnapshot(tree, settings)
    }, SAVE_DEBOUNCE_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [ready, tree, settings])

  const game = useMemo(() => {
    const rebuilt = gameAt(tree, tree.currentId)
    return rebuilt.ok ? rebuilt.value : null
  }, [tree])

  const moves = useMemo(() => (game === null ? [] : legalMoves(game)), [game])
  const legalMoveMap = useMemo(() => movesByOrigin(moves), [moves])
  const checkSquare = useMemo(() => (game === null ? null : kingSquare(game)), [game])

  const play = useCallback(
    (move: MoveInput) => {
      const added = addMove(tree, tree.currentId, move)
      if (!added.ok) {
        setProblem(added.error.message)
        return
      }
      setTree(added.value.tree)
    },
    [tree],
  )

  const isPromotion = useCallback(
    (from: Square, to: Square) =>
      moves.some((move) => move.from === from && move.to === to && move.promotion !== undefined),
    [moves],
  )

  const select = useCallback((id: VariationNodeId | null) => {
    setTree((current) => goTo(current, id))
  }, [])

  const back = useCallback(() => {
    setTree((current) => goTo(current, previousNodeId(current)))
  }, [])

  const forward = useCallback(() => {
    setTree((current) => goTo(current, nextNodeId(current)))
  }, [])

  const toStart = useCallback(() => {
    setTree((current) => goTo(current, null))
  }, [])

  const toEnd = useCallback(() => {
    setTree((current) => goTo(current, lastNodeId(current)))
  }, [])

  const promote = useCallback((id: VariationNodeId) => {
    setTree((current) => promoteVariation(current, id))
  }, [])

  const promoteToMain = useCallback((id: VariationNodeId) => {
    setTree((current) => promoteToMainLine(current, id))
  }, [])

  const remove = useCallback((id: VariationNodeId) => {
    setTree((current) => deleteNode(current, id))
  }, [])

  const loadFen = useCallback((fen: string): Result<Fen> => {
    const created = createVariationTree(fen)
    if (!created.ok) {
      setProblem(created.error.message)
      return created
    }
    setProblem(null)
    setTree(created.value)
    return ok(created.value.rootFen)
  }, [])

  const loadPgn = useCallback((text: string): Result<VariationTree> => {
    const parsed = treeFromPgn(text)
    if (!parsed.ok) {
      setProblem(parsed.error.message)
      return parsed
    }
    setProblem(null)
    setTree(parsed.value)
    return parsed
  }, [])

  const updateSettings = useCallback((change: Partial<AnalysisSettings>) => {
    setSettings((current) => ({ ...current, ...change }))
  }, [])

  const clearProblem = useCallback(() => {
    setProblem(null)
  }, [])

  return {
    ready,
    tree,
    settings,
    game,
    fen: game?.fen ?? tree.rootFen,
    legalMoveMap,
    checkSquare,
    problem,
    play,
    isPromotion,
    select,
    back,
    forward,
    toStart,
    toEnd,
    promote,
    promoteToMain,
    remove,
    loadFen,
    loadPgn,
    updateSettings,
    clearProblem,
  }
}
