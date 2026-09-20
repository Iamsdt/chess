import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CoachGallery } from './coach-gallery'

/**
 * The sprint's merge gate is "every prototype chat state renders from the mock".
 * This is that check, in one assertion per state, so a state that silently stops
 * rendering fails the suite rather than the reviewer's eyes.
 */
describe('CoachGallery', () => {
  const STATES = [
    'Seeded thread · home',
    'No spoilers · puzzle',
    'Game review',
    'Lists · learn',
    'Quiet during play · note banner',
    'Empty · no seed',
    'No key',
    'Loading context',
    'Error · ask anything to see retry',
    'Long thread · virtualized',
  ]

  it('renders every chat state at once', () => {
    render(<CoachGallery />)
    for (const state of STATES) {
      expect(screen.getByRole('heading', { name: state })).toBeInTheDocument()
    }
    expect(screen.getAllByRole('region', { name: 'Chat with Sage' })).toHaveLength(9)
  })
})
