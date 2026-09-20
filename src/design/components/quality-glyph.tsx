import { cn } from '@/design/lib/utils'
import type { MoveQuality } from '@/domain'

import type * as React from 'react'

export type { MoveQuality }

/** The render order for a legend. `satisfies` forbids a name S03 does not know, and the
 *  exhaustive `GLYPH` record below forbids omitting one — so this cannot drift from the
 *  domain union. Type-only import: the runtime list stays here so `@/design` never pulls
 *  zod and every schema into the UI bundle for ten strings. */
export const MOVE_QUALITIES = [
  'brilliant',
  'great',
  'best',
  'excellent',
  'good',
  'book',
  'inaccuracy',
  'mistake',
  'miss',
  'blunder',
] as const satisfies readonly MoveQuality[]

const GLYPH: Record<MoveQuality, string> = {
  brilliant: '!!',
  great: '!',
  best: '★',
  excellent: '✓',
  good: '✓',
  book: 'B',
  inaccuracy: '?!',
  mistake: '?',
  miss: '×',
  blunder: '??',
}

const SIZES = {
  sm: 'size-4 text-[8px]',
  default: 'size-5 text-[10px]',
  lg: 'size-6 text-xs',
} as const

export interface QualityGlyphProps extends Omit<React.ComponentProps<'span'>, 'children'> {
  quality: MoveQuality
  size?: keyof typeof SIZES
  /** Hide the spoken label when the verdict is already written next to the glyph. */
  labelled?: boolean
}

/** The coloured verdict pip next to a move. Several verdicts share a glyph (`✓` for both
 *  excellent and good), so the accessible name — not the character — carries the meaning. */
export function QualityGlyph({
  quality,
  size = 'default',
  labelled = true,
  className,
  ...props
}: QualityGlyphProps) {
  return (
    <span
      data-slot="quality-glyph"
      data-quality={quality}
      className={cn('q', `q-${quality}`, SIZES[size], className)}
      {...props}
    >
      <span aria-hidden="true">{GLYPH[quality]}</span>
      {labelled ? <span className="sr-only">{quality}</span> : null}
    </span>
  )
}
