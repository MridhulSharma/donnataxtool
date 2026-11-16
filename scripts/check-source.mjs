/**
 * Watch the city's published data for the two changes that break this app
 * silently, and fail loudly when either happens.
 *
 *   npm run check:source
 *
 * 1. A NEW FISCAL YEAR. Boston publishes a new assessment table each
 *    December. Until the extract is rebuilt the app shows last year's
 *    values, and an application filed against the wrong year's assessment
 *    is wasted. This is the single most damaging silent failure the product
 *    has, because every number still looks right.
 *
 * 2. SCHEMA DRIFT. Column names change between years (TOTAL_VALUE became
 *    AV_TOTAL and back; one year shipped 'LIVING _AREA' with a stray space).
 *    The client reads through alias lists, so drift degrades quietly rather
 *    than erroring. This names any column it can no longer find.
 *
 * Exits non-zero when something needs a person, so it can run on a schedule.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CKAN = 'https://data.boston.gov/api/3/action'
const DATASET = 'property-assessment'

/** The fields the app actually reads, with the spellings it knows. */
const REQUIRED = {
  'parcel id': ['PID', 'PARCEL_ID', 'GIS_ID', 'CM_ID'],
  'street name': ['ST_NAME'],
  zip: ['ZIP_CODE', 'ZIPCODE'],
  'land use': ['LU'],
  'floor area': ['LIVING_AREA', 'LIVING_AREA_SF', 'GROSS_AREA'],
  'year built': ['YR_BUILT', 'YEAR_BUILT'],
  'total value': ['TOTAL_VALUE', 'AV_TOTAL', 'TOTAL_VAL'],
  'land value': ['LAND_VALUE', 'AV_LAND'],
  'building value': ['BLDG_VALUE', 'AV_BLDG'],
}

const normalize = (key) => key.toUpperCase().replace(/[^A-Z0-9]/g, '')

async function action(name, params) {
  const url = new URL(`${CKAN}/${name}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`${name} returned HTTP ${response.status}`)
  const body = await response.json()
  if (!body.success) throw new Error(`${name} returned an error envelope`)
  return body.result
}

function yearOf(resource) {
  const haystack = [resource.name, resource.url, resource.description]
    .filter((part) => typeof part === 'string')
    .join(' ')
  const ceiling = new Date().getFullYear() + 2
  const years = [...haystack.matchAll(/(?:19|20)\d{2}/g)]
    .map((m) => Number(m[0]))
    .filter((y) => y >= 2000 && y <= ceiling)
  return years.length > 0 ? Math.max(...years) : null
}

async function main() {
  const problems = []

  let shipped = null
  try {
    shipped = JSON.parse(readFileSync(resolve(root, 'src/data/parcels.json'), 'utf8')).fy
  } catch {
    problems.push('src/data/parcels.json is missing or unreadable. Run `npm run data`.')
  }

  const pkg = await action('package_show', { id: DATASET })
  const live = (pkg.resources ?? [])
    .filter((r) => r.datastore_active)
    .map((r) => ({ id: r.id, fy: yearOf(r) }))
    .filter((r) => r.fy !== null)

  if (live.length === 0) {
    problems.push('The city publishes no queryable assessment table right now.')
  }

  const latest = live.reduce((best, r) => (r.fy > best.fy ? r : best), live[0])

  if (shipped !== null && latest && latest.fy > shipped) {
    problems.push(
      `The city has published FY${latest.fy}, and this build ships FY${shipped}. ` +
        'Rebuild the extract before the filing season: until then the app shows last ' +
        "year's values, and an application filed against the wrong year is wasted.",
    )
  }

  if (latest) {
    const probe = await action('datastore_search', { resource_id: latest.id, limit: '1' })
    const columns = new Set((probe.fields ?? []).map((f) => normalize(f.id)))
    for (const [label, aliases] of Object.entries(REQUIRED)) {
      if (!aliases.some((alias) => columns.has(normalize(alias)))) {
        problems.push(
          `FY${latest.fy} carries no column for ${label}. ` +
            `Known spellings: ${aliases.join(', ')}. Add the new one to ALIASES in ` +
            'src/lib/live.ts and to REQUIRED here.',
        )
      }
    }
    console.log(`  Latest published table   FY${latest.fy} (${latest.id})`)
    console.log(`  Columns seen             ${columns.size}`)
  }
  console.log(`  Fiscal year in this build ${shipped ?? 'unknown'}`)

  if (problems.length === 0) {
    console.log('\n  Nothing needs attention.\n')
    return
  }

  console.error(`\n  ${problems.length} thing${problems.length === 1 ? '' : 's'} need attention:\n`)
  for (const problem of problems) console.error(`  - ${problem}\n`)
  process.exitCode = 1
}

main().catch((error) => {
  console.error(`\n  Could not check the city's data: ${error.message}\n`)
  process.exitCode = 1
})
