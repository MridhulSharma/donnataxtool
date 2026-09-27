/**
 * The abatement deadline is the due date of the first actual tax bill, which in
 * Boston is typically February 1. When February 1 falls on a weekend it moves to
 * the next business day. Missing it forfeits appeal rights for the year.
 *
 * Federal/state holidays are not modelled; the weekend roll covers the common
 * case and the copy tells the user to confirm the date on their bill.
 */

export interface Countdown {
  /** The operative deadline date, after any weekend roll. */
  date: Date
  /** February 1 of the deadline year, before the roll. */
  nominal: Date
  /** True when Feb 1 was a weekend and the date moved. */
  rolled: boolean
  daysLeft: number
  hoursLeft: number
  minutesLeft: number
  secondsLeft: number
  /** Total whole days, for the headline figure. */
  totalMs: number
  /** Fiscal year the abatement would apply to. */
  fiscalYear: number
}

/** Saturday -> Monday, Sunday -> Monday. */
function rollToBusinessDay(d: Date): Date {
  const out = new Date(d.getTime())
  const day = out.getDay()
  if (day === 6) out.setDate(out.getDate() + 2)
  else if (day === 0) out.setDate(out.getDate() + 1)
  return out
}

/**
 * The next February 1 that has not yet passed, at end of day — a filing on the
 * deadline date is still on time.
 */
export function nextDeadline(now: Date = new Date()): { date: Date; nominal: Date; rolled: boolean } {
  for (let year = now.getFullYear(); year <= now.getFullYear() + 1; year++) {
    const nominal = new Date(year, 1, 1, 0, 0, 0, 0)
    const rolledDate = rollToBusinessDay(nominal)
    const endOfDay = new Date(rolledDate.getFullYear(), rolledDate.getMonth(), rolledDate.getDate(), 23, 59, 59, 999)
    if (endOfDay.getTime() >= now.getTime()) {
      return {
        date: endOfDay,
        nominal,
        rolled: rolledDate.getDate() !== nominal.getDate(),
      }
    }
  }
  // Unreachable, but keep the return type honest.
  const nominal = new Date(now.getFullYear() + 1, 1, 1)
  return { date: nominal, nominal, rolled: false }
}

export function countdown(now: Date = new Date()): Countdown {
  const { date, nominal, rolled } = nextDeadline(now)
  const totalMs = Math.max(0, date.getTime() - now.getTime())

  const secs = Math.floor(totalMs / 1000)
  return {
    date,
    nominal,
    rolled,
    daysLeft: Math.floor(secs / 86400),
    hoursLeft: Math.floor((secs % 86400) / 3600),
    minutesLeft: Math.floor((secs % 3600) / 60),
    secondsLeft: secs % 60,
    totalMs,
    // A Feb 1 deadline belongs to the fiscal year that began the previous July.
    fiscalYear: date.getFullYear(),
  }
}

/**
 * Massachusetts gives the assessors three months to act, then three more months
 * to petition the Appellate Tax Board. Both are measured from the filing.
 */
export function appealTimeline(deadline: Date) {
  const plusMonths = (d: Date, m: number) => {
    const out = new Date(d.getTime())
    out.setMonth(out.getMonth() + m)
    return out
  }
  return {
    filingDeadline: deadline,
    assessorsDecideBy: plusMonths(deadline, 3),
    atbPetitionBy: plusMonths(deadline, 6),
  }
}
