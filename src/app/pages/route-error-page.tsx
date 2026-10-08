import { Link } from '@tanstack/react-router'
import { TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button, CtaButton, EmptyState, PageHeader } from '@/design'
import { copyDiagnostics, recordError } from '@/pwa'

import type { ErrorComponentProps } from '@tanstack/react-router'

/** The shell's error boundary. It names the failure rather than hiding it, and offers the
 *  two moves that actually help: retry this screen, or leave it. */
export function RouteErrorPage({ error, reset }: ErrorComponentProps) {
  const message = error instanceof Error ? error.message : String(error)
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle')

  useEffect(() => {
    recordError('Route error boundary caught an error', error)
  }, [error])

  return (
    <div className="page">
      <PageHeader
        eyebrow="Something broke"
        title="This screen could not load"
        description="Nothing you have done is lost — everything lives in this browser."
      />
      <div className="mt-7">
        <EmptyState
          icon={TriangleAlert}
          title="The screen threw an error"
          description={message}
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <CtaButton type="button" onClick={reset}>
                Try again
              </CtaButton>
              <Button variant="outline" asChild>
                <Link to="/">Back to Today</Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void copyDiagnostics().then((ok) => {
                    setCopied(ok ? 'done' : 'failed')
                  })
                }}
              >
                {copied === 'done'
                  ? 'Diagnostics copied'
                  : copied === 'failed'
                    ? 'Copy failed'
                    : 'Copy diagnostics'}
              </Button>
            </div>
          }
        />
      </div>
    </div>
  )
}
