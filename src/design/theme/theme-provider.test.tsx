import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ThemeToggle } from '@/design/components/theme-toggle'

import { ThemeProvider } from './theme-provider'
import { STORAGE_KEYS } from './types'
import { useTheme } from './use-theme'

type MediaListener = (event: MediaQueryListEvent) => void

let listeners: MediaListener[] = []
let systemDark = false

function installMatchMedia() {
  vi.stubGlobal(
    'matchMedia',
    (query: string): MediaQueryList =>
      ({
        media: query,
        matches: systemDark,
        onchange: null,
        addEventListener: (_: string, listener: MediaListener) => listeners.push(listener),
        removeEventListener: (_: string, listener: MediaListener) => {
          listeners = listeners.filter((item) => item !== listener)
        },
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  )
}

function Probe() {
  const { theme, resolvedTheme, board, pieceSet, setBoard, setPieceSet } = useTheme()
  return (
    <div>
      <output data-testid="state">{`${theme}/${resolvedTheme}/${board}/${pieceSet}`}</output>
      <button
        type="button"
        onClick={() => {
          setBoard('walnut')
        }}
      >
        walnut
      </button>
      <button
        type="button"
        onClick={() => {
          setPieceSet('staunty')
        }}
      >
        staunty
      </button>
    </div>
  )
}

function renderProvider() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
      <Probe />
    </ThemeProvider>,
  )
}

beforeEach(() => {
  listeners = []
  systemDark = false
  localStorage.clear()
  document.documentElement.className = ''
  document.documentElement.removeAttribute('data-board')
  installMatchMedia()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ThemeProvider', () => {
  it('defaults to system and follows prefers-color-scheme', () => {
    renderProvider()
    expect(screen.getByTestId('state')).toHaveTextContent('system/light/grove/california')

    act(() => {
      for (const listener of listeners) listener({ matches: true } as MediaQueryListEvent)
    })
    expect(screen.getByTestId('state')).toHaveTextContent('system/dark')
    expect(document.documentElement).toHaveClass('dark')
  })

  it('writes only dark or light to ck-theme so the boot script still works', async () => {
    renderProvider()
    await userEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }))

    expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe('dark')
    expect(document.documentElement).toHaveClass('dark')

    await userEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }))
    expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe('light')
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('restores a persisted dark theme', () => {
    localStorage.setItem(STORAGE_KEYS.theme, 'dark')
    renderProvider()
    expect(screen.getByTestId('state')).toHaveTextContent('dark/dark')
  })

  it('persists the board under ck-board and mirrors it onto the html element', async () => {
    renderProvider()
    expect(document.documentElement).not.toHaveAttribute('data-board')

    await userEvent.click(screen.getByRole('button', { name: 'walnut' }))
    expect(localStorage.getItem(STORAGE_KEYS.board)).toBe('walnut')
    expect(document.documentElement).toHaveAttribute('data-board', 'walnut')
  })

  it('persists the piece set under ck-set for S08', async () => {
    renderProvider()
    await userEvent.click(screen.getByRole('button', { name: 'staunty' }))
    expect(localStorage.getItem(STORAGE_KEYS.pieceSet)).toBe('staunty')
    expect(screen.getByTestId('state')).toHaveTextContent('staunty')
  })

  it('ignores an unknown stored board instead of applying it', () => {
    localStorage.setItem(STORAGE_KEYS.board, 'not-a-board')
    renderProvider()
    expect(screen.getByTestId('state')).toHaveTextContent('grove')
    expect(document.documentElement).not.toHaveAttribute('data-board')
  })

  it('still renders when storage throws', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })

    expect(() => {
      renderProvider()
    }).not.toThrow()
    expect(screen.getByTestId('state')).toHaveTextContent('system/light/grove/california')

    getItem.mockRestore()
    setItem.mockRestore()
  })
})

describe('useTheme', () => {
  it('fails loudly outside a provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => render(<Probe />)).toThrow(/useTheme must be used inside/)
    consoleError.mockRestore()
  })
})
