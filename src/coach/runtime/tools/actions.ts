import { z } from 'zod'

import { actionHref } from '@/coach/actions/action-href'
import type { ActionAttachment } from '@/domain'

import { isToolFailure, resolveFen, toolFailure } from './shared'
import { defineTool, type CoachToolGroup, type CoachToolOutput } from './types'

/**
 * S21b · Actions (§5): queuePuzzles, openLesson, addToMistakeBank, startDrill,
 * startVisualizationSet, setTodaysPlan. (`saveNote` lives with memory.)
 *
 * Why every action only proposes: guardrail "reversible, none destructive" (§5, §7) means
 * the model never changes the user's data. Each tool pins a card; the user's Confirm runs
 * `performAction`. The output tells the model the card is waiting, so it says "I've set that
 * up for you to confirm" rather than "done".
 */

const LESSONS_UNAVAILABLE = 'Lessons are coming soon, so this cannot be opened yet.'

interface Proposed extends CoachToolOutput {
  readonly status: 'proposed' | 'unavailable'
  readonly note: string
}

const WAITING = 'Proposed on a card. Nothing has happened: waiting for the user to confirm.'

/** `mateIn2` → `Mate in 2`, `back-rank` → `Back rank`. */
function themeName(theme: string): string {
  const spaced = theme
    .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export const actionTools: CoachToolGroup = (env) => {
  const propose = (
    card: Omit<ActionAttachment, 'kind' | 'items'> & { items?: string[] },
  ): Proposed => {
    env.emit({ kind: 'action', items: [], ...card })
    return { status: 'proposed', note: WAITING, summary: `proposed: ${card.title}` }
  }

  return {
    queuePuzzles: defineTool({
      description:
        'Propose a set of puzzles, on one theme or on the weakest ones. The user confirms on a card; nothing starts until then.',
      inputSchema: z.object({
        theme: z.string().min(1).optional().describe('A puzzle theme such as fork or mateIn2.'),
        count: z.number().int().min(3).max(20).default(10),
      }),
      execute: ({ theme, count }) =>
        propose({
          action: 'queue-puzzles',
          title:
            theme === undefined ? 'Puzzles on your weakest themes' : `${themeName(theme)} puzzles`,
          detail: `${String(count)} puzzles, chosen for your rating.`,
          items: theme === undefined ? [] : [themeName(theme)],
          href: actionHref('/puzzles/solve', { theme, goal: count }),
        }),
    }),

    openLesson: defineTool({
      description:
        'Propose opening a lesson. Lessons are not available yet: the card says so and cannot be confirmed.',
      inputSchema: z.object({
        topic: z.string().min(1).describe('What the lesson is about, in a few words.'),
      }),
      execute: ({ topic }): Proposed => {
        env.emit({
          kind: 'action',
          action: 'open-lesson',
          title: `Lesson: ${topic}`,
          items: [],
          unavailable: LESSONS_UNAVAILABLE,
        })
        return {
          status: 'unavailable',
          note: `${LESSONS_UNAVAILABLE} Tell the user, and offer a puzzle set or a Sage board instead.`,
          summary: 'lessons not available yet',
        }
      },
    }),

    addToMistakeBank: defineTool({
      description:
        'Propose saving the position on screen to the Mistake Bank for spaced review. Uses the current position.',
      inputSchema: z.object({
        fen: z.string().optional().describe('Defaults to the position on screen.'),
      }),
      execute: ({ fen }) => {
        const resolved = resolveFen(env, fen)
        if (isToolFailure(resolved)) return resolved
        return propose({
          action: 'add-to-mistake-bank',
          title: 'Save this position to the Mistake Bank',
          detail: 'It comes back for review on a schedule, with the engine’s best move.',
          href: actionHref('/mistakes', {
            fen: resolved,
            color: env.context.position?.orientation,
          }),
        })
      },
    }),

    startDrill: defineTool({
      description: 'Propose an endgame drill or a vision drill. The user confirms on a card.',
      inputSchema: z.object({
        kind: z.enum(['endgame', 'vision']),
        focus: z.string().min(1).optional().describe('E.g. "king and pawn" or "knight routes".'),
      }),
      execute: ({ kind, focus }) =>
        propose({
          action: 'start-drill',
          title: kind === 'endgame' ? 'Endgame drill' : 'Vision drill',
          items: focus === undefined ? [] : [focus],
          href: actionHref(kind === 'endgame' ? '/drills/endgames' : '/drills/vision'),
        }),
    }),

    startVisualizationSet: defineTool({
      description:
        'Propose a short ladder of visualization exercises at the user’s level. The user confirms on a card.',
      inputSchema: z.object({
        focus: z.string().min(1).optional().describe('E.g. "knight routes" or "blindfold checks".'),
      }),
      execute: ({ focus }) =>
        propose({
          action: 'start-drill',
          title: 'Visualization set',
          detail: 'A few exercises that start easy and climb as you get them right.',
          items: focus === undefined ? [] : [focus],
          href: actionHref('/drills/vision'),
        }),
    }),

    setTodaysPlan: defineTool({
      description:
        'Propose today’s path as a short list of steps. The user confirms on a card; nothing is saved until then.',
      inputSchema: z.object({
        steps: z.array(z.string().min(1).max(80)).min(1).max(6),
      }),
      execute: ({ steps }) => {
        if (new Set(steps).size !== steps.length) return toolFailure('Steps must be different.')
        return propose({
          action: 'set-plan',
          title: 'Today’s plan',
          items: steps,
          href: actionHref('/'),
        })
      },
    }),
  }
}
