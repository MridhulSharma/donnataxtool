import { Console, Fact } from '../components/Console'
import { Note } from '../components/ui'
import { money, prettyDate, sqft, titleCase, year } from '../lib/format'
import type { Property } from '../lib/types'

export function Assessment({ subject }: { subject: Property | null }) {
  return (
    <Console
      n="02"
      id="assessment"
      title="Your assessment"
      lede="These are the figures the city currently has on file for your property. Check them against your tax bill — a wrong square footage or year built is itself a reason to ask for an abatement."
    >
      {!subject ? (
        <Note>Choose a property in step 01 and its assessment will appear here.</Note>
      ) : (
        <div aria-live="polite">
          <p className="m-0 font-display text-[1.25rem]">{titleCase(subject.addr)}</p>
          {subject.lu ? (
            <p className="m-0 mt-1 text-[0.92rem] text-muted">{titleCase(subject.lu)}</p>
          ) : null}

          <dl className="m-0 mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Fact label="Total assessed value" value={money(subject.tv)} emphasis />
            <Fact label="Building value" value={money(subject.bv)} />
            <Fact label="Land value" value={money(subject.lv)} />
            <Fact label="Living area" value={sqft(subject.la)} />
            <Fact label="Year built" value={year(subject.yr)} />
            <Fact label="Parcel ID" value={subject.pid || '—'} hint="Use this on Form 128." />

            {subject.gt ? (
              <Fact
                label="Annual tax"
                value={money(subject.gt)}
                hint="Gross tax before any exemptions."
              />
            ) : null}

            {subject.sp && subject.sd ? (
              <Fact label="Last sale" value={money(subject.sp)} hint={prettyDate(subject.sd)} />
            ) : null}

            {subject.ex !== null && subject.ex !== undefined ? (
              <Fact
                label="Residential exemption"
                value={subject.ex === 1 ? 'Applied' : 'Not applied'}
                hint={
                  subject.ex === 1
                    ? 'You already receive this owner-occupant discount.'
                    : 'If you live here as your primary home, you may be able to claim this separately.'
                }
              />
            ) : null}
          </dl>

          {subject.o ? (
            <p className="m-0 mt-4 text-[0.88rem] text-muted">
              Owner of record: {titleCase(subject.o)}
            </p>
          ) : null}
        </div>
      )}
    </Console>
  )
}
