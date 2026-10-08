import { useMemo, useRef, useState } from 'react'

import { Badge, Button, Input, PageHeader, ThemeToggle, cn } from '@/design'
import { makeCoachContext } from '@/domain'

import { CoachPanel } from '../components/coach-panel'
import { SHOWCASE_PROMPTS } from '../showcase-prompts'

import { SAGE_FEATURES, STATUS_LABEL } from './sage-lab-features'

import type { SageFeature, SageFeatureStatus } from './sage-lab-features'
import type { CoachContextBase } from '../components/coach-panel'

/**
 * `/dev/sage`: every planned Sage feature in one list, each with a button that asks the
 * panel the question that demos it.
 *
 * Why a page and not a doc: "can I see it work?" is the only honest way to check a
 * mock-first feature list, and the list is the same registry the test reads.
 */

const { spoilerGuard: _spoilerGuard, allowEngineLines: _engine, ...BASE } = makeCoachContext()
const CONTEXT: CoachContextBase = BASE

type StatusFilter = SageFeatureStatus | 'all'

const FILTERS: readonly { readonly id: StatusFilter; readonly label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'mock', label: STATUS_LABEL.mock },
  { id: 'waits-learn', label: STATUS_LABEL['waits-learn'] },
  { id: 'waits-friends', label: STATUS_LABEL['waits-friends'] },
  { id: 'later', label: STATUS_LABEL.later },
]

const BADGE_VARIANT = {
  mock: 'soft',
  'waits-learn': 'sky',
  'waits-friends': 'lilac',
  later: 'muted',
} as const

function FeatureRow({
  feature,
  seen,
  onTry,
}: {
  readonly feature: SageFeature
  readonly seen: boolean
  readonly onTry: (feature: SageFeature) => void
}) {
  return (
    <li
      data-slot="sage-lab-row"
      data-feature={feature.n}
      className="flex flex-wrap items-start gap-3 border-b px-1 py-3 last:border-b-0"
    >
      <span className="w-7 shrink-0 pt-0.5 text-right font-mono text-xs text-muted-foreground">
        {feature.n}
      </span>
      <div className="min-w-0 flex-1 basis-56">
        <p className="flex flex-wrap items-center gap-2 font-semibold">
          {feature.name}
          <Badge variant={BADGE_VARIANT[feature.status]}>{STATUS_LABEL[feature.status]}</Badge>
          {seen ? <Badge variant="outline">Seen</Badge> : null}
        </p>
        <p className="help mt-0.5">{feature.line}</p>
        {feature.where !== undefined ? (
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="font-semibold">Where: </span>
            {feature.where}
          </p>
        ) : null}
      </div>
      {feature.prompt !== undefined ? (
        <Button
          size="sm"
          variant={seen ? 'outline' : 'default'}
          aria-label={`Try ${feature.name}`}
          onClick={() => {
            onTry(feature)
          }}
        >
          Try
        </Button>
      ) : null}
    </li>
  )
}

export function SageLab() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [seen, setSeen] = useState<ReadonlySet<number>>(new Set())
  const [prompt, setPrompt] = useState<{ id: number; text: string } | undefined>()
  const nextId = useRef(1)
  const chatRef = useRef<HTMLDivElement>(null)

  const ready = SAGE_FEATURES.filter((f) => f.status === 'mock').length

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matches = SAGE_FEATURES.filter(
      (f) =>
        (filter === 'all' || f.status === filter) &&
        (needle === '' || `${f.name} ${f.line}`.toLowerCase().includes(needle)),
    )
    const byGroup = new Map<string, SageFeature[]>()
    for (const f of matches) byGroup.set(f.group, [...(byGroup.get(f.group) ?? []), f])
    return [...byGroup.entries()]
  }, [query, filter])

  const tryFeature = (feature: SageFeature) => {
    if (feature.prompt === undefined) return
    // A fresh id each time, so asking the same question twice sends it twice.
    setPrompt({ id: nextId.current++, text: SHOWCASE_PROMPTS[feature.prompt] })
    setSeen((prev) => new Set(prev).add(feature.n))
  }

  return (
    <div data-slot="sage-lab" className="page">
      <PageHeader
        eyebrow="Dev"
        title="Sage feature preview"
        description="Mock data, no AI calls"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="lg:hidden"
              onClick={() => chatRef.current?.scrollIntoView({ behavior: 'smooth' })}
            >
              Jump to chat
            </Button>
            <ThemeToggle className="size-10 rounded-full" />
          </>
        }
      />

      <div
        data-slot="sage-lab-progress"
        role="status"
        className="mt-4 flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm"
      >
        <span className="font-semibold">
          {ready} of {SAGE_FEATURES.length} ready in the mock
        </span>
        <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <span
            className="block h-full rounded-full bg-primary"
            style={{ width: `${String((ready / SAGE_FEATURES.length) * 100)}%` }}
          />
        </span>
        <span className="text-muted-foreground">{seen.size} seen</span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div data-slot="sage-lab-list" className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="search"
              aria-label="Search features"
              placeholder="Search features"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
              }}
              className="max-w-xs"
            />
            <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <Button
                  key={f.id}
                  size="sm"
                  variant={filter === f.id ? 'default' : 'outline'}
                  aria-pressed={filter === f.id}
                  onClick={() => {
                    setFilter(f.id)
                  }}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>

          {groups.length === 0 ? (
            <p className="help mt-6">No feature matches.</p>
          ) : (
            groups.map(([group, features]) => (
              <section key={group} aria-label={group} className="mt-4">
                <h2 className="eyebrow sticky top-0 z-10 bg-background py-2">{group}</h2>
                <ul>
                  {features.map((feature) => (
                    <FeatureRow
                      key={feature.n}
                      feature={feature}
                      seen={seen.has(feature.n)}
                      onTry={tryFeature}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>

        <div
          ref={chatRef}
          data-slot="sage-lab-chat"
          className={cn(
            'flex h-[640px] overflow-hidden rounded-2xl border',
            'lg:sticky lg:top-4 lg:h-[calc(100dvh-2rem)]',
          )}
        >
          <CoachPanel context={CONTEXT} prompt={prompt} className="min-w-0" />
        </div>
      </div>
    </div>
  )
}
