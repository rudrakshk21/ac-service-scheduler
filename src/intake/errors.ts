export type IntakeErrorCode =
  | 'not_a_data_file'
  | 'empty_file'
  | 'unsupported_format'
  | 'no_case_id_column'
  | 'bad_profile'
  | 'bad_site'
  | 'unreadable'

/** A problem the user caused with a file or a profile. The message is plain language and names what is wrong. */
export class IntakeError extends Error {
  readonly code: IntakeErrorCode

  constructor(code: IntakeErrorCode, message: string) {
    super(message)
    this.name = 'IntakeError'
    this.code = code
  }
}
