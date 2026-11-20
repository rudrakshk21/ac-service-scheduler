/** Python-compatible number helpers, so that the port rounds exactly like the reference engine. */

/** Python's round(x) for floats: a value exactly halfway goes to the nearest even integer. */
export function pyRound(x: number): number {
  const isHalf = Math.abs(x % 1) === 0.5
  const r = isHalf ? 2 * Math.round(x / 2) : Math.round(x)
  return r === 0 ? 0 : r // never -0
}

/** Python's int(x): truncate toward zero. */
export function pyInt(x: number): number {
  const r = Math.trunc(x)
  return r === 0 ? 0 : r
}

/** Python's a % n for n > 0: the result is never negative. */
export function pyMod(a: number, n: number): number {
  return ((a % n) + n) % n
}

function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n)
}

/** Python's hm(minutes): clock text such as "09:05", from minutes after midnight. */
export function formatClock(minutes: number): string {
  const t = pyRound(minutes)
  return pad2(pyMod(Math.floor(t / 60), 24)) + ':' + pad2(pyMod(t, 60))
}
