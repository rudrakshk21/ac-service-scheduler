import { adoptLanguage, currentLanguage } from '../i18n'
import type { IntakeErrorCode } from '../intake/errors'
import { applyProfile, type Imported } from '../intake/map/apply'
import type { MappingProfile } from '../intake/map/profile'
import { readSource, type ReadOptions, type SourceTable } from '../intake/read'
import type { SiteProfile } from '../intake/site/site'

/** The language in use on the page, with its messages: the worker has no page, and the messages it writes are shown on it. */
export type Language = ReturnType<typeof currentLanguage>

/**
 * Work on a file that can take a long time (SEC-4: a file is parsed outside the interface thread): reading it into a
 * table, and applying a mapping to every row.
 */
export type IntakeRequest =
  | { op: 'read'; language: Language; data: Uint8Array; name: string; options: ReadOptions }
  | { op: 'apply'; language: Language; table: SourceTable; profile: MappingProfile; site: SiteProfile; importDate: string }

export type IntakeReply =
  | { ok: true; op: 'read'; table: SourceTable }
  | { ok: true; op: 'apply'; imported: Imported }
  | { ok: false; error: { name: string; code?: IntakeErrorCode; message: string } }

/**
 * The work of the worker, as a plain function so that it can be tested without a browser. It sets the language of
 * the module it runs in, so call it only in a worker (or in a test that puts the language back).
 */
export async function handleIntakeRequest(request: IntakeRequest): Promise<IntakeReply> {
  try {
    adoptLanguage(request.language)
    if (request.op === 'read') return { ok: true, op: 'read', table: await readSource(request.data, request.name, request.options) }
    return { ok: true, op: 'apply', imported: applyProfile(request.table, request.profile, request.site, request.importDate) }
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e))
    const code = (error as { code?: IntakeErrorCode }).code
    return { ok: false, error: { name: error.name, ...(code === undefined ? {} : { code }), message: error.message } }
  }
}
