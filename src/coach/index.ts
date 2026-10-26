/**
 * S09 (chat UI) + S21 (providers, crypto) · the Sage coach.
 *
 * The seam is `CoachPort`. Everything exported here is written against it, and
 * nothing here knows — or may learn — which provider answers. S21 implements the
 * port and hands it to `<CoachPanel port={…}>`; not one component changes.
 */

/* The provider seam S21 implements. */
export {
  CoachDeltaSchema,
  CoachError,
  coachErrorMessage,
  GENERIC_COACH_ERROR,
  isCoachError,
  type CoachDelta,
  type CoachPort,
  type CoachSendOptions,
} from './port'

/* The scripted port the panel ships with. */
export {
  createMockCoach,
  DEFAULT_MOCK_SCRIPT,
  type MockCoachOptions,
  type MockCoachReply,
} from './mock-coach'

/* The scripted replies for every Sage feature, and the modes the panel shows. */
export { SHOWCASE_SCRIPT } from './showcase-script'
export { DECISION_MODE_MIN_PROB, defaultModeFor, MODE_INFO, modeFromDecision } from './modes'

/* Thread state: streaming, cancellation, retry, history. */
export {
  applyCoachDelta,
  useCoach,
  type CoachStatus,
  type CoachThreadSummary,
  type UseCoachOptions,
  type UseCoachResult,
} from './use-coach'

/* Per-screen opening threads, ported from the prototype. */
export {
  COACH_SEED_SCREENS,
  NEW_THREAD_GREETING,
  seedThreadFor,
  type CoachSeedScreen,
  type CoachSeedThread,
} from './seeds'

/* S21 · the real runtime: providers, key vault, AI SDK port, usage meter. */
export { createAiSdkCoach, toModelMessages, type CoachRuntimeConfig } from './runtime/ai-sdk-port'
export { createLanguageModel, type CoachModelConfig } from './runtime/create-model'
export { toCoachError, type ErrorContext } from './runtime/errors'
export { listModels, testConnection, type ConnectionResult, type ModelInfo } from './runtime/models'
export {
  defaultModelFor,
  effectiveBaseUrl,
  isConfigured,
  normalizeBaseUrl,
  PROVIDER_LIST,
  PROVIDER_PRESETS,
  providerLabel,
  providerPreset,
  type ProviderPreset,
  type ProviderSdkKind,
  type SuggestedModel,
} from './runtime/providers'
export { buildSystemPrompt, estimateTokens, modeForContext } from './runtime/system-prompt'
export { createCoachTools } from './runtime/tools'
export {
  assertUnderCap,
  monthKey,
  readMonthUsage,
  recordUsage,
  useCoachUsage,
  type CoachMonthUsage,
  type CoachUsageMeter,
} from './runtime/usage'
export { useCoachPort, type CoachPortHandle } from './runtime/use-coach-port'
export {
  DECISION_BUDGET_MS,
  toCoachDecision,
  withDecision,
  type WithDecisionOptions,
} from './runtime/with-decision'
export { useVaultStatus } from './runtime/use-vault-status'
export {
  createVault,
  isVaultLockedError,
  MIN_PASSPHRASE_LENGTH,
  vault,
  VaultCorruptError,
  VaultLockedError,
  VaultPassphraseError,
  type Vault,
  type VaultStatus,
} from './runtime/vault'

/* The panel S04 mounts, and the pieces a feature may want on its own. */
export { CoachPanel, type CoachContextBase, type CoachPanelProps } from './components/coach-panel'
export { CoachComposer, type CoachComposerProps } from './components/coach-composer'
export {
  CoachThread,
  VIRTUALIZE_AFTER_ROWS,
  type CoachThreadProps,
} from './components/coach-thread'
export { MessageBubble, type MessageBubbleProps } from './components/message-bubble'
export { AttachmentCard, type AttachmentCardProps } from './components/attachment-card'
export { PositionPreview, type PositionPreviewProps } from './components/position-preview'
export { CoachMarkdown, type CoachMarkdownProps } from './components/coach-markdown'
export { ModeChip } from './components/mode-chip'
export { DecisionChip, type DecisionChipProps } from './components/decision-chip'
export { MemorySheet } from './components/memory-sheet'
export { AttachmentView } from './components/attachment-view'
export { TypingIndicator } from './components/typing-indicator'

/* Pure helpers, useful to S21's context builder and to tests. */
export {
  coachMarkdownToPlainText,
  parseCoachMarkdown,
  type CoachBlock,
  type CoachSpan,
} from './markdown'
export {
  formatMessageTime,
  groupMessagesByDay,
  type CoachDayGroup,
  type GroupMessagesOptions,
} from './time'
export { newMessageId, newThreadId } from './ids'
