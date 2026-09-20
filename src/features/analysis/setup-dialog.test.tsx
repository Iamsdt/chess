import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { ThemeProvider } from '@/design'
import { START_FEN, toFen, type Fen } from '@/domain'

import { SetupDialog } from './setup-dialog'

/** Radix measures its own layers; jsdom has nothing to measure. */
beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {
      /* nothing is laid out in jsdom */
    }
    unobserve(): void {
      /* nothing is laid out in jsdom */
    }
    disconnect(): void {
      /* nothing is laid out in jsdom */
    }
  }
  globalThis.ResizeObserver = ResizeObserverStub
})

function open(initialFen: Fen = START_FEN) {
  const onLoad = vi.fn<(fen: Fen) => void>()
  render(
    <ThemeProvider>
      <SetupDialog open onOpenChange={vi.fn()} initialFen={initialFen} onLoad={onLoad} />
    </ThemeProvider>,
  )
  return { onLoad, user: userEvent.setup() }
}

const fenField = () => screen.getByLabelText('FEN')
const status = () => screen.getByRole('status')
const loadButton = () => screen.getByRole('button', { name: 'Load position' })

describe('<SetupDialog> validation', () => {
  it('opens on the position that is on the board', () => {
    open()
    expect(fenField()).toHaveValue(START_FEN)
    expect(status()).toHaveTextContent('Legal position')
    expect(loadButton()).toBeEnabled()
  })

  it('names the missing king and refuses to load', async () => {
    const { user } = open()
    await user.click(screen.getByRole('button', { name: 'Clear' }))

    expect(status()).toHaveTextContent('White needs a king.')
    expect(loadButton()).toBeDisabled()
    expect(fenField()).toHaveAttribute('aria-invalid', 'true')
  })

  it('becomes legal again once both kings are back on the board', async () => {
    const { user, onLoad } = open()
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    await user.click(screen.getByRole('radio', { name: 'White king' }))
    await user.click(screen.getByRole('button', { name: /^e1,/ }))
    await user.click(screen.getByRole('radio', { name: 'Black king' }))
    await user.click(screen.getByRole('button', { name: /^e8,/ }))

    expect(status()).toHaveTextContent('Legal position')
    await user.click(loadButton())
    expect(onLoad).toHaveBeenCalledWith('4k3/8/8/8/8/8/8/4K3 w - - 0 1')
  })

  it('erases a piece the palette put down', async () => {
    const { user } = open()
    await user.click(screen.getByRole('button', { name: 'Erase' }))
    await user.click(screen.getByRole('button', { name: /^d1, White queen$/ }))

    expect(screen.getByRole('button', { name: /^d1,/ })).toHaveAccessibleName('d1, empty')
    expect(fenField()).toHaveValue('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNB1KBNR w KQkq - 0 1')
  })

  it('refuses a castling right the rooks cannot support', async () => {
    const { user } = open(toFen('4k3/8/8/8/8/8/8/R3K3 w Q - 0 1'))
    expect(status()).toHaveTextContent('Legal position')

    await user.click(screen.getByRole('button', { name: 'Erase' }))
    await user.click(screen.getByRole('button', { name: /^a1,/ }))

    expect(status()).toHaveTextContent(
      'White cannot castle long without the king on e1 and a rook on a1.',
    )
    expect(loadButton()).toBeDisabled()
  })

  it('takes a FEN typed straight into the field', async () => {
    const { user } = open()
    await user.clear(fenField())
    await user.type(fenField(), '4k3/8/8/8/8/8/8/4K3 w - - 0 1')

    expect(status()).toHaveTextContent('Legal position')
    expect(screen.getByRole('button', { name: /^e1,/ })).toHaveAccessibleName('e1, White king')
  })

  it('says so when the FEN in the field is not a position', async () => {
    const { user } = open()
    await user.clear(fenField())
    await user.type(fenField(), 'nonsense')
    expect(loadButton()).toBeDisabled()
  })
})
