import { useCallback, useSyncExternalStore } from 'react'

/**
 * The install prompt. Chromium fires `beforeinstallprompt` and lets the page hold it until
 * a good moment; iOS Safari never fires it, so there the best we can do is say how to
 * "Add to Home Screen" (see docs/pwa.md).
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()
let snapshot = { canInstall: false }

function publish(): void {
  snapshot = { canInstall: deferred !== null && !installed }
  for (const listener of listeners) listener()
}

/** Call once at startup; the event can fire before any component has mounted. */
export function captureInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferred = event as BeforeInstallPromptEvent
    publish()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    deferred = null
    publish()
  })
}

export function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches
}

/** iPadOS reports itself as a Mac, so touch support is the tell. */
export function isIos(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1)
  )
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export interface InstallPrompt {
  readonly canInstall: boolean
  /** iOS Safari, not yet installed: show the manual instructions instead of a button. */
  readonly showIosHint: boolean
  readonly install: () => Promise<boolean>
}

export function useInstallPrompt(): InstallPrompt {
  const { canInstall } = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  )
  const install = useCallback(async (): Promise<boolean> => {
    const event = deferred
    if (event === null) return false
    await event.prompt()
    const choice = await event.userChoice
    deferred = null
    publish()
    return choice.outcome === 'accepted'
  }, [])
  return { canInstall, showIosHint: isIos() && !isStandalone(), install }
}
