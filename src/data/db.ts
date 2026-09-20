import Dexie, { type Table } from 'dexie'

import type {
  AttemptId,
  ContentPack,
  GameId,
  Job,
  JobId,
  LessonId,
  MistakeEntry,
  MistakeId,
  MoveRecord,
  PackId,
  Profile,
  ProfileId,
  Puzzle,
  PuzzleAttempt,
  PuzzleId,
  RepertoireNode,
  RepertoireNodeId,
  SessionId,
  SrsCard,
  SrsCardId,
} from '@/domain'

import { applyMigrations, CURRENT_DB_VERSION } from './migrations'

import type { GameRow, KvRow, LessonProgress, PracticeSession, SettingsRow } from './schema'

/**
 * The one Dexie instance.
 *
 * Nothing outside `src/data` imports this file — ESLint blocks `@/features` and
 * `@/app` from it, and the repositories are the only sanctioned way in. Each
 * table is typed with the domain shape it stores and the key type it is indexed
 * by, so a `PuzzleId` cannot be handed to `games.get`.
 */
export const DB_NAME = 'chessking'

export class ChessKingDb extends Dexie {
  readonly games: Table<GameRow, GameId>
  /** Keyed by `[gameId+ply]`: the move list is a range scan of its own key. */
  readonly moves: Table<MoveRecord, [GameId, number]>
  readonly puzzles: Table<Puzzle, PuzzleId>
  readonly attempts: Table<PuzzleAttempt, AttemptId>
  readonly srsCards: Table<SrsCard, SrsCardId>
  readonly mistakes: Table<MistakeEntry, MistakeId>
  readonly packs: Table<ContentPack, PackId>
  readonly lessonsProgress: Table<LessonProgress, LessonId>
  readonly repertoire: Table<RepertoireNode, RepertoireNodeId>
  readonly sessions: Table<PracticeSession, SessionId>
  readonly jobs: Table<Job, JobId>
  readonly settings: Table<SettingsRow, string>
  readonly profile: Table<Profile, ProfileId>
  readonly kv: Table<KvRow, string>

  constructor(name: string = DB_NAME, upTo: number = CURRENT_DB_VERSION) {
    super(name)
    applyMigrations(this, upTo)
    this.games = this.table('games')
    this.moves = this.table('moves')
    this.puzzles = this.table('puzzles')
    this.attempts = this.table('attempts')
    this.srsCards = this.table('srsCards')
    this.mistakes = this.table('mistakes')
    this.packs = this.table('packs')
    this.lessonsProgress = this.table('lessonsProgress')
    this.repertoire = this.table('repertoire')
    this.sessions = this.table('sessions')
    this.jobs = this.table('jobs')
    this.settings = this.table('settings')
    this.profile = this.table('profile')
    this.kv = this.table('kv')
  }
}

/** The instance every repository binds to at module load. */
export const db = new ChessKingDb()

/**
 * Open a database at a chosen schema version.
 *
 * Why it is exported: this is the migration test harness. A test opens a
 * uniquely named database at version 1, writes the rows an old build wrote,
 * closes it, then reopens the same name with no `upTo` so Dexie runs the real
 * upgrade path. Production never passes `upTo`.
 */
export function createDb(name: string, upTo: number = CURRENT_DB_VERSION): ChessKingDb {
  return new ChessKingDb(name, upTo)
}
