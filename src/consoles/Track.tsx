/**
 * Console 08 — tracking the case after it is filed.
 *
 * The deadlines that follow a filing run from the day the application went
 * in, and both are jurisdictional. This console exists so the owner can tell
 * the page when they filed, and be given the two dates that actually govern
 * their appeal rather than a guess counted from February 1.
 *
 * Everything entered here stays in this browser.
 */
import * as Label from '@radix-ui/react-label'
import { useCallback, useEffect, useId, useState } from 'react'
import { Console } from '../components/Console'
import { btnSecondary, Chip, Note } from '../components/ui'
import {
  caseStatus,
  clearCase,
  newCase,
  readCase,
  writeCase,
  type CaseRecord,
} from '../lib/caseTrack'
import { useToday, type CalendarDay } from '../lib/deadline'
import { longDate, money } from '../lib/format'
import { buildIcs, downloadIcs } from '../lib/ics'
import { atbEntryFee, ATB_LATE_NOTICE_EXTENSION_MONTHS } from '../lib/legal'
import type { Property } from '../lib/types'

interface Props {
  subject: Property | null
  deadline: CalendarDay
  caseRecord: CaseRecord | null
  onChange: (record: CaseRecord | null) => void
}

const STAGE_LABEL: Record<string, string> = {
  'not-filed': 'Not filed yet',
  'awaiting-assessors': 'With the assessors',
  'deemed-denied': 'Deemed denied',
  granted: 'Granted',
  denied: 'Denied',
  'atb-window-closed': 'Appeal window closed',
}

export function Track({ subject, deadline, caseRecord, onChange }: Props) {
  const filedId = useId()
  const decidedId = useId()
  const [storageBlocked, setStorageBlocked] = useState(false)

  // Pick up a case stored on an earlier visit for this property.
  useEffect(() => {
    if (!subject) return
    const stored = readCase(subject.pid)
    if (stored && stored.pid !== caseRecord?.pid) onChange(stored)
    // Only when the property changes.
  }, [subject, caseRecord?.pid, onChange])

  const update = useCallback(
    (patch: Partial<CaseRecord>) => {
      if (!subject) return
      const base = caseRecord ?? newCase(subject.pid, subject.addr, subject.fy)
      const next: CaseRecord = {
        ...base,
        ...patch,
        updated: new Date().toISOString().slice(0, 10),
      }
      onChange(next)
      setStorageBlocked(!writeCase(next))
    },
    [subject, caseRecord, onChange],
  )

  const today = useToday()
  const status = caseStatus(caseRecord, today, deadline)
  const fee = atbEntryFee(subject?.tv)

  const onCalendar = useCallback(() => {
    const events = []
    if (status.timeline.deemedDeniedOn) {
      events.push({
        date: status.timeline.deemedDeniedOn,
        title: 'Abatement deemed denied if the assessors have not acted',
        remindDaysBefore: 7,
        description:
          'Three months from the day you filed. If nothing has arrived, your application is deemed denied today and your three months to appeal start running.',
      })
    }
    if (status.timeline.atbPetitionBy) {
      events.push({
        date: status.timeline.atbPetitionBy,
        title: 'Last day to petition the Appellate Tax Board',
        remindDaysBefore: 21,
        description: `Three months from the denial. This limit is jurisdictional. Entry fee for this property: ${
          fee.amount === null ? 'see the Board’s schedule' : money(fee.amount)
        }.`,
      })
    }
    if (events.length > 0) downloadIcs('abatement-appeal-dates.ics', buildIcs(events))
  }, [status.timeline, fee.amount])

  return (
    <Console
      n="08"
      id="track"
      title="Track your case"
      lede="Once you have filed, the dates that matter are counted from the day you filed. Tell this page that date and it will work out the two that follow — both of which end your appeal if you miss them."
    >
      {!subject ? (
        <Note>Choose a property in step 01 to track a case against it.</Note>
      ) : (
        <div aria-live="polite">
          <p className="m-0 flex flex-wrap items-center gap-2">
            <Chip tone={status.urgent ? 'warn' : 'neutral'}>
              {STAGE_LABEL[status.stage] ?? status.stage}
            </Chip>
            {status.daysUntil !== null && status.nextDate ? (
              <span className="text-[0.92rem] text-muted">
                {status.daysUntil >= 0
                  ? `${status.daysUntil} days to ${longDate(status.nextDate)}`
                  : `${Math.abs(status.daysUntil)} days past ${longDate(status.nextDate)}`}
              </span>
            ) : null}
          </p>
          <p className="m-0 mt-3 max-w-[64ch]">{status.nextStep}</p>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label.Root htmlFor={filedId} className="font-semibold text-[0.94rem]">
                The date you filed
              </Label.Root>
              <input
                id={filedId}
                type="date"
                value={caseRecord?.filedOn ?? ''}
                onChange={(e) => update({ filedOn: e.target.value || null })}
                className="rounded-xl border border-lines bg-paper px-4 py-2.5 text-ink"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label.Root htmlFor={decidedId} className="font-semibold text-[0.94rem]">
                The date a decision arrived, if one has
              </Label.Root>
              <input
                id={decidedId}
                type="date"
                value={caseRecord?.decidedOn ?? ''}
                onChange={(e) => update({ decidedOn: e.target.value || null })}
                className="rounded-xl border border-lines bg-paper px-4 py-2.5 text-ink"
              />
            </div>
          </div>

          {caseRecord?.decidedOn ? (
            <fieldset className="m-0 mt-4 rounded-xl border border-lines bg-paper px-4 py-3">
              <legend className="px-1 font-semibold">What did it say?</legend>
              <div className="mt-1 flex flex-wrap gap-2">
                {(['granted', 'denied'] as const).map((decision) => (
                  <button
                    key={decision}
                    type="button"
                    aria-pressed={caseRecord.decision === decision}
                    onClick={() => update({ decision })}
                    className={[
                      'rounded-full border px-4 py-1.5 text-[0.9rem] font-semibold transition-colors',
                      caseRecord.decision === decision
                        ? 'border-brand bg-brand text-[var(--surface)]'
                        : 'border-lines bg-surface text-ink hover:bg-brand-soft',
                    ].join(' ')}
                  >
                    {decision === 'granted' ? 'Abatement granted' : 'Application denied'}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}

          {status.timeline.filedOn ? (
            <dl className="m-0 mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-lines bg-paper px-4 py-3">
                <dt className="text-[0.8rem] font-semibold uppercase tracking-[0.06em] text-muted">
                  You filed
                </dt>
                <dd className="m-0 mt-1 font-display text-[1.05rem]">
                  {longDate(status.timeline.filedOn)}
                </dd>
              </div>
              <div className="rounded-xl border border-lines bg-paper px-4 py-3">
                <dt className="text-[0.8rem] font-semibold uppercase tracking-[0.06em] text-muted">
                  Deemed denied on
                </dt>
                <dd className="m-0 mt-1 font-display text-[1.05rem]">
                  {status.timeline.deemedDeniedOn
                    ? longDate(status.timeline.deemedDeniedOn)
                    : '—'}
                </dd>
              </div>
              <div className="rounded-xl border border-brand bg-brand-soft px-4 py-3">
                <dt className="text-[0.8rem] font-semibold uppercase tracking-[0.06em] text-muted">
                  Appeal to the Board by
                </dt>
                <dd className="m-0 mt-1 font-display text-[1.05rem] font-semibold">
                  {status.timeline.atbPetitionBy ? longDate(status.timeline.atbPetitionBy) : '—'}
                </dd>
              </div>
            </dl>
          ) : null}

          {status.timeline.atbPetitionBy ? (
            <>
              <Note tone="warn" title="This appeal deadline cannot be extended by asking" className="mt-5">
                <p className="m-0">
                  A petition filed late is dismissed whatever its merits. One narrow exception
                  exists: where the assessors never sent written notice of their inaction, the
                  Board may allow a further {ATB_LATE_NOTICE_EXTENSION_MONTHS} months. Never
                  plan around it — speak to a navigator if you think it applies.
                </p>
              </Note>
              <div className="mt-4">
                <button type="button" onClick={onCalendar} className={btnSecondary}>
                  Put these dates in my calendar
                </button>
              </div>
            </>
          ) : null}

          {storageBlocked ? (
            <Note tone="warn" title="This browser will not remember your case" className="mt-5">
              <p className="m-0">
                Storage is blocked, which happens in private browsing. The dates above are still
                correct for this visit — put them in your calendar before you close the tab.
              </p>
            </Note>
          ) : caseRecord ? (
            <p className="m-0 mt-5 text-[0.88rem] text-muted">
              Saved in this browser only, on this device. There is no account and no server, so
              clearing your browser data clears this with it.{' '}
              <button
                type="button"
                onClick={() => {
                  clearCase(subject.pid)
                  onChange(null)
                }}
                className="underline underline-offset-2"
              >
                Forget this case
              </button>
              .
            </p>
          ) : null}
        </div>
      )}
    </Console>
  )
}
