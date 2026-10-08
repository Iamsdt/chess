import { Link } from '@tanstack/react-router'
import { Check, Eye, Footprints, X } from 'lucide-react'
import { useMemo } from 'react'

import { Board, type BoardMove, type LegalMoveMap } from '@/board'
import { createGame, legalMoves, type ChessGame } from '@/chess'
import { Badge, Button, cn, Input, toast, useTheme } from '@/design'
import { emptyBoardShapes, type Arrow, type CalculationAttachment, type Square } from '@/domain'

import { ExplorePanel } from './explore-panel'
import {
  LINE_PLIES,
  MAX_PICKS,
  resolvePick,
  reviewAttempt,
  type AttemptReview,
} from './test-me-model'

import type { Verdict } from './tree-model'
import type { TestSession, TestStep } from './use-test-session'

/**
 * Test me (coach-agent.md §9.4): calculate first, see the tree after.
 *
 * Attempts live in component state only; the real app stores them (Dexie) so calculation
 * depth and accuracy can be tracked, but the mock has no storage.
 */

function legalMap(game: ChessGame | null): LegalMoveMap {
  const map = new Map<Square, Square[]>()
  if (game === null) return map
  for (const move of legalMoves(game)) {
    const list = map.get(move.from) ?? []
    if (!list.includes(move.to)) list.push(move.to)
    map.set(move.from, list)
  }
  return map
}

function notation(game: ChessGame | null): string {
  if (game === null) return ''
  return game.history
    .map((move) => `${String(move.moveNumber)}${move.color === 'white' ? '.' : '…'}${move.san}`)
    .join(' ')
}

const STEPS: readonly { id: TestStep; label: string }[] = [
  { id: 'candidates', label: 'Candidates' },
  { id: 'calculate', label: 'Calculate' },
  { id: 'verdict', label: 'Verdict' },
  { id: 'reveal', label: 'Reveal' },
]

function Stepper({ step }: { readonly step: TestStep }) {
  return (
    <ol
      className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"
      aria-label="Test me progress"
    >
      {STEPS.map((item, index) => (
        <li
          key={item.id}
          aria-current={item.id === step ? 'step' : undefined}
          className={cn(
            'flex items-center gap-1.5',
            item.id === step ? 'font-semibold text-foreground' : 'text-muted-foreground',
          )}
        >
          <span
            className={cn(
              'grid size-5 place-items-center rounded-full border text-[11px]',
              item.id === step && 'border-primary bg-primary text-primary-foreground',
            )}
          >
            {index + 1}
          </span>
          {item.label}
        </li>
      ))}
    </ol>
  )
}

export function TestMe({
  attachment,
  session,
}: {
  readonly attachment: CalculationAttachment
  readonly session: TestSession
}) {
  const { state } = session
  return (
    <div data-slot="calc-test-me" className="flex flex-col gap-4">
      <Stepper step={state.step} />
      {state.step === 'candidates' ? (
        <CandidatesStep attachment={attachment} session={session} />
      ) : null}
      {state.step === 'calculate' ? (
        <CalculateStep attachment={attachment} session={session} />
      ) : null}
      {state.step === 'verdict' ? <VerdictStep attachment={attachment} session={session} /> : null}
      {state.step === 'reveal' && state.review !== null ? (
        <RevealStep attachment={attachment} session={session} review={state.review} />
      ) : null}
    </div>
  )
}

/* ── Step 1 ──────────────────────────────────────────────────────────────── */

function CandidatesStep({
  attachment,
  session,
}: {
  readonly attachment: CalculationAttachment
  readonly session: TestSession
}) {
  const { pieceSet } = useTheme()
  const { picks } = session.state
  const root = useMemo(() => {
    const created = createGame(attachment.fen)
    return created.ok ? created.value : null
  }, [attachment.fen])
  const moves = useMemo(() => (root === null ? [] : legalMoves(root)), [root])
  const legal = useMemo(() => legalMap(root), [root])
  const full = picks.length >= MAX_PICKS

  const add = (san: string): void => {
    if (picks.some((pick) => pick.first === san)) return
    if (full) {
      toast.info(`Up to ${String(MAX_PICKS)} candidates: remove one first.`)
      return
    }
    session.set({ picks: [...picks, { first: san, reply: '', follow: '', verdict: null }] })
  }
  const onMove = (move: BoardMove): void => {
    const found = moves.find(
      (candidate) => candidate.from === move.from && candidate.to === move.to,
    )
    if (found !== undefined) add(found.san)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
      <div className="mx-auto w-full max-w-[min(100%,56dvh)] overflow-hidden rounded-xl ring-1 ring-border lg:max-w-none">
        <Board
          fen={attachment.fen}
          orientation={attachment.orientation}
          movable={root?.turn ?? 'none'}
          legalMoves={legal}
          onMove={onMove}
          coordinates
          pieceSet={pieceSet}
          label="Your candidate board"
        />
      </div>
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-base font-semibold">What would you consider?</h3>
          <p className="text-sm text-muted-foreground">
            Play up to {MAX_PICKS} candidate moves on the board, or pick them from the list. The
            tree stays hidden until you have committed.
          </p>
        </div>
        <ul className="flex flex-wrap gap-2" aria-label="Your candidates">
          {picks.map((pick) => (
            <li key={pick.first}>
              <Badge variant="soft" className="gap-1.5 py-1 text-sm">
                {pick.first}
                <button
                  type="button"
                  aria-label={`Remove ${pick.first}`}
                  className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => {
                    session.set({ picks: picks.filter((p) => p.first !== pick.first) })
                  }}
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </Badge>
            </li>
          ))}
          {picks.length === 0 ? <li className="text-sm text-muted-foreground">None yet</li> : null}
        </ul>
        <details className="rounded-lg border p-3" open>
          <summary className="cursor-pointer text-sm font-medium">
            All legal moves ({moves.length})
          </summary>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {moves.map((move) => {
              const picked = picks.some((pick) => pick.first === move.san)
              return (
                <li key={move.uci}>
                  <Button
                    size="xs"
                    variant={picked ? 'default' : 'outline'}
                    aria-pressed={picked}
                    onClick={() => {
                      if (picked) session.set({ picks: picks.filter((p) => p.first !== move.san) })
                      else add(move.san)
                    }}
                  >
                    {move.san}
                  </Button>
                </li>
              )
            })}
          </ul>
        </details>
        <div className="flex justify-end">
          <Button
            disabled={picks.length === 0}
            onClick={() => {
              session.set({ step: 'calculate', active: 0 })
            }}
          >
            Calculate these ({picks.length})
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ── Step 2 ──────────────────────────────────────────────────────────────── */

const SLOTS = [
  { key: 'reply', label: 'Opponent reply' },
  { key: 'follow', label: 'Your follow-up' },
] as const

function CalculateStep({
  attachment,
  session,
}: {
  readonly attachment: CalculationAttachment
  readonly session: TestSession
}) {
  const { pieceSet } = useTheme()
  const { picks, active, mode } = session.state
  const pick = picks[active] ?? picks[0]
  const resolved = useMemo(
    () => (pick === undefined ? null : resolvePick(attachment.fen, pick)),
    [attachment.fen, pick],
  )
  const guided = mode === 'guided'

  // Visualize keeps the pieces where they were at the root: only the arrows move.
  const fen = guided && resolved?.game != null ? resolved.game.fen : attachment.fen
  const canPlay =
    guided &&
    resolved?.game != null &&
    resolved.invalid === null &&
    resolved.sans.length < LINE_PLIES
  const legal = useMemo(() => legalMap(canPlay ? resolved.game : null), [canPlay, resolved])

  const shapes = useMemo(() => {
    const next = emptyBoardShapes()
    const history = resolved?.game?.history ?? []
    const arrows: Arrow[] = history.map((move, index) => ({
      from: move.from,
      to: move.to,
      kind: index === 0 ? 'best' : move.color === history[0]?.color ? 'sage' : 'threat',
    }))
    next.arrows = arrows
    const last = history.at(-1)
    if (guided && last !== undefined) next.highlight = [last.from, last.to]
    return next
  }, [resolved, guided])

  if (pick === undefined || resolved === null) return null
  const complete = picks.every((p) => resolvePick(attachment.fen, p).complete)

  const fillNext = (move: BoardMove): void => {
    const game = resolved.game
    if (game === null) return
    const found = legalMoves(game).find((m) => m.from === move.from && m.to === move.to)
    if (found === undefined) return
    session.updatePick(
      active,
      resolved.sans.length === 1 ? { reply: found.san } : { follow: found.san },
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
      <div className="flex flex-col gap-2">
        <div className="mx-auto w-full max-w-[min(100%,56dvh)] overflow-hidden rounded-xl ring-1 ring-border lg:max-w-none">
          <Board
            fen={fen}
            orientation={attachment.orientation}
            movable={canPlay ? resolved.game.turn : 'none'}
            legalMoves={legal}
            onMove={fillNext}
            shapes={shapes}
            coordinates
            pieceSet={pieceSet}
            label={guided ? 'Guided calculation board' : 'Frozen visualization board'}
          />
        </div>
        <p className="text-center font-mono text-sm" data-slot="calc-notation" aria-live="polite">
          {notation(resolved.game) || 'Enter the opponent reply below'}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-base font-semibold">Calculate each candidate</h3>
          <p className="text-sm text-muted-foreground">
            Type the opponent's best reply, then your follow-up (SAN, like Nf3).
          </p>
        </div>
        <div className="flex items-center gap-2" role="group" aria-label="Calculation mode">
          <Button
            size="sm"
            variant={guided ? 'default' : 'outline'}
            aria-pressed={guided}
            onClick={() => {
              session.set({ mode: 'guided' })
            }}
          >
            <Footprints aria-hidden="true" /> Guided
          </Button>
          <Button
            size="sm"
            variant={guided ? 'outline' : 'default'}
            aria-pressed={!guided}
            onClick={() => {
              session.set({ mode: 'visualize' })
            }}
          >
            <Eye aria-hidden="true" /> Visualize
          </Button>
          <span className="text-xs text-muted-foreground">
            {guided ? 'Pieces move as you go.' : 'Pieces stay put: only arrows and notation grow.'}
          </span>
        </div>
        <ul className="flex flex-col gap-2">
          {picks.map((entry, index) => {
            const line = resolvePick(attachment.fen, entry)
            const isActive = index === active
            return (
              <li
                key={entry.first}
                className={cn(
                  'rounded-lg border p-3',
                  isActive && 'border-primary ring-1 ring-primary',
                )}
                onFocusCapture={() => {
                  if (!isActive) session.set({ active: index })
                }}
              >
                <p className="mb-2 flex items-center justify-between text-sm font-medium">
                  <span>Candidate {entry.first}</span>
                  {line.complete ? (
                    <Check className="size-4 text-success" aria-label="Line complete" />
                  ) : null}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SLOTS.map((slot) => {
                    const enabled = slot.key === 'reply' || line.sans.length >= 2
                    const bad = line.invalid === slot.key
                    return (
                      <label
                        key={slot.key}
                        className="flex flex-col gap-1 text-xs text-muted-foreground"
                      >
                        {slot.label} to {entry.first}
                        <Input
                          value={entry[slot.key]}
                          disabled={!enabled}
                          aria-invalid={bad}
                          autoComplete="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          placeholder={slot.key === 'reply' ? 'e.g. exd4' : 'e.g. O-O'}
                          onChange={(event) => {
                            session.updatePick(index, { [slot.key]: event.target.value })
                          }}
                        />
                        {bad ? (
                          <span className="text-destructive">Not legal in this position</span>
                        ) : null}
                      </label>
                    )
                  })}
                </div>
                {guided &&
                isActive &&
                line.game !== null &&
                line.sans.length < LINE_PLIES &&
                line.invalid === null ? (
                  <ul className="mt-2 flex flex-wrap gap-1" aria-label="Legal moves here">
                    {legalMoves(line.game).map((move) => (
                      <li key={move.uci}>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => {
                            session.updatePick(
                              index,
                              line.sans.length === 1 ? { reply: move.san } : { follow: move.san },
                            )
                          }}
                        >
                          {move.san}
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            )
          })}
        </ul>
        <div className="flex justify-between">
          <Button
            variant="ghost"
            onClick={() => {
              session.set({ step: 'candidates' })
            }}
          >
            Back
          </Button>
          <Button
            disabled={!complete}
            onClick={() => {
              session.set({ step: 'verdict' })
            }}
          >
            Judge them
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ── Step 3 ──────────────────────────────────────────────────────────────── */

const VERDICTS: readonly Verdict[] = ['winning', 'equal', 'losing']

function VerdictStep({
  attachment,
  session,
}: {
  readonly attachment: CalculationAttachment
  readonly session: TestSession
}) {
  const { picks, chosen } = session.state
  const ready = picks.every((pick) => pick.verdict !== null) && chosen !== null

  const reveal = (): void => {
    const review = reviewAttempt(attachment, attachment.fen, picks, chosen)
    session.set({ step: 'reveal', review, attempts: [...session.state.attempts, review.score] })
  }

  return (
    <div className="flex max-w-2xl flex-col gap-3">
      <div>
        <h3 className="text-base font-semibold">How does each one end?</h3>
        <p className="text-sm text-muted-foreground">
          Judge each line for {attachment.orientation === 'white' ? 'White' : 'Black'}, then commit
          to one move.
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {picks.map((pick, index) => (
          <li
            key={pick.first}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
          >
            <span className="text-sm font-medium">{pick.first}</span>
            <div
              className="flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label={`Verdict for ${pick.first}`}
            >
              {VERDICTS.map((verdict) => (
                <Button
                  key={verdict}
                  size="sm"
                  variant={pick.verdict === verdict ? 'default' : 'outline'}
                  aria-pressed={pick.verdict === verdict}
                  onClick={() => {
                    session.updatePick(index, { verdict })
                  }}
                  className="capitalize"
                >
                  {verdict}
                </Button>
              ))}
              <Button
                size="sm"
                variant={chosen === index ? 'default' : 'outline'}
                aria-pressed={chosen === index}
                aria-label={`I would play ${pick.first}`}
                onClick={() => {
                  session.set({ chosen: index })
                }}
              >
                {chosen === index ? 'My move' : 'Play this'}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex justify-between">
        <Button
          variant="ghost"
          onClick={() => {
            session.set({ step: 'calculate' })
          }}
        >
          Back
        </Button>
        <Button disabled={!ready} onClick={reveal}>
          Reveal the tree
        </Button>
      </div>
    </div>
  )
}

/* ── Step 4 + 5 ──────────────────────────────────────────────────────────── */

function RevealStep({
  attachment,
  session,
  review,
}: {
  readonly attachment: CalculationAttachment
  readonly session: TestSession
  readonly review: AttemptReview
}) {
  const previous = session.state.attempts.slice(0, -1)
  const lead = (
    <section
      aria-label="Your result"
      data-slot="calc-result"
      className="flex flex-col gap-3 rounded-xl border bg-card p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold">Your calculation</h3>
        <p
          className="text-2xl font-semibold tabular-nums"
          aria-label={`Score ${String(review.score)} out of 100`}
        >
          {review.score}
          <span className="text-sm font-normal text-muted-foreground"> / 100</span>
        </p>
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        {review.picks.map((entry) => (
          <li key={entry.san} className="rounded-lg bg-muted px-3 py-2">
            <p className="font-medium">
              {entry.san}
              {entry.tempting ? (
                <span className="ml-2 text-xs font-normal text-reward-ink">a tempting trap</span>
              ) : null}
              {entry.node === null ? (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  not in Sage's tree
                </span>
              ) : null}
            </p>
            <p className="text-muted-foreground">
              {entry.leftAt === null
                ? 'You stayed on the engine line.'
                : `You left the engine line at ply ${String(entry.leftAt + 1)} with ${entry.leftWith ?? '?'}${entry.expected.length > 0 ? `; Sage expected ${entry.expected.join(' or ')}` : ''}.`}
            </p>
            <p className="flex items-center gap-1">
              {entry.verdictRight ? (
                <Check className="size-4 text-success" aria-hidden="true" />
              ) : (
                <X className="size-4 text-destructive" aria-hidden="true" />
              )}
              <span>
                You said {entry.verdict ?? 'nothing'}
                {entry.truth === null ? '' : entry.verdictRight ? '.' : `; it is ${entry.truth}.`}
              </span>
            </p>
          </li>
        ))}
      </ul>
      <p className="text-sm">
        {review.missed.length === 0
          ? 'You found every sound candidate.'
          : `Candidates you missed: ${review.missed.map((node) => node.san).join(', ')}.`}{' '}
        {review.choiceRight
          ? `Your choice, ${review.chosenSan ?? ''}, holds up.`
          : `Your choice, ${review.chosenSan ?? ''}, was not the best; Sage prefers ${review.bestSan}.`}
      </p>
      {previous.length === 0 ? null : (
        <p className="text-xs text-muted-foreground">Earlier attempts: {previous.join(', ')}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link to="/play" search={{ fen: attachment.fen }}>
            Play it out
          </Link>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            toast.success('Mock: saved to the Mistake Bank.')
          }}
        >
          Save to Mistake Bank
        </Button>
        <Button size="sm" variant="ghost" onClick={session.restart}>
          Try again
        </Button>
      </div>
    </section>
  )
  return <ExplorePanel attachment={attachment} overlay={review.overlay} lead={lead} />
}
