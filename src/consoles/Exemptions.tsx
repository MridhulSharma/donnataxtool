/**
 * Console 05 — exemptions.
 *
 * An abatement argues the value is wrong. An exemption says the owner
 * qualifies for relief whatever the value is. They are separate
 * applications with different deadlines, and for many households the
 * exemption is worth more. A tool that only mentions abatements quietly
 * costs its users the larger saving.
 */
import { Console } from '../components/Console'
import { Chip, ExternalLink, Note, btnSecondary } from '../components/ui'
import type { CalendarDay } from '../lib/deadline'
import { exemptionLeads } from '../lib/exemptions'
import { longDate } from '../lib/format'
import { ASSESSORS_OFFICE } from '../lib/legal'
import type { TriageAnswers } from '../lib/triage'
import type { Property } from '../lib/types'

interface Props {
  subject: Property | null
  answers: TriageAnswers
  deadline: CalendarDay
}

export function Exemptions({ subject, answers, deadline }: Props) {
  const leads = subject ? exemptionLeads(subject, answers) : []
  const missing = leads.filter((lead) => lead.status === 'missing')

  return (
    <Console
      n="05"
      id="exemptions"
      title="Exemptions you may be owed"
      lede="These are separate from an abatement, with their own deadline and their own form. Applying for one does not affect the other, and for many households the exemption is worth more."
    >
      {!subject ? (
        <Note>Choose a property in step 01 to see what may apply to it.</Note>
      ) : (
        <div aria-live="polite">
          <Note
            tone={missing.length > 0 ? 'warn' : 'brand'}
            title={`Exemption deadline: ${longDate(deadline)}`}
          >
            <p className="m-0">
              This is a different date from the abatement deadline. Confirm it against the city's
              own page before you rely on it, and note that the application only opens once the
              third-quarter tax bills are issued in late December.
            </p>
          </Note>

          <ul className="m-0 mt-5 flex list-none flex-col gap-3 p-0">
            {leads.map((lead) => (
              <li
                key={lead.id}
                className={[
                  'rounded-xl border px-4 py-3',
                  lead.status === 'missing'
                    ? 'border-[var(--warn)] bg-[var(--warn-soft)]'
                    : 'border-lines bg-paper',
                ].join(' ')}
              >
                <p className="m-0 flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{lead.title}</span>
                  {/* Never colour alone: the state is written out. */}
                  {lead.status === 'applied' ? (
                    <Chip tone="good">Already applied</Chip>
                  ) : lead.status === 'missing' ? (
                    <Chip tone="warn">Worth claiming</Chip>
                  ) : (
                    <Chip tone="neutral">Check if you qualify</Chip>
                  )}
                </p>
                <p className="m-0 mt-1 max-w-[66ch] text-[0.94rem] text-muted">{lead.who}</p>
                <p className="m-0 mt-1.5 max-w-[66ch] text-[0.94rem]">{lead.detail}</p>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-col gap-3 border-t border-lines pt-5">
            <div className="flex flex-wrap gap-3">
              <ExternalLink href={leads[0]?.link ?? ''} className={btnSecondary}>
                Exemptions at the City of Boston
              </ExternalLink>
            </div>
            <p className="m-0 max-w-[62ch] text-[0.9rem] text-muted">
              Eligibility rules, income limits and asset limits are set by the city and reviewed
              each year, so this page does not state them. The Taxpayer Referral and Assistance
              Center will tell you which you qualify for: {ASSESSORS_OFFICE.phone}.
            </p>
          </div>
        </div>
      )}
    </Console>
  )
}
