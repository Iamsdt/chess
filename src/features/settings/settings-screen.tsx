import { Link } from '@tanstack/react-router'
import {
  AlertCircle,
  AlertTriangle,
  ArchiveX,
  Brain,
  Cpu,
  Crown,
  Database,
  Download,
  Eye,
  EyeOff,
  FileDown,
  HelpCircle,
  Info,
  KeyRound,
  Lock,
  LockKeyhole,
  Moon,
  Palette,
  PlugZap,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Smile,
  Sun,
  Trash2,
  Upload,
  UserRound,
  Volume2,
  Zap,
} from 'lucide-react'
import { useId, useMemo, useState } from 'react'

import { Board } from '@/board'
import { Button, cn, toast, useTheme, type BoardTheme, type PieceSet } from '@/design'
import { emptyBoardShapes, toFen, toSquare, type BoardShapes, type Fen } from '@/domain'

const PREVIEW_FEN: Fen = toFen(
  'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 w - - 2 7',
)

type SettingsSection = 'profile' | 'board' | 'coach' | 'sound' | 'data' | 'about'
type DailyGoal = 5 | 15 | 30
type MoveAnimSpeed = 'off' | 'normal' | 'slow'
type CoachTone = 'friendly' | 'blunt' | 'socratic'
type SoundStyle = 'wood' | 'soft' | 'minimal'

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

interface PieceSetOption {
  readonly id: PieceSet
  readonly label: string
}

const PIECE_SET_OPTIONS: readonly PieceSetOption[] = [
  { id: 'california', label: 'California' },
  { id: 'staunty', label: 'Staunty' },
  { id: 'maestro', label: 'Maestro' },
  { id: 'alpha', label: 'Alpha' },
]

/**
 * Settings Screen (`/settings`) — ported from `prototype/settings.html`.
 *
 * Local device preferences:
 * - Profile (display name, level, daily goal, local reminder)
 * - Board & pieces (appearance theme, board colours, piece sets, board toggles with live preview)
 * - AI coach · Sage (API key configuration, security details, coach tone, token meter)
 * - Sound (move sounds, volume, sound style, low-time warning, celebrations)
 * - Data management (storage breakdown, export/import backups, export PGN, clear data)
 * - About (version info, license, GitHub source, check for updates)
 */
export function SettingsScreen() {
  const { resolvedTheme, setTheme, board, setBoard, pieceSet, setPieceSet } = useTheme()

  // Profile state
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile')
  const [displayName, setDisplayName] = useState('Shudipto')
  const [skillLevel, setSkillLevel] = useState('Club player · around 1200')
  const [dailyGoal, setDailyGoal] = useState<DailyGoal>(15)
  const [reminderTime, setReminderTime] = useState('20:00')
  const [reminderEnabled, setReminderEnabled] = useState(true)

  // Board toggles
  const [coordinates, setCoordinates] = useState(true)
  const [highlightLastMove, setHighlightLastMove] = useState(true)
  const [animationSpeed, setAnimationSpeed] = useState<MoveAnimSpeed>('normal')
  const [premoves, setPremoves] = useState(false)
  const [alwaysAskOnPromotion, setAlwaysAskOnPromotion] = useState(true)

  // AI coach state
  const [provider, setProvider] = useState('Google Gemini')
  const [model, setModel] = useState('Gemini 2.5 Flash · fast, cheap')
  const [apiKey, setApiKey] = useState('AIzaSyC7k2-Qm9vT4xLp0eRb8nWd3HfJ6uYs1Ao')
  const [showKey, setShowKey] = useState(false)
  const [passphraseLock, setPassphraseLock] = useState(false)
  const [coachTone, setCoachTone] = useState<CoachTone>('friendly')
  const [spoilerGuard, setSpoilerGuard] = useState(true)
  const [allowEngineLines, setAllowEngineLines] = useState(true)

  // Sound state
  const [moveSounds, setMoveSounds] = useState(true)
  const [volume, setVolume] = useState(60)
  const [soundStyle, setSoundStyle] = useState<SoundStyle>('wood')
  const [lowTimeWarning, setLowTimeWarning] = useState(true)
  const [celebrations, setCelebrations] = useState(false)

  // Dialog state
  const [removeKeyModalOpen, setRemoveKeyModalOpen] = useState(false)
  const [clearDataModalOpen, setClearDataModalOpen] = useState(false)

  // IDs for accessibility
  const goalLabelId = useId()
  const appLabelId = useId()
  const boardThemesLabelId = useId()
  const pieceSetsLabelId = useId()
  const animLabelId = useId()
  const toneLabelId = useId()
  const soundStyleLabelId = useId()

  const previewShapes: BoardShapes = useMemo(
    () =>
      highlightLastMove
        ? { ...emptyBoardShapes(), highlight: [toSquare('e8'), toSquare('g8')] }
        : emptyBoardShapes(),
    [highlightLastMove],
  )

  return (
    <div className="page @container pb-16">
      <style>{`
        .sw-green { --vb-light:#f5eedf; --vb-dark:#a3b89b; }
        .dark .sw-green { --vb-light:#dfe2d4; --vb-dark:#7d977b; }
        .sw { background: conic-gradient(var(--vb-dark) 0 25%, var(--vb-light) 0 50%, var(--vb-dark) 0 75%, var(--vb-light) 0) 0 0 / 50% 50%; }
        .sub-link[aria-current="true"] { background: var(--card); color: var(--foreground); box-shadow: 0 0 0 1px var(--border); }
        section[id] { scroll-margin-top: 24px; }
      `}</style>

      {/* Header */}
      <header>
        <p className="label">Everything saves automatically, on this device only</p>
        <h1 className="page-title mt-1">Settings</h1>
      </header>

      <div className="mt-6 grid gap-6 @[780px]:grid-cols-[176px_minmax(0,1fr)]">
        {/* Sub-Navigation */}
        <nav
          aria-label="Settings sections"
          className="@[780px]:sticky @[780px]:top-6 @[780px]:self-start"
        >
          <ul className="-mx-4 flex [scrollbar-width:none] gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 @[780px]:flex-col @[780px]:overflow-visible">
            <li>
              <a
                href="#profile"
                className="sub-link nav-item h-10 min-h-[40px] shrink-0 whitespace-nowrap sm:h-9 sm:min-h-0"
                aria-current={activeSection === 'profile' ? 'true' : undefined}
                onClick={() => {
                  setActiveSection('profile')
                }}
              >
                <UserRound className="size-4" aria-hidden="true" />
                Profile
              </a>
            </li>
            <li>
              <a
                href="#board"
                className="sub-link nav-item h-10 min-h-[40px] shrink-0 whitespace-nowrap sm:h-9 sm:min-h-0"
                aria-current={activeSection === 'board' ? 'true' : undefined}
                onClick={() => {
                  setActiveSection('board')
                }}
              >
                <Palette className="size-4" aria-hidden="true" />
                Board &amp; pieces
              </a>
            </li>
            <li>
              <a
                href="#coach"
                className="sub-link nav-item h-10 min-h-[40px] shrink-0 whitespace-nowrap sm:h-9 sm:min-h-0"
                aria-current={activeSection === 'coach' ? 'true' : undefined}
                onClick={() => {
                  setActiveSection('coach')
                }}
              >
                <Brain className="size-4" aria-hidden="true" />
                AI coach
              </a>
            </li>
            <li>
              <a
                href="#sound"
                className="sub-link nav-item h-10 min-h-[40px] shrink-0 whitespace-nowrap sm:h-9 sm:min-h-0"
                aria-current={activeSection === 'sound' ? 'true' : undefined}
                onClick={() => {
                  setActiveSection('sound')
                }}
              >
                <Volume2 className="size-4" aria-hidden="true" />
                Sound
              </a>
            </li>
            <li>
              <a
                href="#data"
                className="sub-link nav-item h-10 min-h-[40px] shrink-0 whitespace-nowrap sm:h-9 sm:min-h-0"
                aria-current={activeSection === 'data' ? 'true' : undefined}
                onClick={() => {
                  setActiveSection('data')
                }}
              >
                <Database className="size-4" aria-hidden="true" />
                Data
              </a>
            </li>
            <li>
              <a
                href="#about"
                className="sub-link nav-item h-10 min-h-[40px] shrink-0 whitespace-nowrap sm:h-9 sm:min-h-0"
                aria-current={activeSection === 'about' ? 'true' : undefined}
                onClick={() => {
                  setActiveSection('about')
                }}
              >
                <Info className="size-4" aria-hidden="true" />
                About
              </a>
            </li>
          </ul>
        </nav>

        <div className="min-w-0 space-y-6">
          {/* PROFILE */}
          <section id="profile" className="card" aria-labelledby="profile-h">
            <div className="border-b p-4 sm:px-6 sm:py-4">
              <h2 id="profile-h" className="text-lg font-bold">
                Profile
              </h2>
              <p className="help">A local profile. No account, no email.</p>
            </div>
            <div className="grid gap-5 p-4 sm:grid-cols-2 sm:p-6">
              <div className="space-y-1.5">
                <label htmlFor="name" className="field-label">
                  Display name
                </label>
                <input
                  id="name"
                  className="input"
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value)
                  }}
                  autoComplete="nickname"
                />
                <p className="help">Shown to friends when you share a link.</p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="level" className="field-label">
                  Your level
                </label>
                <select
                  id="level"
                  className="input"
                  value={skillLevel}
                  onChange={(e) => {
                    setSkillLevel(e.target.value)
                  }}
                >
                  <option value="I know the rules">I know the rules</option>
                  <option value="Club player · around 1200">Club player · around 1200</option>
                  <option value="Strong · 1600+">Strong · 1600+</option>
                </select>
                <p className="help">Sets puzzle and sparring starting points. They adapt anyway.</p>
              </div>

              <div className="space-y-1.5">
                <span className="field-label block" id={goalLabelId}>
                  Daily goal
                </span>
                <div className="seg flex w-full" role="group" aria-labelledby={goalLabelId}>
                  <button
                    type="button"
                    className={cn('min-h-[36px] flex-1 sm:min-h-0', dailyGoal === 5 && 'is-active')}
                    onClick={() => {
                      setDailyGoal(5)
                    }}
                  >
                    5 min
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'min-h-[36px] flex-1 sm:min-h-0',
                      dailyGoal === 15 && 'is-active',
                    )}
                    onClick={() => {
                      setDailyGoal(15)
                    }}
                  >
                    15 min
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'min-h-[36px] flex-1 sm:min-h-0',
                      dailyGoal === 30 && 'is-active',
                    )}
                    onClick={() => {
                      setDailyGoal(30)
                    }}
                  >
                    30 min
                  </button>
                </div>
                <p className="help">Small and steady beats long and rare.</p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="remind" className="field-label">
                  Daily reminder
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="remind"
                    type="time"
                    className="input w-32 sm:w-36"
                    value={reminderTime}
                    onChange={(e) => {
                      setReminderTime(e.target.value)
                    }}
                  />
                  <label className="switch" aria-label="Reminder on">
                    <input
                      type="checkbox"
                      checked={reminderEnabled}
                      onChange={(e) => {
                        setReminderEnabled(e.target.checked)
                      }}
                    />
                    <span />
                  </label>
                </div>
                <p className="help">A browser notification. You learn best around 8pm.</p>
              </div>
            </div>
          </section>

          {/* BOARD & PIECES */}
          <section id="board" className="card" aria-labelledby="board-h">
            <div className="border-b p-4 sm:px-6 sm:py-4">
              <h2 id="board-h" className="text-lg font-bold">
                Board &amp; pieces
              </h2>
              <p className="help">Changes apply everywhere, right away.</p>
            </div>

            <div className="grid gap-6 p-4 sm:p-6 @[640px]:grid-cols-[minmax(0,1fr)_200px] @[1000px]:grid-cols-[minmax(0,1fr)_260px]">
              <div className="min-w-0 space-y-6">
                {/* Theme / Appearance */}
                <div>
                  <span className="field-label block" id={appLabelId}>
                    Appearance
                  </span>
                  <div
                    className="seg mt-2"
                    role="group"
                    aria-labelledby={appLabelId}
                    id="theme-seg"
                  >
                    <button
                      type="button"
                      className={cn(resolvedTheme === 'light' && 'is-active')}
                      onClick={() => {
                        setTheme('light')
                      }}
                    >
                      <Sun className="mr-1.5 inline size-3.5 align-[-2px]" aria-hidden="true" />
                      Light
                    </button>
                    <button
                      type="button"
                      className={cn(resolvedTheme === 'dark' && 'is-active')}
                      onClick={() => {
                        setTheme('dark')
                      }}
                    >
                      <Moon className="mr-1.5 inline size-3.5 align-[-2px]" aria-hidden="true" />
                      Dark
                    </button>
                  </div>
                </div>

                {/* Board Colours */}
                <div>
                  <span className="field-label block" id={boardThemesLabelId}>
                    Board colours
                  </span>
                  <div
                    className="mt-2 flex flex-wrap gap-2.5 sm:gap-3"
                    role="radiogroup"
                    aria-labelledby={boardThemesLabelId}
                    id="board-swatches"
                  >
                    {BOARD_SWATCHES.map((swatch) => (
                      <button
                        key={swatch.id}
                        type="button"
                        role="radio"
                        aria-checked={board === swatch.id}
                        data-board-name={swatch.id === 'grove' ? '' : swatch.id}
                        className="group flex flex-col items-center gap-1.5 text-xs font-medium"
                        onClick={() => {
                          setBoard(swatch.id)
                        }}
                      >
                        <span
                          className={cn(
                            'sw block size-12 rounded-xl ring-1 ring-border transition group-aria-checked:ring-[3px] group-aria-checked:ring-primary sm:size-14',
                            swatch.id === 'grove' && 'sw-green',
                          )}
                          data-board={swatch.id !== 'grove' ? swatch.id : undefined}
                        />
                        {swatch.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Piece Set */}
                <div>
                  <span className="field-label block" id={pieceSetsLabelId}>
                    Piece set
                  </span>
                  <div
                    className="mt-2 grid grid-cols-2 gap-2 @[1000px]:grid-cols-4"
                    role="radiogroup"
                    aria-labelledby={pieceSetsLabelId}
                    id="piece-sets"
                  >
                    {PIECE_SET_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={pieceSet === opt.id}
                        data-set-name={opt.id}
                        className="option min-h-[44px] flex-col gap-1 p-3 aria-checked:border-primary aria-checked:bg-accent/50 aria-checked:ring-2 aria-checked:ring-primary/20"
                        onClick={() => {
                          setPieceSet(opt.id)
                        }}
                      >
                        <span className="flex">
                          <img
                            src={`/pieces/${opt.id}/wN.svg`}
                            alt=""
                            className="size-9"
                            aria-hidden="true"
                          />
                          <img
                            src={`/pieces/${opt.id}/bQ.svg`}
                            alt=""
                            className="-ml-2 size-9"
                            aria-hidden="true"
                          />
                        </span>
                        <span className="text-xs font-medium">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Board Toggles */}
                <div className="divide-y rounded-xl border">
                  <div className="flex min-h-[44px] items-center gap-3 p-3 text-sm">
                    <div className="flex-1">
                      <label htmlFor="opt-coords" className="block cursor-pointer font-medium">
                        Coordinates
                      </label>
                      <span className="help">a–h and 1–8 on the board edge</span>
                    </div>
                    <span className="switch">
                      <input
                        type="checkbox"
                        id="opt-coords"
                        checked={coordinates}
                        onChange={(e) => {
                          setCoordinates(e.target.checked)
                        }}
                      />
                      <span />
                    </span>
                  </div>

                  <div className="flex min-h-[44px] items-center gap-3 p-3 text-sm">
                    <div className="flex-1">
                      <label htmlFor="opt-hl" className="block cursor-pointer font-medium">
                        Highlight last move
                      </label>
                      <span className="help">Tint the from and to squares</span>
                    </div>
                    <span className="switch">
                      <input
                        type="checkbox"
                        id="opt-hl"
                        checked={highlightLastMove}
                        onChange={(e) => {
                          setHighlightLastMove(e.target.checked)
                        }}
                      />
                      <span />
                    </span>
                  </div>

                  <div className="flex min-h-[44px] flex-wrap items-center gap-3 p-3 text-sm">
                    <span className="flex-1">
                      <span className="block font-medium" id={animLabelId}>
                        Move animation
                      </span>
                      <span className="help">How fast pieces slide</span>
                    </span>
                    <div
                      className="seg flex [&>button]:min-h-[36px]"
                      role="group"
                      aria-labelledby={animLabelId}
                    >
                      <button
                        type="button"
                        className={cn(animationSpeed === 'off' && 'is-active')}
                        onClick={() => {
                          setAnimationSpeed('off')
                        }}
                      >
                        Off
                      </button>
                      <button
                        type="button"
                        className={cn(animationSpeed === 'normal' && 'is-active')}
                        onClick={() => {
                          setAnimationSpeed('normal')
                        }}
                      >
                        Normal
                      </button>
                      <button
                        type="button"
                        className={cn(animationSpeed === 'slow' && 'is-active')}
                        onClick={() => {
                          setAnimationSpeed('slow')
                        }}
                      >
                        Slow
                      </button>
                    </div>
                  </div>

                  <div className="flex min-h-[44px] items-center gap-3 p-3 text-sm">
                    <div className="flex-1">
                      <label htmlFor="opt-premoves" className="block cursor-pointer font-medium">
                        Premoves
                      </label>
                      <span className="help">Queue a move during your opponent&apos;s turn</span>
                    </div>
                    <span className="switch">
                      <input
                        type="checkbox"
                        id="opt-premoves"
                        checked={premoves}
                        onChange={(e) => {
                          setPremoves(e.target.checked)
                        }}
                      />
                      <span />
                    </span>
                  </div>

                  <div className="flex min-h-[44px] items-center gap-3 p-3 text-sm">
                    <div className="flex-1">
                      <label htmlFor="opt-promo" className="block cursor-pointer font-medium">
                        Always ask on promotion
                      </label>
                      <span className="help">Off promotes to a queen automatically</span>
                    </div>
                    <span className="switch">
                      <input
                        type="checkbox"
                        id="opt-promo"
                        checked={alwaysAskOnPromotion}
                        onChange={(e) => {
                          setAlwaysAskOnPromotion(e.target.checked)
                        }}
                      />
                      <span />
                    </span>
                  </div>
                </div>
              </div>

              {/* Live Preview */}
              <figure className="self-start @max-[640px]:-order-1 @[640px]:sticky @[640px]:top-6">
                <div className="mx-auto w-full max-w-[260px] overflow-hidden rounded-xl shadow-[0_18px_40px_-18px_rgba(30,40,30,.45)] ring-1 ring-border sm:max-w-[300px]">
                  <Board
                    fen={PREVIEW_FEN}
                    coordinates={coordinates}
                    movable="none"
                    shapes={previewShapes}
                    label="Preview board: Italian Game after 6...O-O"
                  />
                </div>
                <figcaption className="mt-2 text-center text-xs text-muted-foreground">
                  Live preview · Italian Game, move 7
                </figcaption>
              </figure>
            </div>
          </section>

          {/* AI COACH · SAGE */}
          <section id="coach" className="card" aria-labelledby="coach-h">
            <div className="flex flex-wrap items-center gap-3 border-b p-4 sm:px-6 sm:py-4">
              <span className="sage-av size-9 rounded-xl">
                <Brain className="size-4" aria-hidden="true" />
              </span>
              <div className="flex-1">
                <h2 id="coach-h" className="text-lg font-bold">
                  AI coach · Sage
                </h2>
                <p className="help">Bring your own key. No key? Everything else works.</p>
              </div>
              <span className="badge badge-soft">
                <span className="size-1.5 rounded-full bg-success" />
                Connected
              </span>
            </div>

            <div className="space-y-6 p-4 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="provider" className="field-label">
                    Provider
                  </label>
                  <select
                    id="provider"
                    className="input"
                    value={provider}
                    onChange={(e) => {
                      setProvider(e.target.value)
                    }}
                  >
                    <option value="Google Gemini">Google Gemini</option>
                    <option value="OpenAI">OpenAI</option>
                    <option value="Anthropic">Anthropic</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="model" className="field-label">
                    Model
                  </label>
                  <select
                    id="model"
                    className="input"
                    value={model}
                    onChange={(e) => {
                      setModel(e.target.value)
                    }}
                  >
                    <option value="Gemini 2.5 Flash · fast, cheap">
                      Gemini 2.5 Flash · fast, cheap
                    </option>
                    <option value="Gemini 2.5 Pro · deeper reviews">
                      Gemini 2.5 Pro · deeper reviews
                    </option>
                  </select>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label htmlFor="apikey" className="field-label">
                    API key
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <div className="relative min-w-0 flex-1 basis-60">
                      <Lock
                        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <input
                        id="apikey"
                        type={showKey ? 'text' : 'password'}
                        className="input pr-11 pl-9 font-mono"
                        value={apiKey}
                        onChange={(e) => {
                          setApiKey(e.target.value)
                        }}
                        autoComplete="off"
                        spellCheck="false"
                      />
                      <button
                        type="button"
                        id="reveal"
                        className="btn btn-ghost btn-icon btn-sm absolute top-1/2 right-1 min-h-[36px] min-w-[36px] -translate-y-1/2"
                        aria-label={showKey ? 'Hide key' : 'Show key'}
                        aria-pressed={showKey}
                        onClick={() => {
                          setShowKey(!showKey)
                        }}
                      >
                        {showKey ? (
                          <EyeOff className="size-4" aria-hidden="true" />
                        ) : (
                          <Eye className="size-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>

                    <div className="flex w-full items-center gap-2 sm:w-auto">
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-[40px] flex-1 sm:flex-initial"
                        onClick={() => {
                          toast('Key works · Gemini 2.5 Flash')
                        }}
                      >
                        <PlugZap className="size-4" aria-hidden="true" />
                        Test key
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        className="min-h-[40px] flex-1 sm:flex-initial"
                        onClick={() => {
                          setRemoveKeyModalOpen(true)
                        }}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                        Remove key
                      </Button>
                    </div>
                  </div>
                  <p className="help">
                    Get a free key at aistudio.google.com. Added 3 Sep · last used 6 min ago.
                  </p>
                </div>
              </div>

              {/* Security Explainer */}
              <div className="rounded-2xl bg-accent/60 p-4 sm:p-5">
                <h3 className="flex items-center gap-2 text-base font-bold">
                  <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
                  How your key is protected
                </h3>
                <ul className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <li className="flex gap-2.5">
                    <KeyRound className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>
                      <b className="font-semibold">Encrypted at rest.</b>{' '}
                      <span className="text-muted-foreground">
                        AES-GCM via Web Crypto, with a non-extractable key kept in IndexedDB. The
                        page can use it but can never read it out.
                      </span>
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <Send className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>
                      <b className="font-semibold">Sent only to your provider.</b>{' '}
                      <span className="text-muted-foreground">
                        Straight from your browser to Google. No Chess King server, no proxy.
                      </span>
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <ArchiveX className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>
                      <b className="font-semibold">Never in backups.</b>{' '}
                      <span className="text-muted-foreground">
                        Exports skip it, so sharing a backup file can&apos;t leak it.
                      </span>
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <AlertCircle
                      className="mt-0.5 size-4 shrink-0 text-reward-ink"
                      aria-hidden="true"
                    />
                    <span>
                      <b className="font-semibold">The honest limit.</b>{' '}
                      <span className="text-muted-foreground">
                        No browser storage can stop malicious code running inside the page. We
                        reduce that risk with a strict Content Security Policy and no third-party
                        scripts.
                      </span>
                    </span>
                  </li>
                </ul>

                <label
                  htmlFor="opt-passphrase"
                  className="mt-4 flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border bg-card p-3 text-sm"
                >
                  <LockKeyhole className="size-4 shrink-0 text-foreground" aria-hidden="true" />
                  <span className="flex-1">
                    <span className="block font-medium">Passphrase lock</span>
                    <span className="help">
                      Adds a passphrase (PBKDF2) on top. You unlock once per session.
                    </span>
                  </span>
                  <span className="switch">
                    <input
                      type="checkbox"
                      id="opt-passphrase"
                      checked={passphraseLock}
                      onChange={(e) => {
                        setPassphraseLock(e.target.checked)
                      }}
                    />
                    <span />
                  </span>
                </label>
              </div>

              {/* Tone & Usage */}
              <div className="grid gap-6 @[900px]:grid-cols-2">
                <div>
                  <span className="field-label block" id={toneLabelId}>
                    Sage&apos;s tone
                  </span>
                  <div className="mt-2 space-y-2" role="radiogroup" aria-labelledby={toneLabelId}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={coachTone === 'friendly'}
                      className={cn(
                        'option min-h-[44px] w-full p-3 text-left',
                        coachTone === 'friendly' && 'is-active',
                      )}
                      onClick={() => {
                        setCoachTone('friendly')
                      }}
                    >
                      <span className="grid size-8 place-items-center rounded-lg bg-accent text-primary">
                        <Smile className="size-4" aria-hidden="true" />
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-medium">Friendly coach</span>
                        <span className="help">Warm, encouraging, plain words</span>
                      </span>
                    </button>

                    <button
                      type="button"
                      role="radio"
                      aria-checked={coachTone === 'blunt'}
                      className={cn(
                        'option min-h-[44px] w-full p-3 text-left',
                        coachTone === 'blunt' && 'is-active',
                      )}
                      onClick={() => {
                        setCoachTone('blunt')
                      }}
                    >
                      <span className="grid size-8 place-items-center rounded-lg bg-cta-soft text-cta">
                        <Zap className="size-4" aria-hidden="true" />
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-medium">Blunt GM</span>
                        <span className="help">Short and direct. No sugar.</span>
                      </span>
                    </button>

                    <button
                      type="button"
                      role="radio"
                      aria-checked={coachTone === 'socratic'}
                      className={cn(
                        'option min-h-[44px] w-full p-3 text-left',
                        coachTone === 'socratic' && 'is-active',
                      )}
                      onClick={() => {
                        setCoachTone('socratic')
                      }}
                    >
                      <span className="grid size-8 place-items-center rounded-lg bg-lilac text-lilac-ink">
                        <HelpCircle className="size-4" aria-hidden="true" />
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-medium">Socratic</span>
                        <span className="help">Answers with questions, so you find it</span>
                      </span>
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <label
                    htmlFor="opt-spoiler"
                    className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm"
                  >
                    <EyeOff className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span className="flex-1">
                      <span className="block font-medium">Spoiler guard</span>
                      <span className="help">On puzzles and lessons Sage nudges, never tells</span>
                    </span>
                    <span className="switch">
                      <input
                        type="checkbox"
                        id="opt-spoiler"
                        checked={spoilerGuard}
                        onChange={(e) => {
                          setSpoilerGuard(e.target.checked)
                        }}
                      />
                      <span />
                    </span>
                  </label>

                  <label
                    htmlFor="opt-engine"
                    className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm"
                  >
                    <Cpu className="size-4 shrink-0 text-foreground" aria-hidden="true" />
                    <span className="flex-1">
                      <span className="block font-medium">Let Sage read engine lines</span>
                      <span className="help">Better explanations after a game</span>
                    </span>
                    <span className="switch">
                      <input
                        type="checkbox"
                        id="opt-engine"
                        checked={allowEngineLines}
                        onChange={(e) => {
                          setAllowEngineLines(e.target.checked)
                        }}
                      />
                      <span />
                    </span>
                  </label>

                  <div className="rounded-xl border p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">September usage</span>
                      <span className="text-muted-foreground">
                        ≈ <b className="font-semibold text-foreground">$0.06</b>
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-valuenow={184000}
                      aria-valuemin={0}
                      aria-valuemax={500000}
                      aria-label="Monthly token usage"
                      className="progress mt-2"
                    >
                      <span className="w-[37%]" />
                    </div>
                    <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
                      <span>184k of 500k tokens</span>
                      <span>Soft cap · you set it</span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Estimated from your provider&apos;s public prices. Billing happens on your
                      provider account.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SOUND */}
          <section id="sound" className="card" aria-labelledby="sound-h">
            <div className="border-b p-4 sm:px-6 sm:py-4">
              <h2 id="sound-h" className="text-lg font-bold">
                Sound
              </h2>
            </div>
            <div className="divide-y px-4 sm:px-6">
              <label
                htmlFor="opt-movesounds"
                className="flex min-h-[44px] cursor-pointer items-center gap-3 py-3 text-sm"
              >
                <span className="flex-1 font-medium">Move sounds</span>
                <span className="switch">
                  <input
                    type="checkbox"
                    id="opt-movesounds"
                    checked={moveSounds}
                    onChange={(e) => {
                      setMoveSounds(e.target.checked)
                    }}
                  />
                  <span />
                </span>
              </label>

              <div className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <label htmlFor="vol" className="flex-1 font-medium">
                  Volume
                </label>
                <input
                  id="vol"
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => {
                    setVolume(Number(e.target.value))
                  }}
                  className="w-full accent-[var(--primary)] sm:w-48"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <span className="flex-1 font-medium" id={soundStyleLabelId}>
                  Sound style
                </span>
                <div
                  className="seg flex [&>button]:min-h-[36px]"
                  role="group"
                  aria-labelledby={soundStyleLabelId}
                >
                  <button
                    type="button"
                    className={cn(soundStyle === 'wood' && 'is-active')}
                    onClick={() => {
                      setSoundStyle('wood')
                    }}
                  >
                    Wood
                  </button>
                  <button
                    type="button"
                    className={cn(soundStyle === 'soft' && 'is-active')}
                    onClick={() => {
                      setSoundStyle('soft')
                    }}
                  >
                    Soft
                  </button>
                  <button
                    type="button"
                    className={cn(soundStyle === 'minimal' && 'is-active')}
                    onClick={() => {
                      setSoundStyle('minimal')
                    }}
                  >
                    Minimal
                  </button>
                </div>
              </div>

              <div className="flex min-h-[44px] items-center gap-3 py-3 text-sm">
                <div className="flex-1">
                  <label htmlFor="opt-lowtime" className="block cursor-pointer font-medium">
                    Low-time warning
                  </label>
                  <span className="help">A gentle tick under 20 seconds</span>
                </div>
                <span className="switch">
                  <input
                    type="checkbox"
                    id="opt-lowtime"
                    checked={lowTimeWarning}
                    onChange={(e) => {
                      setLowTimeWarning(e.target.checked)
                    }}
                  />
                  <span />
                </span>
              </div>

              <div className="flex min-h-[44px] items-center gap-3 py-3 text-sm">
                <div className="flex-1">
                  <label htmlFor="opt-celebrations" className="block cursor-pointer font-medium">
                    Celebration sounds
                  </label>
                  <span className="help">When a puzzle streak or lesson ends</span>
                </div>
                <span className="switch">
                  <input
                    type="checkbox"
                    id="opt-celebrations"
                    checked={celebrations}
                    onChange={(e) => {
                      setCelebrations(e.target.checked)
                    }}
                  />
                  <span />
                </span>
              </div>
            </div>
          </section>

          {/* DATA */}
          <section id="data" className="card" aria-labelledby="data-h">
            <div className="border-b p-4 sm:px-6 sm:py-4">
              <h2 id="data-h" className="text-lg font-bold">
                Your data
              </h2>
              <p className="help">It all lives in this browser. Back it up now and then.</p>
            </div>

            <div className="space-y-5 p-4 sm:p-6">
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Storage used</span>
                  <span className="text-muted-foreground">
                    <b className="font-semibold text-foreground">4.2 MB</b> in IndexedDB
                  </span>
                </div>
                <div
                  className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-muted"
                  role="img"
                  aria-label="Games 2.6 MB, puzzles 0.9 MB, lessons and repertoire 0.4 MB, chats 0.3 MB"
                >
                  <span className="w-[62%] bg-primary" />
                  <span className="w-[21%] bg-sky-ink" />
                  <span className="w-[10%] bg-reward" />
                  <span className="w-[7%] bg-lilac-ink" />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-primary" />
                    Games · 142
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-sky-ink" />
                    Puzzles
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-reward" />
                    Lessons &amp; repertoire
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-lilac-ink" />
                    Sage chats
                  </span>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <Button
                  variant="outline"
                  className="h-auto min-h-[52px] flex-col items-start gap-0.5 p-3 text-left whitespace-normal"
                  onClick={() => {
                    toast('Backup saved · chess-king-2026-09-19.json')
                  }}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <Download className="size-4" aria-hidden="true" />
                    Export backup
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    Everything except your API key (.json)
                  </span>
                </Button>

                <Button
                  variant="outline"
                  className="h-auto min-h-[52px] flex-col items-start gap-0.5 p-3 text-left whitespace-normal"
                  onClick={() => {
                    toast('Choose a backup file to import')
                  }}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <Upload className="size-4" aria-hidden="true" />
                    Import backup
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    Merges with what&apos;s here
                  </span>
                </Button>

                <Button
                  variant="outline"
                  className="h-auto min-h-[52px] flex-col items-start gap-0.5 p-3 text-left whitespace-normal"
                  onClick={() => {
                    toast('142 games exported · my-games.pgn')
                  }}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <FileDown className="size-4" aria-hidden="true" />
                    Export all PGN
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    142 games, with Sage&apos;s notes
                  </span>
                </Button>
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 p-4 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <div className="text-sm font-medium">Clear all data</div>
                  <p className="help">
                    Games, progress, garden and key. This can&apos;t be undone.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  className="min-h-[44px] w-full sm:w-auto"
                  onClick={() => {
                    setClearDataModalOpen(true)
                  }}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Clear all data
                </Button>
              </div>
            </div>
          </section>

          {/* ABOUT */}
          <section id="about" className="card bg-accent/40" aria-labelledby="about-h">
            <div className="flex flex-wrap items-start gap-4 p-4 sm:p-6">
              <span className="grid size-12 -rotate-6 place-items-center rounded-2xl bg-primary text-reward shadow-sm">
                <Crown className="size-6" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="about-h" className="text-lg font-bold">
                  Chess King{' '}
                  <span className="ml-1 align-middle font-mono text-xs font-medium text-muted-foreground">
                    v0.9.2
                  </span>
                </h2>
                <p className="mt-1 text-sm">
                  No accounts. No tracking. Your data stays in this browser.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Free and open source under the MIT licence. Stockfish 17 runs on your device.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    href="https://github.com/"
                    className="btn btn-outline btn-sm min-h-[36px]"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Crown className="size-3.5" aria-hidden="true" />
                    Source on GitHub
                  </a>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-[36px]"
                    onClick={() => {
                      toast('Up to date · v0.9.2')
                    }}
                  >
                    <RefreshCw className="size-3.5" aria-hidden="true" />
                    Check for updates
                  </Button>
                  <Button asChild variant="ghost" size="sm" className="min-h-[36px]">
                    <Link to="/onboarding">
                      <RotateCcw className="size-3.5" aria-hidden="true" />
                      Replay first-run setup
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Remove Key Modal */}
      {removeKeyModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="rk-h"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="card w-full max-w-[min(440px,calc(100vw-32px))] p-5 shadow-xl sm:p-6">
            <h2 id="rk-h" className="text-xl font-bold">
              Remove your Gemini key?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Sage goes quiet until you add a key again. Your games, puzzles and progress stay
              exactly as they are.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                className="min-h-[44px] w-full sm:w-auto"
                onClick={() => {
                  setRemoveKeyModalOpen(false)
                }}
              >
                Keep key
              </Button>
              <Button
                variant="destructive"
                className="min-h-[44px] w-full sm:w-auto"
                onClick={() => {
                  setApiKey('')
                  setRemoveKeyModalOpen(false)
                  toast('Key removed from this browser')
                }}
              >
                Remove key
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Data Modal */}
      {clearDataModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cd-h"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="card w-full max-w-[min(440px,calc(100vw-32px))] p-5 shadow-xl sm:p-6">
            <span className="grid size-11 place-items-center rounded-xl bg-destructive-soft text-destructive">
              <AlertTriangle className="size-5" aria-hidden="true" />
            </span>
            <h2 id="cd-h" className="mt-4 text-xl font-bold">
              Clear everything on this device?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              142 games, your Mistake Bank, your garden and your key will be deleted. There&apos;s
              no server copy, so this can&apos;t be undone.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 min-h-[36px]"
              onClick={() => {
                toast('Backup saved · chess-king-2026-09-19.json')
              }}
            >
              <Download className="size-3.5" aria-hidden="true" />
              Export a backup first
            </Button>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                className="min-h-[44px] w-full sm:w-auto"
                onClick={() => {
                  setClearDataModalOpen(false)
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="min-h-[44px] w-full sm:w-auto"
                onClick={() => {
                  setClearDataModalOpen(false)
                  toast('All data cleared')
                }}
              >
                Clear all data
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
