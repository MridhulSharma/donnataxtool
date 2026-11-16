/**
 * Console 06 — the deadline.
 *
 * This is the console that actually protects the homeowner. Missing the due
 * date of the first actual tax bill forfeits the year with no cure, so the
 * date is stated, counted down in Boston's own clock, copyable and
 * exportable.
 *
 * The dates that follow a filing are deliberately NOT shown as fixed dates
 * until the owner says when they filed, because they run from the filing
 * date rather than from February 1. Showing them counted from the deadline
 * would hand someone who filed early an appeal deadline weeks too late, and
 * that limit is jurisdictional.
 *
 * The ticking figures are aria-hidden: a live region changing every second
 * makes a page unusable with a screen reader. The sentence underneath
 * carries the same fact and changes at most once a day.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Console } from '../components/Console'
import { btnSecondary, CopyButton, Note } from '../components/ui'
import { buildDeadlineDetails } from '../lib/caseSummary'
import type { CaseRecord } from '../lib/caseTrack'
import { appealTimeline, countdown, parseISO, type Countdown } from '../lib/deadline'
import { longDate, money, titleCase } from '../lib/format'
import { buildIcs, downloadIcs } from '../lib/ics'
import { atbEntryFee, ATB_MUNICIPAL_TRANSFER_FEE, EVIDENCE_GUIDANCE } from '../lib/legal'
import type { Property } from '../lib/types'

const TICK_MS = 1000

function useCountdown(): Countdown {
  const [value, setValue] = useState<Countdown>(() => countdown())
  useEffect(() => {
    const id = window.setInterval(() => setValue(countdown()), TICK_MS)
    return () => window.clearInterval(id)
  }, [])
  return value
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

interface Props {
  subject: Property | null
  caseRecord: CaseRecord | null
}

export function Deadline({ subject, caseRecord }: Props) {
  const clock = useCountdown()
  const filingDeadline = clock.deadline.date
  const filedOn = caseRecord?.filedOn ? parseISO(caseRecord.filedOn) : null
  const timeline = appealTimeline({ filedOn })
  const [saved, setSaved] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const fee = atbEntryFee(subject?.tv)
  const feeText = fee.amount === null ? 'depends on your assessed value' : money(fee.amount)

  const details = useCallback(
    () =>
      buildDeadlineDetails({
        subject,
        filingDeadline,
        filedOn,
        assessorsDecideBy: timeline.assessorsDecideBy,
        atbPetitionBy: timeline.atbPetitionBy,
        atbFee: `${feeText} — ${fee.basis}`,
      }),
    [subject, filingDeadline, filedOn, timeline, feeText, fee.basis],
  )

  const onCalendar = useCallback(() => {
    const where = subject ? ` — ${titleCase(subject.addr)}` : ''
    const events = [
      {
        date: filingDeadline,
        title: `File property tax abatement (Form 128)${where}`,
        remindDaysBefore: 14,
        description: details(),
      },
    ]
    // The later dates only exist once there is a filing date to count from.
    if (timeline.deemedDeniedOn) {
      events.push({
        date: timeline.deemedDeniedOn,
        title: 'Abatement deemed denied if the assessors have not acted',
        remindDaysBefore: 7,
        description:
          'Three months from the day you filed. If the assessors have not acted, your application is deemed denied today, and you have three months from here to petition the Appellate Tax Board.',
      })
    }
    if (timeline.atbPetitionBy) {
      events.push({
        date: timeline.atbPetitionBy,
        title: 'Last day to petition the Appellate Tax Board',
        remindDaysBefore: 21,
        description: `Three months after the denial, actual or deemed. This limit is jurisdictional: the Board cannot hear a late appeal. Entry fee for your assessed value: ${feeText}.`,
      })
    }
    downloadIcs(`abatement-deadlines-${filingDeadline.year}.ics`, buildIcs(events))
    setSaved(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setSaved(false), 4000)
  }, [subject, filingDeadline, timeline, details, feeText])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const daysWord = clock.daysLeft === 1 ? 'day' : 'days'

  return (
    <Console
      n="06"
      id="deadline"
      title="Your filing deadline"
      lede="An abatement application is due on the due date of your first actual tax bill — in Boston, typically February 1. There is no extension and no late filing: missing it forfeits your right to appeal for that year."
    >
      <div className="rounded-card border border-brand bg-brand-soft px-5 py-5">
        <p className="m-0 text-[0.8rem] font-semibold uppercase tracking-[0.06em] text-muted">
          File on or before
        </p>
        <p className="m-0 mt-1 font-display text-[1.4rem] font-semibold leading-tight sm:text-[1.8rem]">
          {longDate(filingDeadline)}, 5:00 pm
        </p>

        {/* Decorative repetition of the sentence below it; not announced. */}
        <div
          aria-hidden="true"
          className="mt-4 grid grid-cols-2 gap-2 sm:max-w-[26rem] sm:grid-cols-4"
        >
          <Unit value={clock.daysLeft} label="Days" />
          <Unit value={clock.hoursLeft} label="Hrs" />
          <Unit value={clock.minutesLeft} label="Min" />
          <Unit value={clock.secondsLeft} label="Sec" />
        </div>

        {/* The announced version of the same fact. */}
        <p role="status" aria-live="polite" className="m-0 mt-4 text-[0.98rem]">
          {clock.daysLeft > 0
            ? `You have about ${clock.daysLeft} ${daysWord} left to file for fiscal year ${clock.deadline.fiscalYear}.`
            : clock.passed
              ? 'The 5:00 pm cut-off for this fiscal year has passed. Speak to a navigator about what remains open to you.'
              : 'Today is the deadline for this fiscal year. File today, before 5:00 pm.'}
        </p>

        {clock.deadline.rolled ? (
          <p className="m-0 mt-2 text-[0.9rem] text-muted">
            February 1 falls on a weekend this year, so the due date moves to the next business
            day.
          </p>
        ) : null}

        <p className="m-0 mt-2 text-[0.9rem] text-muted">
          Times are Boston time, wherever you are reading this. The 5:00 pm cut-off is the one
          the city has used at City Hall — confirm the exact date and time printed on your own
          bill, because that is what governs, not this page.
        </p>
      </div>

      <Note tone="warn" title="Pay the bill as billed, on time" className="mt-5">
        <p className="m-0">
          You must pay your tax as assessed to keep your right to appeal. Applying for an
          abatement does not pause the bill, and paying it does not weaken your application.
        </p>
      </Note>

      <h3 className="m-0 mt-7 text-[1.1rem]">What happens after you file</h3>
      <p className="m-0 mt-1 max-w-[62ch] text-[0.94rem] text-muted">
        Every date below is counted from the day you actually file, not from February 1. File
        two weeks early and they all move two weeks earlier with you.
      </p>
      <ol className="m-0 mt-4 list-none p-0">
        <Step
          ordinal="1"
          when={filedOn ? `filed ${longDate(filedOn)}` : `by ${longDate(filingDeadline)}`}
          title="File with the Board of Assessors"
        >
          State Tax Form 128 goes to your local Board of Assessors — not to a court, and not to
          the state. Good evidence is {EVIDENCE_GUIDANCE}
        </Step>
        <Step
          ordinal="2"
          when={
            timeline.deemedDeniedOn
              ? `by ${longDate(timeline.deemedDeniedOn)}`
              : 'three months after you file'
          }
          title="The assessors have 3 months to act"
        >
          They may grant it, deny it, or do nothing. If they do not act within three months of
          your filing, the application is{' '}
          <strong className="font-semibold text-ink">“deemed denied”</strong> — which is itself a
          decision you can appeal.
        </Step>
        <Step
          ordinal="3"
          when={
            timeline.atbPetitionBy
              ? `by ${longDate(timeline.atbPetitionBy)}`
              : 'three months after that'
          }
          title="Petition the Appellate Tax Board"
        >
          After a denial, actual or deemed, you have three months to petition the Board. This
          limit is jurisdictional: a late petition is dismissed whatever its merits. The entry
          fee is set by your assessed value — for this property, {feeText}. ({fee.basis} The
          widely quoted $
          {ATB_MUNICIPAL_TRANSFER_FEE} is not a taxpayer fee: it is what a municipality pays to
          move an appeal to the formal procedure.)
        </Step>
        <Step ordinal="4" when="throughout" title="A person reviews your work">
          A navigator or clinic checks the application before it is filed, and complex cases are
          escalated to an attorney. You make and sign every decision. Step 07 prepares the
          referral.
        </Step>
      </ol>

      {!filedOn ? (
        <Note tone="brand" title="Once you have filed, tell step 08" className="mt-5">
          <p className="m-0">
            Enter the date you filed and this page will work out your deemed-denial date and
            your appeal deadline from it, and put all three in your calendar.
          </p>
        </Note>
      ) : null}

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
            label="Copy your dates"
            copiedLabel="Dates copied"
            className={btnSecondary}
          />
        </div>

        <p role="status" aria-live="polite" className="m-0 min-h-[1.2rem] text-[0.88rem] text-muted">
          {saved
            ? filedOn
              ? 'Calendar file downloaded. Open it to add all three dates.'
              : 'Calendar file downloaded with your filing deadline. Add the later dates once you have filed.'
            : ''}
        </p>

        <p className="m-0 max-w-[62ch] text-[0.88rem] text-muted">
          The calendar file is built in your browser — nothing is uploaded, and this page keeps
          no record of you.
        </p>
      </div>
    </Console>
  )
}
