/**
 * One-time / re-runnable build step: read the local assessment database and write
 * a compact JSON payload the app imports directly.
 *
 *   npm run data
 *
 * better-sqlite3 is a devDependency and is never shipped to the browser.
 */
import Database from 'better-sqlite3'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DB_PATH = resolve(root, '02134.db')
const OUT_PATH = resolve(root, 'src/data/local.json')

const SQL = `
  SELECT pid, full_address, st_num, st_name, living_area, yr_built,
         land_value, bldg_value, total_value, gross_tax,
         latest_sale_price, latest_sale_date,
         residential_exemption_flag, owner_name, lu_desc
  FROM parcel
  WHERE total_value > 0
  ORDER BY st_name, st_num
`

/** Round to a whole number, or null when there is nothing usable. */
const int = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : null
}

/** Trim whitespace, collapse runs of spaces, and drop empty strings to null. */
const text = (v) => {
  if (v === null || v === undefined) return null
  const s = String(v).replace(/\s+/g, ' ').trim()
  return s === '' ? null : s
}

/** "3 WESTFORD ST, ALLSTON, MA 02134" -> "3 WESTFORD ST, ALLSTON" */
const cleanAddress = (full, stNum, stName) => {
  const a = text(full)
  if (a) return a.replace(/,?\s*MA\s*0?2134\s*$/i, '').replace(/,\s*$/, '').trim()
  // Fall back to rebuilding from the street parts.
  const parts = [int(stNum), text(stName)].filter(Boolean)
  return parts.length ? parts.join(' ') : null
}

function main() {
  let db
  try {
    db = new Database(DB_PATH, { readonly: true, fileMustExist: true })
  } catch (err) {
    console.error(`\n  Could not open ${DB_PATH}`)
    console.error(`  ${err.message}`)
    console.error('\n  Place 02134.db at the project root and re-run `npm run data`.\n')
    process.exit(1)
  }

  const rows = db.prepare(SQL).all()
  const records = []
  let skipped = 0

  for (const r of rows) {
    const a = cleanAddress(r.full_address, r.st_num, r.st_name)
    const tv = int(r.total_value)
    // A record with no address can never be found, and no value can never be scored.
    if (!a || !tv) {
      skipped++
      continue
    }

    const sp = int(r.latest_sale_price)
    const ex = r.residential_exemption_flag

    records.push({
      p: text(r.pid),
      a,
      la: int(r.living_area),
      yr: int(r.yr_built),
      lv: int(r.land_value),
      bv: int(r.bldg_value),
      tv,
      gt: int(r.gross_tax),
      // Nominal $1 / $10 transfers are not sales; treat them as unknown.
      sp: sp !== null && sp > 100 ? sp : null,
      sd: text(r.latest_sale_date),
      ex: ex === null || ex === undefined ? null : Number(ex) ? 1 : 0,
      o: text(r.owner_name),
      lu: text(r.lu_desc),
    })
  }

  db.close()

  mkdirSync(dirname(OUT_PATH), { recursive: true })
  writeFileSync(OUT_PATH, JSON.stringify(records), 'utf8')

  const kb = (Buffer.byteLength(JSON.stringify(records), 'utf8') / 1024).toFixed(0)
  console.log(`\n  Level data extraction`)
  console.log(`  ---------------------`)
  console.log(`  rows read      ${rows.length}`)
  console.log(`  records written ${records.length}${skipped ? `  (${skipped} skipped: no address or no value)` : ''}`)
  console.log(`  with living area ${records.filter((r) => r.la && r.la > 0).length}`)
  console.log(`  with a sale     ${records.filter((r) => r.sp).length}`)
  console.log(`  payload        ${kb} KB  ->  src/data/local.json\n`)
}

main()
