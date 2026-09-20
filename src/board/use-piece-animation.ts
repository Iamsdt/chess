import { useLayoutEffect, useRef } from 'react'

import type { AnimationSpeed, Color } from '@/domain'

import { diffPlacements, screenColumn, screenRow, type Placement } from './placement'

import type { RefObject } from 'react'

/** Milliseconds per setting. `off` and reduced motion both mean "no transition". */
export const ANIMATION_DURATIONS: Record<AnimationSpeed, number> = {
  off: 0,
  normal: 180,
  slow: 340,
}

export interface PieceAnimationOptions {
  boardRef: RefObject<HTMLDivElement | null>
  placement: Placement
  orientation: Color
  durationMs: number
}

/**
 * Slides the pieces that moved between two positions.
 *
 * Why FLIP written straight to the DOM instead of React state: the pieces are
 * already rendered on their new squares, so all that is left is to show them
 * starting from the old ones. Setting a transform and then releasing it keeps the
 * whole animation on the compositor — no re-render per frame, which is what the
 * 60 fps target on a mid-range phone actually costs.
 */
export function usePieceAnimation({
  boardRef,
  placement,
  orientation,
  durationMs,
}: PieceAnimationOptions): void {
  const previousRef = useRef<Placement | null>(null)

  useLayoutEffect(() => {
    const previous = previousRef.current
    previousRef.current = placement

    const board = boardRef.current
    if (!previous || !board || durationMs <= 0) return

    const squareSize = board.clientWidth / 8
    if (squareSize <= 0) return

    const moved: HTMLElement[] = []
    for (const slide of diffPlacements(previous, placement)) {
      const piece = board.querySelector(`[data-square="${slide.to}"] [data-piece]`)
      if (!(piece instanceof HTMLElement)) continue
      const dx =
        (screenColumn(slide.from, orientation) - screenColumn(slide.to, orientation)) * squareSize
      const dy =
        (screenRow(slide.from, orientation) - screenRow(slide.to, orientation)) * squareSize
      piece.style.transition = 'none'
      piece.style.transform = `translate3d(${String(dx)}px, ${String(dy)}px, 0)`
      moved.push(piece)
    }
    if (moved.length === 0) return

    // One frame later the browser has painted the old positions, so releasing the
    // transform now is a transition rather than an instant jump.
    const frame = requestAnimationFrame(() => {
      for (const piece of moved) {
        piece.style.transition = `transform ${String(durationMs)}ms ease-out`
        piece.style.transform = ''
      }
    })

    return () => {
      cancelAnimationFrame(frame)
      for (const piece of moved) {
        piece.style.transition = ''
        piece.style.transform = ''
      }
    }
  }, [boardRef, placement, orientation, durationMs])
}
