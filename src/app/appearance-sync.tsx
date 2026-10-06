import { useEffect } from 'react'

import { useTheme } from '@/design'

/**
 * Applies the look saved in IndexedDB once, on launch.
 *
 * The theme provider boots from `localStorage` so the first paint never flashes; the
 * database is the durable copy, and it is the only one a restored backup or a new
 * device carries. This reconciles the two at startup and then gets out of the way —
 * after that the Settings screen writes both.
 *
 * The data layer is imported on demand: it brings Dexie and zod with it, and the first
 * download has a budget that the first paint does not need that for.
 */
export function AppearanceSync() {
  const { setTheme, setBoard, setPieceSet } = useTheme()

  useEffect(() => {
    let cancelled = false
    void import('@/data').then(async ({ settingsRepo }) => {
      const stored = await settingsRepo.peek()
      if (cancelled || stored === undefined) return
      setTheme(stored.theme)
      setBoard(stored.board.theme)
      setPieceSet(stored.board.pieceSet)
    })
    return () => {
      cancelled = true
    }
  }, [setTheme, setBoard, setPieceSet])

  return null
}
