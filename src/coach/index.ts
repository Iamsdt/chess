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
