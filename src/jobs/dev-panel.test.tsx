import 'fake-indexeddb/auto'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { jobsRepo } from '@/data'

import { JobsDevPanel } from './dev-panel'
import { jobQueue } from './runtime'

/**
 * `/dev/jobs` is the one screen S11 owns, so it gets the component test the quality
 * bar asks of every interactive component. It renders against the real singleton
 * queue — in jsdom that means the in-process lock fallback and no engine worker,
 * which is exactly the "nothing has started yet" state the panel has to render.
 */

beforeEach(async () => {
  await jobsRepo.clear()
})

afterEach(async () => {
  jobQueue.resume()
  await jobQueue.stop()
})

describe('JobsDevPanel', () => {
  it('renders the queue with nothing in it', async () => {
    render(<JobsDevPanel />)

    expect(screen.getByRole('heading', { level: 1, name: 'Job queue' })).toBeInTheDocument()
    expect(await screen.findByText('Nothing in the queue.')).toBeInTheDocument()
    expect(screen.getByText('No finished jobs yet.')).toBeInTheDocument()
    expect(screen.getByText('No engine worker has started yet.')).toBeInTheDocument()
  })

  it('pauses and resumes the scheduler from the header button', async () => {
    const user = userEvent.setup()
    render(<JobsDevPanel />)

    await user.click(screen.getByRole('button', { name: 'Pause' }))
    expect(jobQueue.stats().pauseReasons).toContain('manual')

    await user.click(screen.getByRole('button', { name: 'Resume' }))
    expect(jobQueue.stats().pauseReasons).not.toContain('manual')
  })

  it('lists a queued job with its progress bar', async () => {
    await jobQueue.enqueue('analyse-game', { gameId: 'g1' }, { priority: 'high' })
    render(<JobsDevPanel />)

    expect(await screen.findByText('analyse-game')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'analyse-game progress' })).toBeInTheDocument()
    expect(screen.getByText(/no progress reported yet/)).toBeInTheDocument()
  })
})
