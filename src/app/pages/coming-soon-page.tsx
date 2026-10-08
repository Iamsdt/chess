import { Link } from '@tanstack/react-router'
import { Users } from 'lucide-react'

import { CtaButton, EmptyState, PageHeader, ThemeToggle } from '@/design'

import type { Screen } from '../screens'

export interface ComingSoonPageProps {
  screen: Screen
}

/**
 * Stands in for a screen that is planned but held back from this release. Unlike the
 * placeholder it speaks to the player, not the reviewer: no sprint numbers, just what is
 * coming and a way back to practice.
 */
export function ComingSoonPage({ screen }: ComingSoonPageProps) {
  return (
    <div className="page">
      <PageHeader
        title={screen.title}
        description={screen.description}
        actions={<ThemeToggle className="size-10 rounded-full" />}
      />

      <div className="mt-7">
        <EmptyState
          icon={Users}
          eyebrow="Coming soon"
          title="Playing with friends is on its way"
          description="Invites, share links and live games against friends are coming in a later release. Everything else works today."
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
