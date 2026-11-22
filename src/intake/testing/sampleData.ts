// Invented files for trying the app: for a phone test, a demonstration, or a speed check. Everything in them is made up
// (a made-up region, numbered technicians, numbered areas); nothing comes from a real centre. No imports, so that a
// script can run this file with Node alone.

export interface SampleOptions {
  /** How many cases, 1 to 50,000 (the most the app reads from one file). */
  cases: number
  /** How many technicians, 1 to 1,000. */
  technicians: number
  /** The same seed always gives the same files. */
  seed?: number
  /**
   * Where the cases are scattered (within about 30 km). Default 20, 30: the made-up region of the app's starting base,
   * which is empty desert on a real map. Give the coordinates of your own city to see pins on real streets; the Plan
   * screen then offers "put the base in the middle of my cases" (one tap).
   */
  centerLat?: number
  centerLon?: number
}

export interface SampleFiles {
  /** CSV, with the app's own column names: `case_id,work_type,latitude,longitude,area,reported_at,priority`. No status column: a case with no status can be planned. */
  cases: string
  /** CSV, with the app's own column names: `name,skills,active`. */
  technicians: string
}

const WORK_TYPES = ['Installation', 'Service', 'Breakdown']

function random(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

/**
 * A made-up centre: cases scattered within about 30 km of the app's starting base (20, 30), each work type, and
 * technicians who each do two of the three work types, so that every case can be planned.
 */
export function sampleFiles({ cases, technicians, seed = 1, centerLat = 20, centerLon = 30 }: SampleOptions): SampleFiles {
  if (!(Math.abs(centerLat) <= 90)) throw new Error('centerLat must be a latitude between -90 and 90')
  if (!(Math.abs(centerLon) <= 180)) throw new Error('centerLon must be a longitude between -180 and 180')
  if (!Number.isInteger(cases) || cases < 1) throw new Error('cases must be a whole number of at least 1')
  if (cases > 50_000) throw new Error('cases must be at most 50,000, the most the app reads from one file')
  if (!Number.isInteger(technicians) || technicians < 1) throw new Error('technicians must be a whole number of at least 1')
  if (technicians > 1000) throw new Error('technicians must be at most 1,000')

  const rnd = random(seed)
  const pad = (n: number): string => String(n).padStart(2, '0')
  const caseRows = ['case_id,work_type,latitude,longitude,area,reported_at,priority']
  for (let i = 0; i < cases; i++) {
    const lat = (centerLat + (rnd() - 0.5) * 0.6).toFixed(5)
    const lon = (centerLon + (rnd() - 0.5) * 0.6).toFixed(5)
    const reported = `2026-11-${pad(1 + Math.floor(rnd() * 20))}`
    caseRows.push([100001 + i, WORK_TYPES[Math.floor(rnd() * 3)], lat, lon, `Area ${1 + (i % 12)}`, reported, rnd() < 0.05 ? 'escalated' : 'normal'].join(','))
  }

  const techRows = ['name,skills,active']
  for (let i = 0; i < technicians; i++) {
    const skills = technicians < 3 ? WORK_TYPES : [WORK_TYPES[i % 3], WORK_TYPES[(i + 1) % 3]]
    techRows.push([`Technician ${pad(i + 1)}`, skills.join(';'), 'yes'].join(','))
  }
  return { cases: caseRows.join('\n') + '\n', technicians: techRows.join('\n') + '\n' }
}
