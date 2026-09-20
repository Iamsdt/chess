import { db } from '../db'

import { createAttemptsRepository } from './attempts'
import { createGamesRepository } from './games'
import { createJobsRepository } from './jobs'
import { createKvRepository } from './kv'
import { createLessonsProgressRepository } from './lessons-progress'
import { createMistakesRepository } from './mistakes'
import { createMovesRepository } from './moves'
import { createPacksRepository } from './packs'
import { createProfileRepository } from './profile'
import { createPuzzlesRepository } from './puzzles'
import { createRepertoireRepository } from './repertoire'
import { createSessionsRepository } from './sessions'
import { createSettingsRepository } from './settings'
import { createSrsCardsRepository } from './srs-cards'

import type { ChessKingDb } from '../db'

/**
 * Every repository, bound to the app's database.
 *
 * Each `createXRepository(db)` is exported too, so a test (or the backup, or the
 * seed) can bind the same queries to a scratch database without touching the
 * real one. Nothing here leaks the Dexie instance.
 */
export interface Repositories {
  games: ReturnType<typeof createGamesRepository>
  moves: ReturnType<typeof createMovesRepository>
  puzzles: ReturnType<typeof createPuzzlesRepository>
  attempts: ReturnType<typeof createAttemptsRepository>
  srsCards: ReturnType<typeof createSrsCardsRepository>
  mistakes: ReturnType<typeof createMistakesRepository>
  packs: ReturnType<typeof createPacksRepository>
  lessonsProgress: ReturnType<typeof createLessonsProgressRepository>
  repertoire: ReturnType<typeof createRepertoireRepository>
  sessions: ReturnType<typeof createSessionsRepository>
  jobs: ReturnType<typeof createJobsRepository>
  settings: ReturnType<typeof createSettingsRepository>
  profile: ReturnType<typeof createProfileRepository>
  kv: ReturnType<typeof createKvRepository>
}

/** Why: the backup, the seed and every test need the whole set at once. */
export function createRepositories(target: ChessKingDb): Repositories {
  return {
    games: createGamesRepository(target),
    moves: createMovesRepository(target),
    puzzles: createPuzzlesRepository(target),
    attempts: createAttemptsRepository(target),
    srsCards: createSrsCardsRepository(target),
    mistakes: createMistakesRepository(target),
    packs: createPacksRepository(target),
    lessonsProgress: createLessonsProgressRepository(target),
    repertoire: createRepertoireRepository(target),
    sessions: createSessionsRepository(target),
    jobs: createJobsRepository(target),
    settings: createSettingsRepository(target),
    profile: createProfileRepository(target),
    kv: createKvRepository(target),
  }
}

/** The app-wide set. Features import these, never `db`. */
export const repositories: Repositories = createRepositories(db)

export const gamesRepo = repositories.games
export const movesRepo = repositories.moves
export const puzzlesRepo = repositories.puzzles
export const attemptsRepo = repositories.attempts
export const srsCardsRepo = repositories.srsCards
export const mistakesRepo = repositories.mistakes
export const packsRepo = repositories.packs
export const lessonsProgressRepo = repositories.lessonsProgress
export const repertoireRepo = repositories.repertoire
export const sessionsRepo = repositories.sessions
export const jobsRepo = repositories.jobs
export const settingsRepo = repositories.settings
export const profileRepo = repositories.profile
export const kvRepo = repositories.kv

export {
  createAttemptsRepository,
  createGamesRepository,
  createJobsRepository,
  createKvRepository,
  createLessonsProgressRepository,
  createMistakesRepository,
  createMovesRepository,
  createPacksRepository,
  createProfileRepository,
  createPuzzlesRepository,
  createRepertoireRepository,
  createSessionsRepository,
  createSettingsRepository,
  createSrsCardsRepository,
}
export { defaultSettings } from './settings'

export type { AttemptRange, AttemptsRepository } from './attempts'
export type { GameFilter, GamePage, GamesRepository } from './games'
export type { JobsRepository } from './jobs'
export type { KvRepository } from './kv'
export type { LessonsProgressRepository } from './lessons-progress'
export type { MistakeFilter, MistakesRepository } from './mistakes'
export type { MovesRepository } from './moves'
export type { PacksRepository } from './packs'
export type { ProfileRepository } from './profile'
export type { PuzzleSelection, PuzzleStats, PuzzlesRepository } from './puzzles'
export type { RepertoireRepository } from './repertoire'
export type { SessionsRepository } from './sessions'
export type { SettingsRepository } from './settings'
export type { DueQuery, SrsCardsRepository } from './srs-cards'
