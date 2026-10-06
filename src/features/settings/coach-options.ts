import type { CoachProvider } from '@/domain'

/** Why shared: Settings and first-run setup offer the same providers and must agree on
 *  which model names belong to which one. */
export const PROVIDER_OPTIONS: readonly { readonly id: CoachProvider; readonly label: string }[] = [
  { id: 'gemini', label: 'Google Gemini' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic' },
]

export const MODEL_OPTIONS: Record<
  CoachProvider,
  readonly { readonly id: string; readonly label: string }[]
> = {
  gemini: [
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash · fast, cheap' },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro · deeper reviews' },
  ],
  openai: [
    { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini · fast, cheap' },
    { id: 'gpt-4.1', label: 'GPT-4.1 · deeper reviews' },
  ],
  anthropic: [
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 · fast, cheap' },
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 · deeper reviews' },
  ],
}
