import { useContext } from 'react'

import { ChatPanelContext, type ChatPanelValue } from './shell-contexts'

/** Reads and drives the Sage panel. Throws outside `<AppShell>` so a component that
 *  assumes a panel fails at first render rather than quietly doing nothing. */
export function useChatPanel(): ChatPanelValue {
  const value = useContext(ChatPanelContext)
  if (!value) throw new Error('useChatPanel must be used inside <AppShell>')
  return value
}
