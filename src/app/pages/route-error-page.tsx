import { Link } from '@tanstack/react-router'
import { TriangleAlert } from 'lucide-react'

import { Button, CtaButton, EmptyState, PageHeader } from '@/design'

import type { ErrorComponentProps } from '@tanstack/react-router'

/** The shell's error boundary. It names the failure rather than hiding it, and offers the
 *  two moves that actually help: retry this screen, or leave it. */
export function RouteErrorPage({ error, reset }: ErrorComponentProps) {
  const message = error instanceof Error ? error.message : String(error)

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
            </div>
          }
        />
      </div>
    </div>
  )
}
