import type { Ctx } from './context'
import { recalc, travelOf, type Route } from './route'

/**
 * Puts the stops of a route in the shortest order: an exact search (Held-Karp) up to 10 stops,
 * 2-opt improvement above that. Ends by recalculating the route.
 */
export function orderRoute(ctx: Ctx, r: Route): void {
  const n = r.stops.length
  if (n < 2) {
    recalc(ctx, r)
    return
  }
  const tm = ctx.geo.tm
  if (n <= 10) {
    const nodes = r.stops.map((c) => ctx.caseNode[c])
    const full = 1 << n
    const dp = new Float64Array(full * n).fill(Infinity)
    const par = new Int8Array(full * n).fill(-1)
    for (let j = 0; j < n; j++) dp[(1 << j) * n + j] = tm[0][nodes[j]]
    for (let m = 1; m < full; m++) {
      for (let j = 0; j < n; j++) {
        if (!((m >> j) & 1)) continue
        const dj = dp[m * n + j]
        if (dj === Infinity) continue
        for (let k = 0; k < n; k++) {
          if ((m >> k) & 1) continue
          const nm = m | (1 << k)
          const v = dj + tm[nodes[j]][nodes[k]]
          if (v < dp[nm * n + k]) {
            dp[nm * n + k] = v
            par[nm * n + k] = j
          }
        }
      }
    }
    let best = Infinity
    let bj = 0
    for (let j = 0; j < n; j++) {
      const v = dp[(full - 1) * n + j] + tm[nodes[j]][0]
      if (v < best) {
        best = v
        bj = j
      }
    }
    const seq: number[] = []
    let mask = full - 1
    let cur = bj
    while (cur !== -1) {
      seq.push(r.stops[cur])
      const p = par[mask * n + cur]
      mask &= ~(1 << cur)
      cur = p
    }
    seq.reverse()
    r.stops = seq
  } else {
    let imp = true
    let guard = 0
    while (imp && guard < 200) {
      guard += 1
      imp = false
      const cur = travelOf(ctx, r.stops)
      for (let i = 0; i < n - 1; i++) {
        if (imp) break
        for (let j = i + 1; j < n; j++) {
          const t = [...r.stops]
          const seg = t.slice(i, j + 1).reverse()
          t.splice(i, seg.length, ...seg)
          const v = travelOf(ctx, t)
          if (v < cur - 1e-6) {
            r.stops = t
            imp = true
            break
          }
        }
      }
    }
  }
  recalc(ctx, r)
}
