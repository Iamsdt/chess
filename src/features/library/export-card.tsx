import { Archive, ChevronRight, FileDown, Loader2, Sparkles } from 'lucide-react'
import { useCallback, useState } from 'react'

import { gamesRepo } from '@/data'
import type { GameFilter, GameRow } from '@/data'
import { Button, toast } from '@/design'

import { downloadFile, exportGames, pgnFileName } from './export-service'
import { analyseGames, createJobsPort } from './jobs-port'

import type { SaveFile } from './export-service'
import type { LibraryJobsPort } from './jobs-port'
import type { PgnPort } from './pgn-port'

/**
 * Export and bulk review.
 *
 * The two live together because they are the same sentence from the user's side: "do
 * something with everything I am looking at". Both act on the *filtered* set, not the
 * whole library, so what the table shows is what the button acts on.
 */

export interface ExportCardProps {
  readonly getPort: () => PgnPort
  /** The repository-level filter the table is showing. */
  readonly filter: GameFilter
  /** The rows on screen, used to decide what still needs reviewing. */
  readonly rows: readonly GameRow[]
  readonly onAnalysed: () => void
  /** Injected in tests so nothing is written to disk and no queue is needed. */
  readonly save?: SaveFile
  readonly jobs?: LibraryJobsPort
}

export function ExportCard({
  getPort,
  filter,
  rows,
  onAnalysed,
  save = downloadFile,
  jobs,
}: ExportCardProps) {
  const [busy, setBusy] = useState<'export' | 'analyse' | null>(null)
  const pending = rows.filter((row) => row.reviewState === 'not-reviewed')

  const onExport = useCallback(() => {
    setBusy('export')
    void exportGames(filter, { pgn: getPort(), games: gamesRepo }).then((result) => {
      setBusy(null)
      if (!result.ok) {
        toast.error('Nothing exported', { description: result.error.message })
        return
      }
      const name = pgnFileName()
      save(name, result.value.text)
      toast.success(`${name} downloaded`, {
        description: `${String(result.value.count)} games, one file.`,
      })
    })
  }, [filter, getPort, save])

  const onAnalyse = useCallback(() => {
    setBusy('analyse')
    const port = jobs ?? createJobsPort()
    void analyseGames(
      pending.map((row) => row.id),
      { jobs: port, games: gamesRepo },
    ).then((result) => {
      setBusy(null)
      if (!result.ok) {
        toast.error('Nothing to analyse', { description: result.error.message })
        return
      }
      onAnalysed()
      if (result.value.enqueued === 0) {
        toast.error('Analysis could not be queued', {
          description: result.value.reason ?? 'The background queue refused the work.',
        })
        return
      }
      toast.success(`${String(result.value.enqueued)} games queued for review`, {
        description: 'They analyse in the background while you keep playing.',
      })
    })
  }, [jobs, onAnalysed, pending])

  return (
    <section className="card p-5" aria-labelledby="library-export-heading">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="grid size-8 place-items-center rounded-lg bg-accent text-accent-foreground"
        >
          <FileDown className="size-4" />
        </span>
        <h2 id="library-export-heading" className="text-lg font-bold">
          Export &amp; review
        </h2>
      </div>
      <p className="help mt-1">Your games are yours. Take them anywhere.</p>

      <div className="mt-4 grid gap-2">
        <Button
          variant="outline"
          className="justify-start"
          disabled={busy !== null}
          onClick={onExport}
        >
          {busy === 'export' ? (
            <Loader2 aria-hidden className="animate-spin" />
          ) : (
            <FileDown aria-hidden />
          )}
          Download these games as PGN
        </Button>
        <Button
          variant="outline"
          className="justify-start"
          disabled={busy !== null || pending.length === 0}
          onClick={onAnalyse}
        >
          {busy === 'analyse' ? (
            <Loader2 aria-hidden className="animate-spin" />
          ) : (
            <Sparkles aria-hidden />
          )}
          Analyse {pending.length} unreviewed game{pending.length === 1 ? '' : 's'}
        </Button>
        <a
          href="/settings#data"
          className="inline-flex h-9 items-center justify-start gap-2 rounded-md px-4 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Archive aria-hidden className="size-4" />
          Full backup in Settings
          <ChevronRight aria-hidden className="ml-auto size-4" />
        </a>
      </div>
    </section>
  )
}
