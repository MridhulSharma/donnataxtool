/**
 * Tracking a case after it is filed.
 *
 * The dates that follow a filing run from the day the application went in,
 * and both are jurisdictional: three months for the assessors to act, then
 * three months to petition the Appellate Tax Board. A homeowner who files in
 * early January and is told to watch February 1 of the following year will
 * lose the appeal without ever being told why.
 *
 * What the owner enters is kept in their own browser and nowhere else. There
 * is no account, no server and nothing to sign in to, so a cleared browser
 * clears the case with it, and the page says so.
 */
import { appealTimeline, parseISO, toISO, type AppealTimeline, type CalendarDay } from './deadline'

const KEY = 'donna.case.v1'

export interface CaseRecord {
  /** The parcel the case is about. */
  pid: string
  address: string
  fiscalYear: number
  /** ISO date the application was filed. */
  filedOn: string | null
  /** ISO date a written decision was received. */
  decidedOn: string | null
  decision: 'granted' | 'denied' | null
  /** Whether the assessors sent written notice of their inaction. */
  noticeReceived: boolean | null
  /** Free-text note the owner keeps for themselves. */
  note: string | null
  /** When this record was last changed. */
  updated: string
}

export type CaseStage =
  | 'not-filed'
  | 'awaiting-assessors'
  | 'deemed-denied'
  | 'granted'
  | 'denied'
  | 'atb-window-closed'

export interface CaseStatus {
  stage: CaseStage
  timeline: AppealTimeline
  /** What to do next, in one sentence. */
  nextStep: string
  /** The date that next step is tied to. */
  nextDate: CalendarDay | null
  /** Days until that date; negative once it has passed. */
  daysUntil: number | null
  /** True when the next date is close enough to need attention now. */
  urgent: boolean
}

/* ------------------------------------------------------------------ *
 * Storage
 * ------------------------------------------------------------------ */

export function readCases(): CaseRecord[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is CaseRecord =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as CaseRecord).pid === 'string',
    )
  } catch {
    // Blocked storage or malformed JSON: start clean rather than crash.
    return []
  }
}

/** True when the case was written. False when storage refused it. */
export function writeCase(record: CaseRecord): boolean {
  try {
    const others = readCases().filter((c) => c.pid !== record.pid)
    localStorage.setItem(KEY, JSON.stringify([...others, record]))
    return true
  } catch {
    return false
  }
}

export function readCase(pid: string): CaseRecord | null {
  return readCases().find((c) => c.pid === pid) ?? null
}

export function clearCase(pid: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(readCases().filter((c) => c.pid !== pid)))
  } catch {
    // Nothing to do: the case was never stored.
  }
}

/* ------------------------------------------------------------------ *
 * Where the case stands
 * ------------------------------------------------------------------ */

const daysBetweenDays = (from: CalendarDay, to: CalendarDay): number =>
  Math.round(
    (Date.UTC(to.year, to.month - 1, to.day) - Date.UTC(from.year, from.month - 1, from.day)) /
      86_400_000,
  )

export function caseStatus(
  record: CaseRecord | null,
  today: CalendarDay,
  filingDeadline: CalendarDay,
): CaseStatus {
  const filedOn = record?.filedOn ? parseISO(record.filedOn) : null
  const decidedOn = record?.decidedOn ? parseISO(record.decidedOn) : null

  const timeline = appealTimeline({
    filedOn,
    deniedOn: record?.decision === 'denied' ? decidedOn : null,
  })

  if (!filedOn) {
    const daysUntil = daysBetweenDays(today, filingDeadline)
    return {
      stage: 'not-filed',
      timeline,
      nextStep: `File your application by ${filingDeadline.month}/${filingDeadline.day}, 5:00 pm. Everything after this date is counted from the day you actually file.`,
      nextDate: filingDeadline,
      daysUntil,
      // Missing this date forfeits the year with no cure, so it is called
      // urgent a month out rather than a fortnight.
      urgent: daysUntil <= 30,
    }
  }

  if (record?.decision === 'granted') {
    return {
      stage: 'granted',
      timeline,
      nextStep:
        'Your abatement was granted. Check that the reduction appears on your next tax bill, and keep the notice.',
      nextDate: null,
      daysUntil: null,
      urgent: false,
    }
  }

  const { deemedDeniedOn, atbPetitionBy } = timeline

  if (record?.decision === 'denied' && atbPetitionBy) {
    const daysUntil = daysBetweenDays(today, atbPetitionBy)
    return {
      stage: 'denied',
      timeline,
      nextStep:
        daysUntil >= 0
          ? 'Your application was denied. You have three months from that denial to petition the Appellate Tax Board. This deadline is jurisdictional: the Board cannot hear a late appeal.'
          : 'The three months to petition the Appellate Tax Board have passed. A navigator can tell you whether anything remains open.',
      nextDate: atbPetitionBy,
      daysUntil,
      urgent: daysUntil >= 0 && daysUntil <= 30,
    }
  }

  if (deemedDeniedOn && daysBetweenDays(today, deemedDeniedOn) > 0) {
    const daysUntil = daysBetweenDays(today, deemedDeniedOn)
    return {
      stage: 'awaiting-assessors',
      timeline,
      nextStep:
        'The assessors have three months from the day you filed. If they have not acted by then, your application is deemed denied on that date and your three months to appeal start running.',
      nextDate: deemedDeniedOn,
      daysUntil,
      urgent: daysUntil <= 14,
    }
  }

  if (atbPetitionBy) {
    const daysUntil = daysBetweenDays(today, atbPetitionBy)
    if (daysUntil < 0) {
      return {
        stage: 'atb-window-closed',
        timeline,
        nextStep:
          'The three months to petition the Appellate Tax Board have passed. Speak to a navigator about whether anything remains open, including the extension that can apply when the assessors never sent written notice.',
        nextDate: atbPetitionBy,
        daysUntil,
        urgent: false,
      }
    }
    return {
      stage: 'deemed-denied',
      timeline,
      nextStep:
        'Three months have passed with no decision, so your application is deemed denied. You have three months from that date to petition the Appellate Tax Board.',
      nextDate: atbPetitionBy,
      daysUntil,
      urgent: daysUntil <= 30,
    }
  }

  return {
    stage: 'awaiting-assessors',
    timeline,
    nextStep: 'Waiting on the assessors.',
    nextDate: null,
    daysUntil: null,
    urgent: false,
  }
}

/** A fresh record for a property. */
export function newCase(pid: string, address: string, fiscalYear: number): CaseRecord {
  return {
    pid,
    address,
    fiscalYear,
    filedOn: null,
    decidedOn: null,
    decision: null,
    noticeReceived: null,
    note: null,
    updated: toISO(
      (() => {
        const now = new Date()
        return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() }
      })(),
    ),
  }
}
