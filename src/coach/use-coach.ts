import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'

import {
  assertValid,
  now as nowTimestamp,
  type CoachMessage,
  type MessageId,
  type CoachContext,
  type ThreadId,
  type Timestamp,
} from '@/domain'

import { newMessageId, newThreadId } from './ids'
import { coachErrorMessage, CoachDeltaSchema, type CoachDelta, type CoachPort } from './port'
import { NEW_THREAD_GREETING, type CoachSeedThread } from './seeds'

/**
 * The thread state machine behind the panel.
 *
 * Why the component does not own this: streaming, cancellation and retry are the
 * only genuinely hard parts of a chat UI, and they are far easier to trust when
 * they are a reducer plus one async loop that can be tested without a panel
 * around them. The hook knows nothing about providers — only about a `CoachPort`.
 *
 * The seed is read once, at mount. A screen that changes which thread it opens
 * with remounts the panel under a new `key`; nothing silently rewrites a thread
 * the user is in the middle of.
 */

export type CoachStatus = 'idle' | 'thinking' | 'streaming' | 'error'

/** One row of the chat history list. */
export interface CoachThreadSummary {
  readonly id: ThreadId
  /** The first thing the user said, or the screen label for a seeded thread. */
  readonly title: string
  readonly updatedAt: Timestamp
  readonly messageCount: number
}

interface StoredThread {
  readonly id: ThreadId
  readonly label: string | undefined
  readonly messages: readonly CoachMessage[]
}

interface CoachState {
  readonly threadId: ThreadId
  /** The reply currently being streamed. Guards a stale stream from settling the new one. */
  readonly activeId: MessageId | null
  readonly label: string | undefined
  readonly messages: readonly CoachMessage[]
  readonly status: CoachStatus
  readonly error: string | null
  readonly archive: readonly StoredThread[]
}

type CoachAction =
  | { readonly type: 'start'; readonly user: CoachMessage; readonly placeholder: CoachMessage }
  | { readonly type: 'delta'; readonly id: MessageId; readonly delta: CoachDelta }
  | { readonly type: 'settle'; readonly id: MessageId }
  | { readonly type: 'fail'; readonly id: MessageId; readonly message: string }
  | { readonly type: 'retry'; readonly id: MessageId }
  | { readonly type: 'newThread'; readonly thread: StoredThread }
  | { readonly type: 'openThread'; readonly id: ThreadId }

/** Why a pure function: applying a delta is the one place a reply's shape changes. */
export function applyCoachDelta(message: CoachMessage, delta: CoachDelta): CoachMessage {
  switch (delta.kind) {
    case 'text':
      return { ...message, text: message.text + delta.text, status: 'streaming' }
    case 'attachment':
      return { ...message, attachments: [...message.attachments, delta.attachment] }
    case 'quickReplies':
      return { ...message, quickReplies: [...delta.replies] }
    case 'usage':
      return {
        ...message,
        usage: delta.usage,
        ...(delta.provider === undefined ? {} : { provider: delta.provider }),
        ...(delta.model === undefined ? {} : { model: delta.model }),
      }
  }
}

function replace(
  messages: readonly CoachMessage[],
  id: MessageId,
  update: (message: CoachMessage) => CoachMessage,
): readonly CoachMessage[] {
  return messages.map((message) => (message.id === id ? update(message) : message))
}

function reducer(state: CoachState, action: CoachAction): CoachState {
  switch (action.type) {
    case 'start':
      return {
        ...state,
        messages: [...state.messages, action.user, action.placeholder],
        activeId: action.placeholder.id,
        status: 'thinking',
        error: null,
      }
    case 'delta':
      return {
        ...state,
        messages: replace(state.messages, action.id, (message) =>
          applyCoachDelta(message, action.delta),
        ),
        status:
          action.id === state.activeId && action.delta.kind === 'text' ? 'streaming' : state.status,
      }
    case 'settle':
      return {
        ...state,
        // A cancelled reply keeps whatever arrived: stopping is not a failure.
        messages: replace(state.messages, action.id, (message) => ({
          ...message,
          status: 'complete',
        })),
        ...(action.id === state.activeId
          ? { activeId: null, status: 'idle' as const, error: null }
          : {}),
      }
    case 'fail':
      return {
        ...state,
        messages: replace(state.messages, action.id, (message) => ({
          ...message,
          status: 'error',
          error: action.message,
        })),
        ...(action.id === state.activeId
          ? { status: 'error' as const, error: action.message }
          : {}),
      }
    case 'retry':
      return {
        ...state,
        messages: replace(state.messages, action.id, (message) => ({
          ...message,
          text: '',
          status: 'pending',
          attachments: [],
          quickReplies: [],
          error: undefined,
        })),
        activeId: action.id,
        status: 'thinking',
        error: null,
      }
    case 'newThread': {
      const keep = state.messages.length > 0
      return {
        threadId: action.thread.id,
        activeId: null,
        label: action.thread.label,
        messages: action.thread.messages,
        status: 'idle',
        error: null,
        archive: keep
          ? [
              { id: state.threadId, label: state.label, messages: state.messages },
              ...state.archive.filter((thread) => thread.id !== state.threadId),
            ]
          : state.archive,
      }
    }
    case 'openThread': {
      const target = state.archive.find((thread) => thread.id === action.id)
      if (target === undefined) return state
      return {
        threadId: target.id,
        activeId: null,
        label: target.label,
        messages: target.messages,
        status: 'idle',
        error: null,
        archive: [
          { id: state.threadId, label: state.label, messages: state.messages },
          ...state.archive.filter((thread) => thread.id !== target.id),
        ],
      }
    }
  }
}

export interface UseCoachOptions {
  readonly port: CoachPort
  /** Rebuilt by the screen on every render; the hook reads the latest on send. */
  readonly context: CoachContext
  readonly seed?: CoachSeedThread | undefined
  /** Injected in tests so timestamps and day dividers are deterministic. */
  readonly now?: (() => Timestamp) | undefined
}

export interface UseCoachResult {
  readonly threadId: ThreadId
  /** The seed's screen label, used for the first day divider. */
  readonly threadLabel: string | undefined
  readonly messages: readonly CoachMessage[]
  readonly status: CoachStatus
  /** One calm sentence, or `null`. Mirrors the errored message's own `error`. */
  readonly error: string | null
  readonly canRetry: boolean
  readonly threads: readonly CoachThreadSummary[]
  readonly send: (text: string) => void
  readonly retry: () => void
  readonly cancel: () => void
  readonly newThread: () => void
  readonly openThread: (id: ThreadId) => void
}

function summarise(thread: StoredThread): CoachThreadSummary {
  const firstUser = thread.messages.find((message) => message.role === 'user')
  const last = thread.messages[thread.messages.length - 1]
  return {
    id: thread.id,
    title: firstUser?.text ?? thread.label ?? 'New chat',
    updatedAt: last?.createdAt ?? nowTimestamp(),
    messageCount: thread.messages.length,
  }
}

export function useCoach(options: UseCoachOptions): UseCoachResult {
  const { port, seed } = options
  const clock = options.now ?? nowTimestamp

  const contextRef = useRef(options.context)
  const portRef = useRef(port)
  const clockRef = useRef(clock)
  const messagesRef = useRef<readonly CoachMessage[]>([])

  /**
   * Why refs and not dependencies: a stream in flight must answer with the
   * newest context and port without `send` changing identity on every render,
   * which would re-create the composer's handlers mid-conversation. They are
   * written after commit, and only ever read from an event handler or the loop.
   */
  useEffect(() => {
    contextRef.current = options.context
    portRef.current = port
    clockRef.current = clock
  })

  const abortRef = useRef<AbortController | null>(null)
  const pendingRef = useRef<{ request: readonly CoachMessage[]; placeholderId: MessageId } | null>(
    null,
  )

  const [state, dispatch] = useReducer(reducer, seed, (initialSeed): CoachState => {
    const threadId = initialSeed?.messages[0]?.threadId ?? newThreadId()
    return {
      threadId,
      activeId: null,
      label: initialSeed?.label,
      messages: initialSeed?.messages ?? [],
      status: 'idle',
      error: null,
      archive: [],
    }
  })

  useEffect(() => {
    messagesRef.current = state.messages
  }, [state.messages])

  const run = useCallback((request: readonly CoachMessage[], placeholderId: MessageId): void => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    pendingRef.current = { request, placeholderId }

    const consume = async (): Promise<void> => {
      try {
        for await (const raw of portRef.current.send(request, contextRef.current, {
          signal: controller.signal,
        })) {
          if (controller.signal.aborted) break
          // Every delta is untrusted: a provider adapter is a boundary like any other.
          const delta = assertValid(CoachDeltaSchema, raw, 'coach reply')
          dispatch({ type: 'delta', id: placeholderId, delta })
        }
        dispatch({ type: 'settle', id: placeholderId })
      } catch (error) {
        if (controller.signal.aborted) {
          dispatch({ type: 'settle', id: placeholderId })
          return
        }
        dispatch({ type: 'fail', id: placeholderId, message: coachErrorMessage(error) })
      }
    }

    void consume()
  }, [])

  const send = useCallback(
    (text: string): void => {
      const trimmed = text.trim()
      if (trimmed === '') return
      const at = clockRef.current()
      const threadId = state.threadId
      const user: CoachMessage = {
        id: newMessageId(),
        threadId,
        role: 'user',
        text: trimmed,
        status: 'complete',
        createdAt: at,
        attachments: [],
        quickReplies: [],
      }
      const placeholder: CoachMessage = {
        id: newMessageId(),
        threadId,
        role: 'sage',
        text: '',
        status: 'pending',
        createdAt: at,
        attachments: [],
        quickReplies: [],
      }
      dispatch({ type: 'start', user, placeholder })
      run([...messagesRef.current, user], placeholder.id)
    },
    [run, state.threadId],
  )

  const retry = useCallback((): void => {
    const pending = pendingRef.current
    if (pending === null) return
    dispatch({ type: 'retry', id: pending.placeholderId })
    run(pending.request, pending.placeholderId)
  }, [run])

  const cancel = useCallback((): void => {
    abortRef.current?.abort()
  }, [])

  const newThread = useCallback((): void => {
    abortRef.current?.abort()
    const id = newThreadId()
    dispatch({
      type: 'newThread',
      thread: {
        id,
        label: 'New chat',
        messages: [
          {
            id: newMessageId(),
            threadId: id,
            role: 'sage',
            text: NEW_THREAD_GREETING,
            status: 'complete',
            createdAt: clockRef.current(),
            attachments: [],
            quickReplies: [],
          },
        ],
      },
    })
  }, [])

  const openThread = useCallback((id: ThreadId): void => {
    abortRef.current?.abort()
    dispatch({ type: 'openThread', id })
  }, [])

  // Leaving the panel must stop the stream, not leave it writing into a dead tree.
  useEffect(() => () => abortRef.current?.abort(), [])

  const threads = useMemo(
    () =>
      [{ id: state.threadId, label: state.label, messages: state.messages }, ...state.archive].map(
        summarise,
      ),
    [state.threadId, state.label, state.messages, state.archive],
  )

  return {
    threadId: state.threadId,
    threadLabel: state.label,
    messages: state.messages,
    status: state.status,
    error: state.error,
    canRetry: state.status === 'error',
    threads,
    send,
    retry,
    cancel,
    newThread,
    openThread,
  }
}
