import { Activity, CircleSlash, Pause, Play, RotateCcw, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useActiveJobs, useJobCounts } from '@/data'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  Progress,
  SectionHeader,
  Separator,
  StatCard,
} from '@/design'
import type { Job, JobId, JobState } from '@/domain'
import { now } from '@/domain'
import { engine } from '@/engine'
import type { EngineTelemetry } from '@/engine'

import { hasBroadcastChannel, hasWebLocks } from './browser'
import { jobQueue } from './runtime'

import type { JobsRuntimeStats } from './queue'

/**
 * `/dev/jobs` — what the queue is doing, and what the engine underneath it is doing.
 *
 * Why it polls instead of subscribing: both `jobQueue.stats()` and
 * `engine.telemetry()` are snapshots of "what is true now" by design, and a panel
 * that repainted on every progress tick of a 40-move analysis would be the heaviest
 * thing on the page it exists to keep light. The job *rows* come from S05's live
 * queries, so state changes still land immediately.
 */

const REFRESH_MS = 1_000
const RECENT_LIMIT = 30

const STATE_VARIANT: Record<JobState, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  queued: 'outline',
  running: 'default',
  succeeded: 'secondary',
  failed: 'destructive',
  cancelled: 'outline',
  quarantined: 'destructive',
}

const FINISHED: readonly JobState[] = ['succeeded', 'failed', 'cancelled', 'quarantined']
const REPLAYABLE: readonly JobState[] = ['failed', 'cancelled', 'quarantined']

function formatMs(value: number): string {
  return `${value.toFixed(1)} ms`
}

function formatClock(value: number | null): string {
  if (value === null) return '—'
  return new Date(value).toLocaleTimeString()
}

export function JobsDevPanel() {
  const counts = useJobCounts()
  const active = useActiveJobs()
  const [stats, setStats] = useState<JobsRuntimeStats>(() => jobQueue.stats())
  const [telemetry, setTelemetry] = useState<EngineTelemetry>(() => engine.telemetry())
  const [recent, setRecent] = useState<readonly Job[]>([])

  useEffect(() => {
    // Opening the panel is itself a reason to wake the queue: it is the one screen
    // whose whole job is to show work that may have been left over by a dead tab.
    jobQueue.start()
    let live = true
    const sample = (): void => {
      setStats(jobQueue.stats())
      setTelemetry(engine.telemetry())
      void jobQueue.list().then((all) => {
        if (!live) return
        setRecent(all.filter((job) => FINISHED.includes(job.state)).slice(0, RECENT_LIMIT))
      })
    }
    sample()
    const handle = setInterval(sample, REFRESH_MS)
    return () => {
      live = false
      clearInterval(handle)
    }
  }, [])

  const togglePause = (): void => {
    if (stats.pauseReasons.includes('manual')) jobQueue.resume()
    else jobQueue.pause()
    setStats(jobQueue.stats())
  }

  const cancel = (id: JobId): void => {
    void jobQueue.cancel(id)
  }

  const retry = (id: JobId): void => {
    void jobQueue.retry(id)
  }

  /** Quarantined rows are deliberately not pruned: they are waiting to be looked at. */
  const clearFinished = (): void => {
    void jobQueue.prune(now()).then(() => {
      setRecent((rows) => rows.filter((job) => job.state === 'quarantined'))
    })
  }

  const manuallyPaused = stats.pauseReasons.includes('manual')

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-6">
      <PageHeader
        eyebrow="Devtools"
        title="Job queue"
        description="The durable background queue: what is waiting, what is running, and what it costs the main thread."
        actions={
          <Button variant={manuallyPaused ? 'default' : 'outline'} onClick={togglePause}>
            {manuallyPaused ? <Play aria-hidden /> : <Pause aria-hidden />}
            {manuallyPaused ? 'Resume' : 'Pause'}
          </Button>
        }
      />

      <section aria-labelledby="queue-totals" className="flex flex-col gap-4">
        <SectionHeader id="queue-totals" title="Totals" icon={Activity} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Queued" value={counts?.queued ?? 0} hint="waiting for a slice" />
          <StatCard label="Running" value={counts?.running ?? 0} hint="claimed by some tab" />
          <StatCard
            label="Quarantined"
            value={counts?.quarantined ?? 0}
            hint="out of attempts"
            {...((counts?.quarantined ?? 0) > 0 ? { trend: 'down' as const } : {})}
          />
          <StatCard
            label="Throughput"
            value={stats.throughputPerMinute}
            hint="finished in the last minute"
          />
        </div>
      </section>

      <section aria-labelledby="queue-scheduler" className="flex flex-col gap-4">
        <SectionHeader
          id="queue-scheduler"
          title="Scheduler"
          meta={stats.paused ? stats.pauseReasons.join(', ') : 'running'}
        />
        <Card>
          <CardContent className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            <Row label="This tab" value={stats.owner} />
            <Row label="Started" value={stats.started ? 'yes' : 'no'} />
            <Row label="Last slice" value={formatMs(stats.lastSliceMs)} />
            <Row label="Worst slice" value={formatMs(stats.maxSliceMs)} />
            <Row
              label="Handlers"
              value={stats.handlers.length === 0 ? 'none registered' : stats.handlers.join(', ')}
            />
            <Row
              label="Locks held"
              value={stats.heldLocks.length === 0 ? 'none' : stats.heldLocks.join(', ')}
            />
            <Row label="Web Locks" value={hasWebLocks() ? 'available' : 'missing (single tab)'} />
            <Row
              label="BroadcastChannel"
              value={hasBroadcastChannel() ? 'available' : 'missing (no fan-out)'}
            />
            <Row label="Completed" value={String(stats.completed)} />
            <Row label="Failed" value={String(stats.failed)} />
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="queue-active" className="flex flex-col gap-4">
        <SectionHeader
          id="queue-active"
          title="Queued and running"
          meta={`${String(active?.length ?? 0)} jobs`}
        />
        {active === undefined || active.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing in the queue.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {active.map((job) => (
              <li key={job.id}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                      <span>{job.type}</span>
                      <Badge variant={STATE_VARIANT[job.state]}>{job.state}</Badge>
                      <Badge variant="outline">{job.priority}</Badge>
                      <span className="ml-auto flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            cancel(job.id)
                          }}
                        >
                          <X aria-hidden />
                          Cancel
                        </Button>
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    <Progress value={job.progress} aria-label={`${job.type} progress`} />
                    <p className="text-xs text-muted-foreground">
                      {job.progressLabel ?? 'no progress reported yet'} · attempt{' '}
                      {String(job.attempts + 1)} of {String(job.maxAttempts)} · queued{' '}
                      {formatClock(job.createdAt)}
                      {job.lockOwner === null ? '' : ` · held by ${job.lockOwner}`}
                    </p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="queue-recent" className="flex flex-col gap-4">
        <SectionHeader
          id="queue-recent"
          title="Finished"
          icon={CircleSlash}
          action={
            <Button size="sm" variant="ghost" onClick={clearFinished}>
              <Trash2 aria-hidden />
              Clear finished
            </Button>
          }
        />
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No finished jobs yet.</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {recent.map((job) => (
              <li key={job.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <Badge variant={STATE_VARIANT[job.state]}>{job.state}</Badge>
                <span className="font-medium">{job.type}</span>
                <span className="text-xs text-muted-foreground">
                  {formatClock(job.finishedAt)} · {String(job.attempts)} attempts
                </span>
                {job.lastError === null ? null : (
                  <span className="text-xs text-destructive">{job.lastError.message}</span>
                )}
                {REPLAYABLE.includes(job.state) ? (
                  <Button
                    className="ml-auto"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      retry(job.id)
                    }}
                  >
                    <RotateCcw aria-hidden />
                    Requeue
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Separator />

      <section aria-labelledby="engine-telemetry" className="flex flex-col gap-4">
        <SectionHeader
          id="engine-telemetry"
          title="Engine"
          meta={`${String(telemetry.workers.length)} workers`}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Completed searches" value={telemetry.searches.completed} />
          <StatCard label="Cancelled" value={telemetry.searches.cancelled} />
          <StatCard label="Failed" value={telemetry.searches.failed} />
        </div>
        <Card>
          <CardContent className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
            {Object.entries(telemetry.lanes).map(([lane, counts]) => (
              <Row
                key={lane}
                label={`Lane ${lane}`}
                value={`${String(counts.running)} running · ${String(counts.queued)} queued`}
              />
            ))}
          </CardContent>
        </Card>
        {telemetry.workers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No engine worker has started yet.</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {telemetry.workers.map((worker) => (
              <li key={worker.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <Badge variant="outline">{worker.state}</Badge>
                <span className="font-medium">#{String(worker.index)}</span>
                <span className="text-xs text-muted-foreground">
                  {worker.lane ?? 'idle'} · depth {String(worker.depth)} ·{' '}
                  {worker.nps === null ? '—' : `${String(Math.round(worker.nps))} nps`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium break-all">{value}</span>
    </div>
  )
}
