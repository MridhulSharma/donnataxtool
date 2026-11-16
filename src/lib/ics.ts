/**
 * A minimal RFC 5545 calendar file, built in the browser.
 *
 * The dates in an abatement cannot be recovered once missed, so they are
 * worth putting into the calendar the homeowner actually looks at. All-day
 * events, so an entry never drifts across a time zone and lands on the wrong
 * day.
 */
import type { CalendarDay } from './deadline'
import { addDays } from './deadline'

const pad = (n: number) => String(n).padStart(2, '0')

/** YYYYMMDD, for an all-day DATE value. */
const icsDate = (d: CalendarDay) => `${d.year}${pad(d.month)}${pad(d.day)}`

/** DTSTAMP is a UTC timestamp. */
const icsStamp = (d: Date) => `${d.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`

/** Backslashes, semicolons, commas and newlines are escaped in TEXT values. */
function icsText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** Content lines are folded at 75 octets, with a leading space on the rest. */
function fold(line: string): string[] {
  if (line.length <= 74) return [line]
  const out = [line.slice(0, 74)]
  let rest = line.slice(74)
  while (rest.length > 73) {
    out.push(` ${rest.slice(0, 73)}`)
    rest = rest.slice(73)
  }
  if (rest) out.push(` ${rest}`)
  return out
}

export interface IcsEvent {
  date: CalendarDay
  title: string
  description: string
  /** Days before the date to fire a reminder. Omit for none. */
  remindDaysBefore?: number
}

export function buildIcs(events: IcsEvent[], now: Date = new Date()): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Donna//Property Tax Abatement//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  events.forEach((event, i) => {
    const end = addDays(event.date, 1)
    lines.push(
      'BEGIN:VEVENT',
      `UID:${icsDate(event.date)}-${i}-donna-abatement`,
      `DTSTAMP:${icsStamp(now)}`,
      `DTSTART;VALUE=DATE:${icsDate(event.date)}`,
      `DTEND;VALUE=DATE:${icsDate(end)}`,
      `SUMMARY:${icsText(event.title)}`,
      `DESCRIPTION:${icsText(event.description)}`,
      'TRANSP:TRANSPARENT',
    )
    if (event.remindDaysBefore) {
      lines.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `TRIGGER:-P${event.remindDaysBefore}D`,
        `DESCRIPTION:${icsText(event.title)}`,
        'END:VALARM',
      )
    }
    lines.push('END:VEVENT')
  })

  lines.push('END:VCALENDAR')
  // CRLF throughout, with a trailing break, as the spec requires.
  return `${lines.flatMap(fold).join('\r\n')}\r\n`
}

/** Hand a file to the browser. Nothing is uploaded. */
export function downloadFile(filename: string, data: BlobPart, mime: string): void {
  const blob = new Blob([data], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Give the download a tick to start before the blob is revoked.
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export const downloadIcs = (filename: string, ics: string): void =>
  downloadFile(filename, ics, 'text/calendar;charset=utf-8')
