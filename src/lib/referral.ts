/**
 * Handing the case to a person.
 *
 * The product promises that a navigator or clinic reviews the application
 * before it is filed. That promise was a sentence in the interface and
 * nothing more, which is the worst kind of claim to make: it reads as a
 * safeguard and does not exist.
 *
 * What exists now, with no server to run and no account to create:
 *
 *   - a referral summary a navigator can read in under a minute;
 *   - a mail link that opens the owner's own mail client, addressed to the
 *     partner clinic, with that summary in the body;
 *   - a reviewer view at #/review, which renders a case a navigator has been
 *     sent so they can check it against the figures.
 *
 * The owner sends it. Nothing leaves the browser on its own.
 */
import type { AssessmentResult } from './assess'
import type { CalendarDay } from './deadline'
import { longDate, money, moneyCents, pct, titleCase } from './format'
import type { Property } from './types'
import type { ValuationResult } from './valuation'

/**
 * The partner a referral goes to. Set at build time so a clinic can run its
 * own copy without touching the code:
 *
 *   VITE_NAVIGATOR_EMAIL=intake@example.org
 *   VITE_NAVIGATOR_NAME="Example Housing Clinic"
 *
 * With no partner configured the interface offers the summary to copy rather
 * than pretending there is somewhere to send it.
 */
export interface Navigator {
  name: string
  email: string
}

export function configuredNavigator(): Navigator | null {
  const email = import.meta.env.VITE_NAVIGATOR_EMAIL as string | undefined
  const name = import.meta.env.VITE_NAVIGATOR_NAME as string | undefined
  if (!email || !email.includes('@')) return null
  return { name: name || 'the partner clinic', email }
}

export interface ReferralInput {
  subject: Property
  valuation: ValuationResult | null
  equity: AssessmentResult | null
  filingDeadline: CalendarDay
  recordFlags: { title: string; detail: string }[]
  /** What the owner said, when they answered the questions. */
  notes?: string[]
  /** How to reach the owner. Only what they chose to type. */
  contact?: { name?: string | null; email?: string | null; phone?: string | null }
}

/**
 * The reviewer's summary: the facts, the figures, and the specific things a
 * person should check that a calculation cannot see.
 */
export function buildReferral(input: ReferralInput): string {
  const { subject, valuation, equity, filingDeadline, recordFlags } = input
  const lines: string[] = []

  lines.push('ABATEMENT CASE FOR REVIEW')
  lines.push('')
  lines.push(`Property       ${titleCase(subject.addr)}`)
  lines.push(`Parcel         ${subject.pid}`)
  lines.push(`Fiscal year    FY${subject.fy}  (assessed as of January 1, ${subject.fy - 1})`)
  lines.push(`Assessed       ${money(subject.tv)}`)
  lines.push(
    `Type           ${subject.luDesc ?? subject.lu ?? 'unknown'}${
      subject.la ? `, ${subject.la.toLocaleString('en-US')} sq ft` : ''
    }${subject.yr ? `, built ${subject.yr}` : ''}`,
  )
  lines.push(
    `Res. exemption ${subject.ex === 1 ? 'applied' : subject.ex === 0 ? 'NOT APPLIED' : 'unknown'}`,
  )
  lines.push(`File by        ${longDate(filingDeadline)}, 5:00 pm`)
  lines.push('')

  if (input.contact && (input.contact.name || input.contact.email || input.contact.phone)) {
    lines.push('OWNER')
    if (input.contact.name) lines.push(`  ${input.contact.name}`)
    if (input.contact.email) lines.push(`  ${input.contact.email}`)
    if (input.contact.phone) lines.push(`  ${input.contact.phone}`)
    lines.push('')
  }

  lines.push('WHAT THE TOOL FOUND')
  if (valuation?.status === 'valued') {
    lines.push(
      `  Sales comparison: ${valuation.comps.length} comps over ${valuation.windowMonths} months indicate ${money(valuation.indicatedValue)} (range ${money(valuation.low)}–${money(valuation.high)}).`,
    )
    lines.push(
      valuation.overAssessed
        ? `  Assessed ${money(valuation.aboveRange)} ABOVE the top of that range.`
        : '  Assessment sits inside the range the sales support.',
    )
    lines.push(`  Adjustment method: ${valuation.model.method}.`)
  } else if (valuation?.status === 'insufficient-sales') {
    lines.push(
      `  Sales comparison: not enough evidence (${valuation.found} of ${valuation.needed} needed, ${valuation.windowMonths}-month window).`,
    )
  } else {
    lines.push('  Sales comparison: not run for this property.')
  }

  if (equity?.status === 'scored') {
    lines.push(
      `  Equity comparison: ${moneyCents(equity.subjPsf)}/sq ft against a median of ${moneyCents(equity.medPsf)} across ${equity.compCount} same-type properties (${pct(equity.ratio - 1)} above).`,
    )
    if (equity.criteria.widened) {
      lines.push('  NOTE: the equity pool was widened across property classes. Treat with care.')
    }
  }
  lines.push('')

  if (recordFlags.length > 0) {
    lines.push('RECORD ISSUES TO CHECK')
    for (const flag of recordFlags) lines.push(`  — ${flag.title}: ${flag.detail}`)
    lines.push('')
  }

  if (input.notes && input.notes.length > 0) {
    lines.push('WHAT THE OWNER TOLD US')
    for (const note of input.notes) lines.push(`  — ${note}`)
    lines.push('')
  }

  lines.push('FOR THE REVIEWER')
  lines.push('  The things this tool cannot see:')
  lines.push('    — Who actually owns the property, and in what form (trust, LLC, probate).')
  lines.push('    — Whether the tax has been paid as billed, which preserves the appeal.')
  lines.push('    — The condition of the building, and anything a photograph would show.')
  lines.push('    — Any exemption the household qualifies for but has never claimed.')
  lines.push('    — Whether a second ground is worth raising alongside the first.')
  lines.push('')
  lines.push('  Prepared by Donna from public records. Legal information, not legal advice.')

  return lines.join('\n')
}

/** A mail link that opens the owner's own client with the summary in it. */
export function referralMailto(navigator: Navigator, subject: Property, body: string): string {
  const title = `Abatement review — ${titleCase(subject.addr)} (FY${subject.fy})`
  // Mail clients vary in what length they accept, so the body is trimmed and
  // the interface also offers the whole thing to copy.
  const trimmed = body.length > 1800 ? `${body.slice(0, 1800)}\n\n[continues — full summary attached]` : body
  return `mailto:${encodeURIComponent(navigator.email)}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(trimmed)}`
}

/**
 * A reviewer opens a case through a link that carries it, so nothing has to
 * be stored anywhere. The payload is the referral text, base64 in the hash.
 */
export function encodeReview(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeReview(encoded: string): string | null {
  try {
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}
