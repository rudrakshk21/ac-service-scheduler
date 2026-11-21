import { t, tn } from '../i18n'
import type { ChangeNote } from './useDemoPlan'

/** "Technician 03 switched off. 27 cases moved." in the language in use. */
export function changeText(c: ChangeNote): string {
  const moved = c.moved === 0 ? t('plan.moved.none') : tn('plan.moved', c.moved)
  return t(c.switchedOn ? 'plan.change.on' : 'plan.change.off', { name: c.techName, moved })
}
