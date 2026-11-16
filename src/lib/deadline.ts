/**
 * Every date in the appeal, worked out from the one date that governs it.
 *
 * Two corrections drive the shape of this file:
 *
 *   1. The deadlines after filing run from the DAY THE APPLICATION WAS FILED,
 *      not from February 1. The assessors have three months from filing to
 *      act; three months after their decision, or after the deemed denial,
 *      the right to petition the Appellate Tax Board is gone. Those limits
 *      are jurisdictional, so an owner who files early and is shown a date
 *      counted from February 1 is being shown a deadline that is too late.
 *
 *   2. The filing deadline is a Boston clock time, not the reader's. Someone
 *      checking from another time zone must see the Boston cut-off.
 *
 * Holidays are not modelled: the weekend roll covers the common case, and the
 * copy tells the reader to confirm the date printed on their own bill.
 */
import { useEffect, useState } from 'react'
import { ASSESSORS_MONTHS, ATB_MONTHS, FILING_CUTOFF_HOUR_ET } from './legal'

/** Everything in this file is reckoned in Boston's time zone. */
export const BOSTON_TZ = 'America/New_York'

/** A plain calendar day, with no time zone attached to it. */
export interface CalendarDay {
  year: number
  /** 1-12. */
  month: number
  /** 1-31. */
  day: number
}

const pad = (n: number) => String(n).padStart(2, '0')

export const toISO = (d: CalendarDay): string => `${d.year}-${pad(d.month)}-${pad(d.day)}`

export function parseISO(raw: string): CalendarDay | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim())
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  // Reject a day that does not exist in that month, e.g. 2026-02-30.
  const probe = new Date(Date.UTC(year, month - 1, day))
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null
  return { year, month, day }
}

/** Today's date in Boston, whatever the reader's own clock says. */
export function todayInBoston(now: Date = new Date()): CalendarDay {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BOSTON_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return { year: get('year'), month: get('month'), day: get('day') }
}

/** Day of the week for a calendar day: 0 Sunday through 6 Saturday. */
export function weekdayOf(d: CalendarDay): number {
  return new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay()
}

/** Add days to a calendar day, rolling months and years correctly. */
export function addDays(d: CalendarDay, days: number): CalendarDay {
  const t = new Date(Date.UTC(d.year, d.month - 1, d.day))
  t.setUTCDate(t.getUTCDate() + days)
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() }
}

/**
 * Add calendar months, clamping to the end of a short month: three months
 * from 31 January is 30 April, not 1 May. Statutory periods are counted in
 * months, and overshooting one by a day is the kind of error that loses a
 * jurisdictional deadline.
 */
export function addMonths(d: CalendarDay, months: number): CalendarDay {
  const zeroBased = d.month - 1 + months
  const year = d.year + Math.floor(zeroBased / 12)
  const month = ((zeroBased % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return { year, month: month + 1, day: Math.min(d.day, lastDay) }
}

/** Saturday and Sunday roll forward to Monday. */
export function rollToBusinessDay(d: CalendarDay): CalendarDay {
  const day = weekdayOf(d)
  if (day === 6) return addDays(d, 2)
  if (day === 0) return addDays(d, 1)
  return d
}

/** Whole days from one calendar day to another; negative when it has passed. */
export function daysBetween(from: CalendarDay, to: CalendarDay): number {
  const a = Date.UTC(from.year, from.month - 1, from.day)
  const b = Date.UTC(to.year, to.month - 1, to.day)
  return Math.round((b - a) / 86_400_000)
}

/** The instant the cut-off falls, as a real timestamp in Boston's zone. */
export function cutoffInstant(d: CalendarDay): Date {
  // Guess at UTC, then correct by the offset Boston was on at that moment.
  const guess = Date.UTC(d.year, d.month - 1, d.day, FILING_CUTOFF_HOUR_ET, 0, 0)
  const offset = bostonOffsetMs(new Date(guess))
  return new Date(guess + offset)
}

/** How far behind UTC Boston is at a given instant, in milliseconds. */
function bostonOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BOSTON_TZ,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const asUTC = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second'),
  )
  return at.getTime() - asUTC
}

/* ------------------------------------------------------------------ *
 * The filing deadline
 * ------------------------------------------------------------------ */

export interface FilingDeadline {
  /** The operative date, after any weekend roll. */
  date: CalendarDay
  /** February 1 of that year, before the roll. */
  nominal: CalendarDay
  /** True when February 1 fell on a weekend and the date moved. */
  rolled: boolean
  /** The fiscal year an application filed by this date would be for. */
  fiscalYear: number
}

/**
 * The next filing deadline that has not yet passed.
 *
 * In Boston the application is due on the due date of the first actual tax
 * bill, which is typically February 1. A February 1 deadline belongs to the
 * fiscal year that began the previous July, so the fiscal year is the calendar
 * year the deadline falls in.
 */
export function nextFilingDeadline(today: CalendarDay = todayInBoston()): FilingDeadline {
  for (let year = today.year; year <= today.year + 1; year++) {
    const nominal: CalendarDay = { year, month: 2, day: 1 }
    const date = rollToBusinessDay(nominal)
    if (daysBetween(today, date) >= 0) {
      return { date, nominal, rolled: date.day !== nominal.day, fiscalYear: year }
    }
  }
  // Unreachable: the loop covers this year and the next.
  const nominal: CalendarDay = { year: today.year + 1, month: 2, day: 1 }
  const date = rollToBusinessDay(nominal)
  return { date, nominal, rolled: date.day !== nominal.day, fiscalYear: nominal.year }
}

export interface Countdown {
  deadline: FilingDeadline
  /** Whole days left, counted in Boston. Zero on the deadline day itself. */
  daysLeft: number
  hoursLeft: number
  minutesLeft: number
  secondsLeft: number
  /** Milliseconds to the 5:00 pm Boston cut-off. Zero once it has passed. */
  totalMs: number
  /** True once the cut-off on the deadline day has gone by. */
  passed: boolean
}

export function countdown(now: Date = new Date()): Countdown {
  const today = todayInBoston(now)
  const deadline = nextFilingDeadline(today)
  const cutoff = cutoffInstant(deadline.date)
  const totalMs = Math.max(0, cutoff.getTime() - now.getTime())
  const seconds = Math.floor(totalMs / 1000)
  return {
    deadline,
    // Counted from the calendar, so "1 day left" means tomorrow, whatever
    // the hour. The clock figures below carry the hours.
    daysLeft: Math.max(0, daysBetween(today, deadline.date)),
    hoursLeft: Math.floor((seconds % 86_400) / 3600),
    minutesLeft: Math.floor((seconds % 3600) / 60),
    secondsLeft: seconds % 60,
    totalMs,
    passed: totalMs === 0,
  }
}

/* ------------------------------------------------------------------ *
 * What follows the filing
 * ------------------------------------------------------------------ */

export interface AppealTimeline {
  /** The day the application was filed, if the owner has told us. */
  filedOn: CalendarDay | null
  /** The day the assessors' three months run out. */
  assessorsDecideBy: CalendarDay | null
  /** The day the application is deemed denied if they have not acted. */
  deemedDeniedOn: CalendarDay | null
  /** The day a written denial was received, if there was one. */
  deniedOn: CalendarDay | null
  /**
   * Last day to petition the Appellate Tax Board: three months from the
   * denial, actual or deemed. Null until there is a filing date to count from.
   */
  atbPetitionBy: CalendarDay | null
  /** Which of the two denials the ATB date was counted from. */
  atbCountedFrom: 'written-denial' | 'deemed-denial' | null
  /** True while the dates are hypothetical because nothing has been filed. */
  projected: boolean
}

/**
 * The dates that follow a filing.
 *
 * `filedOn` is the date the application actually went in. When it is not
 * known, the deadline is used and every date is marked `projected`, because
 * filing a day earlier moves all of them a day earlier with it.
 */
export function appealTimeline(input: {
  filedOn?: CalendarDay | null
  deniedOn?: CalendarDay | null
  fallbackFilingDate?: CalendarDay | null
}): AppealTimeline {
  const filedOn = input.filedOn ?? input.fallbackFilingDate ?? null
  const deniedOn = input.deniedOn ?? null

  if (!filedOn) {
    return {
      filedOn: null,
      assessorsDecideBy: null,
      deemedDeniedOn: null,
      deniedOn,
      atbPetitionBy: null,
      atbCountedFrom: null,
      projected: true,
    }
  }

  const deemedDeniedOn = addMonths(filedOn, ASSESSORS_MONTHS)
  // A written denial, when there is one, starts the clock instead.
  const countFrom = deniedOn ?? deemedDeniedOn
  const atbPetitionBy = addMonths(countFrom, ATB_MONTHS)

  return {
    filedOn,
    assessorsDecideBy: deemedDeniedOn,
    deemedDeniedOn,
    deniedOn,
    atbPetitionBy,
    atbCountedFrom: deniedOn ? 'written-denial' : 'deemed-denial',
    projected: input.filedOn === null || input.filedOn === undefined,
  }
}

/* ------------------------------------------------------------------ *
 * React
 * ------------------------------------------------------------------ */

/**
 * Today's date in Boston, as a value that only changes when the date does.
 *
 * `todayInBoston()` builds a new object every call, which would re-run every
 * calculation downstream on every render. This holds one, and swaps it only
 * when the day actually turns, so a tab left open overnight does not go on
 * counting down to yesterday.
 */
export function useToday(): CalendarDay {
  const [today, setToday] = useState<CalendarDay>(() => todayInBoston())

  useEffect(() => {
    const id = window.setInterval(() => {
      const now = todayInBoston()
      setToday((held) => (toISO(held) === toISO(now) ? held : now))
    }, 60_000)
    return () => window.clearInterval(id)
  }, [])

  return today
}
