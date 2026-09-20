import { useEffect, useMemo, useRef } from 'react'

import { CoachPanel, type CoachContextBase, type CoachSeedScreen } from '@/coach'

import { useChatPanel } from './use-chat-panel'

import type { ShellScreen } from '../screens'

/**
 * Which of S09's six seeded conversations a screen opens with. Screens that share a task
 * share a seed, so `/puzzles` and `/puzzles/solve` continue one thread rather than two.
 */
const SEED_BY_SCREEN: Readonly<Record<string, CoachSeedScreen>> = {
  today: 'home',
  'play-setup': 'play',
  'play-game': 'play',
  puzzles: 'puzzle',
  puzzle: 'puzzle',
  'puzzle-rush': 'puzzle',
  'session-summary': 'puzzle',
  learn: 'learn',
  lesson: 'learn',
  games: 'review',
  review: 'review',
  mistakes: 'review',
  analysis: 'analysis',
  endgames: 'analysis',
  vision: 'analysis',
  openings: 'analysis',
  'opening-drill': 'analysis',
}

/** Placeholder until S21 sizes the context against the chosen provider's real window. */
const DEFAULT_TOKEN_BUDGET = 8000

export interface CoachSlotProps {
  /** `ShellScreen`, not `Screen`: the 404 frame is the smaller shape and still shows Sage. */
  readonly screen: ShellScreen
}

/**
 * The adapter between S04's panel chrome and S09's panel body. It exists because the two
 * sprints may not import each other's internals: the shell owns whether the panel is open
 * and where focus goes, the coach owns the thread. Keeping the bridge here means neither
 * has to know the other's shape.
 */
export function CoachSlot({ screen }: CoachSlotProps) {
  const chat = useChatPanel()
  const hostRef = useRef<HTMLDivElement>(null)
  const { close, registerComposer } = chat

  // S09 renders its own composer, so the shell cannot hold a ref to it directly. The panel
  // marks it with `data-slot`, which is the contract S09 documented for exactly this.
  useEffect(() => {
    const textarea = hostRef.current?.querySelector<HTMLTextAreaElement>(
      '[data-slot="coach-composer"] textarea',
    )
    registerComposer(textarea ?? null)
    return () => {
      registerComposer(null)
    }
  }, [registerComposer, screen.id])

  const context = useMemo<CoachContextBase>(
    () => ({
      screen: screen.id,
      tone: 'friendly',
      engineLines: [],
      recentGames: [],
      weakThemes: [],
      // A placeholder ceiling until S21's builder owns the budget for real.
      tokenBudget: DEFAULT_TOKEN_BUDGET,
    }),
    [screen.id],
  )

  const seedScreen = SEED_BY_SCREEN[screen.id]

  return (
    <div ref={hostRef} className="flex min-h-0 flex-1 flex-col">
      {/* S09 owns the whole panel body, header included — its header is the shell's plus
          thread history and new chat, and its status line reflects real state rather than a
          fixed string. The shell frame draws no header of its own. */}
      <CoachPanel
        context={context}
        settingsHref="/settings#coach"
        {...(seedScreen ? { seedScreen } : {})}
        {...(screen.chat.context ? { contextSummary: screen.chat.context } : {})}
        {...(screen.chat.attach ? { attachmentLabel: screen.chat.attach } : {})}
        {...(screen.chat.note ? { note: screen.chat.note } : {})}
        {...(screen.chat.quick.length > 0 ? { quickReplies: screen.chat.quick } : {})}
        onClose={close}
      />
    </div>
  )
}
