import { useEffect, useState } from 'react'

import { vault, type Vault, type VaultStatus } from './vault'

/**
 * Whether a passphrase is set and whether this session has unlocked it.
 *
 * Why a hook over the vault's subscribe: lock state is not in the database that live queries
 * watch (the derived key is memory-only by design), so the vault tells us when it changes.
 * `undefined` until the first read, so "not yet known" is never read as "unlocked".
 */
export function useVaultStatus(target: Vault = vault): VaultStatus | undefined {
  const [status, setStatus] = useState<VaultStatus | undefined>(undefined)

  useEffect(() => {
    let live = true
    const read = (): void => {
      void target.status().then((next) => {
        if (live) setStatus(next)
      })
    }
    read()
    const unsubscribe = target.subscribe(read)
    return () => {
      live = false
      unsubscribe()
    }
  }, [target])

  return status
}
