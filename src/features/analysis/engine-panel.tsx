import { Info, Loader2, TriangleAlert } from 'lucide-react'

import { uciLineToSan } from '@/chess'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  Switch,
  cn,
} from '@/design'
import type { Color, EngineLine, Fen, Uci } from '@/domain'

import { SEARCH_LIMITS, type AnalysisSettings } from './analysis-state'
import { displayPawns, formatScore } from './score-format'
import { numberingFor, type LineStart } from './variation-tree'

import type { EngineAnalysis } from './use-engine-analysis'

/**
 * The engine panel: the switch, the dials, and the top lines.
 *
 * The lines are translated to SAN here rather than stored that way, because the
 * engine speaks UCI and the position they start from is the one on the board —
 * which is the only place both halves of that translation are known.
 */

/** Long enough to show the idea, short enough not to wrap three times. */
const PV_MOVES_SHOWN = 8

const MULTI_PV_CHOICES = [1, 2, 3, 4, 5] as const

export interface EnginePanelProps {
  readonly analysis: EngineAnalysis
  readonly settings: AnalysisSettings
  /** `false` where the browser cannot host a worker; the switch is then meaningless. */
  readonly available: boolean
  readonly fen: Fen
  readonly sideToMove: Color
  readonly lineStart: LineStart
  readonly onSettingsChange: (change: Partial<AnalysisSettings>) => void
  readonly onPlayMove: (uci: Uci) => void
}

function pvText(sans: readonly string[], start: LineStart): string {
  return sans
    .map((san, index) => {
      const { moveNumber, white } = numberingFor(index + 1, start)
      if (white) return `${String(moveNumber)}.${san}`
      if (index === 0) return `${String(moveNumber)}…${san}`
      return san
    })
    .join(' ')
}

function getScoreTone(score: EngineLine['score'], sideToMove: Color): 'good' | 'bad' | 'neutral' | 'mate' {
  if (score.kind === 'mate') return 'mate'
  const pawns = displayPawns(score, sideToMove)
  if (pawns >= 0.3) return 'good'
  if (pawns <= -0.3) return 'bad'
  return 'neutral'
}

function LineRow({
  line,
  fen,
  sideToMove,
  lineStart,
  onPlayMove,
}: {
  readonly line: EngineLine
  readonly fen: Fen
  readonly sideToMove: Color
  readonly lineStart: LineStart
  readonly onPlayMove: (uci: Uci) => void
}) {
  const sans = uciLineToSan(fen, line.pv.slice(0, PV_MOVES_SHOWN))
  const first = line.pv[0]
  const text = sans.ok ? pvText(sans.value, lineStart) : line.pv.join(' ')
  const tone = getScoreTone(line.score, sideToMove)

  return (
    <li>
      <button
        type="button"
        className="group flex w-full items-start gap-3 rounded-lg border border-border/50 bg-card/60 px-3 py-2.5 text-left transition hover:border-primary/40 hover:bg-muted/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => {
          if (first !== undefined) onPlayMove(first)
        }}
        disabled={first === undefined}
      >
        <span
          className={cn(
            'mt-0.5 min-w-[54px] shrink-0 rounded-md py-1 px-1.5 text-center font-mono text-xs font-bold tabular-nums border shadow-2xs transition-colors',
            tone === 'good' && 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
            tone === 'bad' && 'bg-destructive/15 text-destructive dark:text-red-400 border-destructive/30',
            tone === 'mate' && 'bg-purple-500/20 text-purple-600 dark:text-purple-300 border-purple-500/40',
            tone === 'neutral' && 'bg-muted/80 text-foreground border-border',
          )}
        >
          {formatScore(line.score, sideToMove)}
        </span>
        <span className="min-w-0 flex-1 font-mono text-xs sm:text-[13px] font-medium leading-relaxed tracking-tight text-foreground/90 group-hover:text-foreground transition-colors break-words">
          {text}
        </span>
        <span className="mt-0.5 shrink-0 text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
          Play →
        </span>
      </button>
    </li>
  )
}

export function EnginePanel({
  analysis,
  settings,
  available,
  fen,
  sideToMove,
  lineStart,
  onSettingsChange,
  onPlayMove,
}: EnginePanelProps) {
  const best = analysis.lines[0]

  return (
    <section className="card shrink-0 overflow-hidden" aria-labelledby="analysis-engine-heading">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Switch
          checked={settings.engineEnabled && available}
          disabled={!available}
          onCheckedChange={(checked) => {
            onSettingsChange({ engineEnabled: checked })
          }}
          aria-label="Engine"
        />
        <div className="min-w-0 flex-1 leading-tight">
          <h2 id="analysis-engine-heading" className="text-sm font-semibold">
            Stockfish
          </h2>
          <p className="text-xs text-muted-foreground">
            In your browser · depth{' '}
            <span className="font-mono text-foreground">{String(analysis.depth)}</span> ·{' '}
            {String(settings.multiPv)} {settings.multiPv === 1 ? 'line' : 'lines'}
          </p>
        </div>
        <span className="font-display text-xl font-bold tabular-nums">
          {best === undefined ? '—' : formatScore(best.score, sideToMove)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-2">
        <Select
          value={String(settings.multiPv)}
          onValueChange={(value) => {
            onSettingsChange({ multiPv: Number(value) })
          }}
        >
          <SelectTrigger size="sm" className="w-[96px]" aria-label="Number of lines">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MULTI_PV_CHOICES.map((choice) => (
              <SelectItem key={choice} value={String(choice)}>
                {String(choice)} {choice === 1 ? 'line' : 'lines'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={settings.limitId}
          onValueChange={(value) => {
            onSettingsChange({ limitId: value })
          }}
        >
          <SelectTrigger size="sm" className="w-[132px]" aria-label="Search limit">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(['Depth', 'Time'] as const).map((group) => (
              <SelectGroup key={group}>
                <SelectLabel>{group}</SelectLabel>
                {SEARCH_LIMITS.filter((limit) => limit.group === group).map((limit) => (
                  <SelectItem key={limit.id} value={limit.id}>
                    {limit.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!available ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">
          This browser cannot run the engine, so the board works without it. Everything else on this
          screen still does.
        </p>
      ) : settings.engineEnabled ? (
        <>
          <ol className="p-2.5 space-y-1.5 text-sm" aria-label="Engine lines">
            {analysis.lines.map((line) => (
              <LineRow
                key={line.multipv}
                line={line}
                fen={fen}
                sideToMove={sideToMove}
                lineStart={lineStart}
                onPlayMove={onPlayMove}
              />
            ))}
          </ol>
          <div
            className={cn(
              'flex items-center gap-2 border-t bg-muted/40 px-4 py-2 text-xs text-muted-foreground',
              analysis.status === 'error' && 'text-destructive',
            )}
            role="status"
          >
            {analysis.status === 'error' ? (
              <>
                <TriangleAlert className="size-3.5" aria-hidden="true" />
                <span>{analysis.error ?? 'The engine stopped unexpectedly.'}</span>
              </>
            ) : analysis.lines.length === 0 ? (
              <>
                <Loader2
                  className="size-3.5 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
                <span>Thinking about this position…</span>
              </>
            ) : (
              <>
                <Info className="size-3.5" aria-hidden="true" />
                <span>
                  {analysis.status === 'complete'
                    ? 'Search finished. Pick the plan you understand.'
                    : 'Searching. Play a line to add it to the tree.'}
                </span>
              </>
            )}
          </div>
        </>
      ) : (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">
          The engine is off. Turn it on when you want a second opinion.
        </p>
      )}
    </section>
  )
}
