import { PROVIDER_LIST, PROVIDER_PRESETS } from '@/coach'
import type { CoachProvider } from '@/domain'

/**
 * Why derived: Settings and first-run setup offer the same providers and must agree on which
 * model names belong to which one. The registry in `@/coach` is the single source of truth;
 * these are only the shapes the two screens already consume.
 */
export const PROVIDER_OPTIONS: readonly { readonly id: CoachProvider; readonly label: string }[] =
  PROVIDER_LIST.map(({ id, label }) => ({ id, label }))

export const MODEL_OPTIONS: Record<
  CoachProvider,
  readonly { readonly id: string; readonly label: string }[]
> = Object.fromEntries(
  PROVIDER_LIST.map((preset) => [preset.id, PROVIDER_PRESETS[preset.id].models]),
) as Record<CoachProvider, readonly { readonly id: string; readonly label: string }[]>
