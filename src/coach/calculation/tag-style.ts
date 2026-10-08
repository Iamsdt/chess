import type { CalcTag } from '@/domain'

/**
 * One colour language for the tree, all from design tokens (a test fails on raw hex).
 * The chip is tinted, not filled, so the SAN stays readable in light and dark.
 */
export const TAG_STYLE: Readonly<
  Record<CalcTag, { readonly label: string; readonly chip: string; readonly dot: string }>
> = {
  best: { label: 'Best', chip: 'border-success/60 bg-success/10', dot: 'bg-success' },
  good: { label: 'Good', chip: 'border-primary/50 bg-primary/10', dot: 'bg-primary' },
  tempting: { label: 'Tempting', chip: 'border-reward/70 bg-reward/15', dot: 'bg-reward' },
  mistake: { label: 'Mistake', chip: 'border-cta/60 bg-cta/10', dot: 'bg-cta' },
  blunder: {
    label: 'Blunder',
    chip: 'border-destructive/60 bg-destructive/10',
    dot: 'bg-destructive',
  },
  'only-move': { label: 'Only move', chip: 'border-sky/60 bg-sky/20', dot: 'bg-sky-ink' },
  forced: { label: 'Forced', chip: 'border-border bg-muted', dot: 'bg-muted-foreground' },
}
