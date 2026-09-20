import { CircleCheck, Eraser, RotateCcw, TriangleAlert, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { pieceImageUrl } from '@/board'
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useTheme,
} from '@/design'
import type { Fen, Square } from '@/domain'

import {
  availableCastling,
  BOARD_FILES,
  clearPieces,
  enPassantChoices,
  placePiece,
  SETUP_PIECES,
  SETUP_SQUARES,
  setupFromFen,
  setupToFen,
  startSetup,
  type CastlingRights,
  type SetupPiece,
  type SetupState,
} from './setup-position'

/**
 * Set up a position by hand.
 *
 * The board here is its own 8×8 grid of buttons rather than `<Board>`: placing a
 * piece from a palette is a *square* gesture, and `<Board>` deliberately only
 * speaks moves. Buttons also give the dialog a keyboard path for free, which drag
 * and drop would not.
 */

const PIECE_NAMES: Readonly<Record<SetupPiece, string>> = {
  wK: 'White king',
  wQ: 'White queen',
  wR: 'White rook',
  wB: 'White bishop',
  wN: 'White knight',
  wP: 'White pawn',
  bK: 'Black king',
  bQ: 'Black queen',
  bR: 'Black rook',
  bB: 'Black bishop',
  bN: 'Black knight',
  bP: 'Black pawn',
}

const CASTLING_LABELS: readonly (readonly [keyof CastlingRights, string])[] = [
  ['whiteKing', 'White O-O'],
  ['whiteQueen', 'White O-O-O'],
  ['blackKing', 'Black O-O'],
  ['blackQueen', 'Black O-O-O'],
]

const NO_EN_PASSANT = 'none'

type Brush = SetupPiece | 'erase'

function isLightSquare(square: Square): boolean {
  const file = BOARD_FILES.findIndex((letter) => letter === square[0])
  return (file + Number(square[1])) % 2 === 1
}

export interface SetupDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly initialFen: Fen
  readonly onLoad: (fen: Fen) => void
}

/**
 * The dialog's whole draft, tagged with the board position it was opened from.
 *
 * Why a tag rather than an effect that resets on open: reopening the dialog must
 * show the position on the board, and deriving that at render time means the
 * player never sees a frame of the previous one.
 */
interface SetupDraft {
  readonly key: string
  readonly setup: SetupState
  readonly fenText: string
  /** Set while the text in the FEN field is not itself a position. */
  readonly textError: string | null
}

function draftFor(key: string, fen: Fen): SetupDraft {
  const parsed = setupFromFen(fen)
  return { key, setup: parsed.ok ? parsed.value : startSetup(), fenText: fen, textError: null }
}

export function SetupDialog({ open, onOpenChange, initialFen, onLoad }: SetupDialogProps) {
  const { pieceSet } = useTheme()
  const [brush, setBrush] = useState<Brush>('wP')
  const key = open ? String(initialFen) : ''
  const [draft, setDraft] = useState<SetupDraft>(() => draftFor(key, initialFen))
  const active = draft.key === key ? draft : draftFor(key, initialFen)
  const setup = active.setup

  const built = useMemo(() => setupToFen(setup), [setup])
  const available = useMemo(() => availableCastling(setup.placement), [setup.placement])
  const epChoices = useMemo(() => enPassantChoices(setup), [setup])

  /** Editing the board rewrites the FEN field; an unbuildable position leaves it be. */
  const setSetup = (change: (current: SetupState) => SetupState): void => {
    const next = change(setup)
    const rebuilt = setupToFen(next)
    setDraft({
      key,
      setup: next,
      fenText: rebuilt.ok ? rebuilt.value : active.fenText,
      textError: null,
    })
  }

  // What to say, and whether "Load" can do anything: a FEN typed by hand that does
  // not parse leaves the board untouched, so the field's own problem outranks it.
  const problem = active.textError ?? (built.ok ? null : built.error.message)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-32px)] overflow-auto sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle>Set up a position</DialogTitle>
          <DialogDescription>
            Pick a piece, then click a square. The FEN below updates as you go.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_190px]">
          <div
            className="grid aspect-square grid-cols-8 self-start overflow-hidden rounded-xl ring-1 ring-border"
            role="group"
            aria-label="Setup board"
          >
            {SETUP_SQUARES.map((square) => {
              const piece = setup.placement.get(square)
              return (
                <button
                  key={square}
                  type="button"
                  className={cn(
                    'grid place-items-center focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                    isLightSquare(square) ? 'bg-[var(--vb-light)]' : 'bg-[var(--vb-dark)]',
                  )}
                  aria-label={`${square}, ${piece === undefined ? 'empty' : PIECE_NAMES[piece]}`}
                  onClick={() => {
                    setSetup((current) =>
                      placePiece(current, square, brush === 'erase' ? null : brush),
                    )
                  }}
                >
                  {piece === undefined ? null : (
                    <img
                      src={pieceImageUrl(pieceSet, piece)}
                      alt=""
                      className="pointer-events-none size-full"
                    />
                  )}
                </button>
              )
            })}
          </div>

          <div className="space-y-4">
            <div>
              <p className="field-label" id="analysis-setup-palette">
                Pieces
              </p>
              <div
                className="mt-2 grid grid-cols-6 gap-1 sm:grid-cols-3"
                role="radiogroup"
                aria-labelledby="analysis-setup-palette"
              >
                {SETUP_PIECES.map((piece) => (
                  <button
                    key={piece}
                    type="button"
                    role="radio"
                    aria-checked={brush === piece}
                    aria-label={PIECE_NAMES[piece]}
                    className={cn(
                      'flex items-center justify-center rounded-lg border bg-card p-1 transition hover:border-ring/60',
                      brush === piece && 'border-primary bg-accent/50 ring-2 ring-primary/20',
                    )}
                    onClick={() => {
                      setBrush(piece)
                    }}
                  >
                    <img src={pieceImageUrl(pieceSet, piece)} alt="" className="size-8" />
                  </button>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1">
                <Button
                  variant={brush === 'erase' ? 'default' : 'outline'}
                  size="sm"
                  aria-pressed={brush === 'erase'}
                  onClick={() => {
                    setBrush('erase')
                  }}
                >
                  <Eraser aria-hidden="true" />
                  Erase
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSetup(clearPieces)
                  }}
                >
                  <Trash2 aria-hidden="true" />
                  Clear
                </Button>
              </div>
            </div>

            <fieldset>
              <legend className="field-label">Side to move</legend>
              <div className="seg mt-2">
                {(['white', 'black'] as const).map((color) => (
                  <label
                    key={color}
                    className={cn('capitalize', setup.sideToMove === color && 'is-active')}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      name="analysis-setup-side"
                      checked={setup.sideToMove === color}
                      onChange={() => {
                        setSetup((current) => ({ ...current, sideToMove: color, enPassant: null }))
                      }}
                    />
                    {color}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="field-label">Castling</legend>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs sm:grid-cols-1">
                {CASTLING_LABELS.map(([key, label]) => (
                  <label
                    key={key}
                    className={cn(
                      'flex items-center gap-2',
                      !available[key] && 'text-muted-foreground',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={setup.castling[key]}
                      disabled={!available[key]}
                      onChange={(event) => {
                        const checked = event.target.checked
                        setSetup((current) => ({
                          ...current,
                          castling: { ...current.castling, [key]: checked },
                        }))
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <p className="field-label" id="analysis-setup-ep">
                En passant
              </p>
              <Select
                value={setup.enPassant ?? NO_EN_PASSANT}
                onValueChange={(value) => {
                  setSetup((current) => ({
                    ...current,
                    enPassant:
                      value === NO_EN_PASSANT
                        ? null
                        : (epChoices.find((square) => square === value) ?? null),
                  }))
                }}
              >
                <SelectTrigger
                  size="sm"
                  className="mt-2 w-full"
                  aria-labelledby="analysis-setup-ep"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_EN_PASSANT}>None</SelectItem>
                  {epChoices.map((square) => (
                    <SelectItem key={square} value={square}>
                      {square}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="analysis-setup-fen" className="field-label">
              FEN
            </label>
            <Input
              id="analysis-setup-fen"
              className="mt-1.5 font-mono text-xs"
              value={active.fenText}
              spellCheck={false}
              aria-invalid={problem !== null}
              aria-describedby="analysis-setup-status"
              onChange={(event) => {
                const value = event.target.value
                const parsed = setupFromFen(value)
                setDraft({
                  key,
                  setup: parsed.ok ? parsed.value : setup,
                  fenText: value,
                  textError: parsed.ok ? null : parsed.error.message,
                })
              }}
            />
            <p
              id="analysis-setup-status"
              role="status"
              className={cn(
                'help mt-1.5 flex items-center gap-1.5',
                problem !== null && 'text-destructive',
              )}
            >
              {problem === null ? (
                <>
                  <CircleCheck className="size-3.5 text-success" aria-hidden="true" />
                  Legal position · both kings safe
                </>
              ) : (
                <>
                  <TriangleAlert className="size-3.5" aria-hidden="true" />
                  {problem}
                </>
              )}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setSetup(startSetup)
            }}
          >
            <RotateCcw aria-hidden="true" />
            Start position
          </Button>
          <Button
            disabled={problem !== null}
            onClick={() => {
              if (built.ok && problem === null) {
                onLoad(built.value)
                onOpenChange(false)
              }
            }}
          >
            Load position
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
