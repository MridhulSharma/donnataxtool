/**
 * A minimal RFC 5545 calendar file, built in the browser.
 *
 * The filing deadline is the one fact in this whole tool that cannot be
 * recovered if it is missed, so it is worth putting into the calendar the
 * homeowner actually looks at. All-day events, so the entry never drifts across
 * a time zone and lands on January 31.
 */
const pad = (n: number) => String(n).padStart(2, '0')

/** YYYYMMDD, in local terms, for an all-day DATE value. */
const icsDate = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`

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

/** Content lines are folded at 75 octets with a leading space on the rest. */
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
  /** The all-day date the entry sits on. */
  date: Date
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

  events.forEach((ev, i) => {
    const end = new Date(ev.date.getFullYear(), ev.date.getMonth(), ev.date.getDate() + 1)
    lines.push(
      'BEGIN:VEVENT',
      `UID:${icsDate(ev.date)}-${i}-donna-abatement`,
      `DTSTAMP:${icsStamp(now)}`,
      `DTSTART;VALUE=DATE:${icsDate(ev.date)}`,
      `DTEND;VALUE=DATE:${icsDate(end)}`,
      `SUMMARY:${icsText(ev.title)}`,
      `DESCRIPTION:${icsText(ev.description)}`,
      'TRANSP:TRANSPARENT',
    )
    if (ev.remindDaysBefore) {
      lines.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `TRIGGER:-P${ev.remindDaysBefore}D`,
        `DESCRIPTION:${icsText(ev.title)}`,
        'END:VALARM',
      )
    }
    lines.push('END:VEVENT')
  })

  lines.push('END:VCALENDAR')
  // CRLF throughout, with a trailing break, as the spec requires.
  return lines.flatMap(fold).join('\r\n') + '\r\n'
}

/**
 * Hand the file to the browser. Nothing is uploaded: the calendar is assembled
 * from what is already on screen and saved straight to the user's own disk.
 */
export function downloadIcs(filename: string, ics: string): void {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
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
