/**
 * Build step: read the local assessment database and write the payloads the
 * app loads at runtime.
 *
 *   npm run data
 *
 * Three files are written into src/data/, each loaded separately so the first
 * paint does not wait for data it does not need yet:
 *
 *   parcels.json   core record per parcel, used for search and comparison
 *   sales.json     arm's-length-screened transfers, used for valuation
 *   details.json   assessment history and permits, read one parcel at a time
 *
 * Uses node:sqlite, built into Node 22.5+, so there is no native module to
 * compile and no extra dependency to install.
 */
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DB_PATH = resolve(root, '02134.db')
const OUT_DIR = resolve(root, 'src/data')

/** Permits older than this many years tell us nothing about today's record. */
const PERMIT_YEARS = 8
/** A transfer below this is a nominal one, not a sale. */
const NOMINAL_PRICE_CEILING = 10_000

const int = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : null
}

const num = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const text = (v) => {
  if (v === null || v === undefined) return null
  const s = String(v).replace(/\s+/g, ' ').trim()
  return s === '' ? null : s
}

/** "A - Average" -> "A". The grade letter is what we compare on. */
const condition = (v) => {
  const s = text(v)
  if (!s) return null
  const code = s.split('-')[0].trim().toUpperCase()
  return ['P', 'F', 'A', 'G', 'VG', 'E', 'EX'].includes(code)
    ? code === 'EX'
      ? 'E'
      : code
    : null
}

/** "3 WESTFORD ST, ALLSTON, MA 02134" -> "3 WESTFORD ST, ALLSTON" */
const cleanAddress = (full, stNum, stName) => {
  const a = text(full)
  if (a) {
    return a
      .replace(/,?\s*MA\s*\d{5}(-\d{4})?\s*$/i, '')
      .replace(/,\s*$/, '')
      .trim()
  }
  const parts = [int(stNum), text(stName)].filter(Boolean)
  return parts.length ? parts.join(' ') : null
}

/**
 * Centroid of a WKT polygon, averaged over its outer ring. Precise enough to
 * measure the distance between two parcels, which is all it is used for.
 */
function centroid(wkt) {
  const s = text(wkt)
  if (!s) return { lat: null, lon: null }
  const open = s.indexOf('((')
  if (open === -1) return { lat: null, lon: null }
  const close = s.indexOf('))', open)
  if (close === -1) return { lat: null, lon: null }
  // The first ring is the outer boundary; inner rings are holes.
  const ring = s.slice(open + 2, close).split('),')[0]
  let sumLon = 0
  let sumLat = 0
  let count = 0
  for (const pair of ring.split(',')) {
    const [lonRaw, latRaw] = pair.trim().split(/\s+/)
    const lon = Number(lonRaw)
    const lat = Number(latRaw)
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue
    sumLon += lon
    sumLat += lat
    count++
  }
  if (count === 0) return { lat: null, lon: null }
  return {
    lat: Math.round((sumLat / count) * 1e6) / 1e6,
    lon: Math.round((sumLon / count) * 1e6) / 1e6,
  }
}

/**
 * Whether a recorded transfer can stand as evidence of market value.
 *
 * Nominal transfers, foreclosures, and the deeds that create a condominium
 * are all recorded as sales but none of them is an open-market price. Each
 * exclusion carries the reason, so the UI can say why a sale was set aside
 * rather than quietly dropping it.
 */
function screenSale(row) {
  const price = int(row.sale_price)
  const docType = text(row.doc_type)
  const upper = (docType ?? '').toUpperCase()

  if (price === null || price <= NOMINAL_PRICE_CEILING) {
    return { armsLength: false, note: 'Nominal transfer, not a market sale' }
  }
  if (upper.includes('FORCLOSURE') || upper.includes('FORECLOSURE')) {
    return { armsLength: false, note: 'Foreclosure deed' }
  }
  if (upper.includes('MASTER DEED')) {
    return { armsLength: false, note: 'Master deed creating a condominium' }
  }
  if (upper.includes('CONFIRMATORY')) {
    return { armsLength: false, note: 'Confirmatory deed correcting an earlier one' }
  }
  if (text(row.confidence) === 'low') {
    return { armsLength: false, note: 'Source does not confirm the price' }
  }
  if (row.rank_keep === 0) {
    return { armsLength: false, note: 'Superseded by another record of the same transfer' }
  }
  return { armsLength: true, note: null }
}

function main() {
  let db
  try {
    db = new DatabaseSync(DB_PATH, { readOnly: true })
  } catch (err) {
    console.error(`\n  Could not open ${DB_PATH}`)
    console.error(`  ${err.message}`)
    console.error('\n  Place 02134.db at the project root and re-run `npm run data`.\n')
    process.exit(1)
  }

  /* ---------------------------------------------------------------- *
   * Fiscal year: read it, never assume it
   * ---------------------------------------------------------------- */

  const fyRow = db.prepare('SELECT MAX(fiscal_year) AS fy FROM assessment_history').get()
  const fy = int(fyRow?.fy)
  if (!fy) {
    console.error('\n  assessment_history carries no fiscal year; cannot label the data.\n')
    process.exit(1)
  }

  // The parcel table holds one set of values. Confirm they are the fiscal year
  // we just read, because shipping last year's values under this year's label
  // would send people to file against the wrong assessment.
  const agree = db
    .prepare(
      `SELECT COUNT(*) AS n FROM parcel p
       JOIN assessment_history h ON h.pid = p.pid AND h.fiscal_year = ?
       WHERE p.total_value = h.assessed_value AND p.total_value > 0`,
    )
    .get(fy)
  const scored = db.prepare('SELECT COUNT(*) AS n FROM parcel WHERE total_value > 0').get()
  const agreement = scored.n > 0 ? agree.n / scored.n : 0
  if (agreement < 0.9) {
    console.error(
      `\n  parcel.total_value matches FY${fy} for only ${(agreement * 100).toFixed(1)}% of parcels.`,
    )
    console.error('  Refusing to label the extract with a fiscal year it may not be.\n')
    process.exit(1)
  }

  // Assessed value is fair cash value as of January 1 before the fiscal year.
  const valuationDate = `${fy - 1}-01-01`

  /* ---------------------------------------------------------------- *
   * Parcels
   * ---------------------------------------------------------------- */

  const rows = db
    .prepare(
      `SELECT pid, full_address, st_num, st_name, zip_code, lu, lu_desc,
              living_area, gross_area, yr_built, yr_remodel, land_sf,
              land_value, bldg_value, total_value, gross_tax,
              residential_exemption_flag, is_owner_occupied,
              bed_rms, full_bth, hlf_bth, res_units, overall_cond, geometry_wkt
         FROM parcel
        WHERE total_value > 0
        ORDER BY st_name, st_num`,
    )
    .all()

  const parcels = []
  const luDesc = {}
  const zips = new Set()
  let skipped = 0

  for (const r of rows) {
    const a = cleanAddress(r.full_address, r.st_num, r.st_name)
    const tv = int(r.total_value)
    // A record with no address can never be found, and no value never scored.
    if (!a || !tv) {
      skipped++
      continue
    }

    const living = int(r.living_area)
    const gross = int(r.gross_area)
    let la = null
    let as = null
    if (living !== null && living > 0) {
      la = living
      as = 0
    } else if (gross !== null && gross > 0) {
      la = gross
      as = 1
    }

    const lu = text(r.lu)
    const desc = text(r.lu_desc)
    if (lu && desc && !luDesc[lu]) luDesc[lu] = desc

    const zip = text(r.zip_code)
    if (zip) zips.add(zip)

    const full = num(r.full_bth) ?? 0
    const half = num(r.hlf_bth) ?? 0
    const baths = full + half > 0 ? full + half * 0.5 : null

    const { lat, lon } = centroid(r.geometry_wkt)
    const ex = r.residential_exemption_flag
    const oo = r.is_owner_occupied

    parcels.push({
      p: text(r.pid) ?? '',
      a,
      z: zip,
      la,
      as,
      yr: int(r.yr_built),
      lv: int(r.land_value),
      bv: int(r.bldg_value),
      tv,
      gt: int(r.gross_tax),
      ex: ex === null || ex === undefined ? null : Number(ex) ? 1 : 0,
      lu,
      lot: int(r.land_sf),
      cd: condition(r.overall_cond),
      rm: int(r.yr_remodel),
      bd: int(r.bed_rms),
      bt: baths,
      u: int(r.res_units),
      y: lat,
      x: lon,
      oo: oo === null || oo === undefined ? null : Number(oo) ? 1 : 0,
    })
  }

  /* ---------------------------------------------------------------- *
   * Sales
   * ---------------------------------------------------------------- */

  const saleRows = db
    .prepare(
      `SELECT pid, sale_date, sale_price, doc_type, confidence, rank_keep
         FROM sale
        WHERE pid IS NOT NULL AND sale_date IS NOT NULL AND sale_price IS NOT NULL
        ORDER BY sale_date DESC`,
    )
    .all()

  const known = new Set(parcels.map((p) => p.p))
  const seen = new Set()
  const sales = []
  for (const r of saleRows) {
    const pid = text(r.pid)
    const date = text(r.sale_date)
    const price = int(r.sale_price)
    if (!pid || !date || price === null || !known.has(pid)) continue
    if (!/^\d{4}-\d{2}-\d{2}/.test(date)) continue

    // The same transfer can be recorded by more than one source.
    const key = `${pid}|${date}|${price}`
    if (seen.has(key)) continue
    seen.add(key)

    const { armsLength, note } = screenSale(r)
    sales.push({
      p: pid,
      d: date.slice(0, 10),
      v: price,
      t: text(r.doc_type),
      al: armsLength ? 1 : 0,
      n: note,
    })
  }

  /* ---------------------------------------------------------------- *
   * Per-parcel detail
   * ---------------------------------------------------------------- */

  const details = {}

  for (const r of db
    .prepare(
      `SELECT pid, fiscal_year, assessed_value FROM assessment_history
        WHERE assessed_value > 0 ORDER BY fiscal_year DESC`,
    )
    .all()) {
    const pid = text(r.pid)
    if (!pid || !known.has(pid)) continue
    const entry = (details[pid] ??= { h: [], pm: [] })
    if (entry.h.length < 8) entry.h.push([int(r.fiscal_year), int(r.assessed_value)])
  }

  const permitFloor = `${fy - PERMIT_YEARS}-01-01`
  for (const r of db
    .prepare(
      `SELECT parcel_id, issued_date, worktype, permittypedescr, description,
              declared_valuation, sq_feet
         FROM permit
        WHERE parcel_id IS NOT NULL AND issued_date >= ?
        ORDER BY issued_date DESC`,
    )
    .all(permitFloor)) {
    const pid = text(r.parcel_id)
    if (!pid || !known.has(pid)) continue
    const entry = (details[pid] ??= { h: [], pm: [] })
    if (entry.pm.length >= 12) continue
    const describe = text(r.description) ?? text(r.permittypedescr)
    entry.pm.push({
      d: String(r.issued_date).slice(0, 10),
      w: text(r.worktype),
      x: describe ? describe.slice(0, 120) : null,
      v: int(r.declared_valuation),
      s: int(r.sq_feet),
    })
  }

  db.close()

  /* ---------------------------------------------------------------- *
   * Write
   * ---------------------------------------------------------------- */

  mkdirSync(OUT_DIR, { recursive: true })

  const generated = new Date().toISOString().slice(0, 10)
  const files = [
    [
      'parcels.json',
      { fy, valuationDate, generated, zips: [...zips].sort(), luDesc, parcels },
    ],
    ['sales.json', { fy, valuationDate, sales }],
    ['details.json', details],
  ]

  const sizes = []
  for (const [name, payload] of files) {
    const json = JSON.stringify(payload)
    writeFileSync(resolve(OUT_DIR, name), json, 'utf8')
    sizes.push([name, (Buffer.byteLength(json, 'utf8') / 1024).toFixed(0)])
  }

  const armsLength = sales.filter((s) => s.al === 1).length
  console.log(`\n  Donna data extraction`)
  console.log(`  ---------------------`)
  console.log(`  fiscal year      FY${fy}  (values as of ${valuationDate})`)
  console.log(`  rows read        ${rows.length}`)
  console.log(
    `  parcels written  ${parcels.length}${skipped ? `  (${skipped} skipped: no address or no value)` : ''}`,
  )
  console.log(`  with floor area  ${parcels.filter((p) => p.la).length}`)
  console.log(`  with a location  ${parcels.filter((p) => p.y !== null).length}`)
  console.log(`  sales written    ${sales.length}  (${armsLength} screened as arm's length)`)
  console.log(`  parcels detailed ${Object.keys(details).length}`)
  for (const [name, kb] of sizes) console.log(`  ${name.padEnd(16)} ${kb} KB`)
  console.log('')
}

main()
