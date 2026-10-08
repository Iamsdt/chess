import { FileUp } from 'lucide-react'
import { useId, useRef, useState } from 'react'

import { Button, Textarea, toast } from '@/design'
import type { Color } from '@/domain'

import { createLinesPort, type LinesPort } from './pgn-lines-port'
import { importPgnLines, type OpeningsDeps } from './service'

export interface ImportPanelProps {
  readonly deps: OpeningsDeps
  readonly color: Color
  readonly port?: LinesPort
}

/**
 * Import lines from PGN into the colour being edited. Variations become branches, and
 * large files are parsed in a worker, so pasting a whole study does not freeze the page.
 */
export function ImportPanel({ deps, color, port }: ImportPanelProps) {
  const fieldId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const run = async (source: string) => {
    setBusy(true)
    setMessage(null)
    const result = await importPgnLines(deps, color, source, port ?? createLinesPort())
    setBusy(false)
    if (!result.ok) {
      setMessage({ ok: false, text: result.error.message })
      return
    }
    const { created, games, skipped } = result.value
    const summary = `Added ${String(created)} ${created === 1 ? 'move' : 'moves'} from ${String(games)} ${games === 1 ? 'game' : 'games'}${skipped > 0 ? `, ${String(skipped)} skipped` : ''}.`
    setMessage({ ok: true, text: summary })
    setText('')
    toast(summary)
  }

  const onFile = async (file: File | undefined) => {
    if (file === undefined) return
    await run(await file.text())
  }

  return (
    <div className="space-y-2.5">
      <label htmlFor={fieldId} className="text-xs font-medium">
        Paste PGN for your {color} repertoire
      </label>
      <Textarea
        id={fieldId}
        value={text}
        rows={5}
        className="font-mono text-xs"
        placeholder="1. e4 c6 2. d4 d5 3. e5 Bf5 (3... c5 4. dxc5) 4. Nf3 e6"
        onChange={(event) => {
          setText(event.target.value)
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className="h-9"
          disabled={busy || text.trim() === ''}
          onClick={() => {
            void run(text)
          }}
        >
          Import lines
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-9"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <FileUp className="size-4" aria-hidden="true" />
          Choose a .pgn file
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".pgn,text/plain"
          className="sr-only"
          aria-label="PGN file"
          tabIndex={-1}
          onChange={(event) => {
            void onFile(event.target.files?.[0])
            event.target.value = ''
          }}
        />
      </div>
      {message !== null && (
        <p
          role={message.ok ? 'status' : 'alert'}
          className={message.ok ? 'text-xs text-muted-foreground' : 'text-xs text-destructive'}
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
