import { createBrowserEnvironment } from './browser'
import { createJobQueue, type JobQueue } from './queue'

import type { JobsApi } from './contract'

/**
 * The app's one queue.
 *
 * Building it is free — no database is opened, no channel constructed, no listener
 * attached until something calls `enqueue`, `registerHandler`, `observe` or
 * `cancel` — so importing `@/jobs` anywhere, including in a test, costs nothing.
 */
export const jobQueue: JobQueue = createJobQueue(createBrowserEnvironment())

/**
 * The seam S12, S14, S19 and S20 import: the same object, narrowed to the contract
 * they were written against, so nothing outside `/dev/jobs` can drive the scheduler.
 */
export const jobs: JobsApi = jobQueue
