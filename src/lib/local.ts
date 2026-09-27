import rows from '../data/local.json'
import type { CompactRow, Property } from './types'

/** Widen the compact rows into the shared shape, once, on first use. */
let cache: Property[] | null = null

export function localRecords(): Property[] {
  if (cache) return cache
  cache = (rows as CompactRow[]).map((r) => ({
    pid: r.p ?? '',
    addr: r.a,
    la: r.la,
    yr: r.yr,
    lv: r.lv,
    bv: r.bv,
    tv: r.tv,
    gt: r.gt,
    sp: r.sp,
    sd: r.sd,
    ex: r.ex,
    o: r.o,
    lu: r.lu,
    src: 'local' as const,
  }))
  return cache
}

/**
 * Instant substring match on the address, ranked by where the match falls —
 * a hit at the start of the address beats one in the middle.
 */
export function searchLocal(query: string, limit = 25): Property[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []

  const scored: { rec: Property; at: number }[] = []
  for (const rec of localRecords()) {
    const at = rec.addr.toLowerCase().indexOf(q)
    if (at !== -1) scored.push({ rec, at })
  }

  scored.sort((x, y) => x.at - y.at || x.rec.addr.localeCompare(y.rec.addr, 'en', { numeric: true }))
  return scored.slice(0, limit).map((s) => s.rec)
}

export function findLocalByPid(pid: string): Property | null {
  return localRecords().find((r) => r.pid === pid) ?? null
}

/** The worked example the page opens on: a real, genuinely over-assessed parcel. */
export const EXAMPLE_PID = '2201050000'
export const EXAMPLE_LABEL = '3 Westford St, Allston'

export function exampleProperty(): Property | null {
  const byPid = findLocalByPid(EXAMPLE_PID)
  if (byPid) return byPid
  // If the dataset is ever re-extracted and the PID moves, match on the address.
  return localRecords().find((r) => /^3 WESTFORD ST\b/i.test(r.addr)) ?? null
}
