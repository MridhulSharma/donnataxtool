/**
 * Answers short enough to be read down a telephone or sent as a text message.
 *
 * A remedy reachable only by someone with a screen, a keyboard, fluent
 * English and broadband is not reachable by the people who need it most. The
 * route to them is a phone, so the answers a resident most often needs are
 * written here as plain functions with no interface around them: what is my
 * deadline, am I owed an exemption, what is my property assessed at.
 *
 * Nothing here sends anything. There is no telephony account, no number, and
 * no server to run one from, so this is the half that can be built honestly
 * today: the content, the length limit, and a transport interface a partner
 * can implement when there is somewhere to send it. A stub transport records
 * what would have gone out, so the answers can be tested end to end without
 * a message ever being sent.
 */
import type { CalendarDay } from './deadline'
import { longDate, money } from './format'
import type { Property } from './types'

/** One text message. Longer answers are split, never truncated mid-sentence. */
export const SMS_LIMIT = 320

export type OutreachIntent = 'deadline' | 'assessment' | 'exemption' | 'help' | 'unknown'

/** What a resident asked, in their own words. */
export function classify(message: string): OutreachIntent {
  const text = message.toLowerCase()
  if (/\b(deadline|due|when|date|late|file by)\b/.test(text)) return 'deadline'
  if (/\b(exempt|residential exemption|senior|veteran|blind|discount)\b/.test(text)) {
    return 'exemption'
  }
  if (/\b(assess|value|worth|bill|tax|how much)\b/.test(text)) return 'assessment'
  if (/\b(help|what|how|start|hello|hi)\b/.test(text)) return 'help'
  return 'unknown'
}

export interface OutreachContext {
  property: Property | null
  filingDeadline: CalendarDay
  /** Where a person can be reached, for the hand-off line. */
  navigatorPhone?: string | null
}

/** The answer, in plain language, split into message-sized pieces. */
export function answer(intent: OutreachIntent, context: OutreachContext): string[] {
  const { property, filingDeadline } = context
  const handoff = context.navigatorPhone
    ? ` A person can help on ${context.navigatorPhone}.`
    : ''

  switch (intent) {
    case 'deadline':
      return split(
        `Your abatement application is due ${longDate(filingDeadline)} by 5pm, at the Assessing Department, Room 301, Boston City Hall. Missing it ends your appeal for the year. Pay your tax bill as billed anyway, or you lose the right to appeal.${handoff}`,
      )

    case 'assessment':
      if (!property) {
        return split(
          `Text your street address and I will read back what the city has your property assessed at.${handoff}`,
        )
      }
      return split(
        `${property.addr} is assessed at ${money(property.tv)} for FY${property.fy}, as of January 1 ${property.fy - 1}.${
          property.la ? ` The city records ${property.la.toLocaleString('en-US')} sq ft.` : ''
        } If that square footage is wrong, that alone is a reason to apply for an abatement.${handoff}`,
      )

    case 'exemption':
      return split(
        `The residential exemption is for owners living in their own home, and it comes off your taxable value. It is a separate application from an abatement, due April 1. There are also exemptions for older owners, veterans, blind owners and hardship. Call the Taxpayer Referral Center on 617-635-4287.${handoff}`,
      )

    case 'help':
      return split(
        `I can tell you three things: your filing deadline, what the city has your property assessed at, and which exemptions might be open to you. Text your street address to start.${handoff}`,
      )

    default:
      return split(
        `Sorry, I did not follow that. Text your street address, or the word DEADLINE, ASSESSMENT or EXEMPTION.${handoff}`,
      )
  }
}

/** Break a message on sentence boundaries, never mid-word. */
export function split(text: string, limit = SMS_LIMIT): string[] {
  if (text.length <= limit) return [text]
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text]
  const out: string[] = []
  let current = ''
  for (const sentence of sentences) {
    if (current.length + sentence.length <= limit) {
      current += sentence
    } else {
      if (current.trim()) out.push(current.trim())
      current = sentence
    }
  }
  if (current.trim()) out.push(current.trim())
  return out.map((part, i, all) => (all.length > 1 ? `(${i + 1}/${all.length}) ${part}` : part))
}

/* ------------------------------------------------------------------ *
 * Transport
 * ------------------------------------------------------------------ */

/**
 * What a partner implements to make this live. Deliberately small: a
 * telephony provider, a clinic's own messaging system or a volunteer with a
 * phone can all satisfy it.
 */
export interface OutreachTransport {
  name: string
  send(to: string, parts: string[]): Promise<{ sent: boolean; reason?: string }>
}

/** A transport that records what it was asked to send, for testing. */
export interface StubTransport extends OutreachTransport {
  sent: { to: string; parts: string[]; at: string }[]
}

/**
 * The transport this build ships with. It sends nothing, and says so. It
 * exists so the answers above can be tested, and so that turning this on is
 * a matter of supplying a transport rather than writing the feature.
 */
export const stubTransport: StubTransport = {
  name: 'stub (nothing is sent)',
  sent: [],
  async send(to: string, parts: string[]) {
    stubTransport.sent.push({ to, parts, at: new Date().toISOString() })
    return {
      sent: false,
      reason:
        'No messaging transport is configured in this build. The reply was composed but not sent.',
    }
  },
}

/** Handle one inbound message end to end. */
export async function handle(
  message: string,
  context: OutreachContext,
  transport: OutreachTransport = stubTransport,
  from = 'unknown',
): Promise<{ intent: OutreachIntent; parts: string[]; sent: boolean; reason?: string }> {
  const intent = classify(message)
  const parts = answer(intent, context)
  const result = await transport.send(from, parts)
  return { intent, parts, sent: result.sent, reason: result.reason }
}
