import { makeCoachContext, now as nowTimestamp, toMessageId, toThreadId } from '@/domain'
import type { CoachMessage } from '@/domain'

import { CoachPanel } from '../components/coach-panel'
import { CoachThread } from '../components/coach-thread'
import { createMockCoach } from '../mock-coach'

import type { CoachContextBase } from '../components/coach-panel'
import type { ReactNode } from 'react'

/**
 * Every state the prototype's chat panel can be in, side by side.
 *
 * Why a gallery rather than screenshots in a doc: "every prototype chat state
 * renders from the mock" is the sprint's merge gate, and the only honest way to
 * check it is to put all of them on one page in both themes. S04 mounts this at
 * `/dev/coach` next to S02's kitchen sink.
 */

const { spoilerGuard: _spoilerGuard, allowEngineLines: _engine, ...BASE } = makeCoachContext()
const CONTEXT: CoachContextBase = BASE

function Frame({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="eyebrow">{title}</h2>
      <div className="flex h-[620px] w-[400px] overflow-hidden rounded-2xl border">{children}</div>
    </section>
  )
}

function longThread(count: number): readonly CoachMessage[] {
  const threadId = toThreadId('thread-gallery-long')
  const at = nowTimestamp()
  return Array.from({ length: count }, (_, index) => ({
    id: toMessageId(`message-gallery-${String(index)}`),
    threadId,
    role: index % 2 === 0 ? ('user' as const) : ('sage' as const),
    text:
      index % 2 === 0
        ? `Question ${String(index)}: why did that move lose material?`
        : `Because the **knight on f3** was the only defender. Play \`Re1\` first next time.`,
    status: 'complete' as const,
    createdAt: at,
    attachments: [],
    quickReplies: [],
  }))
}

export function CoachGallery() {
  return (
    <div className="flex flex-wrap gap-8 p-8">
      <Frame title="Seeded thread · home">
        <CoachPanel context={CONTEXT} seedScreen="home" attachmentLabel="Today's plan" />
      </Frame>

      <Frame title="No spoilers · puzzle">
        <CoachPanel context={CONTEXT} seedScreen="puzzle" attachmentLabel="Current position" />
      </Frame>

      <Frame title="Game review">
        <CoachPanel context={CONTEXT} seedScreen="review" />
      </Frame>

      <Frame title="Lists · learn">
        <CoachPanel context={CONTEXT} seedScreen="learn" />
      </Frame>

      <Frame title="Quiet during play · note banner">
        <CoachPanel
          context={CONTEXT}
          seedScreen="play"
          note={<span>Training wheels are on. Sage only speaks up before a blunder.</span>}
        />
      </Frame>

      <Frame title="Empty · no seed">
        <CoachPanel context={CONTEXT} contextSummary="nothing yet" />
      </Frame>

      <Frame title="No key">
        <CoachPanel context={CONTEXT} hasKey={false} />
      </Frame>

      <Frame title="Loading context">
        <CoachPanel context={CONTEXT} seedScreen="home" loading />
      </Frame>

      <Frame title="Error · ask anything to see retry">
        <CoachPanel
          context={CONTEXT}
          quickReplies={['Show me the error state']}
          port={createMockCoach({
            thinkingMs: 200,
            script: [{ text: '', failWith: 'Sage could not reach your provider just now.' }],
          })}
        />
      </Frame>

      <Frame title="Long thread · virtualized">
        <div className="flex min-h-0 flex-1 flex-col bg-card">
          <CoachThread messages={longThread(80)} status="idle" threadLabel="Everything so far" />
        </div>
      </Frame>
    </div>
  )
}
