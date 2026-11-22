/**
 * The link that opens one stop in the phone's maps app with a pin on it (FR-28.9).
 *
 * A bare `geo:lat,lon` only centres the map: Google Maps shows no pin for it. A pin comes from the query,
 * `q=lat,lon(label)`. The coordinates are in the path as well, so that a program that reads the standard `geo:` form
 * (RFC 5870) and one that reads the query both find them. Works with no connection: it is the phone's app that draws the map.
 */
export function mapsLink(lat: number, lon: number, label: string): string {
  const at = `${lat},${lon}`
  const text = label.replace(/[()]/g, '').trim()
  return `geo:${at}?q=${at}${text === '' ? '' : `(${encodeURIComponent(text)})`}`
}
