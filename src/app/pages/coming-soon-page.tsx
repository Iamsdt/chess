import { Link } from '@tanstack/react-router'
import { Sprout, Users, type LucideIcon } from 'lucide-react'

import { Button, CtaButton, EmptyState, PageHeader, ThemeToggle } from '@/design'

import type { Screen } from '../screens'

export interface ComingSoonPageProps {
  screen: Screen
}

interface ComingSoonCopy {
  readonly icon: LucideIcon
  readonly title: string
  readonly description: string
  /** What already works nearby, so the page is not a dead end. */
  readonly meanwhile?: readonly { readonly to: string; readonly label: string }[]
}

const LEARN_COPY: ComingSoonCopy = {
  icon: Sprout,
  title: 'Lessons are being redesigned',
  description:
    'A full course you learn by playing: the board shows the idea, then hands you the move. Until it lands, the drills below keep working.',
  meanwhile: [
    { to: '/drills/endgames', label: 'Endgame drills' },
    { to: '/drills/vision', label: 'Board vision' },
  ],
}

const FRIENDS_COPY: ComingSoonCopy = {
  icon: Users,
  title: 'Playing with friends is on its way',
  description:
    'Invites, share links and live games against friends are coming in a later release. Everything else works today.',
}

/**
 * Stands in for a screen that is planned but held back from this release. Unlike the
 * placeholder it speaks to the player, not the reviewer: no sprint numbers, just what is
 * coming and a way back to practice.
 */
export function ComingSoonPage({ screen }: ComingSoonPageProps) {
  const copy = screen.nav === 'learn' ? LEARN_COPY : FRIENDS_COPY
  return (
    <div className="page">
      <PageHeader
        title={screen.title}
        description={screen.description}
        actions={<ThemeToggle className="size-10 rounded-full" />}
      />

      <div className="mt-7">
        <EmptyState
          icon={copy.icon}
          eyebrow="Coming soon"
          title={copy.title}
          description={copy.description}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <CtaButton asChild>
                <Link to="/">Back to Today</Link>
              </CtaButton>
              {copy.meanwhile?.map((item) => (
                <Button key={item.to} variant="outline" asChild>
                  <Link to={item.to}>{item.label}</Link>
                </Button>
              ))}
            </div>
          }
        />
      </div>
    </div>
  )
}
