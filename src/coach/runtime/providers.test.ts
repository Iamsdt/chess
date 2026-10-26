import { describe, expect, it } from 'vitest'

import { COACH_PROVIDERS } from '@/domain'

import {
  defaultModelFor,
  effectiveBaseUrl,
  isConfigured,
  normalizeBaseUrl,
  PROVIDER_LIST,
  PROVIDER_PRESETS,
} from './providers'

describe('provider registry', () => {
  it('has exactly one preset per provider id, in enum order', () => {
    expect(PROVIDER_LIST.map((p) => p.id)).toEqual([...COACH_PROVIDERS])
    for (const id of COACH_PROVIDERS) expect(PROVIDER_PRESETS[id].id).toBe(id)
  })

  it.each(PROVIDER_LIST.map((p) => [p.id, p] as const))('%s is fully described', (_id, preset) => {
    expect(preset.label.length).toBeGreaterThan(0)
    expect(['openai', 'anthropic', 'google', 'openai-compatible']).toContain(preset.kind)
    expect(Array.isArray(preset.models)).toBe(true)
    // Only a preset the user fills in may have no endpoint of its own.
    if (preset.id !== 'custom') expect(preset.baseUrl).toMatch(/^https?:\/\//)
    expect(preset.baseUrl.endsWith('/')).toBe(false)
    // Hosted providers say where to get a key; local ones never ask for one.
    if (preset.keyPolicy === 'required') expect(preset.keyUrl).toMatch(/^https:\/\//)
    for (const model of preset.models) expect(model.id.length).toBeGreaterThan(0)
  })

  it('keeps the original three first so stored defaults stay valid', () => {
    expect(COACH_PROVIDERS.slice(0, 3)).toEqual(['gemini', 'openai', 'anthropic'])
    expect(defaultModelFor('gemini')).toBe('gemini-2.5-flash')
  })

  it('needs no key for local servers and warns about CORS there', () => {
    expect(PROVIDER_PRESETS.ollama.keyPolicy).toBe('none')
    expect(PROVIDER_PRESETS.lmstudio.keyPolicy).toBe('none')
    expect(PROVIDER_PRESETS.custom.keyPolicy).toBe('optional')
    expect(PROVIDER_PRESETS.ollama.corsNote).toContain('OLLAMA_ORIGINS')
    expect(PROVIDER_PRESETS.lmstudio.models).toEqual([])
  })

  it('prefers the user override and trims trailing slashes', () => {
    expect(normalizeBaseUrl(' http://x.test/v1// ')).toBe('http://x.test/v1')
    expect(effectiveBaseUrl('ollama', 'http://localhost:9999/v1/')).toBe('http://localhost:9999/v1')
    expect(effectiveBaseUrl('ollama', undefined)).toBe('http://localhost:11434/v1')
    expect(effectiveBaseUrl('custom', undefined)).toBe('')
  })

  it('only demands a key where the preset does', () => {
    const base = { model: 'm', hasKey: false }
    expect(isConfigured({ ...base, provider: 'openai' })).toBe(false)
    expect(isConfigured({ ...base, provider: 'openai', hasKey: true })).toBe(true)
    expect(isConfigured({ ...base, provider: 'ollama' })).toBe(true)
    expect(isConfigured({ ...base, provider: 'custom' })).toBe(false)
    expect(isConfigured({ ...base, provider: 'custom', baseUrl: 'http://x.test/v1' })).toBe(true)
    expect(isConfigured({ ...base, provider: 'ollama', model: ' ' })).toBe(false)
  })
})
