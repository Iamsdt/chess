import { z } from 'zod'

import { KV_KEYS, repositories, type GameRow, type Repositories } from '@/data'
import { toTimestamp, type Fen, type GameResult } from '@/domain'
import { themeMastery, type ThemeAttemptRecord } from '@/features/puzzles/mastery'

import { isToolFailure, resolveFen } from './shared'
import { defineTool, type CoachToolGroup } from './types'

/**
 * S21b · Your data (§5): getGameContext, getPlayerProfile, getWeakThemes, findMyGames,
 * findSimilarPositions, getMistakeHistory.
 *
 * Why read-only and capped: these tools hand the user's history to a model on the other end
 * of their own API key. Lists stop at ten rows, and nothing here reads the vault or the
 * coach settings beyond the tone, so a key can never end up in a prompt.
 */

const MAX_ROWS = 10
const MAX_PGN_CHARS = 1_500
const RECENT_ATTEMPTS = 300
const RECENT_GAMES_FOR_OPENINGS = 50
const SIMILARITY_GAMES = 30
const SIMILARITY_FLOOR = 0.6
const DAY_MS = 86_400_000

const PIECE_POINTS: Readonly<Record<string, number>> = { p: 1, n: 3, b: 3, r: 5, q: 9 }

/**
 * Cheap position similarity: how alike the pawn skeletons are, nudged by material.
 *
 * Why pawns: they decide the character of a position (open files, outposts, the plans on
 * offer) and they rarely move, so two positions with the same pawns "feel" alike even when
 * the pieces differ. Score is 70% overlap of pawn squares (Jaccard over both colours) and
 * 30% closeness of non-pawn material, which tells a middlegame from its endgame cousin.
 * A string scan of the FEN, so it stays cheap enough to run over a few thousand positions.
 */
export function positionSimilarity(left: Fen, right: Fen): number {
  const a = signatureOf(left)
  const b = signatureOf(right)
  let shared = 0
  for (const square of a.pawns) if (b.pawns.has(square)) shared += 1
  const union = a.pawns.size + b.pawns.size - shared
  const pawnScore = union === 0 ? 1 : shared / union
  const materialScore = 1 - Math.min(Math.abs(a.points - b.points), 10) / 10
  return 0.7 * pawnScore + 0.3 * materialScore
}

function signatureOf(fen: Fen): { pawns: Set<string>; points: number } {
  const pawns = new Set<string>()
  let points = 0
  const rows = (fen.split(' ')[0] ?? '').split('/')
  rows.forEach((row, rowIndex) => {
    let file = 0
    for (const char of row) {
      const skip = Number(char)
      if (Number.isInteger(skip)) {
        file += skip
        continue
      }
      if (char === 'P' || char === 'p') pawns.add(`${char}${String(file)}${String(rowIndex)}`)
      else points += PIECE_POINTS[char.toLowerCase()] ?? 0
      file += 1
    }
  })
  return { pawns, points }
}

function opponentOf(game: GameRow): string {
  return (game.youPlay === 'white' ? game.black : game.white).name
}

/** The outcome from the user's chair; `*` stays `in progress`. */
function outcomeFor(game: GameRow): 'win' | 'loss' | 'draw' | 'in progress' {
  const result: GameResult = game.result
  if (result === '*') return 'in progress'
  if (result === '1/2-1/2') return 'draw'
  return (result === '1-0') === (game.youPlay === 'white') ? 'win' : 'loss'
}

function gameLine(game: GameRow) {
  return {
    id: game.id,
    date: new Date(game.startedAt).toISOString().slice(0, 10),
    youPlayed: game.youPlay,
    opponent: opponentOf(game),
    outcome: outcomeFor(game),
    opening:
      game.opening === undefined
        ? undefined
        : `${game.opening.eco ?? ''} ${game.opening.name}`.trim(),
    plies: game.plyCount,
    accuracy: game.accuracy?.[game.youPlay],
  }
}

export function createDataTools(repos: Repositories): CoachToolGroup {
  return (env) => ({
    getGameContext: defineTool({
      description:
        'The game or position the user is looking at: the board, the moves so far, the opening, and the latest game in progress or last played.',
      inputSchema: z.object({}),
      execute: async () => {
        const { context } = env
        const recent = await repos.games.listRecent(5)
        const game = recent.find((row) => row.result === '*') ?? recent[0]
        const pgn = context.pgn
        return {
          screen: context.screen,
          position: context.position,
          pgn: pgn === undefined ? undefined : pgn.slice(-MAX_PGN_CHARS),
          game: game === undefined ? undefined : gameLine(game),
          summary:
            context.position === undefined
              ? `on ${context.screen}, no board`
              : `on ${context.screen}, board in view`,
        }
      },
    }),

    getPlayerProfile: defineTool({
      description:
        'Who the user is: ratings, level, goals, streak, daily goal and the openings they play most.',
      inputSchema: z.object({}),
      execute: async () => {
        const [profile, settings, streak, games] = await Promise.all([
          repos.profile.get(),
          repos.settings.get(),
          repos.kv.get(KV_KEYS.streak),
          repos.games.listRecent(RECENT_GAMES_FOR_OPENINGS),
        ])
        const counts = new Map<string, number>()
        for (const game of games) {
          if (game.opening === undefined) continue
          const key = `${game.youPlay}: ${game.opening.name}`
          counts.set(key, (counts.get(key) ?? 0) + 1)
        }
        const openings = [...counts.entries()]
          .sort((x, y) => y[1] - x[1])
          .slice(0, 5)
          .map(([name, played]) => ({ name, played }))
        return {
          name: profile?.displayName,
          level: profile?.skillLevel,
          puzzleRating: profile?.puzzleRating,
          sparringRating: profile?.sparringRating,
          goals: profile?.goals ?? [],
          streakDays: streak?.current ?? 0,
          dailyGoalMinutes: settings.dailyGoalMinutes,
          tone: settings.coach.tone,
          openings,
          summary:
            profile === undefined
              ? 'no profile yet'
              : `puzzles ${String(profile.puzzleRating)} · sparring ${String(profile.sparringRating)}`,
        }
      },
    }),

    getWeakThemes: defineTool({
      description:
        'The themes the user is weakest at, ranked, with how many attempts and mistakes back each one.',
      inputSchema: z.object({ limit: z.number().int().min(1).max(MAX_ROWS).default(5) }),
      execute: async ({ limit }) => {
        const attempts = await repos.attempts.listRecent(RECENT_ATTEMPTS)
        const puzzles = await repos.puzzles.getMany([...new Set(attempts.map((a) => a.puzzleId))])
        const themeOf = new Map(puzzles.map((puzzle) => [puzzle.id, puzzle.theme]))
        const records = attempts.flatMap((attempt): ThemeAttemptRecord[] => {
          const theme = themeOf.get(attempt.puzzleId)
          return theme === undefined
            ? []
            : [
                {
                  theme,
                  solved: attempt.solved,
                  hintUsed: attempt.hintUsed,
                  endedAt: attempt.endedAt,
                },
              ]
        })
        const mistakeCounts = await repos.mistakes.countsByTheme()
        const mistakesBy = new Map(mistakeCounts.map(({ theme, count }) => [theme, count]))
        const themes = themeMastery(records)
          .slice(0, limit)
          .map((entry) => ({
            theme: entry.theme,
            masteryPercent: Math.round(entry.mastery * 100),
            attempts: entry.attempted,
            solved: entry.solved,
            mistakesInBank: mistakesBy.get(entry.theme) ?? 0,
          }))
        return {
          themes,
          mostMistakes: mistakeCounts.slice(0, 3),
          summary:
            themes.length === 0 ? 'no puzzle history yet' : `weakest: ${themes[0]?.theme ?? ''}`,
        }
      },
    }),

    findMyGames: defineTool({
      description:
        'Search the user’s games by opening, opponent, result, how recent and accuracy. At most ten.',
      inputSchema: z.object({
        opening: z.string().min(1).optional().describe('Part of the opening name, or an ECO code.'),
        opponent: z.string().min(1).optional(),
        outcome: z.enum(['win', 'loss', 'draw']).optional(),
        withinDays: z.number().int().min(1).max(3650).optional(),
        minAccuracy: z.number().min(0).max(100).optional(),
        limit: z.number().int().min(1).max(MAX_ROWS).default(MAX_ROWS),
      }),
      execute: async ({ opening, opponent, outcome, withinDays, minAccuracy, limit }) => {
        const rows = await repos.games.list(
          {
            opponent,
            minAccuracy,
            from:
              withinDays === undefined ? undefined : toTimestamp(Date.now() - withinDays * DAY_MS),
          },
          { limit: 200 },
        )
        const needle = opening?.toLowerCase()
        const found = rows
          .filter((row) => outcome === undefined || outcomeFor(row) === outcome)
          .filter(
            (row) =>
              needle === undefined ||
              (row.opening?.name.toLowerCase().includes(needle) ?? false) ||
              row.opening?.eco?.toLowerCase() === needle,
          )
          .slice(0, limit)
        return { games: found.map(gameLine), summary: `${String(found.length)} games` }
      },
    }),

    findSimilarPositions: defineTool({
      description:
        'Positions from the user’s own games that look like this one (same pawn structure, similar material).',
      inputSchema: z.object({
        fen: z.string().optional().describe('Defaults to the position on screen.'),
        limit: z.number().int().min(1).max(5).default(3),
      }),
      execute: async ({ fen, limit }) => {
        const target = resolveFen(env, fen)
        if (isToolFailure(target)) return target
        const games = await repos.games.listRecent(SIMILARITY_GAMES)
        const matches: {
          gameId: string
          opponent: string
          ply: number
          fen: Fen
          score: number
        }[] = []
        for (const game of games) {
          // One best position per game, so a long game cannot crowd out the others.
          let best: (typeof matches)[number] | undefined
          for (const move of await repos.moves.listForGame(game.id)) {
            const score = positionSimilarity(target, move.fenAfter)
            if (score >= SIMILARITY_FLOOR && (best === undefined || score > best.score)) {
              best = {
                gameId: game.id,
                opponent: opponentOf(game),
                ply: move.ply,
                fen: move.fenAfter,
                score,
              }
            }
          }
          if (best !== undefined) matches.push(best)
        }
        const top = matches
          .sort((x, y) => y.score - x.score)
          .slice(0, limit)
          .map((match) => ({ ...match, score: Math.round(match.score * 100) / 100 }))
        return { positions: top, summary: `${String(top.length)} similar` }
      },
    }),

    getMistakeHistory: defineTool({
      description: 'What the user got wrong recently, and whether each one is due for review.',
      inputSchema: z.object({
        theme: z.string().min(1).optional(),
        limit: z.number().int().min(1).max(MAX_ROWS).default(5),
      }),
      execute: async ({ theme, limit }) => {
        const entries = await repos.mistakes.list({ theme, limit })
        const at = Date.now()
        const mistakes = await Promise.all(
          entries.map(async (entry) => {
            const card =
              entry.srsCardId === undefined ? undefined : await repos.srsCards.get(entry.srsCardId)
            return {
              fen: entry.fen,
              played: entry.playedSan,
              best: entry.bestSan,
              quality: entry.quality,
              themes: entry.themes,
              origin: entry.originLabel,
              daysAgo: Math.floor((at - entry.createdAt) / DAY_MS),
              dueForReview:
                card === undefined ? undefined : card.due <= at && card.state !== 'mastered',
              mastered: card?.state === 'mastered',
            }
          }),
        )
        return { mistakes, summary: `${String(mistakes.length)} recent mistakes` }
      },
    }),
  })
}

export const dataTools: CoachToolGroup = createDataTools(repositories)
