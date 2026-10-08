/**
 * Mock content for the "What Sage sees" sheet (coach-agent.md §6).
 *
 * Why static: the real context builder arrives with the provider sprint; this lets the
 * sheet's layout, budget bar and Clear behaviour be reviewed now.
 */

export const MEMORY_LAYERS = ['turn', 'session', 'profile', 'taught', 'summary'] as const
export type MemoryLayerId = (typeof MEMORY_LAYERS)[number]

export interface MemoryLayer {
  readonly id: MemoryLayerId
  readonly label: string
  readonly holds: string
  readonly sample: string
  readonly tokens: number
}

export const MEMORY_LAYER_DATA: readonly MemoryLayer[] = [
  {
    id: 'turn',
    label: 'Turn',
    holds: 'This position and your last question',
    sample: 'FEN of the current position · "What if I play Nxe5?" · engine: depth 18, +0.8',
    tokens: 640,
  },
  {
    id: 'session',
    label: 'Session',
    holds: 'This chat and what is already explained',
    sample: 'Explained: knight forks after castling. You asked about Bb3 vs d4.',
    tokens: 380,
  },
  {
    id: 'profile',
    label: 'Profile',
    holds: 'Rating, weak themes, repertoire, goals',
    sample: 'Puzzle 1480 · weak: forks, pins · plays the Italian · tone: friendly',
    tokens: 210,
  },
  {
    id: 'taught',
    label: 'Taught',
    holds: 'Concepts covered, so Sage builds on them',
    sample: 'Forks (Tue) · back-rank checks (last week) · outposts (3 weeks ago)',
    tokens: 120,
  },
  {
    id: 'summary',
    label: 'Summary',
    holds: 'A rolling summary of older chats',
    sample: 'You tend to castle early and lose time on the queenside. Prefers short answers.',
    tokens: 260,
  },
]

export const MEMORY_BUDGET_TOKENS = 2_400

/** Mock monthly spend shown in the cost meter. */
export const MONTHLY_SPEND_USD = 0.84
export const MONTHLY_CAP_USD = 5

/** Same price shape for every provider in the mock: roughly $3 / $15 per million tokens. */
export function estimateCostUsd(promptTokens: number, completionTokens: number): number {
  return (promptTokens * 3 + completionTokens * 15) / 1_000_000
}

export function formatCost(usd: number): string {
  return `≈ $${usd.toFixed(3)}`
}

export function formatTokens(tokens: number): string {
  return tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : String(tokens)
}
