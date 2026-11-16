/**
 * Boston publishes one assessment table per fiscal year, and the column names
 * drift between years. Observed in the live datastore:
 *
 *   FY2026  TOTAL_VALUE  LAND_VALUE  BLDG_VALUE  ZIP_CODE  LIVING_AREA
 *   FY2019  AV_TOTAL     AV_LAND     AV_BLDG     ZIPCODE   LIVING_AREA
 *   FY2004  FY2004_TOTAL FY200_ LAND FY2004_BLDG ZIPCODE   'LIVING _AREA'
 *
 * Note the stray space in `LIVING _AREA` and in `FY200_ LAND`. Every column is
 * also typed as text, so values arrive as "193,800" and " $10,203.96 ".
 *
 * So a record is never read by literal key: keys are normalised (uppercased,
 * everything non-alphanumeric dropped) and fields resolved through an alias
 * list, with a pattern for the year-stamped columns that cannot be listed.
 */

export type DatastoreRecord = Record<string, unknown>

/** `'LIVING _AREA'` and `'living_area'` both normalise to `LIVINGAREA`. */
export const normalizeKey = (key: string): string => key.toUpperCase().replace(/[^A-Z0-9]/g, '')

/** A record with its keys normalised, so aliases resolve cheaply. */
export type FieldIndex = ReadonlyMap<string, unknown>

export function indexRecord(record: DatastoreRecord): FieldIndex {
  const index = new Map<string, unknown>()
  for (const [key, value] of Object.entries(record)) {
    const normalized = normalizeKey(key)
    // First key wins, so an exact column is never shadowed by a duplicate.
    if (!index.has(normalized)) index.set(normalized, value)
  }
  return index
}

const isPresent = (value: unknown) =>
  value !== null && value !== undefined && String(value).trim() !== ''

/**
 * Resolve a field by trying each alias in order, then, for year-stamped
 * columns like `FY2004_TOTAL` that cannot be enumerated, any key matching
 * `pattern`.
 */
export function pickField(
  index: FieldIndex,
  aliases: readonly string[],
  pattern?: RegExp,
): unknown {
  for (const alias of aliases) {
    const value = index.get(normalizeKey(alias))
    if (isPresent(value)) return value
  }
  if (pattern) {
    for (const [key, value] of index) {
      if (pattern.test(key) && isPresent(value)) return value
    }
  }
  return undefined
}

/** Parses "193,800", " $10,203.96 " and 2704.6; null for anything else. */
export function parseNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  const cleaned = String(raw).replace(/[$,\s]/g, '')
  if (cleaned === '' || cleaned === '-') return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

export function parseText(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null
  const trimmed = String(raw).trim()
  return trimmed === '' ? null : trimmed
}
