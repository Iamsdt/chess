import { repertoireRepo, srsCardsRepo } from '@/data'

import type { OpeningsDeps } from './service'

/** The app's own repositories; tests build `OpeningsDeps` of their own. */
export const APP_DEPS: OpeningsDeps = { repertoire: repertoireRepo, srsCards: srsCardsRepo }
