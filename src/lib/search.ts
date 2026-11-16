import { searchLive } from './live'
import { searchLocal } from './local'
import type { Property } from './types'

/** Two records are the same listing when the parcel id or the address matches. */
function keyOf(p: Property): string {
  return p.pid || p.addr.toLowerCase().replace(/\s+/g, ' ')
}

const normalizeAddress = (addr: string) =>
  addr
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

export interface SearchOutcome {
  results: Property[]
  /** Set when the citywide query could not be run. */
  liveError: string | null
  /** Fiscal year the citywide records came from, when it answered. */
  liveFiscalYear: number | null
}

/** Records held locally match instantly, so they are rendered first. */
export async function immediateResults(query: string, limit = 25): Promise<Property[]> {
  return searchLocal(query, limit)
}

/**
 * Citywide additions for a query whose fast results are already on screen,
 * de-duplicated against them.
 */
export async function appendLiveResults(
  query: string,
  already: Property[],
  signal?: AbortSignal,
): Promise<SearchOutcome> {
  const seen = new Set(already.map(keyOf))
  // Match on street text too: the same parcel can carry different ids.
  const seenAddr = new Set(already.map((p) => normalizeAddress(p.addr)))

  let live: Property[] = []
  let liveError: string | null = null
  let liveFiscalYear: number | null = null
  try {
    const outcome = await searchLive(query, signal)
    live = outcome.properties
    liveFiscalYear = outcome.resource.fiscalYear
  } catch (error) {
    if (signal?.aborted) throw error
    const { userMessage } = await import('./errors')
    liveError = userMessage(error)
  }

  const added: Property[] = []
  for (const property of live) {
    const normalized = normalizeAddress(property.addr)
    if (seen.has(keyOf(property)) || seenAddr.has(normalized)) continue
    seen.add(keyOf(property))
    seenAddr.add(normalized)
    added.push(property)
  }

  return { results: [...already, ...added], liveError, liveFiscalYear }
}
