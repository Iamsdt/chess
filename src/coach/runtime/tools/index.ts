import type { CoachMode } from '@/domain'

import { actionTools } from './actions'
import { boardTools } from './board'
import { dataTools } from './data'
import { engineTools } from './engine'
import { memoryTools } from './memory'
import { positionTools } from './position'
import { visualizationTools } from './visualization'

import type { CoachToolEnv, CoachToolGroup } from './types'
import type { ToolSet } from 'ai'

export {
  DEFAULT_TOOL_TIMEOUT_MS,
  defineTool,
  type CoachToolEnv,
  type CoachToolGroup,
  type CoachToolOutput,
} from './types'

/**
 * S21b · The tool registry (coach-agent.md §5).
 *
 * Each group lives in its own file and returns its tools keyed by the spec's name. The mode
 * then narrows the set (§3 "Tools it may use"): a tool the mode does not list is never shown
 * to the model, so a puzzle nudger cannot be talked into running `stepThroughLine`.
 */
const GROUPS: readonly CoachToolGroup[] = [
  engineTools,
  positionTools,
  boardTools,
  visualizationTools,
  dataTools,
  actionTools,
  memoryTools,
]

const ENGINE = [
  'analysePosition',
  'evaluateMove',
  'compareMoves',
  'findBestPlan',
  'buildCalculationTree',
]
const POSITION = ['legalMoves', 'playLine', 'positionFacts', 'identifyOpening']
const BOARD = [
  'openSageBoard',
  'showOnBoard',
  'showWhatIf',
  'showThreat',
  'stepThroughLine',
  'handOverMove',
  'clearBoardMarks',
  'openCalculationTree',
  'showControlMap',
]
const VISUALIZATION = [
  'setBoardView',
  'narrateLine',
  'startVisualizationExercise',
  'checkVisualizationAnswer',
  'peekPosition',
  'getVisualizationProfile',
]
const DATA = [
  'getGameContext',
  'getPlayerProfile',
  'getWeakThemes',
  'findMyGames',
  'findSimilarPositions',
  'getMistakeHistory',
]
const ACTIONS = [
  'queuePuzzles',
  'openLesson',
  'addToMistakeBank',
  'startDrill',
  'startVisualizationSet',
  'setTodaysPlan',
  'saveNote',
]
/** Tools that only read: what Open Q&A may use (§3 "any, read-only"). */
const READ_ONLY = [...ENGINE, ...POSITION, ...BOARD, ...VISUALIZATION, ...DATA]

/** `null` means every registered tool. */
export const TOOLS_BY_MODE: Readonly<Record<CoachMode, readonly string[] | null>> = {
  companion: ['evaluateMove', 'getGameContext', 'positionFacts', 'legalMoves'],
  grandmaster: [...ENGINE, ...POSITION, ...BOARD, 'getGameContext', 'getPlayerProfile', 'saveNote'],
  teacher: [...ENGINE, ...POSITION, ...BOARD, ...DATA, ...ACTIONS],
  tutor: ['legalMoves', 'playLine', 'positionFacts', 'showOnBoard', 'openSageBoard', 'openLesson'],
  'puzzle-nudger': [
    'analysePosition',
    'legalMoves',
    'positionFacts',
    'showOnBoard',
    'openSageBoard',
  ],
  visualization: [
    ...VISUALIZATION,
    'legalMoves',
    'playLine',
    'showOnBoard',
    'openSageBoard',
    'startVisualizationSet',
  ],
  planner: [
    ...DATA,
    'queuePuzzles',
    'startDrill',
    'startVisualizationSet',
    'setTodaysPlan',
    'openLesson',
  ],
  'open-qa': READ_ONLY,
  paused: [],
}

export function createCoachTools(env: CoachToolEnv, mode: CoachMode): ToolSet {
  const all: ToolSet = {}
  for (const group of GROUPS) Object.assign(all, group(env))
  const allowed = TOOLS_BY_MODE[mode]
  if (allowed === null) return all
  return Object.fromEntries(Object.entries(all).filter(([name]) => allowed.includes(name)))
}
