import { useSyncExternalStore } from 'react'

import { getUpdateState, subscribeUpdateState } from './register'
import { type UpdateState } from './update-flow'

/** The service worker's update phase, for any component that wants to show it. */
export function useUpdateState(): UpdateState {
  return useSyncExternalStore(subscribeUpdateState, getUpdateState, getUpdateState)
}
