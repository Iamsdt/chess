import { describe, expect, it } from 'vitest'

import { SHOWCASE_PROMPTS } from './showcase-prompts'
import { SHOWCASE_SCRIPT } from './showcase-script'

describe('SHOWCASE_SCRIPT', () => {
  it.each(Object.entries(SHOWCASE_PROMPTS))(
    'has a reply for %s that matches its prompt',
    (_key, prompt) => {
      const matches = SHOWCASE_SCRIPT.filter((reply) => reply.match?.test(prompt) === true)
      expect(matches).toHaveLength(1)
      expect(matches[0]?.mode).toBeDefined()
    },
  )

  it('does not match other prompts', () => {
    expect(SHOWCASE_SCRIPT.some((r) => r.match?.test('Give me a hint please'))).toBe(false)
  })

  it('never gives the move away in the hint text', () => {
    const hint = SHOWCASE_SCRIPT.find((r) => r.match?.test(SHOWCASE_PROMPTS.hint))
    expect(hint?.spoilerFreeText).toBeDefined()
    expect(hint?.text).not.toMatch(/\b[KQRBN]?[a-h][1-8]\b/)
  })
})
