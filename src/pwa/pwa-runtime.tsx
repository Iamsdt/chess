import { WifiOff } from 'lucide-react'
import { useEffect } from 'react'
import { toast } from 'sonner'

import { applyUpdate } from './register'
import { useInstallPrompt } from './use-install-prompt'
import { useOnline } from './use-online'
import { useUpdateState } from './use-update-state'

const UPDATE_TOAST = 'pwa-update'
const OFFLINE_READY_TOAST = 'pwa-offline-ready'
const INSTALL_TOAST = 'pwa-install'
const INSTALL_DISMISSED_KEY = 'ck-install-dismissed'

function installDismissed(): boolean {
  try {
    return localStorage.getItem(INSTALL_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

function rememberInstallDismissed(): void {
  try {
    localStorage.setItem(INSTALL_DISMISSED_KEY, '1')
  } catch {
    // Storage can be blocked; the prompt just asks again next visit.
  }
}

/**
 * Mounted once in the app root. Renders the offline pill and drives the three PWA toasts:
 * "ready offline" after the first install, "update ready" when a new version waits, and
 * the install offer.
 */
export function PwaRuntime() {
  const online = useOnline()
  const { phase } = useUpdateState()
  const { canInstall, install } = useInstallPrompt()

  useEffect(() => {
    if (phase === 'ready') {
      toast('A new version is ready', {
        id: UPDATE_TOAST,
        duration: Infinity,
        description: 'Reload to update. Games in progress are saved.',
        action: { label: 'Reload', onClick: applyUpdate },
      })
    } else {
      toast.dismiss(UPDATE_TOAST)
    }
    if (phase === 'offline-ready') {
      toast.success('Ready to work offline', { id: OFFLINE_READY_TOAST })
    }
  }, [phase])

  useEffect(() => {
    if (!canInstall || installDismissed()) return
    toast('Install Chess King', {
      id: INSTALL_TOAST,
      duration: 15_000,
      description: 'Opens in its own window and works offline.',
      action: {
        label: 'Install',
        onClick: () => {
          void install()
        },
      },
      onDismiss: rememberInstallDismissed,
    })
  }, [canInstall, install])

  if (online) return null
  return (
    <div
      role="status"
      className="pointer-events-none fixed top-3 left-1/2 z-50 inline-flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-popover px-3 py-1 text-xs text-popover-foreground shadow-sm"
    >
      <WifiOff aria-hidden className="size-3.5" />
      Offline: play, puzzles, lessons and analysis still work
    </div>
  )
}
