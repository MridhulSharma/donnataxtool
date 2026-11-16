/** All money, number and date formatting lives here. */
import type { CalendarDay } from './deadline'

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

const DASH = '—'

export const money = (n: number | null | undefined): string =>
  n === null || n === undefined || !Number.isFinite(n) ? DASH : usd0.format(n)

/** For $/sq ft, where cents carry real meaning. */
export const moneyCents = (n: number | null | undefined): string =>
  n === null || n === undefined || !Number.isFinite(n) ? DASH : usd2.format(n)

/** A signed figure, for an adjustment that can go either way. */
export const signedMoney = (n: number | null | undefined): string => {
  if (n === null || n === undefined || !Number.isFinite(n)) return DASH
  if (Math.round(n) === 0) return '—'
  return `${n > 0 ? '+' : '−'}${usd0.format(Math.abs(n))}`
}

export const count = (n: number | null | undefined): string =>
  n === null || n === undefined || !Number.isFinite(n) ? DASH : num0.format(n)

export const sqft = (n: number | null | undefined): string =>
  n === null || n === undefined || !Number.isFinite(n) || n <= 0
    ? DASH
    : `${num0.format(n)} sq ft`

export const year = (n: number | null | undefined): string =>
  n === null || n === undefined || !Number.isFinite(n) || n <= 1000 ? DASH : String(n)

export const pct = (ratio: number, digits = 1): string =>
  Number.isFinite(ratio) ? `${(ratio * 100).toFixed(digits)}%` : DASH

/** A number of months, as the reader would say it. */
export const months = (n: number): string => {
  const rounded = Math.round(n)
  if (rounded < 1) return 'less than a month'
  if (rounded === 1) return '1 month'
  if (rounded < 24) return `${rounded} months`
  const years = Math.round(rounded / 12)
  return `${years} years`
}

/**
 * Dates in the source data are plain calendar dates ("2021-07-29"). Parsing
 * them with new Date() would shift them by the local UTC offset, so the parts
 * are split out instead.
 */
export function prettyDate(raw: string | null | undefined): string {
  if (!raw) return DASH
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim())
  if (!m) return raw.trim()
  return longDate({ year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }, 'medium')
}

/** A calendar day in words. Never constructed from a timestamp. */
export function longDate(d: CalendarDay, style: 'long' | 'medium' = 'long'): string {
  // Noon UTC keeps the date from drifting either way when it is formatted.
  const at = new Date(Date.UTC(d.year, d.month - 1, d.day, 12))
  return at.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: style === 'long' ? 'long' : undefined,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/** "Feb 1, 2027" for tables and tight spaces. */
export function shortDate(d: CalendarDay): string {
  const at = new Date(Date.UTC(d.year, d.month - 1, d.day, 12))
  return at.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Addresses arrive in all capitals. Title-case them for reading, while
 * keeping directionals and unit letters sane.
 */
export function titleCase(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .toLowerCase()
    .replace(/\b([a-z])([a-z]*)/g, (_, a: string, b: string) => a.toUpperCase() + b)
    .replace(/\b(Ma|Ne|Nw|Se|Sw|Llc|Ii|Iii|Iv)\b/g, (m) => m.toUpperCase())
}

/** "FY2026" with the January 1 it was measured on. */
export const fiscalYearLabel = (fy: number): string => `FY${fy}`

export const valuationDateLabel = (fy: number): string => `January 1, ${fy - 1}`
