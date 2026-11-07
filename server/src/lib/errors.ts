export class HttpError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export const badRequest = (message = 'Bad request', details?: unknown) =>
  new HttpError(400, 'bad_request', message, details)
export const unauthorized = (message = 'Authentication required', code = 'unauthorized') =>
  new HttpError(401, code, message)
export const forbidden = (message = 'Forbidden', code = 'forbidden') => new HttpError(403, code, message)
export const notFound = (message = 'Not found') => new HttpError(404, 'not_found', message)
export const conflict = (message = 'Conflict') => new HttpError(409, 'conflict', message)
