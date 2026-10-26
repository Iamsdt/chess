import { describe, expect, it } from 'vitest'

import { COACH_PROVIDERS, CoachProviderSchema } from './enums'
import { CoachSettingsSchema, SettingsSchema } from './profile'

describe('coach settings after the provider list grew (S21)', () => {
  it('parses settings written before baseUrl and the new providers existed', () => {
    const old = {
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
      tone: 'blunt',
      spoilerGuard: false,
      allowEngineLines: true,
      monthlyTokenCap: 250_000,
      hasKey: true,
      passphraseLock: false,
    }
    const parsed = CoachSettingsSchema.parse(old)
    expect(parsed).toEqual(old)
    expect(parsed.baseUrl).toBeUndefined()
  })

  it('still fills every default from an empty object, on the original provider', () => {
    const parsed = CoachSettingsSchema.parse({})
    expect(parsed.provider).toBe('gemini')
    expect(parsed.model).toBe('gemini-2.5-flash')
    expect(parsed.hasKey).toBe(false)
  })

  it('parses a whole old settings row', () => {
    const parsed = SettingsSchema.parse({
      board: {},
      sound: {},
      coach: { provider: 'openai', model: 'gpt-4.1-mini' },
      play: {},
      updatedAt: 1,
    })
    expect(parsed.coach.model).toBe('gpt-4.1-mini')
  })

  it('accepts every provider id, any model string and a valid base URL only', () => {
    for (const provider of COACH_PROVIDERS)
      expect(CoachProviderSchema.safeParse(provider).success).toBe(true)
    expect(CoachProviderSchema.safeParse('nope').success).toBe(false)
    expect(
      CoachSettingsSchema.safeParse({
        provider: 'custom',
        model: 'org/any-model:7b',
        baseUrl: 'http://localhost:8080/v1',
      }).success,
    ).toBe(true)
    expect(CoachSettingsSchema.safeParse({ baseUrl: 'not a url' }).success).toBe(false)
  })
})
