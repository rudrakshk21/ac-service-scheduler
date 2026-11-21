import { useSyncExternalStore } from 'react'
import { localeCode, subscribe } from './index'

/** The code of the language in use. The component runs again when the language changes. */
export function useLocale(): string {
  return useSyncExternalStore(subscribe, localeCode)
}
