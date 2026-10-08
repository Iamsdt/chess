import type { CoachAttachment } from '@/domain'

import { CalculationCard } from '../calculation/calculation-card'
import { SageBoardCard } from '../sage-board/sage-board-card'
import { VisualizationCard } from '../visualization/visualization-card'

import { ActionCard } from './action-card'
import { HintsCard } from './hints-card'
import { ThinkingCard } from './thinking-card'
import { ToolChips } from './tool-chips'

/**
 * Every attachment kind except the plain position card, which `AttachmentCard` draws.
 *
 * Why one switch: a bubble should not grow a branch per kind, and an unknown kind must
 * render nothing rather than crash a thread that a newer version of the app wrote.
 */
export function AttachmentView({
  attachment,
}: {
  readonly attachment: Exclude<CoachAttachment, { kind: 'position' }>
}) {
  switch (attachment.kind) {
    case 'board':
      return <SageBoardCard attachment={attachment} />
    case 'calculation':
      return <CalculationCard attachment={attachment} />
    case 'visualization':
      return <VisualizationCard attachment={attachment} />
    case 'tool':
      return <ToolChips tools={[attachment]} />
    case 'thinking':
      return <ThinkingCard attachment={attachment} />
    case 'action':
      return <ActionCard attachment={attachment} />
    case 'hints':
      return <HintsCard attachment={attachment} />
    default:
      return null
  }
}
