import { Link, useNavigate } from '@tanstack/react-router'
import { Flame, Gauge, Library, Play, Shield, ShieldCheck, Undo2, WandSparkles } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'

import { Board } from '@/board'
import { validateFen } from '@/chess'
import { newGameId, profileRepo, settingsRepo } from '@/data'
import { Badge, Button, Card, CardContent, CtaButton, Input, PageHeader, useTheme } from '@/design'
import { now, START_FEN } from '@/domain'
import type { Color, EnginePersonality, Fen, TimeControl } from '@/domain'

import { formatTimeControl } from './clock'
import { OptionGroup } from './components/option-group'
import { ToggleRow } from './components/toggle-row'
import { createPlayState, playReducer } from './machine'
import { createSavedGame, defaultPlayStorage } from './persistence'
import {
  expectedScore,
  OPPONENT_RATING_MAX,
  OPPONENT_RATING_MIN,
  OPPONENT_RATING_STEP,
  planStrength,
  strengthBand,
} from './strength'

import type { PlayStorage } from './persistence'
import type { StrengthBand } from './strength'

/**
 * `/play` — the setup screen, ported from `prototype/play-setup.html`.
 *
 * It ends by **writing a game to the database and navigating**. Nothing is handed
 * to the next screen in memory, in a store or in the URL, because the game screen
 * has to be able to pick a game up after a reload anyway; giving it a second way
 * in would mean two code paths and only one of them exercised.
 */

interface TimeOption {
  readonly id: string
  readonly label: string
  readonly control: TimeControl
}

const TIME_OPTIONS: readonly TimeOption[] = [
  { id: 'untimed', label: 'Untimed', control: { kind: 'untimed' } },
  {
    id: '10+5',
    label: '10 + 5',
    control: { kind: 'increment', initialMs: 600_000, incrementMs: 5_000 },
  },
  {
    id: '15+10',
    label: '15 + 10',
    control: { kind: 'increment', initialMs: 900_000, incrementMs: 10_000 },
  },
  {
    id: '30+0',
    label: '30 + 0',
    control: { kind: 'increment', initialMs: 1_800_000, incrementMs: 0 },
  },
]

const BAND_COPY: Readonly<Record<StrengthBand, { title: string; hint: string }>> = {
  gentle: { title: 'A gentle start', hint: 'Leaves pieces around for you to win.' },
  learning: { title: 'Room to learn', hint: 'Punishes the loose piece, misses the rest.' },
  club: { title: 'A fair fight', hint: 'Plays a plan and makes you find yours.' },
  strong: { title: 'A stretch', hint: 'Few gifts. Expect to be outplayed sometimes.' },
  expert: { title: 'Serious opposition', hint: 'Only worth it when you want the wall.' },
}

const PERSONALITY_OPTIONS = [
  {
    value: 'solid' as const,
    label: 'Solid',
    hint: 'Safe moves, slow plans. Punishes loose pieces.',
    icon: <Shield className="size-5" />,
  },
  {
    value: 'aggressive' as const,
    label: 'Aggressive',
    hint: 'Goes for your king early. Good for defence practice.',
    icon: <Flame className="size-5" />,
  },
  {
    value: 'tricky' as const,
    label: 'Tricky',
    hint: 'Sets traps and cheap shots. Tests your blunder check.',
    icon: <WandSparkles className="size-5" />,
  },
]

/** Module scope so the coin toss is never part of a render. */
function tossForColour(): Color {
  return Math.random() < 0.5 ? 'white' : 'black'
}

type ColorChoice = Color | 'random'
type StartFrom = 'standard' | 'fen'

export interface PlaySetupScreenProps {
  /** Injected by tests; the app always uses the real repositories. */
  readonly storage?: PlayStorage
}

export function PlaySetupScreen({ storage = defaultPlayStorage }: PlaySetupScreenProps = {}) {
  const navigate = useNavigate()
  const { pieceSet } = useTheme()
  const ratingId = useId()
  const fenId = useId()

  const [yourRating, setYourRating] = useState(1200)
  const [rating, setRating] = useState(1200)
  const [colorChoice, setColorChoice] = useState<ColorChoice>('white')
  const [timeId, setTimeId] = useState('10+5')
  const [personality, setPersonality] = useState<EnginePersonality>('solid')
  const [trainingWheels, setTrainingWheels] = useState(true)
  const [showEvaluation, setShowEvaluation] = useState(false)
  const [allowTakebacks, setAllowTakebacks] = useState(true)
  const [startFrom, setStartFrom] = useState<StartFrom>('standard')
  const [fenText, setFenText] = useState('')
  const [ready, setReady] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Last game's choices are the defaults for this one, and the form waits for them:
  // filling a slider in and then having it jump back when storage answers is worse
  // than a moment of "loading". Both reads are wrapped
  // because Dexie throws *synchronously* where IndexedDB is missing (a private
  // window, a locked-down browser, jsdom) rather than rejecting, and a setup form
  // that cannot read its defaults should still be a working setup form.
  useEffect(() => {
    const leaving = new AbortController()
    void (async () => {
      try {
        const stored = await settingsRepo.get()
        if (leaving.signal.aborted) return
        setRating(stored.play.defaultOpponentRating)
        setPersonality(stored.play.defaultPersonality)
        setColorChoice(stored.play.defaultColor ?? 'random')
        setTrainingWheels(stored.play.trainingWheels)
        setShowEvaluation(stored.play.showEvaluation)
        setAllowTakebacks(stored.play.allowTakebacks)
        const wanted = formatTimeControl(stored.play.defaultTimeControl)
        const match = TIME_OPTIONS.find((option) => formatTimeControl(option.control) === wanted)
        if (match !== undefined) setTimeId(match.id)
      } catch {
        // The schema's defaults are already on screen.
      }
      try {
        const profile = await profileRepo.get()
        if (!leaving.signal.aborted && profile !== undefined) setYourRating(profile.sparringRating)
      } catch {
        // Without a profile the win-chance line reads as an even match.
      }
      if (!leaving.signal.aborted) setReady(true)
    })()
    return () => {
      leaving.abort()
    }
  }, [])

  const timeOption = TIME_OPTIONS.find((option) => option.id === timeId) ?? TIME_OPTIONS[1]
  const plan = useMemo(() => planStrength(rating), [rating])
  const band = strengthBand(rating)
  const winChance = Math.round(expectedScore(yourRating, rating) * 100)

  const typedFen = fenText.trim()
  const fenResult = startFrom === 'fen' && typedFen !== '' ? validateFen(typedFen) : null
  const startFen: Fen = fenResult?.ok === true ? fenResult.value : START_FEN
  const fenError = fenResult?.ok === false ? fenResult.error.message : null
  const canStart = startFrom !== 'fen' || fenResult?.ok === true

  async function start(): Promise<void> {
    if (!canStart || starting) return
    setStarting(true)
    setError(null)
    const youPlay: Color = colorChoice === 'random' ? tossForColour() : colorChoice
    const at = now()
    const initial = createPlayState(
      {
        youPlay,
        yourName: 'You',
        yourRating,
        opponentRating: plan.rating,
        personality,
        timeControl: timeOption?.control ?? { kind: 'untimed' },
        initialFen: startFen,
        trainingWheels,
        showEvaluation,
        allowTakebacks,
      },
      newGameId(),
      at,
    )
    const started = playReducer(initial, { type: 'start', at })
    try {
      const saved = await createSavedGame(started, storage)
      if (!saved.ok) {
        setStarting(false)
        setError('That game could not be saved, so it has not been started. Try again.')
        return
      }
      // Remembering the choices is a convenience, not part of starting the game.
      await settingsRepo
        .update({
          play: {
            defaultOpponentRating: plan.rating,
            defaultPersonality: personality,
            defaultColor: colorChoice === 'random' ? null : colorChoice,
            defaultTimeControl: timeOption?.control ?? { kind: 'untimed' },
            trainingWheels,
            showEvaluation,
            allowTakebacks,
          },
        })
        .catch(() => undefined)
    } catch {
      setStarting(false)
      setError('That game could not be saved, so it has not been started. Try again.')
      return
    }
    await navigate({ to: '/play/game' })
  }

  const fillPercent =
    ((rating - OPPONENT_RATING_MIN) / (OPPONENT_RATING_MAX - OPPONENT_RATING_MIN)) * 100

  if (!ready) {
    return (
      <div className="mx-auto w-full max-w-5xl p-4 lg:p-6">
        <PageHeader eyebrow="Sparring · no rating at stake" title="New game" />
        <p className="mt-6 text-sm text-muted-foreground" aria-live="polite">
          Fetching the settings you used last time…
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl p-4 lg:p-6">
      <PageHeader
        eyebrow="Sparring · no rating at stake"
        title="New game"
        description="Stockfish runs in your browser. Every game is reviewed afterwards, win or lose."
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link to="/games">
              <Library aria-hidden="true" />
              Past games
            </Link>
          </Button>
        }
      />

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-5">
          <Card>
            <CardContent className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Opponent strength</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Stockfish, tuned to play like a human at this rating.
                  </p>
                </div>
                <Badge variant="secondary">{plan.movetimeMs} ms per move</Badge>
              </div>

              <div className="mt-5 flex items-end gap-3">
                <output
                  htmlFor={ratingId}
                  className="font-display text-5xl leading-none font-bold tabular-nums"
                >
                  {rating}
                </output>
                <div className="pb-1 text-sm">
                  <div className="font-medium">{BAND_COPY[band].title}</div>
                  <div className="text-muted-foreground">≈{winChance}% win chance for you</div>
                </div>
              </div>

              <label htmlFor={ratingId} className="sr-only">
                Opponent rating
              </label>
              <input
                id={ratingId}
                type="range"
                min={OPPONENT_RATING_MIN}
                max={OPPONENT_RATING_MAX}
                step={OPPONENT_RATING_STEP}
                value={rating}
                onChange={(event) => {
                  setRating(Number(event.target.value))
                }}
                style={{
                  background: `linear-gradient(to right, var(--primary) 0 ${String(fillPercent)}%, var(--muted) ${String(fillPercent)}% 100%)`,
                }}
                className="mt-6 h-2 w-full cursor-pointer appearance-none rounded-full focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              />
              <p className="mt-2 text-xs text-muted-foreground">{BAND_COPY[band].hint}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-6 p-5 sm:p-6">
              <OptionGroup
                legend="Your colour"
                name="colour"
                value={colorChoice}
                onChange={setColorChoice}
                options={[
                  { value: 'white', label: 'White', hint: 'You move first' },
                  { value: 'random', label: 'Random', hint: 'Let the coin decide' },
                  { value: 'black', label: 'Black', hint: 'You answer' },
                ]}
              />
              <OptionGroup
                legend="Time control"
                name="time"
                layout="row"
                value={timeId}
                onChange={setTimeId}
                options={TIME_OPTIONS.map((option) => ({
                  value: option.id,
                  label: option.label,
                }))}
              />
              <p className="text-xs text-muted-foreground">
                10 + 5 gives you time to check every capture and check before you move.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 sm:p-6">
              <OptionGroup
                legend="Opponent personality"
                name="personality"
                value={personality}
                onChange={setPersonality}
                options={PERSONALITY_OPTIONS}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 sm:p-6">
              <h2 className="text-lg font-bold">Help while you play</h2>
              <div className="mt-3 space-y-2">
                <ToggleRow
                  icon={ShieldCheck}
                  label="Training wheels"
                  hint="A quiet warning before you leave a piece hanging"
                  checked={trainingWheels}
                  onChange={setTrainingWheels}
                />
                <ToggleRow
                  icon={Gauge}
                  label="Show evaluation"
                  hint="Off helps you judge positions yourself"
                  checked={showEvaluation}
                  onChange={setShowEvaluation}
                />
                <ToggleRow
                  icon={Undo2}
                  label="Allow take-backs"
                  hint="Take-backs are marked in the review, never hidden"
                  checked={allowTakebacks}
                  onChange={setAllowTakebacks}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 sm:p-6">
              <OptionGroup
                legend="Start from"
                name="start-from"
                layout="stack"
                value={startFrom}
                onChange={setStartFrom}
                options={[
                  {
                    value: 'standard',
                    label: 'Standard position',
                    hint: 'A full game from move one',
                  },
                  { value: 'fen', label: 'Paste a FEN', hint: 'Any legal position' },
                ]}
              />
              {startFrom === 'fen' ? (
                <div className="mt-3">
                  <label htmlFor={fenId} className="text-sm font-medium">
                    FEN
                  </label>
                  <Input
                    id={fenId}
                    value={fenText}
                    spellCheck={false}
                    onChange={(event) => {
                      setFenText(event.target.value)
                    }}
                    placeholder="r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 w - - 1 7"
                    className="mt-1.5 font-mono text-xs"
                    aria-describedby={`${fenId}-help`}
                    aria-invalid={fenError !== null}
                  />
                  <p id={`${fenId}-help`} className="mt-1.5 text-xs text-muted-foreground">
                    {fenError ?? 'Checked for legality before the game starts.'}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start" aria-label="Game summary">
          <Card className="overflow-hidden">
            <div className="bg-muted/40 p-3">
              <div className="mx-auto max-w-[168px] overflow-hidden rounded-xl ring-1 ring-border">
                <Board
                  fen={startFen}
                  orientation={colorChoice === 'black' ? 'black' : 'white'}
                  coordinates={false}
                  pieceSet={pieceSet}
                  label="Starting position preview"
                />
              </div>
            </div>
            <CardContent className="p-5">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">Your game</p>
              <h2 className="mt-1 text-xl font-bold">vs Stockfish {plan.rating}</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">You play</dt>
                  <dd className="font-medium capitalize">{colorChoice}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Clock</dt>
                  <dd className="font-medium">
                    {formatTimeControl(timeOption?.control ?? { kind: 'untimed' })}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Personality</dt>
                  <dd className="font-medium capitalize">{personality}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Start</dt>
                  <dd className="truncate font-medium">
                    {startFrom === 'fen' ? 'Pasted position' : 'Standard position'}
                  </dd>
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {trainingWheels ? <Badge variant="secondary">Training wheels</Badge> : null}
                {showEvaluation ? <Badge variant="secondary">Eval on</Badge> : null}
                {allowTakebacks ? <Badge variant="secondary">Take-backs</Badge> : null}
              </div>
              <CtaButton
                className="mt-5"
                block
                disabled={!canStart || starting}
                onClick={() => {
                  void start()
                }}
              >
                <Play aria-hidden="true" />
                {starting ? 'Starting…' : 'Start game'}
              </CtaButton>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Reviewed automatically when it ends
              </p>
              {error === null ? null : (
                <p role="alert" className="mt-3 text-sm text-destructive">
                  {error}
                </p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
