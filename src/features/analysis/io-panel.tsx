import { Link } from '@tanstack/react-router'
import { ClipboardCopy, Library, Upload } from 'lucide-react'
import { useState } from 'react'

import { Button, Input, Textarea, toast } from '@/design'
import type { Fen } from '@/domain'

/**
 * FEN and PGN, in and out.
 *
 * The two fields are drafts, not bindings: typing in them must not move the board
 * half a position at a time, so they hold their own text until "Load" is pressed
 * and re-sync whenever the board moves underneath them.
 */

interface Draft {
  /** The value from the board this text was last synchronised with. */
  readonly base: string
  readonly text: string
}

export interface IoPanelProps {
  readonly fen: Fen
  readonly pgn: string
  readonly onLoadFen: (fen: string) => boolean
  readonly onLoadPgn: (text: string) => boolean
}

async function copy(text: string, what: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${what} copied`)
  } catch {
    // Clipboard access is denied in plenty of ordinary situations (an insecure
    // origin, a permission prompt declined); the text is still on screen.
    toast.error(`${what} could not be copied. Select it and copy by hand.`)
  }
}

export function IoPanel({ fen, pgn, onLoadFen, onLoadPgn }: IoPanelProps) {
  // The draft remembers which board state it was typed against. When the board
  // moves the draft is simply no longer current, which is a render-time fact
  // rather than an effect that briefly shows the previous position's text.
  const [fenDraft, setFenDraft] = useState<Draft>({ base: fen, text: fen })
  const [pgnDraft, setPgnDraft] = useState<Draft>({ base: pgn, text: pgn })
  const fenText = fenDraft.base === fen ? fenDraft.text : fen
  const pgnText = pgnDraft.base === pgn ? pgnDraft.text : pgn

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
      <div>
        <label htmlFor="analysis-fen" className="field-label">
          FEN
        </label>
        <div className="mt-1.5 flex gap-2">
          <Input
            id="analysis-fen"
            className="font-mono text-xs"
            value={fenText}
            spellCheck={false}
            onChange={(event) => {
              setFenDraft({ base: fen, text: event.target.value })
            }}
          />
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            aria-label="Copy FEN"
            onClick={() => {
              void copy(fen, 'FEN')
            }}
          >
            <ClipboardCopy aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div>
        <label htmlFor="analysis-pgn" className="field-label">
          PGN
        </label>
        <div className="mt-1.5 flex gap-2">
          <Textarea
            id="analysis-pgn"
            rows={6}
            className="font-mono text-xs"
            spellCheck={false}
            value={pgnText}
            onChange={(event) => {
              setPgnDraft({ base: pgn, text: event.target.value })
            }}
          />
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            aria-label="Copy PGN"
            onClick={() => {
              void copy(pgn, 'PGN')
            }}
          >
            <ClipboardCopy aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => {
            if (onLoadFen(fenText)) toast.success('Position loaded')
          }}
        >
          <Upload aria-hidden="true" />
          Load FEN
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (onLoadPgn(pgnText)) toast.success('Game loaded')
          }}
        >
          <Upload aria-hidden="true" />
          Load PGN
        </Button>
        <Button asChild size="sm" variant="ghost" className="text-muted-foreground">
          <Link to="/games">
            <Library aria-hidden="true" />
            Open a saved game
          </Link>
        </Button>
      </div>
    </div>
  )
}
