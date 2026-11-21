import { useSyncExternalStore } from 'react'
import { pwaStore, type PwaState } from './register'

/** Whether an update is waiting and whether the app can be installed. */
export function usePwa(): PwaState {
  return useSyncExternalStore(pwaStore.subscribe, pwaStore.getSnapshot)
}
