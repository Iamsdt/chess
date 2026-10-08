import { WifiOff } from 'lucide-react'

import { useOnline } from './use-online'

/**
 * A small notice for features that need a network (opening explorer, game imports, the AI
 * coach). Renders nothing while online, so a feature can drop it in unconditionally.
 */
export function OnlineOnlyNotice({ feature }: { readonly feature: string }) {
  const online = useOnline()
  if (online) return null
  return (
    <p
      role="status"
      className="inline-flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-xs text-muted-foreground"
    >
      <WifiOff aria-hidden className="size-3.5" />
      {feature} needs a connection. Everything else keeps working offline.
    </p>
  )
}
