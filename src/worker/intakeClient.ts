import { currentLanguage } from '../i18n'
import { IntakeError } from '../intake/errors'
import type { Imported } from '../intake/map/apply'
import type { MappingProfile } from '../intake/map/profile'
import type { ReadOptions, SourceTable } from '../intake/read'
import type { SiteProfile } from '../intake/site/site'
import type { IntakeReply, IntakeRequest } from './intakeHandler'

/** Work on a file in a worker, so that a large file never freezes the screen (SEC-4). */
export interface IntakeJob<T> {
  /** The answer. Rejects with an `IntakeError` for a problem with the file, and with `IntakeCancelled` after `cancel()`. */
  result: Promise<T>
  /** Stops the work now. */
  cancel: () => void
}

/** What a job's `result` rejects with after `cancel()`. */
export class IntakeCancelled extends Error {
  constructor() {
    super('The work was stopped.')
    this.name = 'IntakeCancelled'
  }
}

function start<T>(request: IntakeRequest, pick: (reply: IntakeReply & { ok: true }) => T): IntakeJob<T> {
  const worker = new Worker(new URL('./intake.worker.ts', import.meta.url), { type: 'module' })
  let cancel: () => void = () => {}
  const result = new Promise<T>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<IntakeReply>) => {
      worker.terminate()
      const reply = e.data
      if (reply.ok) resolve(pick(reply))
      else reject(reply.error.name === 'IntakeError' && reply.error.code !== undefined ? new IntakeError(reply.error.code, reply.error.message) : new Error(reply.error.message))
    }
    worker.onerror = (e) => {
      worker.terminate()
      reject(new Error(e.message))
    }
    cancel = () => {
      worker.terminate()
      reject(new IntakeCancelled())
    }
    worker.postMessage(request)
  })
  return { result, cancel: () => cancel() }
}

/** Reads a file into a table in a worker. The bytes are copied, so the caller can read the same file again with other options. */
export function startRead(data: Uint8Array, name: string, options: ReadOptions): IntakeJob<SourceTable> {
  return start({ op: 'read', language: currentLanguage(), data, name, options }, (r) => (r.op === 'read' ? r.table : failed()))
}

/** Applies a mapping to every row of a table in a worker. */
export function startApply(table: SourceTable, profile: MappingProfile, site: SiteProfile, importDate: string): IntakeJob<Imported> {
  return start({ op: 'apply', language: currentLanguage(), table, profile, site, importDate }, (r) => (r.op === 'apply' ? r.imported : failed()))
}

function failed(): never {
  throw new Error('The worker answered a different question.')
}
