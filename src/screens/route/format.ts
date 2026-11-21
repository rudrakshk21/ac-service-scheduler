import { formatDate } from '../../i18n'

/** `Sunday, 22 November 2026` for `2026-11-22`, in the language in use. The date is read as written, not moved by the time zone. */
export function longDate(iso: string): string {
  const at = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(at.getTime())) return iso
  return formatDate(at, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** `21 Nov 2026, 14:05` for the time a pack was made, in the time zone of the reader. */
export function madeText(iso: string): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return iso
  return formatDate(at, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
