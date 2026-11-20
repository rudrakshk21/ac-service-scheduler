import { normaliseName, type Kind, type StatusAction } from './model'

/** A saved mapping of one file layout to the common model. It holds no case data (requirements: privacy rules). */
export interface MappingProfile {
  profileVersion: 1
  name: string
  kind: Kind
  /** Hash of the normalised column headers: the same layout gets the same profile without questions. */
  fingerprint: string
  sheet?: string
  headerRow?: number
  formats: {
    encoding?: string
    delimiter?: string
    dateOrder?: 'dmy' | 'mdy' | 'ymd'
    decimal?: '.' | ','
  }
  /** Field name to the source column headers that feed it (several for a location or for skills). */
  columns: Record<string, string[]>
  valueMaps: {
    /** Normalised source value to a site work type name. */
    workType: Record<string, string>
    status: Record<string, StatusAction>
    /** Normalised source value to a site priority level name. */
    priority: Record<string, string>
    /** Normalised source value to a site skill name. */
    skill: Record<string, string>
  }
  /** Used when the file has no category column. */
  singleWorkType?: string
}

/** FNV-1a 32-bit hash of the normalised headers, as 8 hex digits. */
export function fingerprintOf(headers: string[]): string {
  const text = headers.map(normaliseName).join('|')
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}
