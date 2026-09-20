import { Link } from '@tanstack/react-router'
import { Compass, Search } from 'lucide-react'

import { CtaButton, EmptyState, PageHeader, ThemeToggle } from '@/design'

import { useCommandPalette } from '../shell'

import type { Screen } from '../screens'

/** Opens the palette from a page header, the way the prototype's Search button does. */
function SearchButton() {
  const palette = useCommandPalette()
  return (
    <button
      type="button"
      onClick={palette.open}
      className="btn btn-outline h-10 rounded-full font-normal text-muted-foreground"
    >
      <Search className="size-4" aria-hidden="true" />
      Search
      <span className="ml-4 font-mono text-[10px]">⌘K</span>
    </button>
  )
}

export interface PlaceholderPageProps {
  screen: Screen
}

/**
 * Every route renders this until its feature sprint replaces it. It exists so the shell
 * can be reviewed against the prototype today — navigation, the rail, the Sage panel and
 * the keyboard path are all real; only the screen's own content is still to come.
 */
export function PlaceholderPage({ screen }: PlaceholderPageProps) {
  const provenance = [
    `Route ${screen.path}`,
    screen.prototype === undefined ? null : `designed as prototype/${screen.prototype}`,
    screen.sprint === undefined ? null : `built by sprint ${screen.sprint}`,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ')

  return (
    <div className="page">
      <PageHeader
        title={screen.title}
        description={screen.description}
        actions={
          <>
            {screen.frame === 'shell' ? <SearchButton /> : null}
            <ThemeToggle className="size-10 rounded-full" />
          </>
        }
      />

      <div className="mt-7">
        <EmptyState
          icon={Compass}
          eyebrow="Not built yet"
          title="The frame is here; the screen is not"
          description={provenance}
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
