/**
 * Console 05 — filing.
 *
 * Everything here is either an official link or text the homeowner can read,
 * edit and sign. This page never files anything and never speaks for anyone.
 */
import { useMemo } from 'react'
import { Console } from '../components/Console'
import { CopyButton, ExternalLink, Note, btnSecondary } from '../components/ui'
import type { AssessmentResult } from '../lib/assess'
import { buildCaseSummary } from '../lib/caseSummary'
import { nextDeadline } from '../lib/deadline'
import type { Property } from '../lib/types'

interface Props {
  subject: Property | null
  result: AssessmentResult | null
}

const OFFICIAL = [
  {
    href: 'https://www.mass.gov/lists/property-tax-forms-and-guides',
    label: 'State Tax Form 128',
    note: 'The abatement application itself. Download it, fill it in, and sign it.',
  },
  {
    href: 'https://www.boston.gov/departments/assessing',
    label: 'Boston Assessing Department',
    note: 'Your Board of Assessors — where the application is filed, and who decides it.',
  },
  {
    href: 'https://www.sec.state.ma.us/divisions/cis/tax/property-abatement.htm',
    label: 'How an abatement works',
    note: "The Secretary of the Commonwealth's plain-language guide to the process.",
  },
  {
    href: 'https://www.mass.gov/orgs/appellate-tax-board',
    label: 'Appellate Tax Board',
    note: 'Where an appeal goes if the assessors deny your application, or never answer it.',
  },
]

export function FileAppeal({ subject, result }: Props) {
  const deadline = useMemo(() => nextDeadline().date, [])

  const summary = useMemo(
    () => (subject && result ? buildCaseSummary(subject, result, deadline) : ''),
    [subject, result, deadline],
  )

  return (
    <Console
      n="05"
      id="file"
      title="File your appeal"
      lede="You file this yourself, with the official form, on your own signature. Below are the four pages you need and a draft statement of your case, written from the figures above."
    >
      <h3 className="m-0 text-[1.1rem]">The official pages</h3>
      <ul className="m-0 mt-3 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
        {OFFICIAL.map((o) => (
          <li
            key={o.href}
            className="flex flex-col items-start gap-2 rounded-xl border border-lines bg-paper px-4 py-4"
          >
            <ExternalLink href={o.href} className={btnSecondary}>
              {o.label}
            </ExternalLink>
            <p className="m-0 text-[0.9rem] text-muted">{o.note}</p>
          </li>
        ))}
      </ul>

      <div className="mt-7 border-t border-lines pt-6">
        <h3 className="m-0 text-[1.1rem]">Your draft statement of case</h3>
        <p className="m-0 mt-1 max-w-[62ch] text-[0.94rem] text-muted">
          This is prepared text, not advice. It states the facts and the arithmetic already on this
          page, in the first person, and claims nothing about the outcome. Read every line, change
          anything that is not true of your home, and paste it into the “reason for the application”
          section of Form 128.
        </p>

        <div aria-live="polite" className="mt-4">
          {!subject || !result ? (
            <Note>
              Choose a property in step 01 and a draft statement will be prepared here from its
              figures.
            </Note>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <CopyButton
                  text={summary}
                  label="Copy draft statement"
                  copiedLabel="Statement copied"
                />
              </div>
              <div
                role="region"
                aria-label="Draft statement of case"
                tabIndex={0}
                className="mt-4 max-h-[26rem] overflow-auto rounded-xl border border-lines bg-paper"
              >
                <pre className="tnum m-0 whitespace-pre-wrap break-words px-4 py-4 font-sans text-[0.9rem] leading-relaxed">
                  {summary}
                </pre>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-7 border-t border-lines pt-6">
        <h3 className="m-0 text-[1.1rem]">Before you send it</h3>
        <Note tone="brand" title="Have a person review this with you" className="mt-3">
          <p className="m-0">
            A navigator or a legal-aid clinic should read your application before you file it. They
            catch the things a calculation cannot see — an ownership question, a recent sale, a
            condition problem, a second ground worth raising — and complex cases are escalated to an
            attorney. This tool prepares documents; it does not represent you, and it never files
            anything on your behalf.
          </p>
        </Note>

        <ul className="m-0 mt-4 flex list-none flex-col gap-2 p-0 text-[0.94rem]">
          {[
            'Attach 3–5 comparable sales from the last 6–12 months, plus the comparable assessments above.',
            'Check the living area and year built on your bill. If either is wrong, say so in the application — that is a ground of its own.',
            'Sign and date the form. Only you can do this.',
            'Pay your tax bill as billed, on time, even while the application is pending.',
            'File on or before the due date of your first actual tax bill. There is no late filing.',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                aria-hidden="true"
                focusable="false"
                className="mt-[5px] shrink-0"
                fill="none"
                stroke="var(--brand)"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 12.5l5 5L20 6.5" />
              </svg>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </Console>
  )
}
