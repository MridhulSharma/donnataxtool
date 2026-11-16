import { Console, Fact } from '../components/Console'
import { Note } from '../components/ui'
import { money, sqft, titleCase, valuationDateLabel, year } from '../lib/format'
import { CONDITION_LABEL, type ParcelDetail, type Property } from '../lib/types'
import type { RecordCheck } from '../lib/recordCheck'

interface Props {
  subject: Property | null
  checks: RecordCheck[]
  detail: ParcelDetail | null
}

export function Assessment({ subject, checks, detail }: Props) {
  return (
    <Console
      n="02"
      id="assessment"
      title="What the city has on record"
      lede="These are the figures the city holds for your property, and the value your tax bill is calculated from. Check every line against the bill itself — a wrong square footage or year built is a reason to ask for an abatement on its own."
    >
      {!subject ? (
        <Note>Choose a property in step 01 and its record will appear here.</Note>
      ) : (
        <div aria-live="polite">
          <p className="m-0 font-display text-[1.25rem]">{titleCase(subject.addr)}</p>
          <p className="m-0 mt-1 text-[0.92rem] text-muted">
            {subject.luDesc ? `${titleCase(subject.luDesc)} · ` : ''}
            Fiscal year {subject.fy}, valued as of {valuationDateLabel(subject.fy)}
          </p>

          <dl className="m-0 mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Fact
              label={`FY${subject.fy} assessed value`}
              value={money(subject.tv)}
              emphasis
              hint={`What the city says it was worth on ${valuationDateLabel(subject.fy)}`}
            />
            <Fact label="Building value" value={money(subject.bv)} />
            <Fact label="Land value" value={money(subject.lv)} />
            <Fact
              label={subject.areaSrc === 'gross' ? 'Gross floor area' : 'Living area'}
              value={sqft(subject.la)}
              hint={
                subject.areaSrc === 'gross'
                  ? 'The city publishes no living area for this parcel'
                  : undefined
              }
            />
            <Fact label="Year built" value={year(subject.yr)} />
            {subject.remodel ? (
              <Fact
                label="Year remodelled"
                value={year(subject.remodel)}
                hint="A recorded remodel usually lifts the assessment"
              />
            ) : null}
            <Fact label="Parcel ID" value={subject.pid || '—'} hint="Use this on Form 128." />
            {subject.lot ? <Fact label="Lot size" value={sqft(subject.lot)} /> : null}
            {subject.cond ? (
              <Fact label="Recorded condition" value={CONDITION_LABEL[subject.cond]} />
            ) : null}
            {subject.beds ? <Fact label="Bedrooms" value={String(subject.beds)} /> : null}
            {subject.baths ? <Fact label="Bathrooms" value={String(subject.baths)} /> : null}

            {subject.gt ? (
              <Fact
                label="Annual tax"
                value={money(subject.gt)}
                hint="Gross tax before any exemptions."
              />
            ) : null}

            {subject.ex !== null && subject.ex !== undefined ? (
              <Fact
                label="Residential exemption"
                value={subject.ex === 1 ? 'Applied' : 'Not applied'}
                hint={
                  subject.ex === 1
                    ? 'You already receive this owner-occupant discount.'
                    : 'If you live here as your main home, this is worth checking — see step 05.'
                }
              />
            ) : null}
          </dl>

          {detail && detail.h.length > 1 ? (
            <div className="mt-6">
              <h3 className="m-0 text-[1.05rem]">How the assessment has moved</h3>
              <div className="mt-3 overflow-x-auto rounded-xl border border-lines">
                <table className="w-full border-collapse text-left text-[0.92rem]">
                  <caption className="sr-only">
                    Assessed value by fiscal year, newest first, with the change on the year
                    before.
                  </caption>
                  <thead>
                    <tr className="border-b border-lines bg-paper">
                      <th scope="col" className="px-3 py-2 font-semibold">
                        Fiscal year
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">
                        Assessed value
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">
                        Change
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.h.slice(0, 6).map(([fy, value], index, rows) => {
                      const previous = rows[index + 1]?.[1]
                      const change =
                        previous && previous > 0 ? (value - previous) / previous : null
                      return (
                        <tr key={fy} className="border-b border-lines last:border-b-0">
                          <th scope="row" className="px-3 py-2 font-normal">
                            FY{fy}
                          </th>
                          <td className="tnum px-3 py-2 text-right">{money(value)}</td>
                          <td className="tnum px-3 py-2 text-right">
                            {change === null
                              ? '—'
                              : `${change >= 0 ? '+' : '−'}${Math.abs(change * 100).toFixed(1)}%`}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {checks.length > 0 ? (
            <div className="mt-7 border-t border-lines pt-6">
              <h3 className="m-0 text-[1.05rem]">
                {checks.length === 1 ? 'One thing' : `${checks.length} things`} worth checking
                against the building itself
              </h3>
              <p className="m-0 mt-1 max-w-[62ch] text-[0.94rem] text-muted">
                The cheapest abatement to win is the one where the record is simply wrong. None
                of these is a finding — only you can see the property.
              </p>
              <ul className="m-0 mt-4 flex list-none flex-col gap-3 p-0">
                {checks.map((check) => (
                  <li key={check.id}>
                    <Note tone={check.severity === 'flag' ? 'warn' : 'neutral'} title={check.title}>
                      <p className="m-0">{check.detail}</p>
                      <p className="m-0 mt-2 font-medium text-ink">{check.question}</p>
                    </Note>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </Console>
  )
}
