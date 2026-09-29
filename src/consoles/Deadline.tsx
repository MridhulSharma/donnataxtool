/**
 * Console 04 — the deadline.
 *
 * This is the console that actually protects the homeowner. Missing the due date
 * of the first actual tax bill forfeits the year with no cure, so the date is
 * stated, counted down, copyable, and exportable to a calendar.
 *
 * The ticking figures are aria-hidden: a live region that changed every second
 * would make the page unusable with a screen reader. The sentence underneath
 * carries the same fact and changes at most once a day.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Console } from '../components/Console'
import { btnSecondary, CopyButton, Note } from '../components/ui'
import { buildDeadlineDetails } from '../lib/caseSummary'
import { appealTimeline, countdown, type Countdown } from '../lib/deadline'
import { longDate, titleCase } from '../lib/format'
import { buildIcs, downloadIcs } from '../lib/ics'
import type { Property } from '../lib/types'

const TICK_MS = 1000

function useCountdown(): Countdown {
  const [cd, setCd] = useState<Countdown>(() => countdown())

  useEffect(() => {
    const id = window.setInterval(() => setCd(countdown()), TICK_MS)
    return () => window.clearInterval(id)
  }, [])

  return cd
}

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl border border-lines bg-paper px-2 py-3 text-center">
      <p className="tnum m-0 font-display text-[1.6rem] font-semibold leading-none sm:text-[2.1rem]">
        {value}
      </p>
      <p className="m-0 mt-1 text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-muted">
        {label}
      </p>
    </div>
  )
}

/** One dated step in the sequence that follows the filing. */
function Step({
  ordinal,
  when,
  title,
  children,
}: {
  ordinal: string
  when: string
  title: string
  children: ReactNode
}) {
  return (
    <li className="relative border-l-2 border-lines pb-5 pl-5 last:pb-0">
      <span
        aria-hidden="true"
        className="absolute -left-[7px] top-[8px] h-3 w-3 rounded-full border-2 border-brand bg-surface"
      />
      <p className="m-0 text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-muted">
        Step {ordinal} · {when}
      </p>
      <p className="m-0 mt-0.5 font-semibold">{title}</p>
      <div className="mt-1 max-w-[62ch] text-[0.94rem] text-muted">{children}</div>
    </li>
  )
}

export function Deadline({ subject }: { subject: Property | null }) {
  const cd = useCountdown()
  const { filingDeadline, assessorsDecideBy, atbPetitionBy } = appealTimeline(cd.date)
  const [saved, setSaved] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const details = useCallback(
    () => buildDeadlineDetails(subject, filingDeadline, assessorsDecideBy, atbPetitionBy),
    [subject, filingDeadline, assessorsDecideBy, atbPetitionBy],
  )

  const onCalendar = useCallback(() => {
    const where = subject ? ` — ${titleCase(subject.addr)}` : ''
    const ics = buildIcs([
      {
        date: filingDeadline,
        title: `File property tax abatement (Form 128)${where}`,
        remindDaysBefore: 14,
        description: details(),
      },
      {
        date: assessorsDecideBy,
        title: 'Abatement deemed denied if the assessors have not acted',
        remindDaysBefore: 7,
        description:
          'The Board of Assessors has 3 months to act on an abatement application. If they have not, it is "deemed denied" today, and you have 3 months from here to petition the Appellate Tax Board.',
      },
      {
        date: atbPetitionBy,
        title: 'Last day to petition the Appellate Tax Board',
        remindDaysBefore: 14,
        description:
          'Three months after a denial, actual or deemed, is the deadline to petition the Appellate Tax Board. The small-claims track costs roughly $65.',
      },
    ])
    downloadIcs(`abatement-deadlines-${filingDeadline.getFullYear()}.ics`, ics)
    setSaved(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setSaved(false), 4000)
  }, [subject, filingDeadline, assessorsDecideBy, atbPetitionBy, details])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const daysWord = cd.daysLeft === 1 ? 'day' : 'days'

  return (
    <Console
      n="04"
      id="deadline"
      title="Your filing deadline"
      lede="An abatement application is due on the due date of your first actual tax bill — in Boston, typically February 1. There is no extension and no late filing: missing it forfeits your right to appeal for that year."
    >
      <div className="rounded-card border border-brand bg-brand-soft px-5 py-5">
        <p className="m-0 text-[0.8rem] font-semibold uppercase tracking-[0.06em] text-muted">
          File on or before
        </p>
        <p className="m-0 mt-1 font-display text-[1.4rem] font-semibold leading-tight sm:text-[1.8rem]">
          {longDate(filingDeadline)}
        </p>

        {/* Decorative repetition of the sentence below it; not announced. */}
        <div
          aria-hidden="true"
          className="mt-4 grid grid-cols-2 gap-2 sm:max-w-[26rem] sm:grid-cols-4"
        >
          <Unit value={cd.daysLeft} label="Days" />
          <Unit value={cd.hoursLeft} label="Hrs" />
          <Unit value={cd.minutesLeft} label="Min" />
          <Unit value={cd.secondsLeft} label="Sec" />
        </div>

        {/* The announced version of the same fact. */}
        <p role="status" aria-live="polite" className="m-0 mt-4 text-[0.98rem]">
          {cd.daysLeft > 0
            ? `You have about ${cd.daysLeft} ${daysWord} left to file for fiscal year ${cd.fiscalYear}.`
            : 'Today is the deadline for this fiscal year. File today — do not wait.'}
        </p>

        {cd.rolled ? (
          <p className="m-0 mt-2 text-[0.9rem] text-muted">
            February 1 falls on a weekend this year, so the due date moves to the next business day.
          </p>
        ) : null}

        <p className="m-0 mt-2 text-[0.9rem] text-muted">
          Confirm the exact date printed on your own bill — that date governs, not this page.
        </p>
      </div>

      <Note tone="warn" title="Pay the bill as billed, on time" className="mt-5">
        <p className="m-0">
          You must pay your tax as assessed to keep your right to appeal. Applying for an abatement
          does not pause the bill, and paying it does not weaken your application.
        </p>
      </Note>

      <h3 className="m-0 mt-7 text-[1.1rem]">What happens after you file</h3>
      <ol className="m-0 mt-4 list-none p-0">
        <Step ordinal="1" when={longDate(filingDeadline)} title="File with the Board of Assessors">
          State Tax Form 128 goes to your local Board of Assessors — not to a court, and not to the
          state. Good evidence is 3–5 comparable sales from the last 6–12 months.
        </Step>
        <Step
          ordinal="2"
          when={`by ${longDate(assessorsDecideBy)}`}
          title="The assessors have 3 months to act"
        >
          They may grant it, deny it, or do nothing. If they do not act within 3 months your
          application is <strong className="font-semibold text-ink">“deemed denied”</strong> — which
          is itself a decision you can appeal.
        </Step>
        <Step
          ordinal="3"
          when={`by ${longDate(atbPetitionBy)}`}
          title="Petition the Appellate Tax Board"
        >
          After a denial, actual or deemed, you have 3 months to petition the Appellate Tax Board.
          Its small-claims track costs roughly $65.
        </Step>
        <Step ordinal="4" when="throughout" title="A person reviews your work">
          A navigator or clinic checks the application before it is filed, and complex cases are
          escalated to an attorney. You make and sign every decision.
        </Step>
      </ol>

      <div className="mt-6 flex flex-col gap-3 border-t border-lines pt-5">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={onCalendar} className={btnSecondary}>
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              aria-hidden="true"
              focusable="false"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
              <path d="M3.5 10h17M8.5 3v4M15.5 3v4" />
            </svg>
            Add to calendar (.ics)
          </button>
          <CopyButton
            text={details}
            label="Copy deadline details"
            copiedLabel="Deadline details copied"
            className={btnSecondary}
          />
        </div>

        <p role="status" aria-live="polite" className="m-0 min-h-[1.2rem] text-[0.88rem] text-muted">
          {saved ? 'Calendar file downloaded. Open it to add all three dates.' : ''}
        </p>

        <p className="m-0 max-w-[62ch] text-[0.88rem] text-muted">
          The calendar file holds all three dates and is built in your browser — nothing is uploaded,
          and this page keeps no record of you.
        </p>
      </div>
    </Console>
  )
}
