import { searchLocal } from './local'
import { searchLive } from './live'
import type { Property } from './types'

/** Two addresses are the same listing if the parcel id or the address matches. */
function keyOf(p: Property): string {
  return p.pid || p.addr.toLowerCase().replace(/\s+/g, ' ')
}

export interface SearchOutcome {
  results: Property[]
  /** True when the citywide query came back empty or failed. */
  liveFailed: boolean
}

/**
 * Records that match instantly are rendered first; the citywide query then
 * appends whatever it adds. Presented to the user as one set of public records.
 */
export function immediateResults(query: string, limit = 25): Property[] {
  return searchLocal(query, limit)
}

/** De-duplicated citywide additions for a query whose fast results are shown. */
export async function appendLiveResults(
  query: string,
  already: Property[],
  limit = 25,
): Promise<SearchOutcome> {
  const seen = new Set(already.map(keyOf))
  // Match on street text too: the same parcel can carry different ids per source.
  const seenAddr = new Set(
    already.map((p) => p.addr.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()),
  )

  let live: Property[] = []
  try {
    live = await searchLive(query, limit)
  } catch {
    live = []
  }

  const added: Property[] = []
  for (const p of live) {
    const norm = p.addr.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
    if (seen.has(keyOf(p)) || seenAddr.has(norm)) continue
    seen.add(keyOf(p))
    seenAddr.add(norm)
    added.push(p)
  }

  return { results: [...already, ...added], liveFailed: live.length === 0 }
}
