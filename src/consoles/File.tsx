/**
 * Console 07 — preparing the application.
 *
 * Everything here is either an official link, a document the owner
 * downloads, or text they can read and edit. This page never files anything
 * and never speaks for anyone.
 *
 * The form itself is the official State Tax Form 128, filled in the browser
 * from the figures already on screen. Two fields are left deliberately
 * blank: the signature, and the opinion of value, which is the number the
 * owner is asking the city to accept and has to be theirs.
 */
import * as Label from '@radix-ui/react-label'
import { useCallback, useId, useMemo, useState } from 'react'
import { Console } from '../components/Console'
import { btnPrimary, btnSecondary, CopyButton, ExternalLink, Note } from '../components/ui'
import type { AssessmentResult } from '../lib/assess'
import { buildCaseSummary } from '../lib/caseSummary'
import type { CalendarDay } from '../lib/deadline'
import { downloadFile } from '../lib/ics'
import { money } from '../lib/format'
import { ASSESSORS_OFFICE, EVIDENCE_GUIDANCE, LINKS } from '../lib/legal'
import { buildEvidencePacket, fillForm128, packetFilename } from '../lib/packet'
import type { RecordCheck } from '../lib/recordCheck'
import {
  buildReferral,
  configuredNavigator,
  encodeReview,
  referralMailto,
} from '../lib/referral'
import type { TriageAnswers } from '../lib/triage'
import type { Property } from '../lib/types'
import type { ValuationResult } from '../lib/valuation'

interface Props {
  subject: Property | null
  valuation: ValuationResult | null
  equity: AssessmentResult | null
  checks: RecordCheck[]
  answers: TriageAnswers
  deadline: CalendarDay
}

const OFFICIAL = [
  {
    href: LINKS.form128,
    label: 'State Tax Form 128',
    note: 'The official abatement application, on the state’s own page.',
  },
  {
    href: LINKS.bostonAbatements,
    label: 'Boston Assessing Department',
    note: 'Your Board of Assessors — where the application is filed, and who decides it.',
  },
  {
    href: LINKS.abatementGuide,
    label: 'How an abatement works',
    note: 'The Secretary of the Commonwealth’s plain-language guide to the process.',
  },
  {
    href: LINKS.atb,
    label: 'Appellate Tax Board',
    note: 'Where an appeal goes if the assessors deny your application, or never answer it.',
  },
]

export function FileAppeal({ subject, valuation, equity, checks, answers, deadline }: Props) {
  const nameId = useId()
  const phoneId = useId()
  const opinionId = useId()

  const [ownerName, setOwnerName] = useState('')
  const [phone, setPhone] = useState('')
  const [opinion, setOpinion] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [downloaded, setDownloaded] = useState<string | null>(null)

  const purchase = useMemo(
    () =>
      answers.purchasePrice && answers.purchaseDate
        ? { price: answers.purchasePrice, date: answers.purchaseDate }
        : null,
    [answers.purchasePrice, answers.purchaseDate],
  )

  const recordErrors = useMemo(
    () => (answers.recordWrong === true ? checks.map((check) => check.title) : []),
    [answers.recordWrong, checks],
  )

  const caseInput = useMemo(
    () =>
      subject
        ? {
            subject,
            valuation,
            equity,
            deadline,
            purchase,
            recordErrors,
            opinionOfValue: opinion,
            ownerName: ownerName || null,
            phone: phone || null,
          }
        : null,
    [subject, valuation, equity, deadline, purchase, recordErrors, opinion, ownerName, phone],
  )

  /** A sensible default for the opinion of value, which the owner can change. */
  const suggested =
    valuation?.status === 'valued' && valuation.overAssessed
      ? valuation.indicatedValue
      : equity?.status === 'scored' && equity.outOfLine
        ? Math.round(equity.proportionate)
        : null

  const summary = useMemo(
    () => (caseInput ? buildCaseSummary(caseInput) : ''),
    [caseInput],
  )

  const referral = useMemo(() => {
    if (!subject) return ''
    const notes: string[] = []
    if (answers.ownerOccupied === true) notes.push('Lives in the property as their main home.')
    if (answers.ownerOccupied === false) notes.push('Does not live in the property.')
    if (answers.valueTooHigh === true) notes.push('Believes the value is above what it would sell for.')
    if (purchase) {
      notes.push(`Bought on ${purchase.date} for ${money(purchase.price)}.`)
    }
    if (answers.recordWrong === true) notes.push('Says the city’s record is wrong.')
    if (answers.conditionProblems === true) notes.push('Reports condition problems.')
    return buildReferral({
      subject,
      valuation,
      equity,
      filingDeadline: deadline,
      recordFlags: checks.map((check) => ({ title: check.title, detail: check.detail })),
      notes,
      contact: { name: ownerName || null, phone: phone || null },
    })
  }, [subject, valuation, equity, deadline, checks, answers, purchase, ownerName, phone])

  const navigator = configuredNavigator()

  const onForm = useCallback(async () => {
    if (!caseInput || !subject) return
    setBusy(true)
    setFormError(null)
    try {
      const bytes = await fillForm128(caseInput)
      downloadFile(packetFilename(subject, 'form'), bytes as BlobPart, 'application/pdf')
      setDownloaded('Form 128 downloaded, filled in and ready to check and sign.')
    } catch {
      setFormError(
        'The blank form could not be loaded, so it has not been filled. You can download it from the state’s page above and copy your statement into it by hand.',
      )
    } finally {
      setBusy(false)
    }
  }, [caseInput, subject])

  const onPacket = useCallback(() => {
    if (!caseInput || !subject) return
    downloadFile(
      packetFilename(subject, 'packet'),
      buildEvidencePacket(caseInput),
      'text/plain;charset=utf-8',
    )
    setDownloaded('Evidence packet downloaded. Print it and staple it behind the form.')
  }, [caseInput, subject])

  const reviewLink = useMemo(() => {
    if (!referral) return null
    const base = `${window.location.origin}${window.location.pathname}`
    return `${base}#/review/${encodeReview(referral)}`
  }, [referral])

  return (
    <Console
      n="07"
      id="file"
      title="Prepare your application"
      lede="You file this yourself, on your own signature. This page fills the official form from the figures above, builds the evidence to go behind it, and hands the case to a person to check first."
    >
      <h3 className="m-0 text-[1.1rem]">The official pages</h3>
      <ul className="m-0 mt-3 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
        {OFFICIAL.map((item) => (
          <li
            key={item.href}
            className="flex flex-col items-start gap-2 rounded-xl border border-lines bg-paper px-4 py-4"
          >
            <ExternalLink href={item.href} className={btnSecondary}>
              {item.label}
            </ExternalLink>
            <p className="m-0 text-[0.9rem] text-muted">{item.note}</p>
          </li>
        ))}
      </ul>

      {!subject ? (
        <Note className="mt-6">
          Choose a property in step 01 and your application will be prepared here.
        </Note>
      ) : (
        <>
          <div className="mt-7 border-t border-lines pt-6">
            <h3 className="m-0 text-[1.1rem]">Your details</h3>
            <p className="m-0 mt-1 max-w-[62ch] text-[0.94rem] text-muted">
              These go on the form. They stay in your browser, and the page keeps no record of
              them once you close the tab.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label.Root htmlFor={nameId} className="font-semibold text-[0.94rem]">
                  Your name, as on the bill
                </Label.Root>
                <input
                  id={nameId}
                  type="text"
                  autoComplete="name"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="rounded-xl border border-lines bg-paper px-4 py-2.5 text-ink"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label.Root htmlFor={phoneId} className="font-semibold text-[0.94rem]">
                  Telephone
                </Label.Root>
                <input
                  id={phoneId}
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="rounded-xl border border-lines bg-paper px-4 py-2.5 text-ink"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label.Root htmlFor={opinionId} className="font-semibold text-[0.94rem]">
                  Your opinion of value
                </Label.Root>
                <input
                  id={opinionId}
                  type="text"
                  inputMode="numeric"
                  placeholder={suggested ? suggested.toLocaleString('en-US') : 'your figure'}
                  value={opinion ? opinion.toLocaleString('en-US') : ''}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^0-9]/g, '')
                    setOpinion(digits ? Number(digits) : null)
                  }}
                  aria-describedby={`${opinionId}-help`}
                  className="rounded-xl border border-lines bg-paper px-4 py-2.5 text-ink"
                />
                <p id={`${opinionId}-help`} className="m-0 text-[0.82rem] text-muted">
                  {suggested
                    ? `The comparison above points to about ${money(suggested)}, but this figure is yours to set.`
                    : 'What you believe the property was worth on January 1.'}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-7 border-t border-lines pt-6">
            <h3 className="m-0 text-[1.1rem]">Your documents</h3>
            <p className="m-0 mt-1 max-w-[62ch] text-[0.94rem] text-muted">
              Both are built in your browser from what is on this page. Read every line before
              you sign: this is prepared text, not advice, and anything that is not true of your
              property should be changed.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void onForm()}
                disabled={busy}
                className={btnPrimary}
              >
                {busy ? 'Filling the form…' : 'Download Form 128, filled in'}
              </button>
              <button type="button" onClick={onPacket} className={btnSecondary}>
                Download the evidence packet
              </button>
            </div>
            <p role="status" aria-live="polite" className="m-0 mt-3 min-h-[1.2rem] text-[0.9rem] text-muted">
              {downloaded ?? ''}
            </p>
            {formError ? (
              <Note tone="warn" title="The form could not be filled" className="mt-2">
                <p className="m-0">{formError}</p>
              </Note>
            ) : null}
            <p className="m-0 mt-2 max-w-[62ch] text-[0.88rem] text-muted">
              The form is left editable, and the signature and date are left blank. Only you can
              sign it.
            </p>
          </div>

          <div className="mt-7 border-t border-lines pt-6">
            <h3 className="m-0 text-[1.1rem]">Your statement of case</h3>
            <p className="m-0 mt-1 max-w-[62ch] text-[0.94rem] text-muted">
              This is what goes in the “reason for the application” section, and it is already
              inside the two documents above.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <CopyButton text={summary} label="Copy the statement" copiedLabel="Statement copied" />
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
          </div>

          <div className="mt-7 border-t border-lines pt-6">
            <h3 className="m-0 text-[1.1rem]">Have a person check it</h3>
            <Note tone="brand" title="What a reviewer catches that a calculation cannot" className="mt-3">
              <p className="m-0">
                Who actually owns the property and in what form, whether the tax has been paid as
                billed, the condition of the building, an exemption nobody claimed, and whether a
                second ground is worth raising. A navigator or legal-aid clinic should read this
                before you file, and complex cases should go to an attorney. This tool prepares
                documents; it does not represent you and it files nothing.
              </p>
            </Note>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {navigator ? (
                <a
                  href={referralMailto(navigator, subject, referral)}
                  className={btnPrimary}
                >
                  Send to {navigator.name}
                </a>
              ) : null}
              <CopyButton
                text={referral}
                label="Copy the reviewer summary"
                copiedLabel="Summary copied"
                className={btnSecondary}
              />
              {reviewLink ? (
                <CopyButton
                  text={reviewLink}
                  label="Copy a review link"
                  copiedLabel="Review link copied"
                  className={btnSecondary}
                />
              ) : null}
            </div>
            <p className="m-0 mt-3 max-w-[62ch] text-[0.88rem] text-muted">
              {navigator
                ? 'The button opens your own mail app with the summary in it. Nothing is sent until you send it.'
                : 'No partner clinic is configured in this build, so the summary is yours to send. A review link opens the case in a reviewer’s browser without anything being stored anywhere.'}
            </p>
          </div>

          <div className="mt-7 border-t border-lines pt-6">
            <h3 className="m-0 text-[1.1rem]">Before you send it</h3>
            <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0 text-[0.94rem]">
              {[
                `Attach ${EVIDENCE_GUIDANCE}`,
                'Check the floor area, year built and room counts on your record. If any is wrong, say so — that is a ground of its own.',
                'Photograph anything a buyer would hold against the property, and attach it.',
                'Sign and date the form. Only you can do this.',
                'Pay your tax bill as billed, on time, even while the application is pending.',
                `Take or post it to ${ASSESSORS_OFFICE.room}, ${ASSESSORS_OFFICE.address}.`,
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
        </>
      )}
    </Console>
  )
}
