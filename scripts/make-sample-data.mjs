// Writes invented sample files for trying the app (for instance on a phone), into the folder sample-data/.
// Usage: npm run sample-data -- [--cases 300] [--technicians 20] [--seed 1] [--out sample-data] [--lat 22.57 --lon 88.36]
// Everything in the files is made up. 300 cases and 20 technicians is the size NFR-1 is written for. Without --lat and
// --lon the cases lie in the made-up region of the app's starting base (empty desert on a real map); with them they are
// scattered within about 30 km of that point, to see pins on real streets.
// (Node strips the types of the imported .ts file itself.)
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { sampleFiles } from '../src/intake/testing/sampleData.ts'

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const at = args.indexOf(`--${name}`)
  return at >= 0 && args[at + 1] !== undefined ? args[at + 1] : fallback
}

try {
  const cases = Number(option('cases', 300))
  const technicians = Number(option('technicians', 20))
  const seed = Number(option('seed', 1))
  const out = option('out', 'sample-data')
  const centerLat = args.includes('--lat') ? Number(option('lat', 20)) : undefined
  const centerLon = args.includes('--lon') ? Number(option('lon', 30)) : undefined
  const files = sampleFiles({ cases, technicians, seed, centerLat, centerLon })
  await mkdir(out, { recursive: true })
  await writeFile(join(out, 'technicians.csv'), files.technicians)
  await writeFile(join(out, 'cases.csv'), files.cases)
  console.log(`Wrote ${out}/technicians.csv (${technicians} technicians) and ${out}/cases.csv (${cases} cases).`)
  console.log('Import the technicians first, then the cases. Both are invented.')
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e))
  process.exit(1)
}
