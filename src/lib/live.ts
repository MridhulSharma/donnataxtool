/**
 * Live citywide records from Analyze Boston's CKAN datastore.
 *
 * Two things make this fiddly, and both are handled defensively:
 *   1. The resource id changes every assessment year, so it is discovered at
 *      runtime rather than hardcoded.
 *   2. Column names drift year to year (PID vs PARCEL_ID, TOTAL_VALUE vs
 *      AV_TOTAL, ...), so every field is read through a list of candidates.
 *
 * Every call degrades to an empty result instead of throwing. A live outage
 * must never take the rest of the page down with it.
 */
import type { Property } from './types'

const BASE = 'https://data.boston.gov/api/3/action/'
const PACKAGE_ID = 'property-assessment'
const TIMEOUT_MS = 12_000

type Row = Record<string, unknown>

async function getJson<T>(url: string): Promise<T | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/* ------------------------------------------------------------------ *
 * Resource discovery
 * ------------------------------------------------------------------ */

interface CkanResource {
  id?: string
  name?: string
  datastore_active?: boolean
}

let resourcePromise: Promise<string | null> | null = null

/** Highest 4-digit year mentioned in a resource name, or -1 if none. */
function yearIn(name: string): number {
  const years = name.match(/\b(19|20)\d{2}\b/g)
  if (!years) return -1
  return Math.max(...years.map(Number))
}

async function discoverResourceId(): Promise<string | null> {
  const pkg = await getJson<{ result?: { resources?: CkanResource[] } }>(
    `${BASE}package_show?id=${encodeURIComponent(PACKAGE_ID)}`,
  )
  const resources = pkg?.result?.resources
  if (!Array.isArray(resources)) return null

  const active = resources.filter((r) => r?.datastore_active === true && typeof r.id === 'string')
  if (active.length === 0) return null

  // Prefer the most recent assessment year; fall back to the first active one.
  let best: CkanResource | null = null
  let bestYear = -Infinity
  for (const r of active) {
    const y = yearIn(String(r.name ?? ''))
    if (y > bestYear) {
      bestYear = y
      best = r
    }
  }
  return (best ?? active[0]).id ?? null
}

/** Cached for the life of the page; retried on a later call if it failed. */
export function resourceId(): Promise<string | null> {
  if (!resourcePromise) {
    resourcePromise = discoverResourceId().then((id) => {
      if (!id) resourcePromise = null // allow a retry
      return id
    })
  }
  return resourcePromise
}

/* ------------------------------------------------------------------ *
 * Defensive field mapping
 * ------------------------------------------------------------------ */

const F = {
  pid: ['PID', 'PARCEL_ID'],
  stNum: ['ST_NUM'],
  stName: ['ST_NAME'],
  city: ['CITY'],
  zip: ['ZIP_CODE', 'ZIPCODE'],
  living: ['LIVING_AREA', 'LIVING_AREA_SF', 'GROSS_AREA'],
  year: ['YR_BUILT', 'YEAR_BUILT'],
  bldg: ['BLDG_VALUE', 'AV_BLDG'],
  land: ['LAND_VALUE', 'AV_LAND'],
  total: ['TOTAL_VALUE', 'AV_TOTAL', 'TOTAL_VAL'],
  tax: ['GROSS_TAX'],
  owner: ['OWNER'],
  use: ['LU_DESC', 'LU'],
  unit: ['UNIT_NUM'],
} as const

/** Read the first candidate key that is actually present and non-empty. */
function pick(row: Row, keys: readonly string[]): string | null {
  for (const k of keys) {
    // Column casing is not guaranteed either.
    const v = row[k] ?? row[k.toLowerCase()]
    if (v !== null && v !== undefined && String(v).trim() !== '') return String(v).trim()
  }
  return null
}

/** Values arrive as "$1,234,500.00" as often as 1234500. */
function toNum(raw: string | null): number | null {
  if (raw === null) return null
  const cleaned = raw.replace(/[$,\s]/g, '')
  if (cleaned === '' || cleaned === '-') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? Math.round(n) : null
}

const nz = (n: number | null): number | null => (n !== null && n > 0 ? n : null)

function address(row: Row): string | null {
  const num = pick(row, F.stNum)
  const name = pick(row, F.stName)
  const unit = pick(row, F.unit)
  const city = pick(row, F.city)

  const street = [num, name].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
  if (!street) return null

  const withUnit = unit && unit !== '0' ? `${street} #${unit}` : street
  return city ? `${withUnit}, ${city}` : withUnit
}

export function mapRow(row: Row): Property | null {
  const pid = pick(row, F.pid)
  const addr = address(row)
  const tv = toNum(pick(row, F.total))
  // Without an id, an address, or a value the record is not usable.
  if (!pid || !addr || !tv || tv <= 0) return null

  return {
    pid,
    addr,
    la: nz(toNum(pick(row, F.living))),
    yr: nz(toNum(pick(row, F.year))),
    lv: toNum(pick(row, F.land)),
    bv: toNum(pick(row, F.bldg)),
    tv,
    gt: nz(toNum(pick(row, F.tax))),
    sp: null, // the citywide assessment extract carries no sale price
    sd: null,
    ex: null,
    o: pick(row, F.owner),
    lu: pick(row, F.use),
    src: 'live' as const,
    zip: zipOf(row),
  }
}

function mapRows(rows: unknown): Property[] {
  if (!Array.isArray(rows)) return []
  const out: Property[] = []
  const seen = new Set<string>()
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue
    const p = mapRow(r as Row)
    if (p && !seen.has(p.pid)) {
      seen.add(p.pid)
      out.push(p)
    }
  }
  return out
}

/* ------------------------------------------------------------------ *
 * Queries
 * ------------------------------------------------------------------ */

interface SearchResponse {
  result?: { records?: unknown }
}

/** Free-text search across the citywide dataset. */
export async function searchLive(query: string, limit = 25): Promise<Property[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const id = await resourceId()
  if (!id) return []

  const url =
    `${BASE}datastore_search?resource_id=${encodeURIComponent(id)}` +
    `&q=${encodeURIComponent(q)}&limit=${limit}`
  const json = await getJson<SearchResponse>(url)
  return mapRows(json?.result?.records)
}

/** Every record in a ZIP, used as the comp pool for a live subject property. */
export async function liveByZip(zip: string, limit = 1000): Promise<Property[]> {
  const z = zip.trim()
  if (!/^\d{5}$/.test(z)) return []
  const id = await resourceId()
  if (!id) return []

  // CKAN wants the filter object urlencoded. Try both ZIP spellings, since the
  // column name changes between years.
  for (const key of ['ZIP_CODE', 'ZIPCODE']) {
    const filters = encodeURIComponent(JSON.stringify({ [key]: z }))
    const url =
      `${BASE}datastore_search?resource_id=${encodeURIComponent(id)}` +
      `&filters=${filters}&limit=${limit}`
    const json = await getJson<SearchResponse>(url)
    const rows = mapRows(json?.result?.records)
    if (rows.length > 0) return rows
  }
  return []
}

/** Pull the ZIP back out of a live record so we can fetch its comp pool. */
export function zipOf(row: Row | null | undefined): string | null {
  if (!row) return null
  const z = pick(row, F.zip)
  if (!z) return null
  const m = /\d{5}/.exec(z)
  return m ? m[0] : null
}
