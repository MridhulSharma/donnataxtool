/**
 * Citywide records from Analyze Boston, mapped into the shape the rest of the
 * app uses.
 *
 * Two rules hold here, and both exist because getting them wrong produces a
 * comparison that looks fine and is not:
 *
 *   - The comparable pool is the WHOLE ZIP, paged, filtered server-side to
 *     the subject's own land-use class. A first page of a thousand rows is a
 *     biased sample, not a small one.
 *   - Living area and gross area are different measurements and are never
 *     mixed. Which one a record carries travels with it.
 */
import {
  datastoreSearch,
  datastoreSearchAll,
  resolveAssessmentResource,
  type AssessmentResource,
  type DatastoreField,
  type DatastoreResult,
} from './ckan'
import {
  indexRecord,
  normalizeKey,
  parseNumber,
  parseText,
  pickField,
  type DatastoreRecord,
  type FieldIndex,
} from './fields'
import type { AreaSource, Property } from './types'

// Alias lists run most-recent-schema first. See ./fields for the drift.
const ALIASES = {
  parcelId: ['PID', 'PARCEL_ID', 'GIS_ID', 'CM_ID'],
  streetNumber: ['ST_NUM'],
  streetAlpha: ['ST_ALPHA'],
  streetName: ['ST_NAME'],
  streetSuffix: ['ST_NAME_SUF', 'ST_NAME_SFX'],
  unit: ['UNIT_NUM'],
  fullAddress: ['full_address'],
  city: ['CITY'],
  zip: ['ZIP_CODE', 'ZIPCODE'],
  landUse: ['LU'],
  landUseDescription: ['LU_DESC'],
  livingArea: ['LIVING_AREA', 'LIVING_AREA_SF'],
  grossArea: ['GROSS_AREA'],
  landArea: ['LAND_SF', 'LAND_AREA'],
  yearBuilt: ['YR_BUILT', 'YEAR_BUILT'],
  yearRemodel: ['YR_REMODEL'],
  bedrooms: ['BED_RMS'],
  fullBath: ['FULL_BTH'],
  halfBath: ['HLF_BTH'],
  units: ['RES_UNITS'],
  condition: ['OVERALL_COND'],
  totalValue: ['TOTAL_VALUE', 'AV_TOTAL', 'TOTAL_VAL'],
  landValue: ['LAND_VALUE', 'AV_LAND'],
  buildingValue: ['BLDG_VALUE', 'AV_BLDG'],
  grossTax: ['GROSS_TAX'],
  exemption: ['RESIDENTIAL_EXEMPTION', 'RES_EXEMPTION'],
} as const

// Year-stamped columns (FY2004_TOTAL, 'FY200_ LAND') cannot be listed, so
// they are matched by shape once the key has been normalised.
const VALUE_PATTERNS = {
  totalValue: /^FY\d+TOTAL$/,
  landValue: /^FY\d+LAND$/,
  buildingValue: /^FY\d+BLDG$/,
} as const

function composeAddress(index: FieldIndex): string | null {
  const full = parseText(pickField(index, ALIASES.fullAddress))
  const city = parseText(pickField(index, ALIASES.city))
  const unit = parseText(pickField(index, ALIASES.unit))

  let street: string | null = full
  if (!street) {
    const number = parseText(pickField(index, ALIASES.streetNumber))
    const alpha = parseText(pickField(index, ALIASES.streetAlpha))
    const name = parseText(pickField(index, ALIASES.streetName))
    const suffix = parseText(pickField(index, ALIASES.streetSuffix))

    // FY2026's ST_NAME already ends in the suffix ("Lexington ST"); older
    // years keep it separate. Only append when it is not already there.
    let road = name ?? suffix
    if (name && suffix && !normalizeKey(name).endsWith(normalizeKey(suffix))) {
      road = `${name} ${suffix}`
    }
    const houseNumber = number && alpha ? `${number}${alpha}` : number
    street = [houseNumber, road].filter(Boolean).join(' ').trim() || null
  }
  if (!street) return null

  const withUnit = unit && unit !== '0' ? `${street} #${unit}` : street
  return city ? `${withUnit}, ${city}` : withUnit
}

const CONDITION_CODES = ['P', 'F', 'A', 'G', 'VG', 'E'] as const

function conditionOf(index: FieldIndex): Property['cond'] {
  const raw = parseText(pickField(index, ALIASES.condition))
  if (!raw) return null
  const code = raw.split('-')[0].trim().toUpperCase()
  if (code === 'EX') return 'E'
  return (CONDITION_CODES as readonly string[]).includes(code)
    ? (code as Property['cond'])
    : null
}

const positive = (n: number | null): number | null => (n !== null && n > 0 ? n : null)

export function mapRow(record: DatastoreRecord, fiscalYear: number): Property | null {
  const index = indexRecord(record)

  const pid = parseText(pickField(index, ALIASES.parcelId))
  const addr = composeAddress(index)
  const tv = parseNumber(pickField(index, ALIASES.totalValue, VALUE_PATTERNS.totalValue))
  // Without an id, an address or a value the record cannot be used.
  if (!pid || !addr || tv === null || tv <= 0) return null

  const living = positive(parseNumber(pickField(index, ALIASES.livingArea)))
  const gross = positive(parseNumber(pickField(index, ALIASES.grossArea)))
  let la: number | null = null
  let areaSrc: AreaSource | null = null
  if (living !== null) {
    la = living
    areaSrc = 'living'
  } else if (gross !== null) {
    la = gross
    areaSrc = 'gross'
  }

  const fullBath = parseNumber(pickField(index, ALIASES.fullBath)) ?? 0
  const halfBath = parseNumber(pickField(index, ALIASES.halfBath)) ?? 0
  const baths = fullBath + halfBath > 0 ? fullBath + halfBath * 0.5 : null

  const exemption = parseNumber(pickField(index, ALIASES.exemption))

  return {
    pid,
    addr,
    zip: zipOf(index),
    la,
    areaSrc,
    yr: positive(parseNumber(pickField(index, ALIASES.yearBuilt))),
    lv: parseNumber(pickField(index, ALIASES.landValue, VALUE_PATTERNS.landValue)),
    bv: parseNumber(pickField(index, ALIASES.buildingValue, VALUE_PATTERNS.buildingValue)),
    tv,
    gt: positive(parseNumber(pickField(index, ALIASES.grossTax))),
    ex: exemption === null ? null : exemption > 0 ? 1 : 0,
    lu: parseText(pickField(index, ALIASES.landUse)),
    luDesc: parseText(pickField(index, ALIASES.landUseDescription)),
    fy: fiscalYear,
    src: 'live',
    lot: positive(parseNumber(pickField(index, ALIASES.landArea))),
    cond: conditionOf(index),
    remodel: positive(parseNumber(pickField(index, ALIASES.yearRemodel))),
    beds: positive(parseNumber(pickField(index, ALIASES.bedrooms))),
    baths,
    units: positive(parseNumber(pickField(index, ALIASES.units))),
    // The citywide extract carries no geometry.
    lat: null,
    lon: null,
    ownerOcc: null,
  }
}

/** Pull the ZIP out of a record, whichever column holds it. */
function zipOf(index: FieldIndex): string | null {
  const raw = parseText(pickField(index, ALIASES.zip))
  if (!raw) return null
  const match = /\d{5}/.exec(raw)
  return match ? match[0] : null
}

function mapRows(records: DatastoreRecord[], fiscalYear: number): Property[] {
  const out: Property[] = []
  const seen = new Set<string>()
  for (const record of records) {
    const property = mapRow(record, fiscalYear)
    if (property && !seen.has(property.pid)) {
      seen.add(property.pid)
      out.push(property)
    }
  }
  return out
}

/* ------------------------------------------------------------------ *
 * Column resolution for server-side filters
 * ------------------------------------------------------------------ */

/**
 * `filters` has to name a column exactly as this year's table spells it, so
 * the real column ids are read once and the canonical names mapped onto them.
 */
interface ColumnMap {
  zip: string | null
  landUse: string | null
  /**
   * The real ids of the columns actually read, for the projection. Empty
   * means "ask for everything", the safe answer when a total-value column
   * cannot be confirmed in the list.
   */
  projection: string[]
}

const columnMaps = new Map<string, ColumnMap>()

function resolveColumns(fields: DatastoreField[]): ColumnMap {
  const byNormalized = new Map(fields.map((field) => [normalizeKey(field.id), field.id]))
  const find = (aliases: readonly string[]) => {
    for (const alias of aliases) {
      const actual = byNormalized.get(normalizeKey(alias))
      if (actual) return actual
    }
    return null
  }

  const wanted = new Set<string>()
  if (byNormalized.has('ID')) wanted.add('_id')
  for (const aliases of Object.values(ALIASES)) {
    const actual = find(aliases)
    if (actual) wanted.add(actual)
  }
  for (const field of fields) {
    const key = normalizeKey(field.id)
    if (Object.values(VALUE_PATTERNS).some((pattern) => pattern.test(key))) wanted.add(field.id)
  }

  const projection = [...wanted]
  // Projecting away the total value would break every estimate in silence,
  // so only narrow the request once that column is visible in the list.
  const hasTotalValue = projection.some((id) => {
    const key = normalizeKey(id)
    return (
      ALIASES.totalValue.some((alias) => normalizeKey(alias) === key) ||
      VALUE_PATTERNS.totalValue.test(key)
    )
  })

  return {
    zip: find(ALIASES.zip),
    landUse: find(ALIASES.landUse),
    projection: hasTotalValue ? projection : [],
  }
}

function noteSchema(resource: AssessmentResource, result: DatastoreResult): void {
  if (result.fields.length > 0) {
    columnMaps.set(resource.resourceId, resolveColumns(result.fields))
  }
}

async function columnsFor(
  resource: AssessmentResource,
  signal?: AbortSignal,
): Promise<ColumnMap> {
  const known = columnMaps.get(resource.resourceId)
  if (known) return known

  // One-record probe, so a filtered query can name its column correctly.
  const probe = await datastoreSearch({ resourceId: resource.resourceId, limit: 1 }, signal)
  noteSchema(resource, probe)
  return columnMaps.get(resource.resourceId) ?? { zip: null, landUse: null, projection: [] }
}

/* ------------------------------------------------------------------ *
 * Queries
 * ------------------------------------------------------------------ */

const SEARCH_LIMIT = 25

export interface LiveSearch {
  resource: AssessmentResource
  properties: Property[]
}

/** Free-text address search across the citywide table. */
export async function searchLive(query: string, signal?: AbortSignal): Promise<LiveSearch> {
  const trimmed = query.trim()
  const resource = await resolveAssessmentResource(signal)
  if (trimmed.length < 2) return { resource, properties: [] }

  const result = await datastoreSearch(
    { resourceId: resource.resourceId, q: trimmed, limit: SEARCH_LIMIT },
    signal,
  )
  noteSchema(resource, result)
  return { resource, properties: mapRows(result.records, resource.fiscalYear) }
}

/**
 * The cohort is fetched whole. Boston's largest ZIP holds roughly 16,000
 * parcels, so this ceiling covers every one of them with room to spare; it
 * exists to bound a pathological response, not to trim a real ZIP.
 */
const COHORT_MAX_RECORDS = 20_000
const COHORT_PAGE_SIZE = 5000

export interface Cohort {
  pool: Property[]
  /** Whether the pool is the subject's own land-use class or the whole ZIP. */
  scope: 'same-land-use' | 'zip-wide'
  /** False when the ZIP exceeded the ceiling and the pool was cut short. */
  complete: boolean
}

/**
 * Candidate comparables from the subject's ZIP, before the size and age
 * window is applied. A per-square-foot comparison only means something within
 * a property class, so the default scope is the subject's own land use; the
 * caller widens when that yields too few to work with.
 */
export async function fetchLiveCohort(
  subject: Property,
  options: { widen?: boolean } = {},
  signal?: AbortSignal,
): Promise<Cohort> {
  if (!subject.zip) return { pool: [], scope: 'zip-wide', complete: true }

  const resource = await resolveAssessmentResource(signal)
  const columns = await columnsFor(resource, signal)
  if (!columns.zip) return { pool: [], scope: 'zip-wide', complete: true }

  const useLandUse = !options.widen && Boolean(columns.landUse && subject.lu)
  const filters: Record<string, string> = { [columns.zip]: subject.zip }
  if (useLandUse && columns.landUse && subject.lu) filters[columns.landUse] = subject.lu

  const result = await datastoreSearchAll(
    {
      resourceId: resource.resourceId,
      filters,
      fields: columns.projection.length > 0 ? columns.projection : undefined,
    },
    { pageSize: COHORT_PAGE_SIZE, maxRecords: COHORT_MAX_RECORDS },
    signal,
  )
  noteSchema(resource, result)

  return {
    pool: mapRows(result.records, resource.fiscalYear).filter(
      (property) => property.pid !== subject.pid,
    ),
    scope: useLandUse ? 'same-land-use' : 'zip-wide',
    complete: result.complete,
  }
}
