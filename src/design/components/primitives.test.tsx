import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sprout, Brain } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'

import {
  CtaButton,
  EmptyState,
  MOVE_QUALITIES,
  PageHeader,
  QualityGlyph,
  RingProgress,
  SectionHeader,
  StatCard,
} from './index'

describe('CtaButton', () => {
  it('renders a button and fires on click', async () => {
    const onClick = vi.fn()
    render(<CtaButton onClick={onClick}>Start</CtaButton>)
    await userEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('becomes the child element with asChild', () => {
    render(
      <CtaButton asChild>
        <a href="/puzzles">Continue</a>
      </CtaButton>,
    )
    const link = screen.getByRole('link', { name: 'Continue' })
    expect(link).toHaveAttribute('data-slot', 'cta-button')
  })

  it('does not fire when disabled', async () => {
    const onClick = vi.fn()
    render(
      <CtaButton disabled onClick={onClick}>
        Start
      </CtaButton>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('StatCard', () => {
  it('renders label, value and hint', () => {
    render(<StatCard label="Puzzle rating" value="1482" hint="+64 from 1418" trend="up" />)
    expect(screen.getByText('Puzzle rating')).toBeInTheDocument()
    expect(screen.getByText('1482')).toBeInTheDocument()
    expect(screen.getByText('+64 from 1418')).toBeInTheDocument()
  })

  it('omits the hint row when there is no hint', () => {
    const { container } = render(<StatCard label="Games" value="42" />)
    expect(container.querySelectorAll('div')).toHaveLength(3)
  })
})

describe('SectionHeader', () => {
  it('renders an h2 by default and an h3 on request', () => {
    const { rerender } = render(<SectionHeader title="Ways to train" icon={Brain} meta="9 games" />)
    expect(screen.getByRole('heading', { level: 2, name: /Ways to train/ })).toBeInTheDocument()
    expect(screen.getByText('9 games')).toBeInTheDocument()

    rerender(<SectionHeader as="h3" title="Ways to train" />)
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument()
  })
})

describe('QualityGlyph', () => {
  it('names every verdict for screen readers', () => {
    render(
      <>
        {MOVE_QUALITIES.map((quality) => (
          <QualityGlyph key={quality} quality={quality} />
        ))}
      </>,
    )
    for (const quality of MOVE_QUALITIES) {
      expect(screen.getByText(quality)).toBeInTheDocument()
    }
  })

  it('carries the quality on a data attribute and its token class', () => {
    const { container } = render(<QualityGlyph quality="blunder" />)
    const glyph = container.querySelector('[data-slot="quality-glyph"]')
    expect(glyph).toHaveAttribute('data-quality', 'blunder')
    expect(glyph).toHaveClass('q', 'q-blunder')
  })
})

describe('RingProgress', () => {
  it('exposes progressbar semantics', () => {
    render(<RingProgress value={38} label="Course progress" />)
    const bar = screen.getByRole('progressbar', { name: 'Course progress' })
    expect(bar).toHaveAttribute('aria-valuenow', '38')
    expect(bar).toHaveAttribute('aria-valuetext', '38%')
    expect(screen.getByText('38%')).toBeInTheDocument()
  })

  it('clamps out-of-range values', () => {
    const { rerender } = render(<RingProgress value={-10} label="Ring" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')

    rerender(<RingProgress value={250} max={200} label="Ring" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '200')
  })

  it('renders its children instead of the percentage', () => {
    render(
      <RingProgress value={10} max={10} label="Set">
        10/10
      </RingProgress>,
    )
    expect(screen.getByText('10/10')).toBeInTheDocument()
    expect(screen.queryByText('100%')).not.toBeInTheDocument()
  })
})

describe('EmptyState', () => {
  it('renders eyebrow, title, description and action', () => {
    render(
      <EmptyState
        eyebrow="When a filter finds nothing"
        icon={Sprout}
        title="No Caro-Kann games as White yet"
        description="Play one against Stockfish."
        action={<button type="button">Clear filters</button>}
      />,
    )
    expect(screen.getByText('When a filter finds nothing')).toBeInTheDocument()
    expect(screen.getByText('No Caro-Kann games as White yet')).toBeInTheDocument()
    expect(screen.getByText('Play one against Stockfish.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument()
  })
})

describe('PageHeader', () => {
  it('renders one h1 plus its supporting copy', () => {
    render(
      <PageHeader
        eyebrow="Puzzles"
        title="Sharpen your eye"
        description="Short sets, tuned to you."
        actions={<button type="button">Filter</button>}
      />,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Sharpen your eye' })).toBeInTheDocument()
    expect(screen.getByText('Puzzles')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument()
  })
})

describe('MOVE_QUALITIES', () => {
  /**
   * `satisfies` and the exhaustive `GLYPH` record already forbid drift in membership;
   * this pins the order too, which only a runtime comparison can see. Importing the
   * domain list from a test costs nothing — tests are not bundled.
   */
  it('matches the domain order so the legend reads best-to-worst', async () => {
    const domain = await import('@/domain')
    expect([...MOVE_QUALITIES]).toEqual([...domain.MOVE_QUALITIES])
  })
})
