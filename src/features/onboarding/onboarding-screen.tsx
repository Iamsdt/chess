import { useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  Castle,
  Crown,
  Lock,
  Moon,
  Play,
  Puzzle,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Sprout,
  Sun,
  Swords,
  Users,
  Zap,
} from 'lucide-react'
import { useId, useMemo, useState } from 'react'

import { Board } from '@/board'
import { useProfile, useSettings } from '@/data'
import { Button, cn, toast, useTheme, type BoardTheme } from '@/design'
import {
  emptyBoardShapes,
  toFen,
  toSquare,
  type BoardShapes,
  type CoachProvider,
  type Fen,
  type SkillLevel,
} from '@/domain'
import { PROVIDER_OPTIONS } from '@/features/settings/coach-options'

import { completeOnboarding } from './onboarding-actions'

const PREVIEW_FEN: Fen = toFen('rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2')

type OnboardingStep = 1 | 2 | 3 | 4
type SkillLevelChoice = 'never' | 'rules' | 'club' | 'strong'
type GoalChoice = 'tactics' | 'openings' | 'endgames' | 'friends' | 'blunders'
type DailyMinutesChoice = 5 | 15 | 30

/** The two beginner cards are one level in the data: the app only needs to know "starting out". */
const SKILL_FOR_CHOICE: Record<SkillLevelChoice, SkillLevel> = {
  never: 'beginner',
  rules: 'beginner',
  club: 'club',
  strong: 'strong',
}

const GOAL_CHOICES = ['tactics', 'openings', 'endgames', 'friends', 'blunders'] as const

function isGoalChoice(value: string): value is GoalChoice {
  return GOAL_CHOICES.some((goal) => goal === value)
}

/** What the user has changed so far; anything absent falls back to what is already saved. */
interface Draft {
  name?: string
  level?: SkillLevelChoice
  placement?: boolean
  goals?: readonly GoalChoice[]
  minutes?: DailyMinutesChoice
  provider?: CoachProvider
}

interface BoardSwatchOption {
  readonly id: BoardTheme
  readonly label: string
}

const BOARD_SWATCHES: readonly BoardSwatchOption[] = [
  { id: 'grove', label: 'Green' },
  { id: 'walnut', label: 'Walnut' },
  { id: 'slate', label: 'Slate' },
  { id: 'dusk', label: 'Dusk' },
  { id: 'sand', label: 'Sand' },
]

/**
 * Onboarding Screen (`/onboarding`) — ported from `prototype/onboarding.html`.
 *
 * Bare-frame four-step setup flow:
 * 1. Skill level selection or optional placement puzzle flag
 * 2. Learning goals selection
 * 3. Daily practice time commitment & board theme customization with live preview
 * 4. Optional AI Coach (Sage) API key setup or quick skip to play
 */
export function OnboardingScreen() {
  const { theme, resolvedTheme, setTheme, board, setBoard } = useTheme()
  const navigate = useNavigate()
  const profile = useProfile()
  const settings = useSettings()

  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1)
  const [draft, setDraft] = useState<Draft>({})
  const [finishing, setFinishing] = useState(false)

  // Replaying setup from Settings starts from the saved answers instead of a blank form.
  const savedLevel: SkillLevelChoice | undefined =
    profile === undefined
      ? undefined
      : profile.skillLevel === 'beginner'
        ? 'rules'
        : profile.skillLevel
  const savedGoals = profile?.goals.filter(isGoalChoice)
  const displayName = draft.name ?? profile?.displayName ?? ''
  const skillLevel = draft.level ?? savedLevel ?? 'rules'
  const takePlacement = draft.placement ?? false
  const selectedGoals = draft.goals ?? savedGoals ?? ['tactics', 'friends', 'blunders']
  const dailyMinutes = draft.minutes ?? settings.dailyGoalMinutes
  const coachProvider = draft.provider ?? settings.coach.provider

  const setSkillLevel = (level: SkillLevelChoice) => {
    setDraft((d) => ({ ...d, level }))
  }
  const setTakePlacement = (placement: boolean) => {
    setDraft((d) => ({ ...d, placement }))
  }
  const setDailyMinutes = (minutes: DailyMinutesChoice) => {
    setDraft((d) => ({ ...d, minutes }))
  }

  /** Both endings of step 4 land here: skipping the coach still finishes setup. */
  function finish(): void {
    if (finishing) return
    setFinishing(true)
    void completeOnboarding({
      displayName,
      skillLevel: SKILL_FOR_CHOICE[skillLevel],
      goals: selectedGoals,
      dailyMinutes,
      boardTheme: board,
      themeMode: theme,
      coachProvider,
    }).then((result) => {
      if (!result.ok) {
        setFinishing(false)
        toast.error('Setup was not saved', { description: result.error.message })
        return
      }
      void navigate({ to: takePlacement ? '/puzzles' : '/' })
    })
  }

  const boardLabelId = useId()
  const goalsLabelId = useId()
  const timeLabelId = useId()
  const levelLabelId = useId()

  const previewShapes: BoardShapes = useMemo(
    () => ({
      ...emptyBoardShapes(),
      highlight: [toSquare('g1'), toSquare('f3')],
    }),
    [],
  )

  const toggleGoal = (goal: GoalChoice) => {
    setDraft((d) => {
      const current = d.goals ?? selectedGoals
      return {
        ...d,
        goals: current.includes(goal) ? current.filter((g) => g !== goal) : [...current, goal],
      }
    })
  }

  return (
    <main className="min-h-full bg-background">
      <style>{`
        .sw-green { --vb-light:#f5eedf; --vb-dark:#a3b89b; }
        .dark .sw-green { --vb-light:#dfe2d4; --vb-dark:#7d977b; }
        .sw { background: conic-gradient(var(--vb-dark) 0 25%, var(--vb-light) 0 50%, var(--vb-dark) 0 75%, var(--vb-light) 0) 0 0 / 50% 50%; }
      `}</style>

      <div className="mx-auto flex min-h-dvh w-full max-w-[680px] flex-col px-4 py-6 sm:py-10 md:py-12">
        {/* Header */}
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 -rotate-6 place-items-center rounded-xl bg-primary text-reward shadow-sm">
              <Crown className="size-5" aria-hidden="true" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">Chess King</span>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-icon size-9 min-h-[36px] min-w-[36px] sm:size-8"
            onClick={() => {
              setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
            }}
            aria-label="Toggle dark mode"
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="size-4" aria-hidden="true" />
            ) : (
              <Moon className="size-4" aria-hidden="true" />
            )}
          </button>
        </header>

        {/* Hero Title */}
        <div className="mt-6 text-center sm:mt-8">
          <h1
            aria-label="Welcome"
            className="text-2xl leading-tight font-bold tracking-tight sm:text-3xl md:text-[34px]"
          >
            Let&apos;s set you up
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Four quick questions. You&apos;ll be playing in under a minute.
          </p>
        </div>

        {/* Stepper */}
        <ol className="mt-6 grid grid-cols-4 gap-2" aria-label="Setup steps" id="stepper">
          <li>
            <button
              type="button"
              className={cn(
                'group flex min-h-[44px] w-full flex-col text-left',
                currentStep === 1 && 'is-active',
              )}
              aria-current={currentStep === 1 ? 'step' : undefined}
              aria-label="Step 1: Your level"
              onClick={() => {
                setCurrentStep(1)
              }}
            >
              <span
                className={cn(
                  'block h-1.5 w-full rounded-full transition-colors',
                  currentStep >= 1 ? 'bg-primary' : 'bg-muted',
                )}
              />
              <span
                className={cn(
                  'mt-2 block truncate text-[11px] font-medium sm:text-xs',
                  currentStep >= 1 ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                Level
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className={cn(
                'group flex min-h-[44px] w-full flex-col text-left',
                currentStep === 2 && 'is-active',
              )}
              aria-current={currentStep === 2 ? 'step' : undefined}
              aria-label="Step 2: Goals"
              onClick={() => {
                setCurrentStep(2)
              }}
            >
              <span
                className={cn(
                  'block h-1.5 w-full rounded-full transition-colors',
                  currentStep >= 2 ? 'bg-primary' : 'bg-muted',
                )}
              />
              <span
                className={cn(
                  'mt-2 block truncate text-[11px] font-medium sm:text-xs',
                  currentStep >= 2 ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                Goals
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className={cn(
                'group flex min-h-[44px] w-full flex-col text-left',
                currentStep === 3 && 'is-active',
              )}
              aria-current={currentStep === 3 ? 'step' : undefined}
              aria-label="Step 3: Daily time"
              onClick={() => {
                setCurrentStep(3)
              }}
            >
              <span
                className={cn(
                  'block h-1.5 w-full rounded-full transition-colors',
                  currentStep >= 3 ? 'bg-primary' : 'bg-muted',
                )}
              />
              <span
                className={cn(
                  'mt-2 block truncate text-[11px] font-medium sm:text-xs',
                  currentStep >= 3 ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                Time &amp; board
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className={cn(
                'group flex min-h-[44px] w-full flex-col text-left',
                currentStep === 4 && 'is-active',
              )}
              aria-current={currentStep === 4 ? 'step' : undefined}
              aria-label="Step 4: AI coach"
              onClick={() => {
                setCurrentStep(4)
              }}
            >
              <span
                className={cn(
                  'block h-1.5 w-full rounded-full transition-colors',
                  currentStep >= 4 ? 'bg-primary' : 'bg-muted',
                )}
              />
              <span
                className={cn(
                  'mt-2 block truncate text-[11px] font-medium sm:text-xs',
                  currentStep >= 4 ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                Coach
              </span>
            </button>
          </li>
        </ol>

        {/* Form Card */}
        <div className="card mt-5 p-4 sm:p-6 md:p-8">
          {/* STEP 1: LEVEL */}
          {currentStep === 1 && (
            <section aria-labelledby={levelLabelId} className="rise">
              <p className="eyebrow">Step 1 of 4</p>
              <h2 id={levelLabelId} className="mt-1 text-xl font-bold sm:text-2xl">
                How well do you know chess?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                A rough guess is fine. Everything adapts as you play.
              </p>

              <div className="mt-5 space-y-1.5">
                <label htmlFor="ob-name" className="field-label">
                  What should we call you?
                </label>
                <input
                  id="ob-name"
                  className="input"
                  value={displayName}
                  maxLength={40}
                  placeholder="Player"
                  autoComplete="nickname"
                  onChange={(e) => {
                    const name = e.target.value
                    setDraft((d) => ({ ...d, name }))
                  }}
                />
                <p className="help">
                  Stays on this device. Shown to friends only if you share a link.
                </p>
              </div>

              <div
                className="mt-5 grid gap-2 sm:grid-cols-2"
                role="radiogroup"
                aria-labelledby={levelLabelId}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={skillLevel === 'never'}
                  className={cn(
                    'option min-h-[64px] w-full p-3.5 text-left sm:p-4',
                    skillLevel === 'never' && 'is-active',
                  )}
                  onClick={() => {
                    setSkillLevel('never')
                  }}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                    <Sprout className="size-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">Never played</span>
                    <span className="help">Start from how the pieces move</span>
                  </span>
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={skillLevel === 'rules'}
                  className={cn(
                    'option min-h-[64px] w-full p-3.5 text-left sm:p-4',
                    skillLevel === 'rules' && 'is-active',
                  )}
                  onClick={() => {
                    setSkillLevel('rules')
                  }}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky text-sky-ink">
                    <BookOpen className="size-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">I know the rules</span>
                    <span className="help">Casual games with friends</span>
                  </span>
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={skillLevel === 'club'}
                  className={cn(
                    'option min-h-[64px] w-full p-3.5 text-left sm:p-4',
                    skillLevel === 'club' && 'is-active',
                  )}
                  onClick={() => {
                    setSkillLevel('club')
                  }}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-reward-soft text-reward-ink">
                    <Swords className="size-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">Club player</span>
                    <span className="help">Around 1200 online</span>
                  </span>
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={skillLevel === 'strong'}
                  className={cn(
                    'option min-h-[64px] w-full p-3.5 text-left sm:p-4',
                    skillLevel === 'strong' && 'is-active',
                  )}
                  onClick={() => {
                    setSkillLevel('strong')
                  }}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lilac text-lilac-ink">
                    <Crown className="size-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">Strong</span>
                    <span className="help">1600 and up</span>
                  </span>
                </button>
              </div>

              <div className="mt-4 flex min-h-[44px] items-center gap-3 rounded-xl border border-dashed p-3 text-sm">
                <Puzzle className="size-5 shrink-0 text-primary" aria-hidden="true" />
                <div className="flex-1">
                  <label htmlFor="placement-check" className="block cursor-pointer font-medium">
                    Not sure? Take a 5-puzzle placement
                  </label>
                  <span className="help">
                    We&apos;ll open puzzles first. Your rating adapts as you solve.
                  </span>
                </div>
                <span className="switch">
                  <input
                    type="checkbox"
                    id="placement-check"
                    checked={takePlacement}
                    onChange={(e) => {
                      setTakePlacement(e.target.checked)
                    }}
                  />
                  <span />
                </span>
              </div>

              <div className="mt-7 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  className="btn-cta min-h-[44px] w-full sm:w-auto"
                  onClick={() => {
                    setCurrentStep(2)
                  }}
                >
                  Continue
                  <ArrowRight className="size-[18px]" aria-hidden="true" />
                </Button>
              </div>
            </section>
          )}

          {/* STEP 2: GOALS */}
          {currentStep === 2 && (
            <section aria-labelledby={goalsLabelId} className="rise">
              <p className="eyebrow">Step 2 of 4</p>
              <h2 id={goalsLabelId} className="mt-1 text-xl font-bold sm:text-2xl">
                What would you like to get better at?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pick as many as you like. Sage builds your weekly plan around them.
              </p>

              <div
                className="mt-5 flex flex-wrap gap-2"
                role="group"
                aria-labelledby={goalsLabelId}
              >
                <button
                  type="button"
                  aria-pressed={selectedGoals.includes('tactics')}
                  className={cn(
                    'inline-flex min-h-[40px] items-center gap-2 rounded-full border bg-card px-3.5 py-2 text-sm font-medium transition hover:border-ring/60 sm:px-4 sm:py-2.5',
                    selectedGoals.includes('tactics') &&
                      'border-primary bg-accent text-accent-foreground',
                  )}
                  onClick={() => {
                    toggleGoal('tactics')
                  }}
                >
                  <Zap className="size-4" aria-hidden="true" />
                  Tactics
                </button>

                <button
                  type="button"
                  aria-pressed={selectedGoals.includes('openings')}
                  className={cn(
                    'inline-flex min-h-[40px] items-center gap-2 rounded-full border bg-card px-3.5 py-2 text-sm font-medium transition hover:border-ring/60 sm:px-4 sm:py-2.5',
                    selectedGoals.includes('openings') &&
                      'border-primary bg-accent text-accent-foreground',
                  )}
                  onClick={() => {
                    toggleGoal('openings')
                  }}
                >
                  <BookOpen className="size-4" aria-hidden="true" />
                  Openings
                </button>

                <button
                  type="button"
                  aria-pressed={selectedGoals.includes('endgames')}
                  className={cn(
                    'inline-flex min-h-[40px] items-center gap-2 rounded-full border bg-card px-3.5 py-2 text-sm font-medium transition hover:border-ring/60 sm:px-4 sm:py-2.5',
                    selectedGoals.includes('endgames') &&
                      'border-primary bg-accent text-accent-foreground',
                  )}
                  onClick={() => {
                    toggleGoal('endgames')
                  }}
                >
                  <Castle className="size-4" aria-hidden="true" />
                  Endgames
                </button>

                <button
                  type="button"
                  aria-pressed={selectedGoals.includes('friends')}
                  className={cn(
                    'inline-flex min-h-[40px] items-center gap-2 rounded-full border bg-card px-3.5 py-2 text-sm font-medium transition hover:border-ring/60 sm:px-4 sm:py-2.5',
                    selectedGoals.includes('friends') &&
                      'border-primary bg-accent text-accent-foreground',
                  )}
                  onClick={() => {
                    toggleGoal('friends')
                  }}
                >
                  <Users className="size-4" aria-hidden="true" />
                  Beat my friends
                </button>

                <button
                  type="button"
                  aria-pressed={selectedGoals.includes('blunders')}
                  className={cn(
                    'inline-flex min-h-[40px] items-center gap-2 rounded-full border bg-card px-3.5 py-2 text-sm font-medium transition hover:border-ring/60 sm:px-4 sm:py-2.5',
                    selectedGoals.includes('blunders') &&
                      'border-primary bg-accent text-accent-foreground',
                  )}
                  onClick={() => {
                    toggleGoal('blunders')
                  }}
                >
                  <ShieldCheck className="size-4" aria-hidden="true" />
                  Stop blundering
                </button>
              </div>

              <p className="mt-4 flex gap-2 rounded-xl bg-accent/60 p-3 text-xs text-muted-foreground">
                <Sparkles className="mt-px size-3.5 shrink-0 text-primary" aria-hidden="true" />
                Good picks. Most players improve fastest by blundering less, so that comes first.
              </p>

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-[44px] w-full sm:w-auto"
                  onClick={() => {
                    setCurrentStep(1)
                  }}
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Back
                </Button>
                <Button
                  type="button"
                  className="btn-cta min-h-[44px] w-full sm:w-auto"
                  onClick={() => {
                    setCurrentStep(3)
                  }}
                >
                  Continue
                  <ArrowRight className="size-[18px]" aria-hidden="true" />
                </Button>
              </div>
            </section>
          )}

          {/* STEP 3: TIME & BOARD */}
          {currentStep === 3 && (
            <section aria-labelledby={timeLabelId} className="rise">
              <p className="eyebrow">Step 3 of 4</p>
              <h2 id={timeLabelId} className="mt-1 text-xl font-bold sm:text-2xl">
                How much time a day?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Small and steady beats long and rare. You can change it any time.
              </p>

              <div
                className="mt-5 grid grid-cols-3 gap-2"
                role="radiogroup"
                aria-labelledby={timeLabelId}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={dailyMinutes === 5}
                  className={cn(
                    'option min-h-[72px] flex-col gap-0.5 p-3 text-center sm:p-4',
                    dailyMinutes === 5 && 'is-active',
                  )}
                  onClick={() => {
                    setDailyMinutes(5)
                  }}
                >
                  <span className="font-display text-xl font-bold sm:text-2xl">5</span>
                  <span className="help">min · a quick habit</span>
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={dailyMinutes === 15}
                  className={cn(
                    'option min-h-[72px] flex-col gap-0.5 p-3 text-center sm:p-4',
                    dailyMinutes === 15 && 'is-active',
                  )}
                  onClick={() => {
                    setDailyMinutes(15)
                  }}
                >
                  <span className="font-display text-xl font-bold sm:text-2xl">15</span>
                  <span className="help">min · recommended</span>
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={dailyMinutes === 30}
                  className={cn(
                    'option min-h-[72px] flex-col gap-0.5 p-3 text-center sm:p-4',
                    dailyMinutes === 30 && 'is-active',
                  )}
                  onClick={() => {
                    setDailyMinutes(30)
                  }}
                >
                  <span className="font-display text-xl font-bold sm:text-2xl">30</span>
                  <span className="help">min · serious</span>
                </button>
              </div>

              <div className="mt-6 grid items-center gap-5 sm:grid-cols-[minmax(0,1fr)_200px]">
                <div>
                  <span className="field-label block" id={boardLabelId}>
                    Pick a board you like
                  </span>
                  <div
                    className="mt-2 flex flex-wrap gap-2.5"
                    role="radiogroup"
                    aria-labelledby={boardLabelId}
                  >
                    {BOARD_SWATCHES.map((swatch) => (
                      <button
                        key={swatch.id}
                        type="button"
                        role="radio"
                        aria-checked={board === swatch.id}
                        data-board-name={swatch.id === 'grove' ? '' : swatch.id}
                        className="group flex min-h-[44px] flex-col items-center gap-1 text-[11px] font-medium"
                        onClick={() => {
                          setBoard(swatch.id)
                        }}
                      >
                        <span
                          className={cn(
                            'sw block size-11 rounded-lg ring-1 ring-border group-aria-checked:ring-[3px] group-aria-checked:ring-primary',
                            swatch.id === 'grove' && 'sw-green',
                          )}
                          data-board={swatch.id !== 'grove' ? swatch.id : undefined}
                        />
                        {swatch.label}
                      </button>
                    ))}
                  </div>
                  <p className="help mt-2">Pieces and more in Settings later.</p>
                </div>

                <div className="mx-auto w-full max-w-[180px] overflow-hidden rounded-xl shadow-[0_18px_40px_-18px_rgba(30,40,30,.45)] ring-1 ring-border sm:max-w-[200px]">
                  <Board
                    fen={PREVIEW_FEN}
                    movable="none"
                    shapes={previewShapes}
                    label="Board preview after 1.e4 e5 2.Nf3"
                  />
                </div>
              </div>

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-[44px] w-full sm:w-auto"
                  onClick={() => {
                    setCurrentStep(2)
                  }}
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Back
                </Button>
                <Button
                  type="button"
                  className="btn-cta min-h-[44px] w-full sm:w-auto"
                  onClick={() => {
                    setCurrentStep(4)
                  }}
                >
                  Continue
                  <ArrowRight className="size-[18px]" aria-hidden="true" />
                </Button>
              </div>
            </section>
          )}

          {/* STEP 4: AI COACH */}
          {currentStep === 4 && (
            <section aria-labelledby="s4-h" className="rise">
              <p className="eyebrow">Step 4 of 4 · optional</p>
              <div className="mt-1 flex items-start gap-3">
                <span className="sage-av size-10 shrink-0 rounded-2xl sm:size-11">
                  <Brain className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 id="s4-h" className="text-xl font-bold sm:text-2xl">
                    Want Sage, your AI coach?
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Sage explains your mistakes in plain words. It runs on your own key from Gemini,
                    OpenAI or Anthropic.
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={finishing}
                className="mt-5 flex min-h-[56px] w-full items-center gap-3 rounded-2xl border-2 border-primary/30 bg-accent/60 p-3.5 text-left transition hover:border-primary sm:p-4"
                onClick={finish}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-card text-primary ring-1 ring-border">
                  <SkipForward className="size-5" aria-hidden="true" />
                </span>
                <span className="flex-1">
                  <span className="block text-base font-semibold">
                    Skip — everything works without it
                  </span>
                  <span className="help">
                    Games, puzzles, lessons, Stockfish review. Add a key later in Settings.
                  </span>
                </span>
                <ArrowRight className="size-5 shrink-0 text-primary" aria-hidden="true" />
              </button>

              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or pick your coach now
                <span className="h-px flex-1 bg-border" />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="ob-prov" className="field-label">
                  Provider
                </label>
                <select
                  id="ob-prov"
                  className="input min-h-[40px]"
                  value={coachProvider}
                  onChange={(e) => {
                    const next = PROVIDER_OPTIONS.find((option) => option.id === e.target.value)
                    if (next === undefined) return
                    setDraft((d) => ({ ...d, provider: next.id }))
                  }}
                >
                  {PROVIDER_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <p className="mt-2 flex gap-2 text-xs text-muted-foreground">
                <Lock className="mt-px size-3.5 shrink-0 text-primary" aria-hidden="true" />
                Your key is added in Settings once Sage is switched on. It will be encrypted in this
                browser and sent only to your provider. Gemini has a free tier.
              </p>

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-[44px] w-full sm:w-auto"
                  onClick={() => {
                    setCurrentStep(3)
                  }}
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Back
                </Button>
                <Button
                  type="button"
                  className="btn-cta min-h-[44px] w-full sm:w-auto"
                  disabled={finishing}
                  onClick={finish}
                >
                  <Play className="size-[18px]" aria-hidden="true" />
                  Start playing
                </Button>
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          No account. No tracking. Your data stays in this browser.
        </p>
      </div>
    </main>
  )
}
