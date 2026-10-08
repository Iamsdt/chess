import { Link } from '@tanstack/react-router'
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  GitBranch,
  Grid2x2Plus,
  MousePointerClick,
  Swords,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Board } from '@/board'
import { detectOpening, parseUci } from '@/chess'
import { CalculationDialog } from '@/coach/calculation/calculation-dialog'
import { CALCULATION_CARD } from '@/coach/fixtures/calculation-fixtures'
import {
  Badge,
  Button,
  PageHeader,
  SimpleTooltip,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
  useTheme,
} from '@/design'
import { emptyBoardShapes, type Arrow, type BoardShapes, type Uci } from '@/domain'
import type { Engine } from '@/engine'

import { searchLimitById } from './analysis-state'
import { EnginePanel } from './engine-panel'
import { canRunDefaultEngine } from './engine-support'
import { EvalBar } from './eval-bar'
import { ExplorerPanel } from './explorer-panel'
import { IoPanel } from './io-panel'
import { SetupDialog } from './setup-dialog'
import { TreePanel } from './tree-panel'
import { treeToPgn } from './tree-pgn'
import { useAnalysisBoard } from './use-analysis-board'
import { useEngineAnalysis } from './use-engine-analysis'
import { lineStartOf, lineStartOfFen, nodeOf, numberingFor, plyOf } from './variation-tree'

/**
 * S19 · the analysis board.
 *
 * The screen itself holds no rules and no tree logic: `useAnalysisBoard` owns the
 * position and `useEngineAnalysis` owns the search, which is what makes both of
 * them testable without a DOM. What is left here is layout, the keyboard path and
 * the overlays.
 */

/** Three arrows is what the prototype shows and what three MultiPV lines produce. */
const MAX_ARROWS = 3

export interface AnalysisScreenProps {
  /** Injected by tests so the screen can run against a fake engine with no worker. */
  readonly engine?: Engine | undefined
  readonly explorerFetch?: typeof globalThis.fetch | undefined
  readonly isOnline?: (() => boolean) | undefined
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

export function AnalysisScreen({ engine, explorerFetch, isOnline }: AnalysisScreenProps = {}) {
  const { pieceSet } = useTheme()
  const board = useAnalysisBoard()
  const [setupOpen, setSetupOpen] = useState(false)
  const [treeOpen, setTreeOpen] = useState(false)

  const limit = searchLimitById(board.settings.limitId)
  const engineAvailable = engine !== undefined || canRunDefaultEngine()
  const analysis = useEngineAnalysis({
    engine,
    fen: board.fen,
    // Analysing before the saved tree is read back would search the wrong position.
    enabled: engineAvailable && board.ready && board.settings.engineEnabled,
    multiPv: board.settings.multiPv,
    depth: limit.depth,
    movetimeMs: limit.movetimeMs,
  })

  const { problem, clearProblem, back, forward, toStart, toEnd, play } = board

  useEffect(() => {
    if (problem === null) return
    toast.error(problem)
    clearProblem()
  }, [problem, clearProblem])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingTarget(event.target)) return
      const actions: Readonly<Record<string, (() => void) | undefined>> = {
        ArrowLeft: back,
        ArrowRight: forward,
        Home: toStart,
        End: toEnd,
      }
      const action = actions[event.key]
      if (action === undefined) return
      event.preventDefault()
      action()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [back, forward, toStart, toEnd])

  const lineStart = useMemo(() => lineStartOf(board.tree), [board.tree])
  // A principal variation is numbered from the position the engine was given, not
  // from the root of the tree — otherwise every line after Black's reply reads a
  // move early.
  const pvLineStart = useMemo(() => lineStartOfFen(board.fen), [board.fen])
  const current = nodeOf(board.tree, board.tree.currentId)
  const sideToMove = board.game?.turn ?? 'white'

  const opening = useMemo(
    () => (board.game === null ? null : detectOpening(board.game)),
    [board.game],
  )

  const pgn = useMemo(() => {
    const written = treeToPgn(board.tree)
    return written.ok ? written.value : ''
  }, [board.tree])

  const shapes = useMemo<BoardShapes>(() => {
    const next = emptyBoardShapes()
    if (current !== null) {
      const parts = parseUci(current.uci)
      if (parts.ok) next.highlight = [parts.value.from, parts.value.to]
    }
    next.check = board.checkSquare
    if (board.settings.engineEnabled) {
      const arrows: Arrow[] = []
      for (const line of analysis.lines.slice(0, MAX_ARROWS)) {
        const first = line.pv[0]
        if (first === undefined) continue
        const parts = parseUci(first)
        if (!parts.ok) continue
        // The engine's own choice gets the `best` arrow; the runners-up get the
        // quieter one, so three near-equal moves do not read as three best moves.
        arrows.push({
          from: parts.value.from,
          to: parts.value.to,
          kind: line.multipv === 1 ? 'best' : 'sage',
        })
      }
      next.arrows = arrows
    }
    return next
  }, [current, board.checkSquare, board.settings.engineEnabled, analysis.lines])

  const playUci = useCallback(
    (uci: Uci) => {
      play(uci)
    },
    [play],
  )

  const numbering = numberingFor(Math.max(plyOf(board.tree, board.tree.currentId), 1), lineStart)
  const moveCaption =
    current === null
      ? 'Starting position'
      : `${String(numbering.moveNumber)}${numbering.white ? '.' : '…'} ${current.san}`

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 p-2 sm:gap-4 sm:p-4 lg:p-6">
      <PageHeader
        eyebrow="Analysis board"
        title="Analysis"
        description="A free board with engine lines, a variation tree and position setup."
        actions={
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {opening === null ? null : (
              <Badge variant="soft" className="max-md:hidden">
                {opening.name}
              </Badge>
            )}
            <SimpleTooltip content="Flip board orientation">
              <Button
                variant="ghost"
                size="sm"
                aria-label="Flip board"
                onClick={() => {
                  board.updateSettings({
                    orientation: board.settings.orientation === 'white' ? 'black' : 'white',
                  })
                }}
              >
                <ArrowUpDown aria-hidden="true" />
                <span className="max-sm:hidden">Flip</span>
              </Button>
            </SimpleTooltip>
            <SimpleTooltip content="Set up custom position">
              <Button
                variant="ghost"
                size="sm"
                aria-label="Set up position"
                onClick={() => {
                  setSetupOpen(true)
                }}
              >
                <Grid2x2Plus aria-hidden="true" />
                <span className="max-sm:hidden">Set up</span>
              </Button>
            </SimpleTooltip>
            <SimpleTooltip content="Sample calculation tree (mock, not computed from this position yet)">
              <Button
                variant="ghost"
                size="sm"
                aria-label="Calculation tree"
                onClick={() => {
                  setTreeOpen(true)
                }}
              >
                <GitBranch aria-hidden="true" />
                <span className="max-sm:hidden">Calculation tree</span>
              </Button>
            </SimpleTooltip>
            <Button asChild size="sm">
              {/* The position rides in the URL so the setup screen can offer it. S12 owns
                  what it does with it; this side of the handover is all S19 can write. */}
              <Link to="/play" search={{ fen: board.fen }}>
                <Swords aria-hidden="true" />
                <span className="max-sm:hidden">Practice from here</span>
                <span className="sm:hidden">Practice</span>
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="flex justify-center" aria-label="Analysis board">
          <div className="w-full max-w-[min(100%,calc(100dvh-220px))] lg:max-w-[min(100%,70vh)]">
            <div className="flex gap-2 sm:gap-2.5">
              <EvalBar
                score={analysis.lines[0]?.score ?? null}
                sideToMove={sideToMove}
                orientation={board.settings.orientation}
              />
              <div className="min-w-0 flex-1 overflow-hidden rounded-xl shadow-[0_18px_40px_-18px_rgba(30,40,30,.25)] ring-1 ring-border">
                <Board
                  fen={board.fen}
                  orientation={board.settings.orientation}
                  movable="both"
                  legalMoves={board.legalMoveMap}
                  isPromotion={board.isPromotion}
                  onMove={play}
                  shapes={shapes}
                  coordinates
                  pieceSet={pieceSet}
                  label="Analysis board"
                  announcement={moveCaption}
                />
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-2 pl-6 text-xs text-muted-foreground sm:pl-7">
              <span>
                <span className="font-medium text-foreground">
                  {sideToMove === 'white' ? 'White' : 'Black'} to move
                </span>{' '}
                · {moveCaption}
              </span>
              <span className="flex items-center gap-1 max-sm:hidden">
                <MousePointerClick className="size-3.5" aria-hidden="true" />
                Click a piece, then a square
              </span>
            </div>
          </div>
        </section>

        <div className="flex min-h-0 flex-col gap-4 overflow-auto lg:max-h-[calc(100dvh-56px-48px)]">
          <EnginePanel
            analysis={analysis}
            settings={board.settings}
            available={engineAvailable}
            fen={board.fen}
            sideToMove={sideToMove}
            lineStart={pvLineStart}
            onSettingsChange={board.updateSettings}
            onPlayMove={playUci}
          />

          <aside
            className="card flex min-h-[360px] flex-col overflow-hidden sm:min-h-[420px]"
            aria-label="Moves, explorer and import"
          >
            <Tabs defaultValue="moves" className="min-h-0 flex-1 gap-0">
              <TabsList variant="line" className="mx-3 mt-2">
                <TabsTrigger value="moves">Moves</TabsTrigger>
                <TabsTrigger value="explorer">Explorer</TabsTrigger>
                <TabsTrigger value="io">FEN / PGN</TabsTrigger>
              </TabsList>
              <TabsContent value="moves" className="flex min-h-0 flex-1 flex-col">
                <TreePanel
                  tree={board.tree}
                  lineStart={lineStart}
                  onSelect={board.select}
                  onPromote={board.promote}
                  onPromoteToMain={board.promoteToMain}
                  onDelete={board.remove}
                />
              </TabsContent>
              <TabsContent value="explorer" className="flex min-h-0 flex-1 flex-col">
                <ExplorerPanel
                  fen={board.fen}
                  enabled={board.settings.explorerEnabled}
                  onToggle={(enabled) => {
                    board.updateSettings({ explorerEnabled: enabled })
                  }}
                  onPlayMove={playUci}
                  fetchImpl={explorerFetch}
                  isOnline={isOnline}
                />
              </TabsContent>
              <TabsContent value="io" className="flex min-h-0 flex-1 flex-col">
                <IoPanel
                  fen={board.fen}
                  pgn={pgn}
                  onLoadFen={(value) => board.loadFen(value).ok}
                  onLoadPgn={(value) => board.loadPgn(value).ok}
                />
              </TabsContent>
            </Tabs>

            <div className="border-t p-3">
              <div className="grid grid-cols-4 gap-1">
                <SimpleTooltip content="Start position (Home)">
                  <Button variant="ghost" size="sm" aria-label="Start position" onClick={toStart}>
                    <ChevronsLeft aria-hidden="true" />
                  </Button>
                </SimpleTooltip>
                <SimpleTooltip content="Previous move (←)">
                  <Button variant="ghost" size="sm" aria-label="Previous move" onClick={back}>
                    <ChevronLeft aria-hidden="true" />
                  </Button>
                </SimpleTooltip>
                <SimpleTooltip content="Next move (→)">
                  <Button variant="ghost" size="sm" aria-label="Next move" onClick={forward}>
                    <ChevronRight aria-hidden="true" />
                  </Button>
                </SimpleTooltip>
                <SimpleTooltip content="Last move (End)">
                  <Button variant="ghost" size="sm" aria-label="Last move" onClick={toEnd}>
                    <ChevronsRight aria-hidden="true" />
                  </Button>
                </SimpleTooltip>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <SetupDialog
        open={setupOpen}
        onOpenChange={setSetupOpen}
        initialFen={board.fen}
        onLoad={(fen) => {
          board.loadFen(fen)
        }}
      />
      {/* Mock: the tree is a fixture, labelled "Sample tree", until the builder exists. */}
      <CalculationDialog attachment={CALCULATION_CARD} open={treeOpen} onOpenChange={setTreeOpen} />
    </div>
  )
}
