import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'

import { cn } from '@/design'
import { emptyBoardShapes } from '@/domain'
import type { PromotionPiece, Square } from '@/domain'

import {
  describeMove,
  describePosition,
  describePremove,
  describeRejection,
  describeSelection,
} from './announce'
import { BoardArrows } from './arrows'
import { BoardSquare } from './board-square'
import './board.css'
import {
  DEFAULT_SQUARE,
  fileIndexOf,
  FILES,
  findSquare,
  isLightSquare,
  orderedSquares,
  parsePlacement,
  pieceColorOf,
  rankIndexOf,
  screenRow,
  sideToMove,
  squareFromScreen,
  stepSquare,
} from './placement'
import { PromotionPicker } from './promotion-picker'
import { ANIMATION_DURATIONS, usePieceAnimation } from './use-piece-animation'
import { useReducedMotion } from './use-reduced-motion'

import type { BoardFlashTone, BoardHandle, BoardMove, BoardProps } from './types'
import type {
  FocusEvent as ReactFocusEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'

/** Read-only and never handed out; the board only ever reads these arrays. */
const NO_SHAPES = emptyBoardShapes()
const NO_SQUARES: readonly Square[] = []

/** Long enough to register, short enough not to delay the next move. */
const FLASH_MS = 520
const SHAKE_MS = 320

/** Pointer travel, in CSS pixels, that turns a press into a drag. */
const DRAG_THRESHOLD = 4

const PROMOTION_PROMPT = 'Choose a promotion piece.'

interface PendingPromotion {
  from: Square
  to: Square
  /** A promotion chosen ahead of the user's turn is stored, not played. */
  premove: boolean
}

interface DragState {
  from: Square
  pointerId: number
  piece: HTMLElement
  originX: number
  originY: number
  moved: boolean
}

/**
 * The one board every screen uses.
 *
 * It is deliberately **presentational**: it knows squares, pieces and pixels, and
 * no chess rules at all. Legality arrives as the `legalMoves` prop, check as
 * `shapes.check`, and whether a move promotes as the `isPromotion` callback — all
 * computed by the screen that owns the game with `@/chess`. "Rejecting an illegal
 * move" therefore means exactly one thing here: the move was not in `legalMoves`.
 *
 * That split is what lets a puzzle, a lesson, an opening drill and a live game
 * share one board without any of them inheriting another's rules.
 */
export function Board({
  fen,
  orientation = 'white',
  movable = 'none',
  legalMoves,
  isPromotion,
  onMove,
  shapes = NO_SHAPES,
  coordinates = true,
  animationSpeed = 'normal',
  pieceSet = 'california',
  boardTheme,
  premove = false,
  onPremove,
  label = 'Chess board',
  announcement,
  className,
  id,
  ref,
}: BoardProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const effectTimer = useRef<number | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const arrowIdPrefix = useId()

  const [selected, setSelected] = useState<Square | null>(null)
  const [cursor, setCursor] = useState<Square>(
    () => squareFromScreen(0, 7, orientation) ?? DEFAULT_SQUARE,
  )
  const [dragFrom, setDragFrom] = useState<Square | null>(null)
  const [dragOver, setDragOver] = useState<Square | null>(null)
  const [pending, setPending] = useState<PendingPromotion | null>(null)
  const [storedPremove, setStoredPremove] = useState<BoardMove | null>(null)
  const liveRef = useRef<HTMLDivElement>(null)
  const liveToggle = useRef(false)

  const cursorRef = useRef<Square>(cursor)
  useEffect(() => {
    cursorRef.current = cursor
  }, [cursor])

  /* The caller has moved on: the selection and the premove belonged to a position
     that no longer exists. Adjusting during render rather than in an effect keeps
     the board from painting one frame of stale state; the premove has already
     been handed over through `onPremove`, so dropping it here loses nothing. */
  const [renderedFen, setRenderedFen] = useState(fen)
  if (renderedFen !== fen) {
    setRenderedFen(fen)
    setSelected(null)
    setDragOver(null)
    setStoredPremove(null)
  }

  const placement = useMemo(() => parsePlacement(fen), [fen])
  const turn = useMemo(() => sideToMove(fen), [fen])
  const squares = useMemo(() => orderedSquares(orientation), [orientation])
  const rows = useMemo(
    () => Array.from({ length: 8 }, (_, row) => squares.slice(row * 8, row * 8 + 8)),
    [squares],
  )

  const interactive = movable !== 'none'
  const premoveMode = premove && (movable === 'white' || movable === 'black') && turn !== movable

  const reducedMotion = useReducedMotion()
  const durationMs = reducedMotion ? 0 : ANIMATION_DURATIONS[animationSpeed]
  usePieceAnimation({ boardRef: rootRef, placement, orientation, durationMs })

  const highlightSet = useMemo(() => new Set<Square>(shapes.highlight), [shapes.highlight])
  const focusSet = useMemo(() => new Set<Square>(shapes.focus), [shapes.focus])
  const markMap = useMemo(
    () => new Map(shapes.marks.map((mark) => [mark.square, mark.quality])),
    [shapes.marks],
  )

  const destinations = useMemo<readonly Square[]>(() => {
    if (selected === null || legalMoves === undefined || legalMoves === 'any') return NO_SQUARES
    return legalMoves.get(selected) ?? NO_SQUARES
  }, [selected, legalMoves])
  const destinationSet = useMemo(() => new Set<Square>(destinations), [destinations])

  /* ---- announcements ------------------------------------------------- */

  /**
   * Writes to the live region directly rather than through state.
   *
   * The accessibility tree is an external system: what matters is that the text
   * *changes*, because that is what makes a screen reader speak. A live region
   * stays silent when handed the same string twice, and the same verdict twice in
   * a row is exactly when the user most needs to hear it again — hence the
   * alternating trailing space, which no screen reader reads out.
   */
  const announce = useCallback((text: string) => {
    const region = liveRef.current
    if (region === null) return
    liveToggle.current = !liveToggle.current
    region.textContent = liveToggle.current ? text : `${text}\u00a0`
  }, [])

  const check = shapes.check
  useEffect(() => {
    const text = describePosition(check)
    if (text !== null) announce(text)
  }, [check, announce])

  useEffect(() => {
    if (announcement !== undefined && announcement !== '') announce(announcement)
  }, [announcement, announce])

  /* ---- imperative feedback -------------------------------------------- */

  const runEffect = useCallback((value: string, ms: number) => {
    const root = rootRef.current
    if (root === null) return
    if (effectTimer.current !== null) window.clearTimeout(effectTimer.current)
    delete root.dataset.effect
    // Forces a style recalculation, so asking for the same effect twice replays it
    // instead of the browser deciding nothing changed.
    root.getBoundingClientRect()
    root.dataset.effect = value
    effectTimer.current = window.setTimeout(() => {
      delete root.dataset.effect
      effectTimer.current = null
    }, ms)
  }, [])

  useEffect(
    () => () => {
      if (effectTimer.current !== null) window.clearTimeout(effectTimer.current)
    },
    [],
  )

  const flash = useCallback(
    (tone: BoardFlashTone = 'success') => {
      runEffect(`flash-${tone}`, FLASH_MS)
    },
    [runEffect],
  )

  const shake = useCallback(() => {
    runEffect('shake', SHAKE_MS)
  }, [runEffect])

  const focusSquare = useCallback((square: Square) => {
    setCursor(square)
    const cell = gridRef.current?.querySelector(`[data-square="${square}"]`)
    if (cell instanceof HTMLElement) cell.focus()
  }, [])

  const clearSelection = useCallback(() => {
    setSelected(null)
    setDragOver(null)
    setPending(null)
    setStoredPremove(null)
  }, [])

  useImperativeHandle(
    ref,
    (): BoardHandle => ({
      flash,
      shake,
      clearSelection,
      focus: () => {
        focusSquare(cursorRef.current)
      },
    }),
    [flash, shake, clearSelection, focusSquare],
  )

  /* ---- move logic ------------------------------------------------------ */

  const canPickUp = useCallback(
    (square: Square): boolean => {
      const code = placement.get(square)
      if (code === undefined || movable === 'none') return false
      return movable === 'both' || pieceColorOf(code) === movable
    },
    [placement, movable],
  )

  const isLegal = useCallback(
    (from: Square, to: Square): boolean => {
      if (legalMoves === 'any') return true
      if (legalMoves === undefined) return false
      return (legalMoves.get(from) ?? NO_SQUARES).includes(to)
    },
    [legalMoves],
  )

  const selectSquare = useCallback(
    (square: Square) => {
      const code = placement.get(square)
      if (code === undefined || !canPickUp(square)) return
      const count =
        premoveMode || legalMoves === 'any' ? null : (legalMoves?.get(square) ?? NO_SQUARES).length
      setSelected(square)
      announce(describeSelection(square, code, count))
    },
    [placement, canPickUp, premoveMode, legalMoves, announce],
  )

  const storePremove = useCallback(
    (move: BoardMove) => {
      setStoredPremove(move)
      setSelected(null)
      setDragOver(null)
      announce(describePremove(move, placement))
      onPremove?.(move)
    },
    [announce, placement, onPremove],
  )

  const commitMove = useCallback(
    (move: BoardMove) => {
      announce(describeMove(move, placement))
      setSelected(null)
      setDragOver(null)
      onMove?.(move)
    },
    [announce, placement, onMove],
  )

  const attemptMove = useCallback(
    (from: Square, to: Square) => {
      if (from === to) {
        setSelected(null)
        return
      }
      const promoting = isPromotion?.(from, to) ?? false

      if (premoveMode) {
        if (promoting) {
          setPending({ from, to, premove: true })
          announce(PROMOTION_PROMPT)
          return
        }
        storePremove({ from, to })
        return
      }

      if (!isLegal(from, to)) {
        announce(describeRejection(from, to))
        shake()
        setSelected(null)
        setDragOver(null)
        return
      }

      if (promoting) {
        setPending({ from, to, premove: false })
        announce(PROMOTION_PROMPT)
        return
      }

      commitMove({ from, to })
    },
    [isPromotion, premoveMode, storePremove, isLegal, announce, shake, commitMove],
  )

  const activateSquare = useCallback(
    (square: Square) => {
      if (!interactive || pending !== null) return
      if (selected === null) {
        selectSquare(square)
        return
      }
      if (selected === square) {
        setSelected(null)
        announce(`Deselected ${square}.`)
        return
      }
      if (!destinationSet.has(square) && canPickUp(square)) {
        selectSquare(square)
        return
      }
      attemptMove(selected, square)
    },
    [
      interactive,
      pending,
      selected,
      selectSquare,
      destinationSet,
      canPickUp,
      attemptMove,
      announce,
    ],
  )

  const resolvePromotion = useCallback(
    (piece: PromotionPiece) => {
      if (pending === null) return
      const move: BoardMove = { from: pending.from, to: pending.to, promotion: piece }
      setPending(null)
      focusSquare(pending.to)
      if (pending.premove) storePremove(move)
      else commitMove(move)
    },
    [pending, focusSquare, storePremove, commitMove],
  )

  const cancelPromotion = useCallback(() => {
    if (pending === null) return
    setPending(null)
    setSelected(null)
    announce('Promotion cancelled.')
    focusSquare(pending.from)
  }, [pending, announce, focusSquare])

  const cancelPremove = useCallback(() => {
    if (storedPremove === null) return
    setStoredPremove(null)
    announce('Premove cancelled.')
    onPremove?.(null)
  }, [storedPremove, announce, onPremove])

  /* ---- pointer ---------------------------------------------------------- */

  const squareFromPoint = useCallback(
    (clientX: number, clientY: number): Square | null => {
      const grid = gridRef.current
      if (grid === null) return null
      const rect = grid.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return null
      return squareFromScreen(
        Math.floor(((clientX - rect.left) / rect.width) * 8),
        Math.floor(((clientY - rect.top) / rect.height) * 8),
        orientation,
      )
    },
    [orientation],
  )

  const squareOfTarget = (target: EventTarget | null): Square | null => {
    if (!(target instanceof Element)) return null
    return findSquare(target.closest('[data-square]')?.getAttribute('data-square'))
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive || pending !== null) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const square = squareOfTarget(event.target)
    if (square === null) return

    setCursor(square)
    if (!canPickUp(square)) {
      activateSquare(square)
      return
    }

    if (selected !== square) selectSquare(square)

    const piece = gridRef.current?.querySelector(`[data-square="${square}"] [data-piece]`)
    if (!(piece instanceof HTMLElement)) return
    piece.style.transition = 'none'
    gridRef.current?.setPointerCapture(event.pointerId)
    dragRef.current = {
      from: square,
      pointerId: event.pointerId,
      piece,
      originX: event.clientX,
      originY: event.clientY,
      moved: false,
    }
    setDragFrom(square)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (drag?.pointerId !== event.pointerId) return
    const dx = event.clientX - drag.originX
    const dy = event.clientY - drag.originY
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    drag.moved = true
    // Written straight to the element: a transform per pointer event costs a
    // compositor frame, a React render per pointer event costs the frame budget.
    drag.piece.style.transform = `translate3d(${String(dx)}px, ${String(dy)}px, 0) scale(1.08)`
    setDragOver(squareFromPoint(event.clientX, event.clientY))
  }

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>, commit: boolean) => {
    const drag = dragRef.current
    if (drag?.pointerId !== event.pointerId) return
    dragRef.current = null
    drag.piece.style.transition = ''
    drag.piece.style.transform = ''
    setDragFrom(null)
    setDragOver(null)
    if (gridRef.current?.hasPointerCapture(event.pointerId) === true) {
      gridRef.current.releasePointerCapture(event.pointerId)
    }
    // A press that never travelled leaves the piece selected, so click-to-move
    // and drag are the same gesture up to the moment the finger moves.
    if (!commit || !drag.moved) return
    const target = squareFromPoint(event.clientX, event.clientY)
    if (target === null || target === drag.from) return
    if (!isLegal(drag.from, target) && canPickUp(target)) {
      selectSquare(target)
      return
    }
    attemptMove(drag.from, target)
  }

  /* ---- keyboard --------------------------------------------------------- */

  const handleEscape = () => {
    if (pending !== null) {
      cancelPromotion()
      return
    }
    if (storedPremove !== null) {
      cancelPremove()
      return
    }
    if (selected !== null) {
      setSelected(null)
      announce('Selection cleared.')
    }
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return
    let next: Square | null = null
    switch (event.key) {
      case 'ArrowUp':
        next = stepSquare(cursor, orientation, 0, -1)
        break
      case 'ArrowDown':
        next = stepSquare(cursor, orientation, 0, 1)
        break
      case 'ArrowLeft':
        next = stepSquare(cursor, orientation, -1, 0)
        break
      case 'ArrowRight':
        next = stepSquare(cursor, orientation, 1, 0)
        break
      case 'Home':
        next = squareFromScreen(0, screenRow(cursor, orientation), orientation)
        break
      case 'End':
        next = squareFromScreen(7, screenRow(cursor, orientation), orientation)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        activateSquare(cursor)
        return
      case 'Escape':
        event.preventDefault()
        handleEscape()
        return
      default:
        return
    }
    event.preventDefault()
    if (next !== null) focusSquare(next)
  }

  /**
   * Keeps the cursor wherever focus actually landed.
   *
   * Roving tabindex means Tab can only reach the cursor square, but focus also
   * arrives programmatically — from `boardRef.focus()`, or from a screen reader
   * moving through the grid — and the arrow keys must carry on from there rather
   * than from wherever the cursor was last left.
   */
  const handleFocus = (event: ReactFocusEvent<HTMLDivElement>) => {
    const square = squareOfTarget(event.target)
    if (square !== null && square !== cursor) setCursor(square)
  }

  /**
   * `detail === 0` is a click no pointing device produced — a screen reader or
   * other assistive technology activating the cell. Pointer clicks were already
   * dealt with on `pointerdown`, so handling them again here would undo them.
   */
  const handleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!interactive || event.detail !== 0) return
    const square = squareOfTarget(event.target)
    if (square === null) return
    setCursor(square)
    activateSquare(square)
  }

  const handleContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!interactive) return
    if (storedPremove === null && selected === null) return
    // Right-click is the fastest way out of a wrong premove, and the browser menu
    // over a board is never what the user wanted.
    event.preventDefault()
    if (storedPremove !== null) cancelPremove()
    else setSelected(null)
  }

  /* ---- render ------------------------------------------------------------ */

  const handlers = interactive
    ? {
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => {
          endDrag(event, true)
        },
        onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => {
          endDrag(event, false)
        },
        onClick: handleClick,
        onFocus: handleFocus,
        onKeyDown: handleKeyDown,
        onContextMenu: handleContextMenu,
      }
    : {}

  return (
    <div
      ref={rootRef}
      id={id}
      className={cn('vb', className)}
      {...(boardTheme === undefined ? {} : { 'data-board': boardTheme })}
      {...(interactive ? { 'data-interactive': '' } : {})}
    >
      <div
        ref={gridRef}
        className="vb-grid"
        role={interactive ? 'grid' : 'img'}
        aria-label={label}
        {...handlers}
      >
        {rows.map((row, rowIndex) => (
          <div key={row[0] ?? rowIndex} className="vb-row" role={interactive ? 'row' : undefined}>
            {row.map((square, columnIndex) => (
              <BoardSquare
                key={square}
                square={square}
                code={placement.get(square) ?? null}
                pieceSet={pieceSet}
                light={isLightSquare(square)}
                highlighted={highlightSet.has(square)}
                selected={selected === square}
                checked={check === square}
                focused={focusSet.has(square)}
                destination={destinationSet.has(square)}
                premove={
                  storedPremove !== null &&
                  (storedPremove.from === square || storedPremove.to === square)
                }
                over={dragFrom !== null && dragOver === square}
                dragging={dragFrom === square}
                mark={markMap.get(square) ?? null}
                rankLabel={
                  coordinates && columnIndex === 0 ? String(rankIndexOf(square) + 1) : null
                }
                fileLabel={
                  coordinates && rowIndex === 7 ? (FILES[fileIndexOf(square)] ?? null) : null
                }
                interactive={interactive}
                cursor={cursor === square}
              />
            ))}
          </div>
        ))}
      </div>

      <BoardArrows arrows={shapes.arrows} orientation={orientation} idPrefix={arrowIdPrefix} />

      {pending === null ? null : (
        <PromotionPicker
          color={premoveMode ? (movable === 'black' ? 'black' : 'white') : turn}
          square={pending.to}
          orientation={orientation}
          pieceSet={pieceSet}
          onSelect={resolvePromotion}
          onCancel={cancelPromotion}
        />
      )}

      <div className="vb-effect" aria-hidden="true" />

      <div ref={liveRef} className="sr-only" role="status" aria-atomic="true" />
    </div>
  )
}
