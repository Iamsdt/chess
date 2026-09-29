import { Link } from '@tanstack/react-router'
import {
  GitBranch,
  Info,
  MessageCircle,
  Pencil,
  Plus,
  Repeat,
  Search,
  Sparkles,
} from 'lucide-react'
import { useContext, useMemo, useRef, useState } from 'react'

import { ChatPanelContext } from '@/app/shell/shell-contexts'
import { Board } from '@/board'
import { Button, Input, cn, toast } from '@/design'
import { emptyBoardShapes, toFen, toSquare, type BoardShapes, type Color, type Fen } from '@/domain'

export interface RepertoireOpeningItem {
  readonly id: string
  readonly name: string
  readonly details: string
  readonly fen: Fen
  readonly color: Color
  readonly dueCount?: number
  readonly isUpToDate?: boolean
  readonly masteryPercent: number
  readonly masteryCaption: string
  readonly labelPrefix?: string
}

export interface ExploreOpeningItem {
  readonly id: string
  readonly name: string
  readonly codeAndMoves: string
  readonly fen: Fen
  readonly color: Color
  readonly style: 'solid' | 'sharp'
  readonly styleBadgeText: string
  readonly popularityPercent: number
  readonly difficulty: 'Easy' | 'Medium' | 'Hard'
  readonly specialBadge?: {
    readonly text: string
    readonly icon?: 'sparkles'
    readonly className: string
  }
  readonly tags: readonly {
    readonly label: string
    readonly className: string
  }[]
}

const WHITE_REPERTOIRE: readonly RepertoireOpeningItem[] = [
  {
    id: 'italian',
    name: 'Italian Game',
    details: 'C50 · Giuoco Pianissimo · 9 lines',
    fen: toFen('r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4'),
    color: 'white',
    dueCount: 3,
    masteryPercent: 82,
    masteryCaption: 'Mastery · you score 61% in games',
  },
  {
    id: 'london',
    name: 'London System',
    details: 'D02 · vs 1…d5 and 1…Nf6 · 5 lines',
    fen: toFen('rnbqkb1r/pp3ppp/4pn2/2pp4/3P1B2/2P1PN2/PP3PPP/RN1QKB1R b KQkq - 0 5'),
    color: 'white',
    isUpToDate: true,
    masteryPercent: 64,
    masteryCaption: 'Mastery · next review in 3 days',
  },
]

const BLACK_REPERTOIRE: readonly RepertoireOpeningItem[] = [
  {
    id: 'caro-kann',
    name: 'Caro-Kann Defence',
    labelPrefix: 'vs 1.e4',
    details: 'B10–B19 · Advance, Classical, Exchange · 16 lines',
    fen: toFen('rnbqkbnr/pp2pppp/2p5/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3'),
    color: 'black',
    dueCount: 3,
    masteryPercent: 57,
    masteryCaption: 'Mastery · Advance line 3 is shaky',
  },
  {
    id: 'qgd',
    name: "Queen's Gambit Declined",
    labelPrefix: 'vs 1.d4',
    details: 'D30 · Orthodox setup · 4 lines',
    fen: toFen('rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4'),
    color: 'black',
    dueCount: 1,
    masteryPercent: 41,
    masteryCaption: 'Mastery · started 2 weeks ago',
  },
]

const CARO_TREE_FEN = toFen('rnbqkbnr/pp2pppp/2p5/3pP3/3P4/8/PPP2PPP/RNBQKBNR b KQkq - 0 3')

const EXPLORE_OPENINGS: readonly ExploreOpeningItem[] = [
  {
    id: 'french',
    name: 'French Defence',
    codeAndMoves: 'C00 · 1.e4 e6',
    fen: toFen('rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3'),
    color: 'black',
    style: 'solid',
    styleBadgeText: 'solid',
    popularityPercent: 62,
    difficulty: 'Medium',
    specialBadge: {
      text: 'Fits your style',
      icon: 'sparkles',
      className: 'border-transparent bg-reward-soft text-reward-ink',
    },
    tags: [
      { label: 'solid', className: 'border-transparent bg-sky text-sky-ink' },
      { label: 'pawn chains', className: 'border-transparent bg-muted text-muted-foreground' },
    ],
  },
  {
    id: 'najdorf',
    name: 'Sicilian Najdorf',
    codeAndMoves: 'B90 · 5…a6',
    fen: toFen('rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6'),
    color: 'black',
    style: 'sharp',
    styleBadgeText: 'sharp',
    popularityPercent: 78,
    difficulty: 'Hard',
    specialBadge: {
      text: 'Rafi plays this',
      className: 'text-muted-foreground',
    },
    tags: [
      { label: 'sharp', className: 'border-transparent bg-cta-soft text-cta' },
      { label: 'heavy theory', className: 'border-transparent bg-muted text-muted-foreground' },
    ],
  },
  {
    id: 'ruy-lopez',
    name: 'Ruy Lopez',
    codeAndMoves: 'C60 · 3.Bb5',
    fen: toFen('r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3'),
    color: 'white',
    style: 'solid',
    styleBadgeText: 'solid',
    popularityPercent: 70,
    difficulty: 'Medium',
    tags: [
      { label: 'solid', className: 'border-transparent bg-sky text-sky-ink' },
      { label: 'long plans', className: 'border-transparent bg-muted text-muted-foreground' },
    ],
  },
  {
    id: 'slav',
    name: 'Slav Defence',
    codeAndMoves: 'D10 · 2…c6',
    fen: toFen('rnbqkbnr/pp2pppp/2p5/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3'),
    color: 'black',
    style: 'solid',
    styleBadgeText: 'solid',
    popularityPercent: 55,
    difficulty: 'Easy',
    specialBadge: {
      text: 'Caro-Kann cousin',
      icon: 'sparkles',
      className: 'border-transparent bg-reward-soft text-reward-ink',
    },
    tags: [
      { label: 'solid', className: 'border-transparent bg-sky text-sky-ink' },
      { label: 'vs 1.d4', className: 'border-transparent bg-muted text-muted-foreground' },
    ],
  },
  {
    id: 'kid',
    name: "King's Indian Defence",
    codeAndMoves: 'E60 · 1.d4 Nf6 2.c4 g6',
    fen: toFen('rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N5/PP3PPP/R1BQKBNR w KQkq - 0 5'),
    color: 'black',
    style: 'sharp',
    styleBadgeText: 'sharp',
    popularityPercent: 48,
    difficulty: 'Hard',
    tags: [
      { label: 'sharp', className: 'border-transparent bg-cta-soft text-cta' },
      { label: 'kingside attack', className: 'border-transparent bg-muted text-muted-foreground' },
    ],
  },
  {
    id: 'vienna',
    name: 'Vienna Game',
    codeAndMoves: 'C25 · 2.Nc3',
    fen: toFen('rnbqkbnr/pppp1ppp/8/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq - 1 2'),
    color: 'white',
    style: 'sharp',
    styleBadgeText: 'sharp',
    popularityPercent: 34,
    difficulty: 'Easy',
    tags: [
      { label: 'sharp', className: 'border-transparent bg-cta-soft text-cta' },
      { label: 'surprise value', className: 'border-transparent bg-muted text-muted-foreground' },
    ],
  },
]

/**
 * Openings Repertoire Screen (`/openings`) — ported from `prototype/openings.html`.
 *
 * Provides:
 * - Sub-tabs: "My repertoire" and "Explore"
 * - As White and As Black repertoire cards with mastery progress and due indicators
 * - Interactive Caro-Kann tree preview with move indentation and position diagram
 * - Explore directory with search, color filtering, style chips, and draft additions
 */
export function OpeningsScreen() {
  const chatPanel = useContext(ChatPanelContext)
  const treeSectionRef = useRef<HTMLElement>(null)

  const [activeTab, setActiveTab] = useState<'mine' | 'explore'>('mine')
  const [searchQuery, setSearchQuery] = useState('')
  const [colorFilter, setColorFilter] = useState<'all' | 'white' | 'black'>('all')
  const [styleFilter, setStyleFilter] = useState<'any' | 'solid' | 'sharp'>('any')
  const [addedOpenings, setAddedOpenings] = useState<ReadonlySet<string>>(new Set())

  const caroTreeShapes: BoardShapes = useMemo(
    () => ({
      ...emptyBoardShapes(),
      highlight: [toSquare('e4'), toSquare('e5')],
    }),
    [],
  )

  const handleScrollToTree = () => {
    setActiveTab('mine')
    if (treeSectionRef.current) {
      treeSectionRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const handleAskSage = (prompt: string) => {
    if (chatPanel) {
      chatPanel.open()
      chatPanel.focusComposer()
    }
    toast(prompt)
  }

  const handleAddToRepertoire = (item: ExploreOpeningItem) => {
    setAddedOpenings((prev) => new Set([...prev, item.id]))
    if (item.id === 'french') {
      toast('French Defence added as a draft. Pick your first moves.')
    } else {
      toast(`${item.name} added as a draft`)
    }
  }

  const filteredExploreOpenings = useMemo(() => {
    return EXPLORE_OPENINGS.filter((item) => {
      if (colorFilter !== 'all' && item.color !== colorFilter) {
        return false
      }
      if (styleFilter !== 'any' && item.style !== styleFilter) {
        return false
      }
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.trim().toLowerCase()
        const matchesName = item.name.toLowerCase().includes(query)
        const matchesCode = item.codeAndMoves.toLowerCase().includes(query)
        if (!matchesName && !matchesCode) {
          return false
        }
      }
      return true
    })
  }, [colorFilter, styleFilter, searchQuery])

  return (
    <div className="page pb-12">
      <header className="flex flex-wrap items-end justify-between gap-3 sm:gap-4">
        <div>
          <p className="label">Library</p>
          <h1 className="page-title mt-1">Openings</h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            A repertoire you build yourself, one move at a time. Drill it until it's automatic.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="text-right text-xs leading-tight max-sm:text-left sm:text-sm">
            <div className="font-medium">7 lines due</div>
            <div className="text-xs text-muted-foreground">about 5 min</div>
          </div>
          <Button asChild className="btn-cta h-10 sm:h-11">
            <Link to="/openings/drill">
              <Repeat className="size-[18px]" aria-hidden="true" />
              Drill due lines
            </Link>
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <div className="tabs mt-6 sm:mt-7" role="tablist" aria-label="Openings navigation">
        <button
          type="button"
          role="tab"
          id="tab-mine"
          aria-selected={activeTab === 'mine'}
          aria-controls="panel-mine"
          className={cn('tab', activeTab === 'mine' && 'is-active')}
          onClick={() => {
            setActiveTab('mine')
          }}
        >
          My repertoire
        </button>
        <button
          type="button"
          role="tab"
          id="tab-explore"
          aria-selected={activeTab === 'explore'}
          aria-controls="panel-explore"
          className={cn('tab', activeTab === 'explore' && 'is-active')}
          onClick={() => {
            setActiveTab('explore')
          }}
        >
          Explore
        </button>
      </div>

      {/* MY REPERTOIRE PANEL */}
      {activeTab === 'mine' && (
        <div
          id="panel-mine"
          role="tabpanel"
          aria-labelledby="tab-mine"
          className="mt-6 space-y-6 sm:space-y-8"
        >
          {/* As White */}
          <section aria-labelledby="w-h">
            <h2 id="w-h" className="flex items-center gap-2 text-base font-bold sm:text-lg">
              <span
                className="size-3 rounded-full bg-white ring-1 ring-border"
                aria-hidden="true"
              />
              As White
            </h2>
            <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(min(100%,350px),1fr))] gap-3 sm:gap-4">
              {WHITE_REPERTOIRE.map((item) => (
                <article key={item.id} className="card card-hover flex gap-3 p-3.5 sm:gap-4 sm:p-4">
                  <div className="w-20 shrink-0 self-start overflow-hidden rounded-lg ring-1 ring-border sm:w-24 md:w-28">
                    <Board
                      fen={item.fen}
                      orientation={item.color}
                      coordinates={false}
                      movable="none"
                      label={`${item.name} position`}
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold sm:text-base">{item.name}</h3>
                        <p className="truncate text-xs text-muted-foreground">{item.details}</p>
                      </div>
                      {item.dueCount !== undefined ? (
                        <span className="badge shrink-0 border-transparent bg-cta-soft text-xs text-cta">
                          {String(item.dueCount)} due
                        </span>
                      ) : (
                        <span className="badge shrink-0 text-xs text-muted-foreground">
                          Up to date
                        </span>
                      )}
                    </div>
                    <div className="mt-2.5 flex items-center gap-2 sm:mt-3">
                      <span
                        role="progressbar"
                        aria-valuenow={item.masteryPercent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${item.name} mastery`}
                        className="progress h-1.5 flex-1"
                      >
                        <span style={{ width: `${String(item.masteryPercent)}%` }} />
                      </span>
                      <span className="text-xs font-medium">{String(item.masteryPercent)}%</span>
                    </div>
                    <p className="mt-1 text-xs leading-tight text-muted-foreground">
                      {item.masteryCaption}
                    </p>
                    <div className="mt-auto flex flex-wrap gap-2 pt-2.5 sm:pt-3">
                      <Button
                        asChild
                        size="sm"
                        className="h-8 text-xs sm:h-9 sm:text-sm"
                        variant={item.dueCount !== undefined ? 'default' : 'outline'}
                      >
                        <Link to="/openings/drill">
                          <Repeat className="size-3.5" aria-hidden="true" />
                          Drill
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs sm:h-9 sm:text-sm"
                        onClick={() =>
                          toast(
                            item.id === 'italian'
                              ? 'Opening the Italian tree editor'
                              : 'Opening the London tree editor',
                          )
                        }
                      >
                        <GitBranch className="size-3.5" aria-hidden="true" />
                        Edit tree
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* As Black */}
          <section aria-labelledby="b-h">
            <h2 id="b-h" className="flex items-center gap-2 text-base font-bold sm:text-lg">
              <span className="size-3 rounded-full bg-foreground" aria-hidden="true" />
              As Black
            </h2>
            <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(min(100%,350px),1fr))] gap-3 sm:gap-4">
              {BLACK_REPERTOIRE.map((item) => (
                <article
                  key={item.id}
                  className={cn(
                    'card card-hover flex gap-3 p-3.5 sm:gap-4 sm:p-4',
                    item.id === 'caro-kann' && 'border-cta/30',
                  )}
                >
                  <div className="w-20 shrink-0 self-start overflow-hidden rounded-lg ring-1 ring-border sm:w-24 md:w-28">
                    <Board
                      fen={item.fen}
                      orientation={item.color}
                      coordinates={false}
                      movable="none"
                      label={`${item.name} position`}
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {item.labelPrefix && <p className="label">{item.labelPrefix}</p>}
                        <h3 className="truncate text-sm font-bold sm:text-base">{item.name}</h3>
                        <p className="truncate text-xs text-muted-foreground">{item.details}</p>
                      </div>
                      {item.dueCount !== undefined ? (
                        <span className="badge shrink-0 border-transparent bg-cta-soft text-xs text-cta">
                          {String(item.dueCount)} due
                        </span>
                      ) : (
                        <span className="badge shrink-0 text-xs text-muted-foreground">
                          Up to date
                        </span>
                      )}
                    </div>
                    <div className="mt-2.5 flex items-center gap-2 sm:mt-3">
                      <span
                        role="progressbar"
                        aria-valuenow={item.masteryPercent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${item.name} mastery`}
                        className="progress h-1.5 flex-1"
                      >
                        <span style={{ width: `${String(item.masteryPercent)}%` }} />
                      </span>
                      <span className="text-xs font-medium">{String(item.masteryPercent)}%</span>
                    </div>
                    <p className="mt-1 text-xs leading-tight text-muted-foreground">
                      {item.masteryCaption}
                    </p>
                    <div className="mt-auto flex flex-wrap gap-2 pt-2.5 sm:pt-3">
                      <Button
                        asChild
                        size="sm"
                        variant="default"
                        className="h-8 text-xs sm:h-9 sm:text-sm"
                      >
                        <Link to="/openings/drill">
                          <Repeat className="size-3.5" aria-hidden="true" />
                          Drill
                        </Link>
                      </Button>
                      {item.id === 'caro-kann' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs sm:h-9 sm:text-sm"
                          onClick={handleScrollToTree}
                        >
                          <GitBranch className="size-3.5" aria-hidden="true" />
                          Edit tree
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs sm:h-9 sm:text-sm"
                          onClick={() => toast('Opening the QGD tree editor')}
                        >
                          <GitBranch className="size-3.5" aria-hidden="true" />
                          Edit tree
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <button
              type="button"
              className="mt-4 flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-3 text-xs text-muted-foreground transition hover:bg-card sm:text-sm"
              onClick={() => {
                setActiveTab('explore')
              }}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add an opening · vs 1.c4, 1.Nf3 and others are open
            </button>
          </section>

          {/* Tree Preview */}
          <section
            id="tree"
            ref={treeSectionRef}
            className="card overflow-hidden"
            aria-labelledby="tree-h"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5 sm:py-4">
              <div>
                <h2 id="tree-h" className="text-base font-bold sm:text-lg">
                  Caro-Kann tree
                </h2>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  Your moves are marked. Grey moves are alternatives you haven't chosen.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs sm:h-9 sm:text-sm"
                  aria-label="Check Caro-Kann tree with Sage"
                  onClick={() => {
                    handleAskSage('Is my Caro-Kann tree missing anything important at my level?')
                  }}
                >
                  <MessageCircle className="size-4" aria-hidden="true" />
                  Check with Sage
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs sm:h-9 sm:text-sm"
                  onClick={() => toast('Tree editor opens here')}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                  Edit
                </Button>
              </div>
            </div>

            <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_260px] xl:grid-cols-[minmax(0,1fr)_280px]">
              <div className="overflow-x-auto p-3.5 font-mono text-xs sm:p-5 sm:text-[13px]">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">1.</span>e4{' '}
                  <span className="rounded bg-accent px-1.5 py-0.5 font-semibold text-accent-foreground ring-1 ring-primary/30">
                    c6
                  </span>
                </div>
                <ul className="mt-1 ml-3 space-y-1 border-l-2 border-border pl-3 sm:pl-4">
                  <li>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">2.</span>d4{' '}
                      <span className="rounded bg-accent px-1.5 py-0.5 font-semibold text-accent-foreground ring-1 ring-primary/30">
                        d5
                      </span>
                    </div>
                    <ul className="mt-1 ml-3 space-y-1.5 border-l-2 border-border pl-3 sm:pl-4">
                      <li>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-muted-foreground">3.</span>e5{' '}
                          <span className="rounded bg-accent px-1.5 py-0.5 font-semibold text-accent-foreground ring-1 ring-primary/30">
                            Bf5
                          </span>
                          <span className="font-sans text-xs text-muted-foreground">
                            Advance · 8 lines
                          </span>
                          <span className="text-muted-foreground/60">· …c5</span>
                        </div>
                        <ul className="mt-1 ml-3 space-y-1 border-l-2 border-border pl-3 sm:pl-4">
                          <li className="flex flex-wrap items-center gap-2">
                            <span className="text-muted-foreground">4.</span>Nf3{' '}
                            <span className="font-semibold text-primary">e6</span>{' '}
                            <span className="text-muted-foreground">5.</span>Be2{' '}
                            <span className="font-semibold text-primary">c5</span>
                            <span className="badge ml-1 border-transparent bg-cta-soft font-sans text-[11px] text-cta">
                              due
                            </span>
                          </li>
                          <li className="flex flex-wrap items-center gap-2">
                            <span className="text-muted-foreground">4.</span>Nc3{' '}
                            <span className="font-semibold text-primary">e6</span>{' '}
                            <span className="text-muted-foreground">5.</span>g4{' '}
                            <span className="font-semibold text-primary">Bg6</span>
                            <span className="font-sans text-xs text-muted-foreground">Bayonet</span>
                          </li>
                        </ul>
                      </li>
                      <li>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-muted-foreground">3.</span>Nc3{' '}
                          <span className="rounded bg-accent px-1.5 py-0.5 font-semibold text-accent-foreground ring-1 ring-primary/30">
                            dxe4
                          </span>{' '}
                          <span className="text-muted-foreground">4.</span>Nxe4{' '}
                          <span className="font-semibold text-primary">Bf5</span>{' '}
                          <span className="text-muted-foreground">5.</span>Ng3{' '}
                          <span className="font-semibold text-primary">Bg6</span>
                          <span className="font-sans text-xs text-muted-foreground">Classical</span>
                          <span className="text-muted-foreground/60">· 4…Nd7</span>
                        </div>
                      </li>
                      <li>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-muted-foreground">3.</span>exd5{' '}
                          <span className="rounded bg-accent px-1.5 py-0.5 font-semibold text-accent-foreground ring-1 ring-primary/30">
                            cxd5
                          </span>{' '}
                          <span className="text-muted-foreground">4.</span>Bd3{' '}
                          <span className="font-semibold text-primary">Nc6</span>
                          <span className="font-sans text-xs text-muted-foreground">Exchange</span>
                          <span className="badge ml-1 border-transparent bg-cta-soft font-sans text-[11px] text-cta">
                            due
                          </span>
                        </div>
                      </li>
                    </ul>
                  </li>
                  <li>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground">2.</span>Nc3{' '}
                      <span className="rounded bg-accent px-1.5 py-0.5 font-semibold text-accent-foreground ring-1 ring-primary/30">
                        d5
                      </span>{' '}
                      <span className="text-muted-foreground">3.</span>Nf3{' '}
                      <span className="font-semibold text-primary">Bg4</span>
                      <span className="font-sans text-xs text-muted-foreground">Two Knights</span>
                      <span className="badge ml-1 border-transparent bg-cta-soft font-sans text-[11px] text-cta">
                        due
                      </span>
                    </div>
                  </li>
                  <li className="text-muted-foreground/60">
                    <div className="flex items-center gap-2">
                      2.c4 <span className="font-sans text-xs">not in repertoire yet</span>
                      <button
                        type="button"
                        className="cursor-pointer font-sans text-xs font-medium text-primary hover:underline"
                        onClick={() => toast('Pick your reply to 2.c4 on the board')}
                      >
                        Add
                      </button>
                    </div>
                  </li>
                </ul>
              </div>

              <aside className="border-t bg-muted/30 p-4 sm:p-5 lg:border-t-0 lg:border-l">
                <div className="max-w-[200px] overflow-hidden rounded-lg ring-1 ring-border sm:max-w-[220px] lg:max-w-none">
                  <Board
                    fen={CARO_TREE_FEN}
                    orientation="black"
                    coordinates={false}
                    movable="none"
                    shapes={caroTreeShapes}
                    label="Position after 3.e5, Black to move"
                  />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  After{' '}
                  <span className="font-mono font-medium whitespace-nowrap text-foreground">
                    3.e5
                  </span>
                  . Your move here:{' '}
                  <span className="font-mono font-medium whitespace-nowrap text-foreground">
                    …Bf5
                  </span>
                  . The bishop gets out before{' '}
                  <span className="font-mono font-medium whitespace-nowrap text-foreground">
                    …e6
                  </span>{' '}
                  locks it in.
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-card p-2 sm:p-2.5">
                    <dt className="text-[11px] text-muted-foreground sm:text-xs">Lines</dt>
                    <dd className="font-display text-base font-bold sm:text-lg">16</dd>
                  </div>
                  <div className="rounded-lg bg-card p-2 sm:p-2.5">
                    <dt className="text-[11px] text-muted-foreground sm:text-xs">Your moves</dt>
                    <dd className="font-display text-base font-bold sm:text-lg">58</dd>
                  </div>
                </dl>
              </aside>
            </div>
          </section>
        </div>
      )}

      {/* EXPLORE PANEL */}
      {activeTab === 'explore' && (
        <div id="panel-explore" role="tabpanel" aria-labelledby="tab-explore" className="mt-6">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <div className="relative min-w-[200px] flex-1 sm:min-w-[220px]">
              <Search
                className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                }}
                placeholder="Search by name, ECO or moves"
                aria-label="Search openings"
                className="h-10 pl-9 text-xs sm:text-sm"
              />
            </div>
            <div className="seg text-xs" role="group" aria-label="Filter by color">
              <button
                type="button"
                className={cn('h-9 px-2.5 sm:px-3', colorFilter === 'all' && 'is-active')}
                onClick={() => {
                  setColorFilter('all')
                }}
              >
                All
              </button>
              <button
                type="button"
                className={cn('h-9 px-2.5 sm:px-3', colorFilter === 'white' && 'is-active')}
                onClick={() => {
                  setColorFilter('white')
                }}
              >
                White
              </button>
              <button
                type="button"
                className={cn('h-9 px-2.5 sm:px-3', colorFilter === 'black' && 'is-active')}
                onClick={() => {
                  setColorFilter('black')
                }}
              >
                Black
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by style">
              <button
                type="button"
                className={cn(
                  'reply h-9 px-2.5 text-xs sm:px-3',
                  styleFilter === 'any' && 'is-active border-primary bg-accent',
                )}
                onClick={() => {
                  setStyleFilter('any')
                }}
              >
                Any style
              </button>
              <button
                type="button"
                className={cn(
                  'reply h-9 px-2.5 text-xs sm:px-3',
                  styleFilter === 'solid' && 'is-active border-primary bg-accent',
                )}
                onClick={() => {
                  setStyleFilter('solid')
                }}
              >
                Solid
              </button>
              <button
                type="button"
                className={cn(
                  'reply h-9 px-2.5 text-xs sm:px-3',
                  styleFilter === 'sharp' && 'is-active border-primary bg-accent',
                )}
                onClick={() => {
                  setStyleFilter('sharp')
                }}
              >
                Sharp
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-3 sm:mt-5 sm:gap-4">
            {filteredExploreOpenings.map((item) => {
              const isAdded = addedOpenings.has(item.id)
              return (
                <article key={item.id} className="card flex flex-col p-3.5 sm:p-4">
                  <div className="flex items-start gap-2.5 sm:gap-3">
                    <div className="w-18 shrink-0 self-start overflow-hidden rounded-lg ring-1 ring-border sm:w-20">
                      <Board
                        fen={item.fen}
                        orientation={item.color}
                        coordinates={false}
                        movable="none"
                        label={`${item.name} position`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm leading-tight font-bold sm:text-base">{item.name}</h3>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                        {item.codeAndMoves}
                      </p>
                      {item.specialBadge && (
                        <span
                          className={cn(
                            'badge mt-1.5 inline-flex items-center gap-1 text-[11px] sm:text-xs',
                            item.specialBadge.className,
                          )}
                        >
                          {item.specialBadge.icon === 'sparkles' && (
                            <Sparkles className="size-3" aria-hidden="true" />
                          )}
                          {item.specialBadge.text}
                        </span>
                      )}
                    </div>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:mt-4">
                    <div>
                      <dt className="text-muted-foreground">Popularity</dt>
                      <dd className="mt-1 flex items-center gap-1.5">
                        <span
                          role="progressbar"
                          aria-valuenow={item.popularityPercent}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${item.name} popularity`}
                          className="progress h-1.5"
                        >
                          <span style={{ width: `${String(item.popularityPercent)}%` }} />
                        </span>
                        {String(item.popularityPercent)}%
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Difficulty</dt>
                      <dd className="mt-1 font-medium">{item.difficulty}</dd>
                    </div>
                  </dl>

                  <div className="mt-2.5 flex flex-wrap gap-1.5 sm:mt-3">
                    {item.tags.map((tag) => (
                      <span key={tag.label} className={cn('badge text-[11px]', tag.className)}>
                        {tag.label}
                      </span>
                    ))}
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3.5 h-8 self-start text-xs sm:mt-4 sm:h-9 sm:text-sm"
                    disabled={isAdded}
                    onClick={() => {
                      handleAddToRepertoire(item)
                    }}
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                    {isAdded ? 'Added as draft' : 'Add to repertoire'}
                  </Button>
                </article>
              )
            })}
            {filteredExploreOpenings.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No openings match your search criteria.
              </div>
            )}
          </div>

          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="size-3.5 shrink-0" aria-hidden="true" />
            Popularity is how often players rated 1200 to 1600 choose it. Opening data ships as a
            content pack you can replace.
          </p>
        </div>
      )}
    </div>
  )
}
