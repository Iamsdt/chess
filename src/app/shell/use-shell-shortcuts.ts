import { useEffect, useRef } from 'react'

import { NAV_CHORDS } from '../navigation'

import type { ScreenId } from '../screens'

/** How long `g` waits for its second key before giving up, so a stray `g` cannot swallow
 *  the next keystroke for the rest of the session. */
export const CHORD_TIMEOUT_MS = 1500

export interface ShellShortcutOptions {
  /** `/` — open the Sage panel and put the caret in the composer. */
  onFocusChat: () => void
  /** `Escape` — dismiss whatever is floating over the page. */
  onEscape: () => void
  /** `⌘K` / `Ctrl+K` — the command palette. */
  onTogglePalette: () => void
  /** `g` then a letter — jump to a screen. */
  onNavigate: (screen: ScreenId) => void
}

/** True while the caret is somewhere the user is writing, where a bare letter is text
 *  rather than a command. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'
}

/** The global keyboard layer of the shell. Registered once on `document` and reading its
 *  handlers through a ref, so re-rendering the shell never drops a keystroke. */
export function useShellShortcuts(options: ShellShortcutOptions): void {
  const latest = useRef(options)
  useEffect(() => {
    latest.current = options
  })

  useEffect(() => {
    let chordArmed = false
    let chordTimer: number | undefined

    const disarm = () => {
      chordArmed = false
      if (chordTimer !== undefined) window.clearTimeout(chordTimer)
      chordTimer = undefined
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        latest.current.onTogglePalette()
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return

      if (event.key === 'Escape') {
        disarm()
        latest.current.onEscape()
        return
      }
      if (isTypingTarget(event.target)) return

      if (chordArmed) {
        const screen: ScreenId | undefined = NAV_CHORDS.get(event.key.toLowerCase())
        disarm()
        if (screen) {
          event.preventDefault()
          latest.current.onNavigate(screen)
        }
        return
      }

      if (event.key === 'g') {
        chordArmed = true
        chordTimer = window.setTimeout(disarm, CHORD_TIMEOUT_MS)
        return
      }

      if (event.key === '/') {
        event.preventDefault()
        latest.current.onFocusChat()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      disarm()
    }
  }, [])
}
