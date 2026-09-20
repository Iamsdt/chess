import {
  toFen,
  toSquare,
  toTimestamp,
  type CoachAttachment,
  type CoachMessage,
  type ThreadId,
  type CoachRole,
  type Timestamp,
} from '@/domain'

import { newMessageId } from './ids'

/**
 * The per-screen opening messages, ported from the prototype's `#chat-seed`
 * templates.
 *
 * Why seeds are data and not markup: every screen opens Sage with something it
 * already knows about that screen, and the panel must not grow a branch per
 * route to say it. S04 maps its route id to one of these keys; a screen with no
 * seed simply opens on the empty state.
 */

export const COACH_SEED_SCREENS = ['home', 'play', 'puzzle', 'review', 'learn', 'analysis'] as const
export type CoachSeedScreen = (typeof COACH_SEED_SCREENS)[number]

interface SeedTurn {
  readonly role: CoachRole
  readonly text: string
  readonly attachments?: readonly CoachAttachment[] | undefined
  readonly quickReplies?: readonly string[] | undefined
  /** Minutes before "now", so a seeded thread reads as a conversation. */
  readonly minutesAgo: number
}

interface SeedDefinition {
  /** Replaces the first day divider — the prototype's "Adaptive set · 7:54 PM". */
  readonly label: string
  /** One line for the "Sage sees:" strip under the header. */
  readonly contextSummary: string
  readonly quickReplies: readonly string[]
  readonly turns: readonly SeedTurn[]
}

const FORK_FEN = 'r4rk1/pp3ppp/2p5/6n1/3P4/2P5/PP3P1P/R3Q1K1 b - - 0 17'
const LOOSE_PAWN_FEN = 'r2qr1k1/bpp2pp1/p1n1b2p/P2np3/2B5/1QPP1N1P/1P1N1PP1/R1B1R1K1 w - - 0 14'
const ITALIAN_FEN = 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 w - - 2 7'

const SEEDS: Record<CoachSeedScreen, SeedDefinition> = {
  home: {
    label: 'Today',
    contextSummary: "your last 9 games · today's path",
    quickReplies: ['What should I work on?', 'Plan my week', 'Explain simply'],
    turns: [
      {
        role: 'sage',
        text: "Evening. You're one step from finishing today. Want to look at the position you're about to review first?",
        minutesAgo: 3,
      },
      { role: 'user', text: 'Yes. Why do I keep losing to knight tricks?', minutesAgo: 2 },
      {
        role: 'sage',
        text: "It's one pattern: after you castle, your **queen often sits a knight-jump away from your king**. Here's the game from Tuesday.\n\nA quick check before every move: **can any knight hit two things?**",
        attachments: [
          {
            kind: 'position',
            fen: toFen(FORK_FEN),
            orientation: 'white',
            highlight: [toSquare('g5')],
            focus: [toSquare('f3')],
            arrows: [
              { from: toSquare('g5'), to: toSquare('f3'), kind: 'threat' },
              { from: toSquare('f3'), to: toSquare('g1'), kind: 'sage' },
              { from: toSquare('f3'), to: toSquare('e1'), kind: 'sage' },
            ],
            caption: '`…Nf3+` forks king and queen',
            href: '/analysis',
          },
        ],
        quickReplies: ['Yes, 8 fork puzzles', 'Why after castling?'],
        minutesAgo: 2,
      },
    ],
  },
  play: {
    label: 'Game started',
    contextSummary: 'this game · the clock · your opening book',
    quickReplies: ['What does Black want?', 'Am I still in book?', 'Explain simply'],
    turns: [
      {
        role: 'sage',
        text: "I'll stay quiet while you play. Training wheels are on: I'll only speak up if you're about to **hang a piece**.",
        minutesAgo: 8,
      },
      {
        role: 'sage',
        text: 'Still in book: the **Giuoco Pianissimo**. Slow and strategic.\n\nTypical White plan: `a4`, `Re1`, then the knight tour `Nbd2–f1–g3`.',
        quickReplies: ['Show the knight tour', 'What does Black want?'],
        minutesAgo: 4,
      },
    ],
  },
  puzzle: {
    label: 'Adaptive set',
    contextSummary: 'this puzzle · your weak themes',
    quickReplies: ['Give me a nudge', 'What should I look at?', 'Explain simply'],
    turns: [
      {
        role: 'sage',
        text: "Puzzle 4. Take your time, there's no rush on this one.",
        minutesAgo: 6,
      },
      { role: 'user', text: "I'm stuck. Just tell me the answer.", minutesAgo: 5 },
      {
        role: 'sage',
        text: "I'll keep it spoiler-free, since you'll remember it far better if you find it.\n\n**Nudge:** Black's king and the rook on a8 are on the same back rank. Which of your pieces can hit two squares at once?\n\nChecks first. That's always the first question.",
        quickReplies: ['One more nudge', "I'll try again"],
        minutesAgo: 5,
      },
    ],
  },
  review: {
    label: 'Game review',
    contextSummary: 'this game · every move you played',
    quickReplies: ['What was the turning point?', 'Show me the key moment', 'Explain simply'],
    turns: [
      {
        role: 'sage',
        text: "Nice win. Here's the game in three lines.\n\nIt stayed calm and even until move 13. On move 14 the free pawn on `b7` went unplayed, and Black answered with a scary-looking `…Qh4`. You found the only move, `15.d4!`, and after that you never let go.\n\n**The one lesson:** before you make your plan, ask what is loose. Twice this game an unprotected piece decided things.",
        quickReplies: ['Show me 14.Qxb7', 'Practise loose pieces'],
        minutesAgo: 4,
      },
      { role: 'user', text: 'How did I miss b7?', minutesAgo: 3 },
      {
        role: 'sage',
        text: 'Your eyes were on the `e5` pawn. Your queen already hit `b7`, and nothing guarded it.',
        attachments: [
          {
            kind: 'position',
            fen: toFen(LOOSE_PAWN_FEN),
            orientation: 'white',
            highlight: [],
            focus: [toSquare('b7')],
            arrows: [{ from: toSquare('b3'), to: toSquare('b7'), kind: 'best' }],
            caption: '`14.Qxb7` wins a pawn safely',
            href: '/puzzles',
          },
        ],
        minutesAgo: 3,
      },
    ],
  },
  learn: {
    label: 'Today',
    contextSummary: 'your five tracks · what your games keep asking for',
    quickReplies: ['Where should I spend my time?', 'Can I skip ahead?', 'Explain simply'],
    turns: [
      {
        role: 'user',
        text: 'I have five tracks here. Where should I actually spend my time?',
        minutesAgo: 7,
      },
      {
        role: 'sage',
        text: "Going by your games, I'd keep going in **Tactics Foundations**. Knight forks started four of your five losses this week, and **Royal fork** is the very next lesson.\n\nAfter that, this order fits your weak spots:\n\n1. **Royal fork** · finishes the unit on forks\n2. **K+R vs K** · you drew two won endgames\n3. **Pins and skewers** · three missed pins last week",
        minutesAgo: 7,
      },
      { role: 'user', text: 'Can I skip ahead to pins?', minutesAgo: 6 },
      {
        role: 'sage',
        text: 'Of course. Nothing is locked. But forks and pins use the same habit: **look for two targets on one line or one jump**. Finishing forks first makes pins feel easier.',
        quickReplies: ['Start Royal fork', 'Preview pins first'],
        minutesAgo: 6,
      },
    ],
  },
  analysis: {
    label: 'Analysis',
    contextSummary: 'this position · the engine lines you allow',
    quickReplies: ['What is the plan here?', 'Why is this equal?', 'Explain simply'],
    turns: [
      {
        role: 'user',
        text: "The engine says it's equal. So what am I supposed to do here?",
        minutesAgo: 5,
      },
      {
        role: 'sage',
        text: "Equal doesn't mean nothing to do. This is a slow position, so the plan matters more than any single move.\n\n**Your plan:** make room, then reroute. `h3` stops …Bg4 and …Ng4. `Re1` backs up e4. Then your b1 knight walks `Nbd2–f1–g3` towards the kingside.\n\n**Black's plan** is the mirror: …a6 and …Ba7 to keep the bishop safe, then …Be6 to trade off your best piece.",
        attachments: [
          {
            kind: 'position',
            fen: toFen(ITALIAN_FEN),
            orientation: 'white',
            highlight: [],
            focus: [],
            arrows: [
              { from: toSquare('b1'), to: toSquare('d2'), kind: 'sage' },
              { from: toSquare('d2'), to: toSquare('f1'), kind: 'sage' },
              { from: toSquare('f1'), to: toSquare('g3'), kind: 'sage' },
            ],
            caption: "The knight's long walk to `g3`",
          },
        ],
        quickReplies: ['Show the knight route', 'What does Black want?'],
        minutesAgo: 5,
      },
    ],
  },
}

export interface CoachSeedThread {
  readonly label: string
  readonly contextSummary: string
  readonly quickReplies: readonly string[]
  readonly messages: readonly CoachMessage[]
}

/** The greeting a brand-new thread opens with, matching the prototype's "New chat". */
export const NEW_THREAD_GREETING = 'Fresh start. What are we working on?'

/** Build a screen's opening thread. `at` is injected so tests get stable timestamps. */
export function seedThreadFor(
  screen: CoachSeedScreen,
  threadId: ThreadId,
  at: Timestamp,
): CoachSeedThread {
  const definition = SEEDS[screen]
  return {
    label: definition.label,
    contextSummary: definition.contextSummary,
    quickReplies: definition.quickReplies,
    messages: definition.turns.map((turn) => ({
      id: newMessageId(),
      threadId,
      role: turn.role,
      text: turn.text,
      status: 'complete',
      createdAt: toTimestamp(at - turn.minutesAgo * 60_000),
      attachments: [...(turn.attachments ?? [])],
      quickReplies: [...(turn.quickReplies ?? [])],
    })),
  }
}
