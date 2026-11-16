/**
 * Client for the Analyze Boston CKAN API.
 *
 * The API sends `access-control-allow-origin: *` and needs no key, so the
 * browser talks to it directly. There is no server side to this app.
 *
 * Two things make it fiddly, and both are handled here rather than at the
 * call sites: the resource id changes every assessment year, so it is
 * discovered at runtime; and a request can fail, so every failure carries a
 * sentence a resident can act on.
 */
import type { DatastoreRecord } from './fields'

const CKAN_ACTION = 'https://data.boston.gov/api/3/action'
const DATASET = 'property-assessment'
const TIMEOUT_MS = 15_000

/** The fiscal-year table being queried, discovered at runtime. */
export interface AssessmentResource {
  resourceId: string
  fiscalYear: number
}

export class CkanError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CkanError'
  }
}

interface CkanEnvelope<T> {
  success: boolean
  result?: T
  error?: { message?: string; __type?: string }
}

/** Aborts on the caller's signal, and on its own timeout. */
function withTimeout(signal: AbortSignal | undefined): {
  signal: AbortSignal
  done: () => void
} {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const onAbort = () => controller.abort(signal?.reason)
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason)
    else signal.addEventListener('abort', onAbort, { once: true })
  }
  return {
    signal: controller.signal,
    done: () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    },
  }
}

async function callAction<T>(
  action: string,
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<T> {
  const url = new URL(`${CKAN_ACTION}/${action}`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)

  const guard = withTimeout(signal)
  let response: Response
  try {
    response = await fetch(url, { signal: guard.signal, headers: { Accept: 'application/json' } })
  } catch (cause) {
    // A caller that walked away is not an error worth reporting.
    if (signal?.aborted) throw cause
    throw new CkanError(
      'Could not reach the City of Boston assessment records. Check your connection and try again.',
    )
  } finally {
    guard.done()
  }

  if (!response.ok) {
    throw new CkanError(
      `The City of Boston assessment records returned an error (HTTP ${response.status}).`,
    )
  }

  const envelope = (await response.json()) as CkanEnvelope<T>
  if (!envelope.success || envelope.result === undefined) {
    throw new CkanError(
      envelope.error?.message ??
        'The City of Boston assessment records returned an unexpected response.',
    )
  }
  return envelope.result
}

/* ------------------------------------------------------------------ *
 * Resource discovery
 * ------------------------------------------------------------------ */

interface PackageResource {
  id: string
  format?: string | null
  name?: string | null
  url?: string | null
  description?: string | null
  created?: string | null
  datastore_active?: boolean | null
}

/**
 * The fiscal year has to be read out of whatever carries it, because `name`
 * is null for most years. Live examples:
 *
 *   fy2026-property-assessment-data_rev.csv        -> 2026
 *   fy2025-property-assessment-data_12_30_2024.csv -> 2025, the maximum
 *   data2021-full.csv                              -> 2021
 *   fy19fullpropassess.csv                         -> no 4-digit year, so the
 *                                                     created date stands in
 */
export function fiscalYearOf(resource: PackageResource, now: Date = new Date()): number | null {
  const haystack = [resource.name, resource.url, resource.description]
    .filter((part): part is string => typeof part === 'string')
    .join(' ')

  const ceiling = now.getFullYear() + 2
  const years = [...haystack.matchAll(/(?:19|20)\d{2}/g)]
    .map((match) => Number(match[0]))
    .filter((year) => year >= 2000 && year <= ceiling)

  if (years.length > 0) return Math.max(...years)

  const createdYear = resource.created ? new Date(resource.created).getFullYear() : Number.NaN
  return Number.isFinite(createdYear) ? createdYear : null
}

const CACHE_KEY = 'donna.assessment-resource.v1'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

function readCache(): AssessmentResource | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cached = JSON.parse(raw) as Partial<AssessmentResource & { cachedAt: number }>
    if (
      typeof cached.resourceId !== 'string' ||
      typeof cached.fiscalYear !== 'number' ||
      typeof cached.cachedAt !== 'number' ||
      Date.now() - cached.cachedAt > CACHE_TTL_MS
    ) {
      return null
    }
    return { resourceId: cached.resourceId, fiscalYear: cached.fiscalYear }
  } catch {
    // Private browsing, blocked storage, or malformed JSON: re-discover.
    return null
  }
}

function writeCache(resource: AssessmentResource): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...resource, cachedAt: Date.now() }))
  } catch {
    // Caching is an optimisation; never let it break a lookup.
  }
}

/** In-flight de-duplication, so a burst of lookups discovers the table once. */
let pending: Promise<AssessmentResource> | null = null

async function discover(): Promise<AssessmentResource> {
  const pkg = await callAction<{ resources?: PackageResource[] }>('package_show', { id: DATASET })

  const candidates = (pkg.resources ?? [])
    .filter((resource) => resource.datastore_active)
    .map((resource) => ({ resourceId: resource.id, fiscalYear: fiscalYearOf(resource) }))
    .filter((entry): entry is AssessmentResource => entry.fiscalYear !== null)

  if (candidates.length === 0) {
    throw new CkanError(
      'No queryable property-assessment table is currently published by the City of Boston.',
    )
  }

  const latest = candidates.reduce((best, entry) =>
    entry.fiscalYear > best.fiscalYear ? entry : best,
  )
  writeCache(latest)
  return latest
}

/**
 * The most recent fiscal-year assessment table, cached in memory for the
 * session and in local storage for a day.
 *
 * `signal` cancels this caller's wait, not the shared discovery request: one
 * component unmounting must not abort discovery for everything else waiting
 * on the same promise.
 */
export function resolveAssessmentResource(signal?: AbortSignal): Promise<AssessmentResource> {
  const cached = readCache()
  if (cached) return Promise.resolve(cached)

  pending ??= discover().catch((error: unknown) => {
    pending = null
    throw error
  })
  const shared = pending
  if (!signal) return shared

  return new Promise<AssessmentResource>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason as Error)
      return
    }
    const onAbort = () => reject(signal.reason as Error)
    signal.addEventListener('abort', onAbort, { once: true })
    shared.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort))
  })
}

/* ------------------------------------------------------------------ *
 * Datastore search
 * ------------------------------------------------------------------ */

export interface DatastoreField {
  id: string
  type: string
}

export interface DatastoreResult {
  total: number
  fields: DatastoreField[]
  records: DatastoreRecord[]
}

export interface DatastoreQuery {
  resourceId: string
  /** Free-text search across all columns. */
  q?: string
  /** Exact column matches, e.g. `{ ZIP_CODE: '02128' }`. */
  filters?: Record<string, string>
  /**
   * Column projection. The assessment table carries around 68 columns and we
   * read about 18, so naming them cuts most of the weight off a cohort fetch.
   */
  fields?: readonly string[]
  limit?: number
  offset?: number
}

export async function datastoreSearch(
  query: DatastoreQuery,
  signal?: AbortSignal,
): Promise<DatastoreResult> {
  const params: Record<string, string> = { resource_id: query.resourceId }
  if (query.q) params.q = query.q
  if (query.filters && Object.keys(query.filters).length > 0) {
    params.filters = JSON.stringify(query.filters)
  }
  if (query.fields && query.fields.length > 0) params.fields = query.fields.join(',')
  if (query.limit !== undefined) params.limit = String(query.limit)
  if (query.offset !== undefined) params.offset = String(query.offset)

  const result = await callAction<Partial<DatastoreResult>>('datastore_search', params, signal)
  return {
    total: result.total ?? 0,
    fields: result.fields ?? [],
    records: result.records ?? [],
  }
}

/** The datastore caps a single page; stay under it and page instead. */
const MAX_PAGE_SIZE = 5000

/**
 * Every record matching a query, paged until the datastore is exhausted.
 *
 * A partial cohort is not a smaller cohort, it is a biased one: row order
 * follows the parcel id, which in Boston runs ward by ward, so a truncated
 * fetch silently compares a home against one corner of its ZIP. The median
 * that comes out of that can land on the wrong side of the subject.
 *
 * `complete` is false only when the match exceeds `maxRecords`, and callers
 * must say so rather than presenting a truncated median as the whole picture.
 */
export async function datastoreSearchAll(
  query: DatastoreQuery,
  limits: { pageSize?: number; maxRecords: number },
  signal?: AbortSignal,
): Promise<DatastoreResult & { complete: boolean }> {
  const pageSize = Math.min(limits.pageSize ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE)
  const records: DatastoreRecord[] = []
  let fields: DatastoreField[] = []
  let total = 0

  for (let offset = 0; offset < limits.maxRecords; offset += pageSize) {
    const page = await datastoreSearch(
      { ...query, limit: Math.min(pageSize, limits.maxRecords - offset), offset },
      signal,
    )
    if (fields.length === 0) fields = page.fields
    total = page.total
    records.push(...page.records)
    // Exhausted the match, or the datastore stopped returning rows.
    if (records.length >= total || page.records.length === 0) break
  }

  return { total, fields, records, complete: records.length >= total }
}
