import { Link } from '@tanstack/react-router'
import {
  BadgeCheck,
  CalendarCheck,
  ChevronRight,
  Clock,
  Download,
  EyeOff,
  Play,
  Repeat,
  Sparkle,
  Sprout,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { Board } from '@/board'
import { useDueCount, useMistakes, useSrsCountsByState } from '@/data'
import { Button, CtaButton, QualityGlyph, toast } from '@/design'
import { toFen, type Fen, type MoveQuality } from '@/domain'

export interface MistakeCardData {
  id: string
  fen: Fen
  orientation: 'white' | 'black'
  theme: string
  themeColorClass: string
  dueText: string
  isDueToday?: boolean
  origin: string
  playedMove: string
  quality: MoveQuality
  explanation: string
  recallStreak: number
  stateLabel: string
}

const DEFAULT_MISTAKES: readonly MistakeCardData[] = [
  {
    id: 'm1',
    fen: toFen('r4rk1/pp3ppp/2p5/6n1/3P4/2P5/PP2QP1P/R5K1 w - - 0 17'),
    orientation: 'white',
    theme: 'Forks',
    themeColorClass: 'bg-lilac text-lilac-ink',
    dueText: 'Due today',
    isDueToday: true,
    origin: "vs Stockfish 1200 · move 17 · you're White",
    playedMove: '17.Qe1',
    quality: 'blunder',
    explanation:
      'Your queen and king were a knight-jump apart. 17.Qg4 keeps the queen safe and hits the knight.',
    recallStreak: 0,
    stateLabel: 'New',
  },
  {
    id: 'm2',
    fen: toFen('6k1/5ppp/p1r5/8/8/1P6/P4PPP/3R2K1 w - - 0 24'),
    orientation: 'white',
    theme: 'Back rank',
    themeColorClass: 'bg-accent text-accent-foreground',
    dueText: 'Due today',
    isDueToday: true,
    origin: "vs Rafi · move 24 · you're White",
    playedMove: '24.Kf1',
    quality: 'miss',
    explanation: "Black's king has no escape square. 24.Rd8# ends it right away.",
    recallStreak: 1,
    stateLabel: 'Learning',
  },
  {
    id: 'm3',
    fen: toFen('rn1qkbnr/ppp2ppp/3p4/4p3/2B1P1b1/2N2N2/PPPP1PPP/R1BQK2R b KQkq - 3 4'),
    orientation: 'black',
    theme: 'Pins',
    themeColorClass: 'bg-sky text-sky-ink',
    dueText: 'Due today',
    isDueToday: true,
    origin: "vs Stockfish 1000 · move 4 · you're Black",
    playedMove: '4…g6',
    quality: 'mistake',
    explanation:
      "The pin on f3 isn't real: 5.Nxe5! wins a pawn, and …Bxd1 runs into Légal's mate. 4…Nf6 develops first.",
    recallStreak: 2,
    stateLabel: 'Reviewing',
  },
  {
    id: 'm4',
    fen: toFen('rnbqkb1r/pppp1ppp/8/4N3/4n3/8/PPPPQPPP/RNB1KB1R b KQkq - 1 4'),
    orientation: 'black',
    theme: 'Discovered attack',
    themeColorClass: 'bg-lilac text-lilac-ink',
    dueText: 'Tomorrow',
    origin: "vs Stockfish 1100 · move 4 · you're Black",
    playedMove: '4…Nf6',
    quality: 'blunder',
    explanation:
      'The queen on e2 was lined up with your king. 5.Nc6+ uncovers check and hits your queen. Block the file first: 4…Qe7.',
    recallStreak: 1,
    stateLabel: 'Next in 1 day',
  },
  {
    id: 'm5',
    fen: toFen('r6k/6pp/7N/8/8/1Q6/4q1PP/6K1 w - - 0 31'),
    orientation: 'white',
    theme: 'Mate in 2',
    themeColorClass: 'bg-reward-soft text-reward-ink',
    dueText: 'In 3 days',
    origin: "vs Stockfish 1300 · move 31 · you're White",
    playedMove: '31.Nf7+',
    quality: 'inaccuracy',
    explanation: "Smothered mate: 31.Qg8+! Rxg8 32.Nf7#. The king's own pieces become the walls.",
    recallStreak: 2,
    stateLabel: 'Next in 3 days',
  },
  {
    id: 'm6',
    fen: toFen('4k3/8/8/4K3/4P3/8/8/8 w - - 0 48'),
    orientation: 'white',
    theme: 'Endgame',
    themeColorClass: 'bg-accent text-accent-foreground',
    dueText: 'In 7 days',
    origin: "vs Stockfish 1100 · move 48 · you're White",
    playedMove: '48.Kf5',
    quality: 'miss',
    explanation:
      "King in front of the pawn: 48.Ke6 reaches the sixth rank and wins. After Kf5, …Kf7 takes the opposition and it's a draw.",
    recallStreak: 2,
    stateLabel: 'Next in 7 days',
  },
]

const THEME_CHIPS = [
  { id: 'all', label: 'All', count: 57 },
  { id: 'forks', label: 'Forks', count: 14 },
  { id: 'back-rank', label: 'Back rank', count: 6 },
  { id: 'pins', label: 'Pins', count: 9 },
  { id: 'discovered', label: 'Discovered attack', count: 5 },
  { id: 'mate', label: 'Mate patterns', count: 8 },
  { id: 'endgame', label: 'Endgame', count: 7 },
  { id: 'hanging', label: 'Hanging pieces', count: 8 },
] as const

type SortOrder = 'due' | 'newest' | 'game'

/**
 * MistakesScreen (`/mistakes`) — ported from `prototype/mistakes.html`.
 *
 * Spaced Repetition (FSRS) Mistake Bank:
 * - Positions the player erred in, scheduled to return at 1, 3, 7, 21 days
 * - Due hero card and 4-step upcoming schedule strip
 * - Mastery pipeline: New -> Learning -> Reviewing -> Mastered
 * - Theme filtering, sorting, board previews and explanation reveals
 */
export function MistakesScreen() {
  const dbMistakes = useMistakes()
  const dbDueCount = useDueCount()
  const srsCounts = useSrsCountsByState()

  const [selectedTheme, setSelectedTheme] = useState<string>('all')
  const [sortOrder, setSortOrder] = useState<SortOrder>('due')
  const [revealedIds, setRevealedIds] = useState<ReadonlySet<string>>(new Set())

  const dueCount = dbDueCount ?? 7
  const newCount = srsCounts?.new ?? 7
  const learningCount = srsCounts?.learning ?? 9
  const reviewingCount = srsCounts?.review ?? 13
  const masteredCount = srsCounts?.mastered ?? 28

  const allMistakes: readonly MistakeCardData[] = useMemo(() => {
    if (dbMistakes && dbMistakes.length > 0) {
      return dbMistakes.map((entry, idx) => ({
        id: entry.id,
        fen: entry.fen,
        orientation: entry.yourColor,
        theme: entry.themes[0] ?? 'Tactics',
        themeColorClass: 'bg-accent text-accent-foreground',
        dueText: idx < 2 ? 'Due today' : 'In 3 days',
        isDueToday: idx < 2,
        origin: entry.originLabel ?? `Move ${String(entry.moveNumber ?? 1)}`,
        playedMove: entry.playedSan,
        quality: entry.quality,
        explanation: entry.explanation,
        recallStreak: 1,
        stateLabel: 'Learning',
      }))
    }
    return DEFAULT_MISTAKES
  }, [dbMistakes])

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const filteredMistakes = useMemo(() => {
    let items = [...allMistakes]

    // Theme filter
    if (selectedTheme !== 'all') {
      const target = selectedTheme.toLowerCase()
      items = items.filter(
        (m) =>
          m.theme.toLowerCase().includes(target) ||
          (target === 'discovered' && m.theme.toLowerCase().includes('discovered')) ||
          (target === 'mate' && m.theme.toLowerCase().includes('mate')) ||
          (target === 'back-rank' && m.theme.toLowerCase().includes('back rank')),
      )
    }

    // Sort order
    if (sortOrder === 'newest') {
      items.reverse()
    } else if (sortOrder === 'game') {
      items.sort((a, b) => a.origin.localeCompare(b.origin))
    }

    return items
  }, [allMistakes, selectedTheme, sortOrder])

  return (
    <div className="page">
      {/* Page Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">Mistake Bank</p>
          <h1 aria-label="Mistake Bank" className="page-title mt-1">
            Ideas you missed, coming back
          </h1>
          <p className="mt-1 max-w-[60ch] text-sm text-muted-foreground">
            Every position here is from your own games. Recall one and it returns later: 1 day, 3,
            7, 21. Until it's yours.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            toast('Import runs after every game automatically')
          }}
        >
          <Download className="size-4" aria-hidden="true" />
          Import a game
        </Button>
      </header>

      {/* Due Today Hero */}
      <section
        className="card @container mt-4 overflow-hidden border-cta/30 sm:mt-6"
        aria-labelledby="due-h"
      >
        <div className="grid gap-4 p-4 sm:gap-6 sm:p-6 lg:p-7 @[720px]:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
          <div>
            <span className="badge border-transparent bg-cta-soft text-cta">
              <CalendarCheck className="mr-1 size-3.5" aria-hidden="true" />
              Due today
            </span>
            <h2
              id="due-h"
              className="mt-2.5 font-display text-3xl leading-none font-bold tracking-tight sm:mt-3 sm:text-[40px]"
            >
              {dueCount} <span className="text-2xl sm:text-[30px]">due today</span>
            </h2>
            <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
              5 from this week, 2 you've seen before. You play the move; the answer never shows
              first.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2.5 sm:mt-5 sm:gap-3">
              <CtaButton asChild className="h-10 sm:h-11">
                <Link to="/puzzles/solve">
                  <Play className="size-[18px]" aria-hidden="true" />
                  Start review · ~4 min
                </Link>
              </CtaButton>
              <Button
                variant="ghost"
                className="h-10 text-muted-foreground sm:h-11"
                onClick={() => {
                  toast('Moved to tomorrow. Your streak is safe.')
                }}
              >
                Not today
              </Button>
            </div>
          </div>

          {/* Schedule Strip */}
          <div>
            <p className="label">Coming up</p>
            <ol className="mt-2 grid grid-cols-2 gap-2 text-center min-[440px]:grid-cols-4">
              <li className="rounded-xl border-2 border-cta/40 bg-cta-soft p-2 sm:p-2.5">
                <div className="font-display text-xl font-bold text-cta sm:text-2xl">
                  {dueCount}
                </div>
                <div className="text-[11px] font-medium text-cta">Today</div>
              </li>
              <li className="rounded-xl bg-muted/70 p-2 sm:p-2.5">
                <div className="font-display text-xl font-bold sm:text-2xl">3</div>
                <div className="text-[11px] text-muted-foreground">Tomorrow</div>
              </li>
              <li className="rounded-xl bg-muted/70 p-2 sm:p-2.5">
                <div className="font-display text-xl font-bold sm:text-2xl">5</div>
                <div className="text-[11px] text-muted-foreground">In 3 days</div>
              </li>
              <li className="rounded-xl bg-muted/70 p-2 sm:p-2.5">
                <div className="font-display text-xl font-bold sm:text-2xl">12</div>
                <div className="text-[11px] text-muted-foreground">This week</div>
              </li>
            </ol>
            <p className="mt-2 text-xs text-muted-foreground">
              Small and steady beats cramming. We never schedule more than 10 a day.
            </p>
          </div>
        </div>
      </section>

      {/* Mastery Pipeline */}
      <section className="card mt-3.5 p-4 sm:mt-4 sm:p-5" aria-labelledby="pipe-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="pipe-h" className="font-display text-base font-bold sm:text-lg">
            From missed to mastered
          </h2>
          <span className="text-xs text-muted-foreground">
            57 positions · 3 more mastered this week
          </span>
        </div>
        <ol className="mt-3.5 grid grid-cols-2 gap-2 sm:mt-4 md:grid-cols-4">
          {/* New */}
          <li className="relative rounded-xl bg-lilac/70 p-3 sm:p-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-lilac-ink sm:gap-2">
              <Sparkle className="size-3.5" aria-hidden="true" />
              New
            </div>
            <div className="mt-1 font-display text-2xl font-bold tabular-nums sm:text-3xl">
              {newCount}
            </div>
            <div className="text-xs text-muted-foreground">Not tried yet</div>
            <ChevronRight
              className="absolute top-1/2 -right-2.5 z-10 hidden size-5 -translate-y-1/2 rounded-full bg-card p-0.5 text-muted-foreground ring-1 ring-border md:block"
              aria-hidden="true"
            />
          </li>

          {/* Learning */}
          <li className="relative rounded-xl bg-cta-soft p-3 sm:p-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-cta sm:gap-2">
              <Sprout className="size-3.5" aria-hidden="true" />
              Learning
            </div>
            <div className="mt-1 font-display text-2xl font-bold tabular-nums sm:text-3xl">
              {learningCount}
            </div>
            <div className="text-xs text-muted-foreground">Back in 1 to 3 days</div>
            <ChevronRight
              className="absolute top-1/2 -right-2.5 z-10 hidden size-5 -translate-y-1/2 rounded-full bg-card p-0.5 text-muted-foreground ring-1 ring-border md:block"
              aria-hidden="true"
            />
          </li>

          {/* Reviewing */}
          <li className="relative rounded-xl bg-sky/70 p-3 sm:p-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-ink sm:gap-2">
              <Repeat className="size-3.5" aria-hidden="true" />
              Reviewing
            </div>
            <div className="mt-1 font-display text-2xl font-bold tabular-nums sm:text-3xl">
              {reviewingCount}
            </div>
            <div className="text-xs text-muted-foreground">Back in 7 to 21 days</div>
            <ChevronRight
              className="absolute top-1/2 -right-2.5 z-10 hidden size-5 -translate-y-1/2 rounded-full bg-card p-0.5 text-muted-foreground ring-1 ring-border md:block"
              aria-hidden="true"
            />
          </li>

          {/* Mastered */}
          <li className="rounded-xl bg-accent p-3 sm:p-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary sm:gap-2">
              <BadgeCheck className="size-3.5" aria-hidden="true" />
              Mastered
            </div>
            <div className="mt-1 font-display text-2xl font-bold tabular-nums sm:text-3xl">
              {masteredCount}
            </div>
            <div className="text-xs text-muted-foreground">Recalled 3 times in a row</div>
          </li>
        </ol>
      </section>

      {/* Positions List */}
      <section className="mt-6 sm:mt-8" aria-labelledby="list-h">
        <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
          <h2 id="list-h" className="font-display text-lg font-bold sm:text-xl">
            Your positions
          </h2>
          <div className="seg text-xs" role="tablist" aria-label="Sort order">
            <button
              type="button"
              role="tab"
              aria-selected={sortOrder === 'due'}
              className={sortOrder === 'due' ? 'is-active' : ''}
              onClick={() => {
                setSortOrder('due')
              }}
            >
              Due first
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sortOrder === 'newest'}
              className={sortOrder === 'newest' ? 'is-active' : ''}
              onClick={() => {
                setSortOrder('newest')
              }}
            >
              Newest
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sortOrder === 'game'}
              className={sortOrder === 'game' ? 'is-active' : ''}
              onClick={() => {
                setSortOrder('game')
              }}
            >
              By game
            </button>
          </div>
        </div>

        {/* Theme Chips Filter */}
        <div
          className="mt-3 flex flex-wrap gap-1.5 sm:gap-2"
          role="group"
          aria-label="Filter by theme"
        >
          {THEME_CHIPS.map((chip) => {
            const isActive = selectedTheme === chip.id
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => {
                  setSelectedTheme(chip.id)
                }}
                className={`badge cursor-pointer px-2.5 py-0.5 text-xs transition-colors sm:px-3 sm:py-1 ${
                  isActive ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent'
                }`}
              >
                {chip.label} · {chip.count}
              </button>
            )
          })}
        </div>

        {/* Cards Grid */}
        <div className="mt-4 grid gap-3.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {filteredMistakes.map((mistake) => {
            const isRevealed = revealedIds.has(mistake.id)
            return (
              <article key={mistake.id} className="card flex flex-col overflow-hidden">
                <Link
                  to="/puzzles/solve"
                  className="block bg-muted/40 p-2.5 sm:p-3"
                  aria-label={`Try this position: ${mistake.origin}`}
                >
                  <div className="overflow-hidden rounded-lg ring-1 ring-border">
                    <Board
                      fen={mistake.fen}
                      orientation={mistake.orientation}
                      coordinates={false}
                      movable="none"
                      label={`Board: ${mistake.orientation === 'white' ? 'White' : 'Black'} to move`}
                    />
                  </div>
                </Link>

                <div className="flex flex-1 flex-col p-3.5 sm:p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`badge border-transparent ${mistake.themeColorClass}`}>
                      {mistake.theme}
                    </span>
                    <span
                      className={`badge border-transparent ${
                        mistake.isDueToday
                          ? 'bg-cta-soft text-cta'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {mistake.isDueToday ? (
                        <Clock className="mr-1 size-3" aria-hidden="true" />
                      ) : null}
                      {mistake.dueText}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">{mistake.origin}</p>
                  <p className="mt-2 flex items-center gap-2 text-sm whitespace-nowrap">
                    <span className="text-muted-foreground">What you played</span>
                    <span className="san">{mistake.playedMove}</span>
                    <QualityGlyph quality={mistake.quality} />
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      toggleReveal(mistake.id)
                    }}
                    className="group mt-2 w-full cursor-pointer rounded-lg border border-dashed p-2.5 text-left text-sm"
                    aria-label="Reveal the better idea"
                    aria-expanded={isRevealed}
                  >
                    {!isRevealed ? (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
                        <EyeOff className="size-3.5" aria-hidden="true" />
                        Reveal after you try
                      </span>
                    ) : (
                      <span className="block text-xs leading-relaxed text-foreground">
                        {mistake.explanation}
                      </span>
                    )}
                  </button>

                  <div className="mt-auto flex items-center justify-between pt-4 text-xs text-muted-foreground">
                    <span
                      className="flex items-center gap-1"
                      role="group"
                      aria-label={`Recall streak ${String(mistake.recallStreak)} of 3`}
                    >
                      <span
                        className={`size-2 rounded-full ${
                          mistake.recallStreak >= 1 ? 'bg-primary' : 'bg-muted-foreground/25'
                        }`}
                      />
                      <span
                        className={`size-2 rounded-full ${
                          mistake.recallStreak >= 2 ? 'bg-primary' : 'bg-muted-foreground/25'
                        }`}
                      />
                      <span
                        className={`size-2 rounded-full ${
                          mistake.recallStreak >= 3 ? 'bg-primary' : 'bg-muted-foreground/25'
                        }`}
                      />
                      <span className="ml-1">{mistake.stateLabel}</span>
                    </span>
                    <Link to="/puzzles/solve" className="font-medium text-primary hover:underline">
                      Try it
                    </Link>
                  </div>
                </div>
              </article>
            )
          })}
        </div>

        <div className="mt-5 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              toast('Showing 6 of 57 in this view')
            }}
          >
            Show more
          </Button>
        </div>
      </section>
    </div>
  )
}
