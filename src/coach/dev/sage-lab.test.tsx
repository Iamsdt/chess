import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { ThemeProvider } from '@/design'

import { SHOWCASE_PROMPTS } from '../showcase-prompts'

import { SageLab } from './sage-lab'
import { SAGE_FEATURES } from './sage-lab-features'

describe('Sage feature registry', () => {
  it('has 77 features numbered 1..77', () => {
    expect(SAGE_FEATURES).toHaveLength(77)
    expect(SAGE_FEATURES.map((f) => f.n)).toEqual(Array.from({ length: 77 }, (_, i) => i + 1))
  })

  it('gives every feature a valid prompt or a where hint', () => {
    for (const f of SAGE_FEATURES) {
      if (f.prompt !== undefined) expect(Object.keys(SHOWCASE_PROMPTS)).toContain(f.prompt)
      expect(f.prompt !== undefined || f.where !== undefined).toBe(true)
    }
  })
})

describe('SageLab', () => {
  it('sends the prompt into the panel when Try is clicked', async () => {
    render(
      <ThemeProvider>
        <SageLab />
      </ThemeProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Try What if' }))
    const chat = screen.getByRole('region', { name: 'Chat with Sage' })
    expect(await within(chat).findByText(SHOWCASE_PROMPTS.whatIf)).toBeInTheDocument()
  })
})
