import { Globe, Plus, ShieldCheck } from 'lucide-react'

import { Button } from '@/design'
import { OnlineOnlyNotice } from '@/pwa'

import type { Gap } from './gaps'
import type { ExplorerStatus } from './popularity'
import type { CoverageState } from './use-openings'

export interface GapsPanelProps {
  readonly coverage: CoverageState
  readonly explorerStatus: ExplorerStatus
  readonly explorerBusy: boolean
  readonly onToggleExplorer: () => void
  readonly onAddGap: (gap: Gap) => void
  readonly onSelectGap: (gap: Gap) => void
}

const MAX_SHOWN = 8

function explorerCaption(status: ExplorerStatus): string {
  if (status === 'ok') return 'Using real games from players rated 1200 to 1600.'
  if (status === 'offline') {
    return 'Could not reach the explorer, so these use the built-in estimate.'
  }
  return 'Estimated from the opening book. Switch on the online explorer for real game counts.'
}

/**
 * "What happens if Black plays X?": the replies worth preparing that the tree skips.
 *
 * It states how the numbers were made, because an estimate presented as a measurement is
 * the one thing in this panel that could mislead.
 */
export function GapsPanel(props: GapsPanelProps) {
  const { coverage } = props
  const report = coverage.report
  return (
    <section className="card overflow-hidden" aria-labelledby="gaps-h">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5 sm:py-4">
        <div>
          <h2 id="gaps-h" className="text-base font-bold sm:text-lg">
            What if they play something else?
          </h2>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Common replies with no prepared answer yet.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs sm:h-9 sm:text-sm"
          aria-pressed={props.explorerStatus !== 'off'}
          disabled={props.explorerBusy}
          onClick={props.onToggleExplorer}
        >
          <Globe className="size-4" aria-hidden="true" />
          {props.explorerStatus === 'off' ? 'Use online explorer' : 'Use built-in estimate'}
        </Button>
      </div>
      <div className="space-y-3 p-4 sm:p-5">
        <p className="text-xs text-muted-foreground" role="status">
          {coverage.running
            ? `Checking positions… ${String(coverage.checked)} so far`
            : explorerCaption(props.explorerStatus)}
        </p>
        <OnlineOnlyNotice feature="The opening explorer" />
        {report !== null && (
          <>
            <div className="flex items-center gap-2">
              <span
                role="progressbar"
                aria-valuenow={report.coveragePercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Repertoire coverage"
                className="progress h-1.5 flex-1"
              >
                <span style={{ width: `${String(report.coveragePercent)}%` }} />
              </span>
              <span className="text-xs font-medium">{String(report.coveragePercent)}% covered</span>
            </div>
            {report.gaps.length === 0 ? (
              <p className="flex items-center gap-2 text-sm">
                <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
                {report.checkedPositions === 0
                  ? 'Nothing to check yet. Add some moves first.'
                  : 'Every common reply has an answer.'}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {report.gaps.slice(0, MAX_SHOWN).map((gap) => (
                  <li
                    key={`${gap.parentId}-${gap.uci}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/50"
                  >
                    <button
                      type="button"
                      className="cursor-pointer text-left font-mono text-xs hover:underline sm:text-[13px]"
                      onClick={() => {
                        props.onSelectGap(gap)
                      }}
                    >
                      {gap.path === '' ? '' : `${gap.path} `}
                      <span className="font-semibold">{gap.san}</span>
                    </button>
                    <span className="text-xs text-muted-foreground">
                      {String(gap.popularity)}% of games
                      {gap.kind === 'no-answer' ? ' · no reply yet' : ''}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto h-7 text-xs"
                      onClick={() => {
                        props.onAddGap(gap)
                      }}
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                      Add {gap.san}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {report.gaps.length > MAX_SHOWN && (
              <p className="text-xs text-muted-foreground">
                and {String(report.gaps.length - MAX_SHOWN)} smaller ones
              </p>
            )}
          </>
        )}
      </div>
    </section>
  )
}
