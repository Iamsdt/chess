import { toJobId, toMessageId, toProfileId, toThreadId } from '../ids'
import { toFen, toSan, toSquare, toUci } from '../primitives'
import { SHARE_PAYLOAD_VERSION } from '../share'

import { FIXTURE_NOW, FIXTURE_TIME_ZONE, FIXTURE_TODAY, withOverrides } from './base'
import { makeEngineLine, makeGameMeta } from './chess'

import type { CoachContext, CoachMessage } from '../coach'
import type { Job } from '../jobs'
import type { Profile, Settings, StreakState } from '../profile'
import type {
  ShareAnnotatedGame,
  ShareCorrespondenceMove,
  SharePosition,
  SharePuzzleChallenge,
} from '../share'

const ITALIAN_FEN = 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 w - - 2 7'

export function makeProfile(overrides?: Partial<Profile>): Profile {
  return withOverrides<Profile>(
    {
      id: toProfileId('profile-local'),
      displayName: 'Shudipto',
      skillLevel: 'club',
      puzzleRating: 1482,
      puzzleRatingDeviation: 60.1,
      puzzleRatingVolatility: 0.06,
      sparringRating: 1180,
      goals: ['stop hanging pieces', 'play the Caro-Kann'],
      timeZone: FIXTURE_TIME_ZONE,
      gardenLevel: 4,
      gardenStage: 'sapling',
      onboardingCompletedAt: FIXTURE_NOW,
      createdAt: FIXTURE_NOW,
      updatedAt: FIXTURE_NOW,
    },
    overrides,
  )
}

export function makeSettings(overrides?: Partial<Settings>): Settings {
  return withOverrides<Settings>(
    {
      version: 1,
      theme: 'system',
      dailyGoalMinutes: 15,
      reminderEnabled: true,
      reminderTime: '20:00',
      board: {
        theme: 'green',
        pieceSet: 'california',
        coordinates: true,
        highlightLastMove: true,
        animation: 'normal',
        premoves: false,
        alwaysAskOnPromotion: true,
      },
      sound: {
        moveSounds: true,
        volume: 60,
        style: 'wood',
        lowTimeWarning: true,
        celebrations: false,
      },
      coach: {
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        tone: 'friendly',
        spoilerGuard: true,
        allowEngineLines: true,
        monthlyTokenCap: 500_000,
        hasKey: false,
        passphraseLock: false,
      },
      play: {
        defaultOpponentRating: 1200,
        defaultPersonality: 'solid',
        defaultColor: 'white',
        defaultTimeControl: { kind: 'increment', initialMs: 600_000, incrementMs: 5_000 },
        trainingWheels: true,
        showEvaluation: false,
        allowTakebacks: true,
      },
      updatedAt: FIXTURE_NOW,
    },
    overrides,
  )
}

export function makeStreakState(overrides?: Partial<StreakState>): StreakState {
  return withOverrides<StreakState>(
    {
      current: 12,
      longest: 19,
      lastPracticeDay: FIXTURE_TODAY,
      freezesAvailable: 1,
      freezeEarnedOn: FIXTURE_TODAY,
      freezeDaysUsed: [],
      today: {
        day: FIXTURE_TODAY,
        practisedMs: 660_000,
        goalMs: 900_000,
        pathDone: 2,
        pathTotal: 3,
      },
      updatedAt: FIXTURE_NOW,
    },
    overrides,
  )
}

export function makeJob(overrides?: Partial<Job>): Job {
  return withOverrides<Job>(
    {
      id: toJobId('job-fixture-1'),
      type: 'analyse-game',
      payload: { gameId: 'game-fixture-1', depth: 18 },
      state: 'running',
      priority: 'low',
      attempts: 1,
      maxAttempts: 3,
      progress: 42,
      progressLabel: 'move 31 of 73',
      lastError: null,
      createdAt: FIXTURE_NOW,
      updatedAt: FIXTURE_NOW,
      startedAt: FIXTURE_NOW,
      finishedAt: null,
      nextRunAt: null,
      dedupeKey: 'analyse-game:game-fixture-1',
      lockOwner: 'tab-1',
    },
    overrides,
  )
}

export function makeCoachMessage(overrides?: Partial<CoachMessage>): CoachMessage {
  return withOverrides<CoachMessage>(
    {
      id: toMessageId('message-fixture-1'),
      threadId: toThreadId('thread-fixture-1'),
      role: 'sage',
      text: 'Your knight on f3 is doing more work than it looks. Keep it.',
      status: 'complete',
      createdAt: FIXTURE_NOW,
      attachments: [
        {
          kind: 'position',
          fen: toFen(ITALIAN_FEN),
          orientation: 'white',
          highlight: [toSquare('f3')],
          focus: [],
          arrows: [{ from: toSquare('b1'), to: toSquare('d2'), kind: 'best' }],
          caption: 'Italian Game, move 7',
        },
      ],
      quickReplies: ['Why not Ng5?', 'Show me the line'],
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      usage: { promptTokens: 1_420, completionTokens: 180, estimatedCostUsd: 0.0006 },
    },
    overrides,
  )
}

export function makeCoachContext(overrides?: Partial<CoachContext>): CoachContext {
  return withOverrides<CoachContext>(
    {
      screen: '/play',
      tone: 'friendly',
      spoilerGuard: true,
      allowEngineLines: true,
      position: {
        fen: toFen(ITALIAN_FEN),
        orientation: 'white',
        moveNumber: 7,
        ply: 12,
        lastMove: toSan('O-O'),
      },
      engineLines: [makeEngineLine()],
      recentGames: [makeGameMeta()],
      weakThemes: ['fork', 'back-rank'],
      user: { displayName: 'Shudipto', puzzleRating: 1482, sparringRating: 1180 },
      tokenBudget: 4_000,
    },
    overrides,
  )
}

/** The default share is a position; the other three kinds have their own factory. */
export function makeSharePayload(overrides?: Partial<SharePosition>): SharePosition {
  return withOverrides<SharePosition>(
    {
      v: SHARE_PAYLOAD_VERSION,
      kind: 'position',
      from: { name: 'Shudipto', rating: 1180 },
      at: FIXTURE_NOW,
      fen: toFen(ITALIAN_FEN),
      orientation: 'white',
      highlight: [toSquare('e8'), toSquare('g8')],
      note: 'Should I take on e5 here?',
    },
    overrides,
  )
}

export function makeSharePuzzleChallenge(
  overrides?: Partial<SharePuzzleChallenge>,
): SharePuzzleChallenge {
  return withOverrides<SharePuzzleChallenge>(
    {
      v: SHARE_PAYLOAD_VERSION,
      kind: 'puzzle-challenge',
      from: { name: 'Shudipto', rating: 1550 },
      at: FIXTURE_NOW,
      puzzles: [
        {
          fen: toFen('5r2/p4rk1/1p1p1qpp/3Qb3/2P1N3/6P1/PP2RPKP/R7 b - - 6 21'),
          solution: [toUci('f6f3'), toUci('g2g1'), toUci('f3e2')],
          theme: 'fork',
          rating: 1144,
        },
      ],
      timeSeconds: 72,
      hideTheme: true,
      message: 'Beat 1:12 if you can.',
    },
    overrides,
  )
}

export function makeShareAnnotatedGame(
  overrides?: Partial<ShareAnnotatedGame>,
): ShareAnnotatedGame {
  return withOverrides<ShareAnnotatedGame>(
    {
      v: SHARE_PAYLOAD_VERSION,
      kind: 'annotated-game',
      from: { name: 'Shudipto', rating: 1180 },
      at: FIXTURE_NOW,
      title: 'Tomás vs Stockfish 1400',
      moves: [toUci('e2e4'), toUci('e7e5'), toUci('g1f3')],
      result: '1-0',
      eco: 'C54',
      annotations: [
        { ply: 2, san: toSan('e5'), comment: 'Straight into the Italian.', author: 'sage' },
      ],
    },
    overrides,
  )
}

export function makeShareCorrespondenceMove(
  overrides?: Partial<ShareCorrespondenceMove>,
): ShareCorrespondenceMove {
  return withOverrides<ShareCorrespondenceMove>(
    {
      v: SHARE_PAYLOAD_VERSION,
      kind: 'correspondence-move',
      from: { name: 'Rafi' },
      at: FIXTURE_NOW,
      gameKey: 'rafi-najdorf-01',
      moves: [toUci('e2e4'), toUci('c7c5'), toUci('g1f3'), toUci('d7d6')],
      senderColor: 'black',
      lastMove: toSan('d6'),
      openingName: 'Sicilian Najdorf',
    },
    overrides,
  )
}
