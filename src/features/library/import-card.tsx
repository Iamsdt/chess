import { Download, Loader2, Shield, TriangleAlert } from 'lucide-react'
import { useCallback, useId, useRef, useState } from 'react'

import { gamesRepo } from '@/data'
import {
  Button,
  Input,
  Progress,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast,
} from '@/design'
import type { Result } from '@/domain'

import { importFromFeed, importPgn, type ImportProgress, type ImportReport } from './import-service'
import { chesscomFeed, lichessFeed, type FetchLike } from './providers'

import type { PgnPort } from './pgn-port'
import type { PgnImportOptions, PgnWireSource } from './worker-protocol'

/**
 * The import panel: paste, file, Lichess, Chess.com.
 *
 * Every path ends in the same place — the worker parses, the import service dedupes, the
 * repository stores — so the only thing this component owns is which bytes to hand over
 * and how to narrate the wait. Progress is live-announced because a 5 MB file takes long
 * enough that a screen-reader user would otherwise have no idea anything was happening.
 */

const LICHESS_WINDOW_DAYS = 90

export interface ImportCardProps {
  readonly getPort: () => PgnPort
  /** Called after any import that stored something, so the table reloads. */
  readonly onImported: () => void
  /** Injected in tests; in the app it is the browser's own `fetch`. */
  readonly fetchImpl?: FetchLike
}

type Phase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'running'; readonly progress: ImportProgress }
  | { readonly kind: 'done'; readonly report: ImportReport }
  | { readonly kind: 'error'; readonly message: string }

function percentOf(progress: ImportProgress): number | null {
  if (progress.totalBytes === null || progress.totalBytes === 0) return null
  return Math.min(100, Math.round((progress.bytesRead / progress.totalBytes) * 100))
}

function summarize(report: ImportReport): string {
  const parts = [`${String(report.imported)} imported`]
  if (report.duplicates > 0) parts.push(`${String(report.duplicates)} already here`)
  if (report.skippedCount > 0) parts.push(`${String(report.skippedCount)} skipped`)
  return parts.join(' · ')
}

export function ImportCard({ getPort, onImported, fetchImpl }: ImportCardProps) {
  const pgnId = useId()
  const youId = useId()
  const lichessId = useId()
  const chesscomId = useId()
  const lichessRecentId = useId()
  const chesscomRecentId = useId()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [text, setText] = useState('')
  const [you, setYou] = useState('')
  const [lichessUser, setLichessUser] = useState('')
  const [chesscomUser, setChesscomUser] = useState('')
  const [recentOnly, setRecentOnly] = useState(true)

  const busy = phase.kind === 'running'

  const finish = useCallback(
    (report: ImportReport) => {
      setPhase({ kind: 'done', report })
      if (report.imported > 0) {
        onImported()
        toast.success(`${String(report.imported)} games imported`, {
          description: 'They are in your library and ready to review.',
        })
      } else if (report.duplicates > 0) {
        toast.info('Nothing new to import', {
          description: `${String(report.duplicates)} of those games were already here.`,
        })
      }
    },
    [onImported],
  )

  const run = useCallback(
    async (
      task: (context: {
        readonly onProgress: (progress: ImportProgress) => void
        readonly signal: AbortSignal
      }) => Promise<Result<ImportReport>>,
    ) => {
      const controller = new AbortController()
      abortRef.current = controller
      setPhase({
        kind: 'running',
        progress: {
          phase: 'parsing',
          gamesParsed: 0,
          imported: 0,
          duplicates: 0,
          skipped: 0,
          bytesRead: 0,
          totalBytes: null,
        },
      })
      const result = await task({
        onProgress: (progress) => {
          setPhase({ kind: 'running', progress })
        },
        signal: controller.signal,
      })
      abortRef.current = null
      if (result.ok) finish(result.value)
      else setPhase({ kind: 'error', message: result.error.message })
    },
    [finish],
  )

  const importSource = useCallback(
    async (source: PgnWireSource, options: PgnImportOptions) => {
      await run(({ onProgress, signal }) =>
        importPgn(source, options, { pgn: getPort(), games: gamesRepo, onProgress, signal }),
      )
    },
    [getPort, run],
  )

  const onPasteImport = useCallback(() => {
    if (text.trim() === '') {
      setPhase({ kind: 'error', message: 'Paste a PGN first.' })
      return
    }
    void importSource(
      { kind: 'text', text },
      { source: 'pgn-import', ...(you.trim() === '' ? {} : { you: you.trim() }) },
    )
  }, [importSource, text, you])

  const onFile = useCallback(
    (file: File | undefined) => {
      if (file === undefined) return
      void importSource(
        { kind: 'blob', blob: file },
        { source: 'pgn-import', ...(you.trim() === '' ? {} : { you: you.trim() }) },
      )
    },
    [importSource, you],
  )

  const onLichess = useCallback(() => {
    const username = lichessUser.trim()
    if (username === '') {
      setPhase({ kind: 'error', message: 'Enter a Lichess username.' })
      return
    }
    const deps = { fetch: fetchImpl ?? globalThis.fetch.bind(globalThis) }
    const feed = lichessFeed(
      {
        username,
        max: 200,
        ...(recentOnly
          ? { rated: true, since: Date.now() - LICHESS_WINDOW_DAYS * 86_400_000 }
          : {}),
      },
      deps,
    )
    const options: PgnImportOptions = { source: 'lichess', you: username }
    void run(({ onProgress, signal }) =>
      importFromFeed(feed, options, { pgn: getPort(), games: gamesRepo, onProgress, signal }),
    )
  }, [fetchImpl, getPort, lichessUser, recentOnly, run])

  const onChesscom = useCallback(() => {
    const username = chesscomUser.trim()
    if (username === '') {
      setPhase({ kind: 'error', message: 'Enter a Chess.com username.' })
      return
    }
    const deps = { fetch: fetchImpl ?? globalThis.fetch.bind(globalThis) }
    const feed = chesscomFeed({ username, months: recentOnly ? 3 : 12 }, deps)
    const options: PgnImportOptions = { source: 'chesscom', you: username }
    void run(({ onProgress, signal }) =>
      importFromFeed(feed, options, { pgn: getPort(), games: gamesRepo, onProgress, signal }),
    )
  }, [chesscomUser, fetchImpl, getPort, recentOnly, run])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return (
    <section className="card p-5" aria-labelledby="library-import-heading">
      <div className="flex items-center gap-2">
        <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-sky text-sky-ink">
          <Download className="size-4" />
        </span>
        <h2 id="library-import-heading" className="text-lg font-bold">
          Import games
        </h2>
      </div>
      <p className="help mt-1">Imported games get the same review and feed your Mistake Bank.</p>

      <Tabs defaultValue="pgn" className="mt-4">
        <TabsList className="w-full">
          <TabsTrigger value="pgn">Paste or upload</TabsTrigger>
          <TabsTrigger value="lichess">Lichess</TabsTrigger>
          <TabsTrigger value="chesscom">Chess.com</TabsTrigger>
        </TabsList>

        <TabsContent value="pgn" className="pt-4">
          <label htmlFor={pgnId} className="field-label">
            PGN
          </label>
          <Textarea
            id={pgnId}
            rows={5}
            spellCheck={false}
            className="mt-1.5 font-mono text-xs"
            placeholder={'[Event "Club night"]\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 …'}
            value={text}
            onChange={(event) => {
              setText(event.target.value)
            }}
          />
          <label htmlFor={youId} className="field-label mt-3 block">
            Your name in these games <span className="help">(optional)</span>
          </label>
          <Input
            id={youId}
            className="mt-1.5"
            placeholder="e.g. bishop_bard"
            value={you}
            onChange={(event) => {
              setYou(event.target.value)
            }}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="help">
              Several games at once are fine. Large files are read in a worker.
            </p>
            <div className="flex gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".pgn,.txt,application/x-chess-pgn,text/plain"
                className="sr-only"
                aria-label="Choose a PGN file"
                onChange={(event) => {
                  onFile(event.target.files?.[0])
                  event.target.value = ''
                }}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => {
                  fileRef.current?.click()
                }}
              >
                Choose file
              </Button>
              <Button size="sm" disabled={busy} onClick={onPasteImport}>
                <Download aria-hidden />
                Import
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="lichess" className="pt-4">
          <label htmlFor={lichessId} className="field-label">
            Lichess username
          </label>
          <div className="mt-1.5 flex gap-2">
            <Input
              id={lichessId}
              placeholder="e.g. bishop_bard"
              value={lichessUser}
              onChange={(event) => {
                setLichessUser(event.target.value)
              }}
            />
            <Button className="shrink-0" disabled={busy} onClick={onLichess}>
              Fetch
            </Button>
          </div>
          <p className="mt-3 flex gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <Shield aria-hidden className="mt-px size-3.5 shrink-0" />
            <span>
              Fetched directly from your browser via Lichess&apos;s public API. No password, and
              nothing passes through a Chess King server.
            </span>
          </p>
          <div className="mt-3 flex items-center gap-3 text-sm">
            <Switch id={lichessRecentId} checked={recentOnly} onCheckedChange={setRecentOnly} />
            <label htmlFor={lichessRecentId}>
              Only rated games from the last {LICHESS_WINDOW_DAYS} days
            </label>
          </div>
        </TabsContent>

        <TabsContent value="chesscom" className="pt-4">
          <label htmlFor={chesscomId} className="field-label">
            Chess.com username
          </label>
          <div className="mt-1.5 flex gap-2">
            <Input
              id={chesscomId}
              placeholder="e.g. knightowl77"
              value={chesscomUser}
              onChange={(event) => {
                setChesscomUser(event.target.value)
              }}
            />
            <Button className="shrink-0" disabled={busy} onClick={onChesscom}>
              Fetch
            </Button>
          </div>
          <p className="mt-3 flex gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <Shield aria-hidden className="mt-px size-3.5 shrink-0" />
            <span>
              Fetched directly from your browser via Chess.com&apos;s public API. Only public games
              are available, and it takes a few seconds per month of games.
            </span>
          </p>
          <div className="mt-3 flex items-center gap-3 text-sm">
            <Switch id={chesscomRecentId} checked={recentOnly} onCheckedChange={setRecentOnly} />
            <label htmlFor={chesscomRecentId}>Only the last 3 months</label>
          </div>
        </TabsContent>
      </Tabs>

      <div aria-live="polite" className="mt-4 empty:mt-0">
        {phase.kind === 'running' ? (
          <div className="rounded-lg border bg-muted/40 p-3">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 aria-hidden className="size-4 animate-spin" />
              <span>
                {phase.progress.label ?? 'Reading PGN'} · {phase.progress.gamesParsed} games read ·{' '}
                {phase.progress.imported} imported
              </span>
              <Button variant="ghost" size="sm" className="ml-auto" onClick={cancel}>
                Cancel
              </Button>
            </div>
            <Progress className="mt-2" value={percentOf(phase.progress) ?? 0} />
          </div>
        ) : null}

        {phase.kind === 'done' ? (
          <p className="rounded-lg border bg-muted/40 p-3 text-sm">{summarize(phase.report)}</p>
        ) : null}

        {phase.kind === 'error' ? (
          <p className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive">
            <TriangleAlert aria-hidden className="mt-px size-4 shrink-0" />
            {phase.message}
          </p>
        ) : null}
      </div>

      {phase.kind === 'done' && phase.report.skipped.length > 0 ? (
        <details className="mt-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer">
            {phase.report.skippedCount} game(s) could not be read
          </summary>
          <ul className="mt-2 space-y-1">
            {phase.report.skipped.map((skip) => (
              <li key={`${String(skip.index)}-${skip.label}`}>
                <span className="font-medium">{skip.label}</span> — {skip.reason}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  )
}
