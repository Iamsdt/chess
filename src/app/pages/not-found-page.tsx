import { Link, useRouterState } from '@tanstack/react-router'
import { MapPinOff } from 'lucide-react'

import { CtaButton, EmptyState, PageHeader } from '@/design'

/** Shown for any URL the router cannot match. Framed by the shell, so the sidebar is
 *  still there and a wrong link is a detour rather than a dead end. */
export function NotFoundPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  return (
    <div className="page">
      <PageHeader
        eyebrow="404"
        title="That page is not here"
        description="The link may be old, or the screen may not exist yet."
      />
      <div className="mt-7">
        <EmptyState
          icon={MapPinOff}
          title={pathname}
          description="Nothing is routed at that address. Everything else is still one click away."
          action={
            <CtaButton asChild>
              <Link to="/">Back to Today</Link>
            </CtaButton>
          }
        />
      </div>
    </div>
  )
}
