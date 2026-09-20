/**
 * S12 · Play vs engine.
 *
 * Two screens (`/play` and `/play/game`) over one pure state machine. The parts
 * other sprints may want are exported below: S28's live game reuses the machine
 * and the clock, and S13 reads the games this feature writes.
 *
 * The prototype pages this ports are `prototype/play-setup.html` and
 * `prototype/play.html`.
 */
export { PlayGameScreen, type PlayGameScreenProps } from './play-game-screen'
export { PlaySetupScreen, type PlaySetupScreenProps } from './play-setup-screen'

export {
  checkMoveForBlunder,
  describeGuardWarning,
  EMPTY_GUARD_CONTEXT,
  type GuardContext,
  type GuardReason,
  type GuardWarning,
} from './blunder-guard'

export {
  applyMoveToClock,
  createClock,
  flaggedAt,
  formatClock,
  formatTimeControl,
  isLowTime,
  LOW_TIME_MS,
  remainingAt,
  rewindClock,
  startClock,
  stopClock,
  type ClockState,
} from './clock'

export {
  AUTOMATIC_HALFMOVE_CLOCK,
  AUTOMATIC_REPETITION,
  buildLegalMoveMap,
  canTakeBack,
  checkedKingSquare,
  claimableDrawOf,
  createPlayState,
  isEnginesTurn,
  isYourTurn,
  playReducer,
  promotesOn,
  type ClockPair,
  type DrawOfferState,
  type PlayConfig,
  type PlayEvent,
  type PlayPhase,
  type PlayState,
} from './machine'

export {
  createSavedGame,
  defaultPlayStorage,
  findResumableGameId,
  loadResumableGame,
  resumePlayState,
  saveGame,
  toGame,
  toGameMeta,
  toMoveRecords,
  toPgn,
  type PlayStorage,
  type ResumeOptions,
} from './persistence'

export {
  defaultAnalysisQueue,
  defaultEnginePort,
  defaultPlayPorts,
  PlayPortsContext,
  usePlayPorts,
  type AnalysisQueuePort,
  type EnginePort,
  type PlayPorts,
} from './ports'

export { createSoundPlayer, soundForMove, type PlaySound, type SoundPlayer } from './sounds'

export {
  chooseOpponentMove,
  expectedScore,
  HANGING_THRESHOLD_CP,
  OPPONENT_RATING_MAX,
  OPPONENT_RATING_MIN,
  OPPONENT_RATING_STEP,
  planStrength,
  respondToDrawOffer,
  strengthBand,
  STRENGTH_ANCHORS,
  type EngineStrengthPlan,
  type StrengthAnchor,
  type StrengthBand,
} from './strength'

export {
  usePlayGame,
  type PlayGameActions,
  type PlayGameController,
  type PlayLoadState,
  type ReviewQueueState,
} from './use-play-game'
