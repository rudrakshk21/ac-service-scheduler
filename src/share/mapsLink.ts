/** Which kind of link a device can open: `android` hands the stop to the installed maps app, `web` opens Google Maps in the browser. */
export type MapsKind = 'android' | 'web'

/**
 * The kind of link for a device, from its browser's `User-Agent`. Android registers a handler for `geo:` links, so a tap
 * opens the maps app there. A computer has none (Windows and macOS register no `geo:` handler, and a tap does nothing at
 * all) and neither does an iPhone, so they get a web link. When nothing is known, the web link is the safe choice: it
 * opens anywhere that has a browser.
 */
export const mapsKind = (userAgent: string): MapsKind => (/\bAndroid\b/i.test(userAgent) ? 'android' : 'web')

/**
 * The link that opens one stop in a maps app with a pin on it (FR-28.9).
 *
 * On Android, a bare `geo:lat,lon` only centres the map: Google Maps shows no pin for it. A pin comes from the query,
 * `q=lat,lon(label)`. The coordinates are in the path as well, so that a program that reads the standard `geo:` form
 * (RFC 5870) and one that reads the query both find them. Works with no connection: it is the phone's app that draws the map.
 *
 * Anywhere else it is Google's documented Maps URL, which puts a pin at the coordinates in the browser. It needs a connection.
 * It carries the coordinates only: the label holds the case number, which is not sent to a map service.
 */
export function mapsLink(lat: number, lon: number, label: string, kind: MapsKind): string {
  const at = `${lat},${lon}`
  if (kind === 'web') return `https://www.google.com/maps/search/?api=1&query=${at}`
  const text = label.replace(/[()]/g, '').trim()
  return `geo:${at}?q=${at}${text === '' ? '' : `(${encodeURIComponent(text)})`}`
}
