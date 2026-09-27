/** All money, number and date formatting lives here. */

const usd0 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const usd2 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const num0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export const money = (n: number | null | undefined): string =>
  n === null || n === undefined || !Number.isFinite(n) ? '—' : usd0.format(n)

/** For $/sq ft, where cents carry real meaning. */
export const moneyCents = (n: number | null | undefined): string =>
  n === null || n === undefined || !Number.isFinite(n) ? '—' : usd2.format(n)

export const count = (n: number | null | undefined): string =>
  n === null || n === undefined || !Number.isFinite(n) ? '—' : num0.format(n)

export const sqft = (n: number | null | undefined): string =>
  n === null || n === undefined || !Number.isFinite(n) || n <= 0 ? '—' : `${num0.format(n)} sq ft`

export const year = (n: number | null | undefined): string =>
  n === null || n === undefined || !Number.isFinite(n) || n <= 1000 ? '—' : String(n)

export const pct = (ratio: number, digits = 1): string =>
  Number.isFinite(ratio) ? `${(ratio * 100).toFixed(digits)}%` : '—'

/**
 * Dates in the source data are plain calendar dates ("2021-07-29"). Parsing them
 * with new Date() would shift them by the local UTC offset, so split instead.
 */
export function prettyDate(raw: string | null | undefined): string {
  if (!raw) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim())
  if (!m) return raw.trim()
  const [, y, mo, d] = m
  const dt = new Date(Number(y), Number(mo) - 1, Number(d))
  if (Number.isNaN(dt.getTime())) return raw.trim()
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export const longDate = (d: Date): string =>
  d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

/**
 * Addresses arrive in all-caps. Title-case them for reading, while keeping
 * directionals and unit letters sane.
 */
export function titleCase(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .toLowerCase()
    .replace(/\b([a-z])([a-z]*)/g, (_, a: string, b: string) => a.toUpperCase() + b)
    .replace(/\b(Ma|Ne|Nw|Se|Sw|Llc|Ii|Iii|Iv)\b/g, (m) => m.toUpperCase())
}
