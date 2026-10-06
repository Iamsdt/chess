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
  EyeOff,
  FileDown,
  HelpCircle,
  Info,
  KeyRound,
  Lock,
  LockKeyhole,
  Monitor,
  Moon,
  Palette,
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
import { useId, useMemo, useRef, useState } from 'react'

import { Board } from '@/board'
import { useGameCount, useProfile, useSettings, useStorageEstimate, gamesRepo } from '@/data'
import { Button, cn, toast, useTheme, type BoardTheme, type PieceSet } from '@/design'
import {
  emptyBoardShapes,
  toFen,
  toSquare,
  type BoardSettings,
  type BoardShapes,
  type CoachSettings,
  type DailyGoalMinutes,
  type Fen,
  type Settings,
  type SkillLevel,
  type SoundSettings,
  type ThemeMode,
} from '@/domain'
import { downloadFile, exportGames, pgnFileName, usePgnPort } from '@/features/library'

import { MODEL_OPTIONS, PROVIDER_OPTIONS } from './coach-options'
import {
  changeProfile,
  changeSettings,
  downloadBackup,
  importBackupFile,
  wipeEverything,
} from './settings-actions'

const PREVIEW_FEN: Fen = toFen(
  'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 w - - 2 7',
)

type SettingsSection = 'profile' | 'board' | 'coach' | 'sound' | 'data' | 'about'

const SKILL_LEVEL_OPTIONS: readonly { readonly id: SkillLevel; readonly label: string }[] = [
  { id: 'beginner', label: 'I know the rules' },
  { id: 'club', label: 'Club player · around 1200' },
  { id: 'strong', label: 'Strong · 1600+' },
]

const MB = 1024 * 1024

function formatBytes(bytes: number): string {
  return bytes >= MB
    ? `${(bytes / MB).toFixed(1)} MB`
    : `${String(Math.max(1, Math.round(bytes / 1024)))} KB`
}

function formatTokens(tokens: number): string {
  return tokens >= 1000 ? `${String(Math.round(tokens / 1000))}k` : String(tokens)
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
  const { theme, setTheme, board: boardTheme, setBoard, pieceSet, setPieceSet } = useTheme()
  const settings = useSettings()
  const profile = useProfile()
  const { estimate, refresh: refreshStorage } = useStorageEstimate()
  const gameCount = useGameCount()
  const getPgnPort = usePgnPort()
  const importInput = useRef<HTMLInputElement>(null)

  const [activeSection, setActiveSection] = useState<SettingsSection>('profile')
  /** What the name field shows while it is being edited; saved on blur. */
  const [nameDraft, setNameDraft] = useState<string | undefined>(undefined)
  const [clearDataModalOpen, setClearDataModalOpen] = useState(false)
  const [clearConfirmation, setClearConfirmation] = useState('')
  const [wiping, setWiping] = useState(false)

  const { board: boardPrefs, sound, coach } = settings
  const displayName = nameDraft ?? profile?.displayName ?? ''
  const skillLevel = profile?.skillLevel ?? 'club'

  /** Why one funnel: every control saves as it changes, and a failed write must be said out loud. */
  function save(change: (current: Settings) => Settings): void {
    void changeSettings(change).then((result) => {
      if (!result.ok)
        toast.error('That setting was not saved', { description: result.error.message })
    })
  }
  const saveBoard = (patch: Partial<BoardSettings>): void => {
    save((current) => ({ ...current, board: { ...current.board, ...patch } }))
  }
  const saveSound = (patch: Partial<SoundSettings>): void => {
    save((current) => ({ ...current, sound: { ...current.sound, ...patch } }))
  }
  const saveCoach = (patch: Partial<CoachSettings>): void => {
    save((current) => ({ ...current, coach: { ...current.coach, ...patch } }))
  }
  const saveGoal = (minutes: DailyGoalMinutes): void => {
    save((current) => ({ ...current, dailyGoalMinutes: minutes }))
  }

  /** Look changes are applied to the page immediately and kept in the database. */
  const chooseTheme = (mode: ThemeMode): void => {
    setTheme(mode)
    save((current) => ({ ...current, theme: mode }))
  }
  const chooseBoard = (next: BoardTheme): void => {
    setBoard(next)
    saveBoard({ theme: next })
  }
  const choosePieceSet = (next: PieceSet): void => {
    setPieceSet(next)
    saveBoard({ pieceSet: next })
  }

  function commitName(): void {
    const trimmed = (nameDraft ?? '').trim()
    setNameDraft(undefined)
    if (nameDraft === undefined || trimmed === '' || trimmed === profile?.displayName) return
    void changeProfile({ displayName: trimmed }).then((result) => {
      if (!result.ok) toast.error('Your name was not saved', { description: result.error.message })
    })
  }

  function onExportBackup(): void {
    void downloadBackup().then((result) => {
      if (!result.ok) {
        toast.error('Backup failed', { description: result.error.message })
        return
      }
      toast.success(`Backup saved · ${result.value.fileName}`, {
        description: 'Everything except your API key.',
      })
    })
  }

  function onImportBackup(file: File | undefined): void {
    if (file === undefined) return
    void importBackupFile(file).then((result) => {
      if (!result.ok) {
        toast.error('That backup could not be imported', { description: result.error.message })
        return
      }
      toast.success('Backup merged', { description: `${String(result.value)} records read.` })
      refreshStorage()
    })
  }

  function onExportPgn(): void {
    void exportGames({}, { pgn: getPgnPort(), games: gamesRepo }).then((result) => {
      if (!result.ok) {
        toast.error('Nothing exported', { description: result.error.message })
        return
      }
      const name = pgnFileName()
      downloadFile(name, result.value.text)
      toast.success(`${name} downloaded`, { description: `${String(result.value.count)} games.` })
    })
  }

  function onClearAll(): void {
    setWiping(true)
    void wipeEverything().then((result) => {
      if (!result.ok) {
        setWiping(false)
        toast.error('Nothing was cleared', { description: result.error.message })
        return
      }
      // A full load, not a route change: every live query and cached setting is stale now,
      // and the first-run flow should start from a clean slate.
      window.location.assign('/onboarding')
    })
  }

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
      boardPrefs.highlightLastMove
        ? { ...emptyBoardShapes(), highlight: [toSquare('e8'), toSquare('g8')] }
        : emptyBoardShapes(),
    [boardPrefs.highlightLastMove],
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
                    setNameDraft(e.target.value)
                  }}
                  onBlur={commitName}
                  maxLength={40}
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
                    const level = SKILL_LEVEL_OPTIONS.find((option) => option.id === e.target.value)
                    if (level === undefined) return
                    void changeProfile({ skillLevel: level.id })
                  }}
                >
                  {SKILL_LEVEL_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
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
                    className={cn(
                      'min-h-[36px] flex-1 sm:min-h-0',
                      settings.dailyGoalMinutes === 5 && 'is-active',
                    )}
                    onClick={() => {
                      saveGoal(5)
                    }}
                  >
                    5 min
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'min-h-[36px] flex-1 sm:min-h-0',
                      settings.dailyGoalMinutes === 15 && 'is-active',
                    )}
                    onClick={() => {
                      saveGoal(15)
                    }}
                  >
                    15 min
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'min-h-[36px] flex-1 sm:min-h-0',
                      settings.dailyGoalMinutes === 30 && 'is-active',
                    )}
                    onClick={() => {
                      saveGoal(30)
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
                    value={settings.reminderTime}
                    onChange={(e) => {
                      const time = e.target.value
                      if (time === '') return
                      save((current) => ({ ...current, reminderTime: time }))
                    }}
                  />
                  <label className="switch" aria-label="Reminder on">
                    <input
                      type="checkbox"
                      checked={settings.reminderEnabled}
                      onChange={(e) => {
                        const enabled = e.target.checked
                        save((current) => ({ ...current, reminderEnabled: enabled }))
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
                      className={cn(theme === 'light' && 'is-active')}
                      onClick={() => {
                        chooseTheme('light')
                      }}
                    >
                      <Sun className="mr-1.5 inline size-3.5 align-[-2px]" aria-hidden="true" />
                      Light
                    </button>
                    <button
                      type="button"
                      className={cn(theme === 'dark' && 'is-active')}
                      onClick={() => {
                        chooseTheme('dark')
                      }}
                    >
                      <Moon className="mr-1.5 inline size-3.5 align-[-2px]" aria-hidden="true" />
                      Dark
                    </button>
                    <button
                      type="button"
                      className={cn(theme === 'system' && 'is-active')}
                      onClick={() => {
                        chooseTheme('system')
                      }}
                    >
                      <Monitor className="mr-1.5 inline size-3.5 align-[-2px]" aria-hidden="true" />
                      System
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
                        aria-checked={boardTheme === swatch.id}
                        data-board-name={swatch.id === 'grove' ? '' : swatch.id}
                        className="group flex flex-col items-center gap-1.5 text-xs font-medium"
                        onClick={() => {
                          chooseBoard(swatch.id)
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
                          choosePieceSet(opt.id)
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
                        checked={boardPrefs.coordinates}
                        onChange={(e) => {
                          saveBoard({ coordinates: e.target.checked })
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
                        checked={boardPrefs.highlightLastMove}
                        onChange={(e) => {
                          saveBoard({ highlightLastMove: e.target.checked })
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
                        className={cn(boardPrefs.animation === 'off' && 'is-active')}
                        onClick={() => {
                          saveBoard({ animation: 'off' })
                        }}
                      >
                        Off
                      </button>
                      <button
                        type="button"
                        className={cn(boardPrefs.animation === 'normal' && 'is-active')}
                        onClick={() => {
                          saveBoard({ animation: 'normal' })
                        }}
                      >
                        Normal
                      </button>
                      <button
                        type="button"
                        className={cn(boardPrefs.animation === 'slow' && 'is-active')}
                        onClick={() => {
                          saveBoard({ animation: 'slow' })
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
                        checked={boardPrefs.premoves}
                        onChange={(e) => {
                          saveBoard({ premoves: e.target.checked })
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
                        checked={boardPrefs.alwaysAskOnPromotion}
                        onChange={(e) => {
                          saveBoard({ alwaysAskOnPromotion: e.target.checked })
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
                    coordinates={boardPrefs.coordinates}
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
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    coach.hasKey ? 'bg-success' : 'bg-muted-foreground',
                  )}
                />
                {coach.hasKey ? 'Connected' : 'No key yet'}
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
                    value={coach.provider}
                    onChange={(e) => {
                      const next = PROVIDER_OPTIONS.find((option) => option.id === e.target.value)
                      if (next === undefined) return
                      // A model name from another provider would be a request that always fails.
                      const firstModel = MODEL_OPTIONS[next.id][0]
                      saveCoach({
                        provider: next.id,
                        ...(firstModel ? { model: firstModel.id } : {}),
                      })
                    }}
                  >
                    {PROVIDER_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="model" className="field-label">
                    Model
                  </label>
                  <select
                    id="model"
                    className="input"
                    value={coach.model}
                    onChange={(e) => {
                      saveCoach({ model: e.target.value })
                    }}
                  >
                    {MODEL_OPTIONS[coach.provider].map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label htmlFor="apikey" className="field-label">
                    API key
                  </label>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <input
                      id="apikey"
                      type="password"
                      className="input pl-9 font-mono"
                      value=""
                      placeholder={
                        coach.hasKey ? 'A key is stored on this device' : 'No key stored'
                      }
                      disabled
                      readOnly
                      autoComplete="off"
                    />
                  </div>
                  <p className="help">
                    Saving a key switches on with the Sage coach itself, which also tests it and
                    shows its usage. Your tone and model choices below are kept already.
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
                      checked={coach.passphraseLock}
                      onChange={(e) => {
                        saveCoach({ passphraseLock: e.target.checked })
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
                      aria-checked={coach.tone === 'friendly'}
                      className={cn(
                        'option min-h-[44px] w-full p-3 text-left',
                        coach.tone === 'friendly' && 'is-active',
                      )}
                      onClick={() => {
                        saveCoach({ tone: 'friendly' })
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
                      aria-checked={coach.tone === 'blunt'}
                      className={cn(
                        'option min-h-[44px] w-full p-3 text-left',
                        coach.tone === 'blunt' && 'is-active',
                      )}
                      onClick={() => {
                        saveCoach({ tone: 'blunt' })
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
                      aria-checked={coach.tone === 'socratic'}
                      className={cn(
                        'option min-h-[44px] w-full p-3 text-left',
                        coach.tone === 'socratic' && 'is-active',
                      )}
                      onClick={() => {
                        saveCoach({ tone: 'socratic' })
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
                        checked={coach.spoilerGuard}
                        onChange={(e) => {
                          saveCoach({ spoilerGuard: e.target.checked })
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
                        checked={coach.allowEngineLines}
                        onChange={(e) => {
                          saveCoach({ allowEngineLines: e.target.checked })
                        }}
                      />
                      <span />
                    </span>
                  </label>

                  <div className="rounded-xl border p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Monthly usage</span>
                      <span className="text-muted-foreground">
                        <b className="font-semibold text-foreground">0</b> tokens so far
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-valuenow={0}
                      aria-valuemin={0}
                      aria-valuemax={coach.monthlyTokenCap}
                      aria-label="Monthly token usage"
                      className="progress mt-2"
                    >
                      <span className="w-0" />
                    </div>
                    <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
                      <span>0 of {formatTokens(coach.monthlyTokenCap)} tokens</span>
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
                    checked={sound.moveSounds}
                    onChange={(e) => {
                      saveSound({ moveSounds: e.target.checked })
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
                  value={sound.volume}
                  onChange={(e) => {
                    saveSound({ volume: Number(e.target.value) })
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
                    className={cn(sound.style === 'wood' && 'is-active')}
                    onClick={() => {
                      saveSound({ style: 'wood' })
                    }}
                  >
                    Wood
                  </button>
                  <button
                    type="button"
                    className={cn(sound.style === 'soft' && 'is-active')}
                    onClick={() => {
                      saveSound({ style: 'soft' })
                    }}
                  >
                    Soft
                  </button>
                  <button
                    type="button"
                    className={cn(sound.style === 'minimal' && 'is-active')}
                    onClick={() => {
                      saveSound({ style: 'minimal' })
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
                    checked={sound.lowTimeWarning}
                    onChange={(e) => {
                      saveSound({ lowTimeWarning: e.target.checked })
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
                    checked={sound.celebrations}
                    onChange={(e) => {
                      saveSound({ celebrations: e.target.checked })
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
                    {estimate === undefined ? (
                      'The browser did not say'
                    ) : (
                      <>
                        <b className="font-semibold text-foreground">
                          {formatBytes(estimate.usageBytes)}
                        </b>{' '}
                        of {formatBytes(estimate.quotaBytes)} available
                      </>
                    )}
                  </span>
                </div>
                {estimate !== undefined && estimate.quotaBytes > 0 && (
                  <div
                    role="progressbar"
                    aria-label="Storage used"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.min(100, Math.round(estimate.usedRatio * 100))}
                    className="progress mt-2"
                  >
                    <span
                      style={{
                        width: `${String(Math.min(100, estimate.usedRatio * 100))}%`,
                      }}
                    />
                  </div>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  {gameCount === undefined
                    ? 'Counting games…'
                    : `${String(gameCount)} games in your library`}
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <Button
                  variant="outline"
                  className="h-auto min-h-[52px] flex-col items-start gap-0.5 p-3 text-left whitespace-normal"
                  onClick={onExportBackup}
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
                    importInput.current?.click()
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
                <input
                  ref={importInput}
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  aria-label="Backup file"
                  tabIndex={-1}
                  onChange={(e) => {
                    onImportBackup(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />

                <Button
                  variant="outline"
                  className="h-auto min-h-[52px] flex-col items-start gap-0.5 p-3 text-left whitespace-normal"
                  onClick={onExportPgn}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <FileDown className="size-4" aria-hidden="true" />
                    Export all PGN
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    Every game in your library
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
                    setClearConfirmation('')
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
                    v0.0.0
                  </span>
                </h2>
                <p className="mt-1 text-sm">
                  No accounts. No tracking. Your data stays in this browser.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Free and open source under the MIT licence. Stockfish runs on your device.
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
                      toast('You are on the latest build')
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
              {gameCount === undefined ? 'Your' : `${String(gameCount)} games, your`} Mistake Bank,
              your garden and your key will be deleted. There&apos;s no server copy, so this
              can&apos;t be undone.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 min-h-[36px]"
              onClick={onExportBackup}
            >
              <Download className="size-3.5" aria-hidden="true" />
              Export a backup first
            </Button>
            <div className="mt-4 space-y-1.5">
              <label htmlFor="clear-confirm" className="field-label">
                Type DELETE to confirm
              </label>
              <input
                id="clear-confirm"
                className="input"
                value={clearConfirmation}
                autoComplete="off"
                spellCheck="false"
                onChange={(e) => {
                  setClearConfirmation(e.target.value)
                }}
              />
            </div>
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
                disabled={clearConfirmation !== 'DELETE' || wiping}
                onClick={onClearAll}
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
