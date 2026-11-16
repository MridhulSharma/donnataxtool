/**
 * The records held locally: one neighbourhood, in much more depth than the
 * citywide extract carries. Sales, condition, lot size and parcel locations
 * all come from here, and they are what make a sales-based valuation possible.
 */
import { loadLocal, loadSales, type Vintage } from '../data'
import type { Property, Sale } from './types'

export type { Vintage }

/** Everything held locally, loaded once. */
export async function localRecords(): Promise<Property[]> {
  return (await loadLocal()).records
}

export async function localVintage(): Promise<Vintage> {
  return (await loadLocal()).vintage
}

export async function findLocalByPid(pid: string): Promise<Property | null> {
  return (await loadLocal()).byPid.get(pid) ?? null
}

/** True when a ZIP is one this build carries deep records for. */
export async function isLocalZip(zip: string | null | undefined): Promise<boolean> {
  if (!zip) return false
  return (await loadLocal()).vintage.zips.includes(zip)
}

/**
 * Instant substring match on the address, ranked by where the match falls:
 * a hit at the start of the address beats one in the middle.
 */
export async function searchLocal(query: string, limit = 25): Promise<Property[]> {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []

  const { records } = await loadLocal()
  const scored: { record: Property; at: number }[] = []
  for (const record of records) {
    const at = record.addr.toLowerCase().indexOf(q)
    if (at !== -1) scored.push({ record, at })
  }

  scored.sort(
    (x, y) =>
      x.at - y.at || x.record.addr.localeCompare(y.record.addr, 'en', { numeric: true }),
  )
  return scored.slice(0, limit).map((s) => s.record)
}

/** Every recorded transfer of one parcel, newest first. */
export async function salesFor(pid: string): Promise<Sale[]> {
  return (await loadSales()).get(pid) ?? []
}

/** Every transfer in the local set, by parcel. */
export async function allSales(): Promise<Map<string, Sale[]>> {
  return loadSales()
}

/**
 * The worked example the page opens on.
 *
 * It is a real parcel, chosen because its record shows what the tool is for:
 * an assessment well above the neighbourhood rate per square foot, a remodel
 * on file that helps explain the jump, and a nominal transfer in its sale
 * history that a naive reading would mistake for a market price. The estimate
 * it produces is whatever the evidence supports, not a guaranteed finding.
 */
export const EXAMPLE_PID = '2201050000'
export const EXAMPLE_LABEL = '3 Westford St, Allston'

export async function exampleProperty(): Promise<Property | null> {
  const byPid = await findLocalByPid(EXAMPLE_PID)
  if (byPid) return byPid
  // If the dataset is re-extracted and the parcel id moves, match the address.
  const records = await localRecords()
  return records.find((r) => /^3 WESTFORD ST\b/i.test(r.addr)) ?? null
}
