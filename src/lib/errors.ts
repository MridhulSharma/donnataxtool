import { CkanError } from './ckan'

export const isAbort = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError'

/** A message safe to show a resident, with no internals in it. */
export function userMessage(error: unknown): string {
  if (error instanceof CkanError) return error.message
  return 'Something went wrong while reading the city assessment records. Please try again.'
}
