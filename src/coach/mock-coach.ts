import {
  toFen,
  toSquare,
  type CoachAttachment,
  type CoachContext,
  type CoachMessage,
} from '@/domain'

import { CoachError, type CoachDelta, type CoachPort, type CoachSendOptions } from './port'

/**
 * A `CoachPort` that answers from a script.
 *
 * Why it exists beyond tests: S09 ships before any provider does, so this is
 * what the panel runs on in development, in the gallery and in e2e. It streams
 * the way a real provider does — a chunk at a time, abortable at every chunk —
 * so nothing in the UI is written against a shape only a mock can produce.
 */

export interface MockCoachReply {
  /** Tried against the user's message; the first match wins, unmatched entries are the pool. */
  readonly match?: RegExp | undefined
  readonly text: string
  /** Used instead of `text` when the no-spoilers toggle is on. */
  readonly spoilerFreeText?: string | undefined
  readonly attachments?: readonly CoachAttachment[] | undefined
  readonly quickReplies?: readonly string[] | undefined
  /** Makes this reply fail, so the panel's error + retry state is reachable from the mock. */
  readonly failWith?: string | undefined
}

export interface MockCoachOptions {
  readonly script?: readonly MockCoachReply[] | undefined
  /** Pause before the first chunk, which is what the typing indicator covers. */
  readonly thinkingMs?: number | undefined
  /** Pause between chunks. Tests pass 0 and drive the clock themselves. */
  readonly chunkMs?: number | undefined
}

const ITALIAN_FEN = 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 w - - 2 7'
const FORK_FEN = 'r4rk1/pp3ppp/2p5/6n1/3P4/2P5/PP3P1P/R3Q1K1 b - - 0 17'

/**
 * The default voice: calm, reasons before answers, never shaming. Lifted from
 * the prototype's canned replies so the mock reads like the approved design.
 */
export const DEFAULT_MOCK_SCRIPT: readonly MockCoachReply[] = [
  {
    match: /knight|fork/i,
    text: "It's one pattern. After you castle, your **queen often sits a knight-jump away from your king**. Here's the game from Tuesday.",
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
  },
  {
    match: /answer|solution|tell me/i,
    text: 'Here it is: the rook lift wins a piece. Play `Re3`, then swing to `g3`.',
    spoilerFreeText:
      "I'll keep it spoiler-free — you'll remember it far better if you find it.\n\n**Nudge:** Black's king and the rook on a8 are on the same back rank. Which of your pieces can hit two squares at once?",
    quickReplies: ['One more nudge', "I'll try again"],
  },
  {
    match: /plan|what should i|where should i/i,
    text: 'Going by your games, this order fits your weak spots:\n\n1. **Royal fork** · finishes the unit on forks\n2. **K+R vs K** · you drew two won endgames\n3. **Pins and skewers** · three missed pins last week',
    quickReplies: ['Start Royal fork', 'Preview pins first'],
  },
  {
    match: /italian|opening/i,
    text: 'Yes. You play it **6% more accurately** than anything else. One idea to add: `a4` when Black plays …a6.',
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
  },
  {
    text: 'Good question. The short answer: **look at every check and capture first**, for both sides. Most of the games you lost this week turned on a move you never considered because it looked quiet.',
  },
  {
    text: "Here's the idea in plain words: trade when you're ahead, **keep pieces when you're behind**. Your position is the better one, so simplifying helps you.",
  },
  {
    text: "You're closer than you think. That plan is exactly what a 1600 would try here. The only fix is the move order: castle first, **then** push the f-pawn.",
  },
]

/** Why keep whitespace in its own chunk: the renderer must cope with a chunk that is only a space. */
function chunk(text: string): readonly string[] {
  return text.split(/(\s+)/).filter((part) => part !== '')
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0 || signal.aborted) return Promise.resolve()
  return new Promise<void>((resolve) => {
    const finish = (): void => {
      clearTimeout(timer)
      signal.removeEventListener('abort', finish)
      resolve()
    }
    const timer = setTimeout(finish, ms)
    signal.addEventListener('abort', finish, { once: true })
  })
}

function lastUserText(messages: readonly CoachMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message?.role === 'user') return message.text
  }
  return ''
}

/**
 * Build a scripted port. `createMockCoach()` alone is the friendly default; pass
 * a one-entry script to pin a screen — or a `failWith` entry to show the error
 * state — without touching the panel.
 */
export function createMockCoach(options: MockCoachOptions = {}): CoachPort {
  const script = options.script ?? DEFAULT_MOCK_SCRIPT
  const thinkingMs = options.thinkingMs ?? 450
  const chunkMs = options.chunkMs ?? 18
  let rotation = 0

  function pick(text: string): MockCoachReply | undefined {
    const matched = script.find((reply) => reply.match?.test(text) === true)
    if (matched !== undefined) return matched
    const pool = script.filter((reply) => reply.match === undefined)
    const source = pool.length > 0 ? pool : script
    const reply = source[rotation % source.length]
    rotation += 1
    return reply
  }

  return {
    send(
      messages: readonly CoachMessage[],
      context: CoachContext,
      sendOptions: CoachSendOptions,
    ): AsyncIterable<CoachDelta> {
      const { signal } = sendOptions
      const reply = pick(lastUserText(messages))
      // Read through a call so the compiler cannot narrow a value that changes underneath it.
      const stopped = (): boolean => signal.aborted

      async function* stream(): AsyncGenerator<CoachDelta> {
        await sleep(thinkingMs, signal)
        if (stopped() || reply === undefined) return
        if (reply.failWith !== undefined) throw new CoachError(reply.failWith)

        const text =
          context.spoilerGuard && reply.spoilerFreeText !== undefined
            ? reply.spoilerFreeText
            : reply.text

        for (const part of chunk(text)) {
          if (stopped()) return
          yield { kind: 'text', text: part }
          await sleep(chunkMs, signal)
        }

        for (const attachment of reply.attachments ?? []) {
          if (stopped()) return
          yield { kind: 'attachment', attachment }
        }

        if (stopped()) return
        if (reply.quickReplies !== undefined && reply.quickReplies.length > 0) {
          yield { kind: 'quickReplies', replies: [...reply.quickReplies] }
        }

        yield {
          kind: 'usage',
          usage: {
            promptTokens: Math.min(context.tokenBudget, 1_420),
            completionTokens: Math.ceil(text.length / 4),
          },
        }
      }

      return stream()
    },
  }
}
