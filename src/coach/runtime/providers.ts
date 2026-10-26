import type { CoachProvider } from '@/domain'

/**
 * S21 · The provider registry — the one table that says what each preset is.
 *
 * Why a table and not a switch per call site: "any model works" means the model factory,
 * the model lister, the connection test, the error mapper and the Settings panel all need to
 * agree on the same facts (where does this provider live, does it need a key, what does a
 * browser trip over). Keeping those facts in one place means adding a provider is one row,
 * and Settings cannot offer a preset the runtime cannot reach.
 *
 * This file is pure data: no SDK import, so Settings and onboarding can read it without
 * pulling the AI SDK into the initial bundle.
 */

/**
 * Which SDK package speaks to the provider.
 *
 * Why only four: `openai-compatible` covers everything that implements the chat-completions
 * wire format, which is nearly every host and every local server. The three vendor kinds exist
 * only where the vendor's own protocol is richer or different (Anthropic, Gemini) or where we
 * want the vendor's own defaults (OpenAI).
 */
export type ProviderSdkKind = 'openai' | 'anthropic' | 'google' | 'openai-compatible'

export interface SuggestedModel {
  readonly id: string
  readonly label: string
}

export interface ProviderPreset {
  readonly id: CoachProvider
  readonly label: string
  readonly kind: ProviderSdkKind
  /** Empty only for `custom`, where the user supplies it. No trailing slash. */
  readonly baseUrl: string
  /** `required`: refuse to connect without one; `optional`: send one only if given; `none`: never. */
  readonly keyPolicy: 'required' | 'optional' | 'none'
  /** Shape hint shown in the empty key field, never a real key. */
  readonly keyPlaceholder: string
  /** Where the user creates a key. Empty for local servers. */
  readonly keyUrl: string
  /** Current, reasonable defaults. Empty is explicit: LM Studio serves whatever is loaded. */
  readonly models: readonly SuggestedModel[]
  /** Shown beside the endpoint when a browser may be blocked from reaching it. */
  readonly corsNote?: string
  /** Whether `GET /models` works from a browser for this provider. */
  readonly supportsModelListing: boolean
  /** Whether the Base URL field is part of normal setup (otherwise it is an override). */
  readonly baseUrlEditable: 'primary' | 'override'
}

export const PROVIDER_PRESETS: Readonly<Record<CoachProvider, ProviderPreset>> = {
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    kind: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    keyPolicy: 'required',
    keyPlaceholder: 'AIza…',
    keyUrl: 'https://aistudio.google.com/apikey',
    models: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash · fast, cheap' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro · deeper reviews' },
    ],
    supportsModelListing: true,
    baseUrlEditable: 'override',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    kind: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    keyPolicy: 'required',
    keyPlaceholder: 'sk-…',
    keyUrl: 'https://platform.openai.com/api-keys',
    models: [
      { id: 'gpt-5-mini', label: 'GPT-5 mini · fast, cheap' },
      { id: 'gpt-5', label: 'GPT-5 · deeper reviews' },
    ],
    supportsModelListing: true,
    baseUrlEditable: 'override',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    kind: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    keyPolicy: 'required',
    keyPlaceholder: 'sk-ant-…',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    models: [
      { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 · fast, cheap' },
      { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 · deeper reviews' },
      { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 · deepest' },
    ],
    supportsModelListing: true,
    baseUrlEditable: 'override',
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    kind: 'openai-compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyPolicy: 'required',
    keyPlaceholder: 'sk-or-…',
    keyUrl: 'https://openrouter.ai/keys',
    models: [
      { id: 'openai/gpt-5-mini', label: 'OpenAI GPT-5 mini' },
      { id: 'anthropic/claude-sonnet-5-5', label: 'Anthropic Claude Sonnet 5.5' },
      { id: 'google/gemini-2.5-flash', label: 'Google Gemini 2.5 Flash' },
      { id: 'deepseek/deepseek-chat', label: 'DeepSeek Chat' },
      { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B Instruct' },
    ],
    supportsModelListing: true,
    baseUrlEditable: 'override',
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    kind: 'openai-compatible',
    baseUrl: 'https://api.groq.com/openai/v1',
    keyPolicy: 'required',
    keyPlaceholder: 'gsk_…',
    keyUrl: 'https://console.groq.com/keys',
    models: [{ id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B · very fast' }],
    supportsModelListing: true,
    baseUrlEditable: 'override',
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    kind: 'openai-compatible',
    baseUrl: 'https://api.deepseek.com/v1',
    keyPolicy: 'required',
    keyPlaceholder: 'sk-…',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    models: [{ id: 'deepseek-chat', label: 'DeepSeek Chat · cheap' }],
    supportsModelListing: true,
    baseUrlEditable: 'override',
  },
  mistral: {
    id: 'mistral',
    label: 'Mistral',
    kind: 'openai-compatible',
    baseUrl: 'https://api.mistral.ai/v1',
    keyPolicy: 'required',
    keyPlaceholder: 'Mistral API key',
    keyUrl: 'https://console.mistral.ai/api-keys',
    models: [{ id: 'mistral-small-latest', label: 'Mistral Small · fast, cheap' }],
    supportsModelListing: true,
    baseUrlEditable: 'override',
  },
  xai: {
    id: 'xai',
    label: 'xAI (Grok)',
    kind: 'openai-compatible',
    baseUrl: 'https://api.x.ai/v1',
    keyPolicy: 'required',
    keyPlaceholder: 'xai-…',
    keyUrl: 'https://console.x.ai',
    models: [{ id: 'grok-4', label: 'Grok 4' }],
    supportsModelListing: true,
    baseUrlEditable: 'override',
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama (local)',
    kind: 'openai-compatible',
    baseUrl: 'http://localhost:11434/v1',
    keyPolicy: 'none',
    keyPlaceholder: 'No key needed',
    keyUrl: '',
    models: [
      { id: 'llama3.2', label: 'Llama 3.2' },
      { id: 'qwen3', label: 'Qwen 3' },
    ],
    corsNote:
      'A browser can only reach Ollama if it allows this site. Start it with OLLAMA_ORIGINS set to this page’s origin (or "*" for local testing), then restart Ollama.',
    supportsModelListing: true,
    baseUrlEditable: 'primary',
  },
  lmstudio: {
    id: 'lmstudio',
    label: 'LM Studio (local)',
    kind: 'openai-compatible',
    baseUrl: 'http://localhost:1234/v1',
    keyPolicy: 'none',
    keyPlaceholder: 'No key needed',
    keyUrl: '',
    models: [],
    corsNote:
      'Turn on "Enable CORS" in LM Studio’s local server settings, start the server, and load a model. Use the model name LM Studio shows.',
    supportsModelListing: true,
    baseUrlEditable: 'primary',
  },
  custom: {
    id: 'custom',
    label: 'Custom (OpenAI-compatible)',
    kind: 'openai-compatible',
    baseUrl: '',
    keyPolicy: 'optional',
    keyPlaceholder: 'Key, if the server wants one',
    keyUrl: '',
    models: [],
    corsNote:
      'The server must allow cross-origin requests from this page, or the browser will block the call.',
    supportsModelListing: true,
    baseUrlEditable: 'primary',
  },
}

/** Presets in the order Settings lists them. */
export const PROVIDER_LIST: readonly ProviderPreset[] = Object.values(PROVIDER_PRESETS)

export function providerPreset(id: CoachProvider): ProviderPreset {
  return PROVIDER_PRESETS[id]
}

export function providerLabel(id: CoachProvider): string {
  return PROVIDER_PRESETS[id].label
}

/** Why trimmed here: a pasted URL with a trailing slash would double up when `/models` is appended. */
export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

/** The endpoint a request goes to: the user's override, else the preset's. */
export function effectiveBaseUrl(provider: CoachProvider, override: string | undefined): string {
  const trimmed = override === undefined ? '' : normalizeBaseUrl(override)
  return trimmed === '' ? PROVIDER_PRESETS[provider].baseUrl : trimmed
}

/** The model a provider starts on when the user switches to it. */
export function defaultModelFor(id: CoachProvider): string | undefined {
  return PROVIDER_PRESETS[id].models[0]?.id
}

/**
 * Whether a connection can be attempted at all, given what is configured.
 * A key is only demanded where the preset demands one.
 */
export function isConfigured(config: {
  readonly provider: CoachProvider
  readonly model: string
  readonly baseUrl?: string | undefined
  readonly hasKey: boolean
}): boolean {
  const preset = PROVIDER_PRESETS[config.provider]
  if (config.model.trim() === '') return false
  if (effectiveBaseUrl(config.provider, config.baseUrl) === '') return false
  return preset.keyPolicy === 'required' ? config.hasKey : true
}
