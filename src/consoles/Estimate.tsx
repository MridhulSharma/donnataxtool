/**
 * Console 03 — the estimate itself.
 *
 * Two rules from the brief shape this whole file: the verdict is never carried
 * by colour alone, and the arithmetic is always on screen. A homeowner who is
 * going to sign this application is entitled to see every step of the number
 * they are signing for.
 */
import { useState } from 'react'
import { Console, Fact } from '../components/Console'
import { Chip, Note } from '../components/ui'
import { MIN_COMPS, type AssessmentResult } from '../lib/assess'
import { money, moneyCents, pct, sqft, titleCase, year } from '../lib/format'
import type { Property } from '../lib/types'

interface Props {
  subject: Property | null
  result: AssessmentResult | null
  /** True while a citywide subject's comp pool is still being fetched. */
  poolLoading: boolean
}

/** How many comps the table shows before the reader asks for the rest. */
const PREVIEW_ROWS = 8

export function Estimate({ subject, result, poolLoading }: Props) {
  const [showAll, setShowAll] = useState(false)

  return (
    <Console
      n="03"
      id="estimate"
      title="Over-assessment estimate"
      lede="This compares what your home is assessed at per square foot against the median for comparable homes nearby. That comparison is the ground called disproportionate assessment — and it is the one you can document from public records alone."
    >
      {/* The verdict is announced; the arithmetic below it is read on request. */}
      <div aria-live="polite">
        {!subject ? (
          <Note>Choose a property in step 01 and its estimate will appear here.</Note>
        ) : poolLoading || !result ? (
          <Note tone="brand" title="Gathering comparable homes…">
            <p className="m-0">
              We are pulling the other assessments in this area so the comparison has something to
              stand on. This takes a few seconds.
            </p>
          </Note>
        ) : result.status === 'insufficient-data' ? (
          <Note tone="warn" title="Not enough comparable data to estimate">
            <p className="m-0">{result.reason}</p>
            <p className="m-0 mt-2">
              You can still apply for an abatement. An abatement can also be grounded on
              overvaluation — that your assessed value exceeds fair cash value as of January 1 — and
              on recent sales of similar homes. A navigator or clinic can help you build that case.
            </p>
          </Note>
        ) : result.overAssessed ? (
          <div className="rounded-card border border-[var(--bad)] bg-[var(--bad-soft)] px-5 py-5">
            <Chip tone="bad">
              <svg
                viewBox="0 0 24 24"
                width="13"
                height="13"
                aria-hidden="true"
                focusable="false"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
              >
                <path d="M12 4.5v9.5M12 17.4v.2" />
              </svg>
              Likely over-assessed · estimate
            </Chip>
            <p className="tnum m-0 mt-3 font-display text-[2.1rem] font-semibold leading-tight sm:text-[2.7rem]">
              Over by {money(result.over)}
            </p>
            <p className="m-0 mt-2 max-w-[62ch]">
              Your home is assessed{' '}
              <strong className="font-semibold">{pct(result.ratio - 1)}</strong> higher per square
              foot than the median of the{' '}
              <strong className="font-semibold">{result.compCount}</strong> comparable{' '}
              {result.compCount === 1 ? 'home' : 'homes'} we found.
              {result.taxOver
                ? ` At your current tax rate that gap is roughly ${money(result.taxOver)} of property tax a year.`
                : ''}
            </p>
            <p className="m-0 mt-3 text-[0.9rem]">
              This is an estimate from public records, not a prediction. Only the Board of Assessors
              can grant an abatement.
            </p>
          </div>
        ) : (
          <div className="rounded-card border border-[var(--good)] bg-[var(--good-soft)] px-5 py-5">
            <Chip tone="good">
              <svg
                viewBox="0 0 24 24"
                width="13"
                height="13"
                aria-hidden="true"
                focusable="false"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 12.5l5 5L20 6.5" />
              </svg>
              In line with comparable homes · estimate
            </Chip>
            <p className="m-0 mt-3 font-display text-[1.5rem] font-semibold leading-tight sm:text-[1.8rem]">
              No disproportion found on this measure.
            </p>
            <p className="m-0 mt-2 max-w-[62ch]">
              {result.ratio >= 1
                ? `Your home is assessed ${pct(result.ratio - 1)} above the median rate per square foot of the ${result.compCount} comparable ${
                    result.compCount === 1 ? 'home' : 'homes'
                  } we found — inside the normal spread of a citywide mass appraisal.`
                : `Your home is assessed ${pct(1 - result.ratio)} below the median rate per square foot of the ${result.compCount} comparable ${
                    result.compCount === 1 ? 'home' : 'homes'
                  } we found.`}
            </p>
            <p className="m-0 mt-3 text-[0.9rem]">
              This checks one ground only. If you believe the assessed value is simply above what the
              home is worth, overvaluation is a separate ground you can still apply on.
            </p>
          </div>
        )}
      </div>

      {subject && result?.status === 'scored' ? (
        <div className="mt-6 border-t border-lines pt-6">
          <h3 className="m-0 text-[1.1rem]">The arithmetic, in full</h3>
          <p className="m-0 mt-1 max-w-[62ch] text-[0.94rem] text-muted">
            Every figure below comes from public assessment records. Nothing is weighted, adjusted,
            or predicted.
          </p>

          <dl className="m-0 mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Fact
              label="Your value per sq ft"
              value={moneyCents(result.subjPsf)}
              hint={`${money(subject.tv)} ÷ ${sqft(subject.la)}`}
            />
            <Fact
              label={`Median of ${result.compCount} comps`}
              value={moneyCents(result.medPsf)}
              hint="The middle value, so one outlier cannot move it"
            />
            <Fact
              label="Proportionate value"
              value={money(result.fair)}
              hint={`${moneyCents(result.medPsf)} × ${sqft(subject.la)}`}
            />
          </dl>

          <p className="tnum m-0 mt-4 rounded-xl border border-lines bg-paper px-4 py-3 text-[0.98rem]">
            {money(subject.tv)} assessed − {money(result.fair)} proportionate ={' '}
            <strong className="font-semibold">
              {result.over > 0 ? `${money(result.over)} over` : `${money(-result.over)} under`}
            </strong>
          </p>

          <h3 id="comps-heading" className="m-0 mt-7 text-[1.1rem]">
            The {result.compCount} comparable {result.compCount === 1 ? 'home' : 'homes'} used
          </h3>
          <p className="m-0 mt-1 max-w-[62ch] text-[0.94rem] text-muted">
            Each is within 25% of your living area
            {subject.yr ? ' and within 15 years of your year built' : ''}, listed cheapest per square
            foot first — the strongest evidence for you sits at the top. This estimate needs at least{' '}
            {MIN_COMPS}.
          </p>

          <div
            role="region"
            aria-labelledby="comps-heading"
            tabIndex={0}
            className="mt-4 overflow-x-auto rounded-xl border border-lines"
          >
            <table className="w-full border-collapse text-left text-[0.92rem]">
              <caption className="sr-only">
                Comparable homes used in this estimate, with assessed value, living area, year built,
                and assessed value per square foot. Your own home is the last row.
              </caption>
              <thead>
                <tr className="border-b border-lines bg-paper">
                  <th scope="col" className="whitespace-nowrap px-3 py-2 font-semibold">
                    Address
                  </th>
                  <th scope="col" className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                    Assessed
                  </th>
                  <th scope="col" className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                    Living area
                  </th>
                  <th scope="col" className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                    Built
                  </th>
                  <th scope="col" className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                    Per sq ft
                  </th>
                </tr>
              </thead>
              <tbody>
                {(showAll ? result.comps : result.comps.slice(0, PREVIEW_ROWS)).map((c) => (
                  <tr key={`${c.src}-${c.pid}`} className="border-b border-lines">
                    <th scope="row" className="px-3 py-2 font-normal">
                      {titleCase(c.addr)}
                    </th>
                    <td className="tnum px-3 py-2 text-right">{money(c.tv)}</td>
                    <td className="tnum whitespace-nowrap px-3 py-2 text-right">{sqft(c.la)}</td>
                    <td className="tnum px-3 py-2 text-right">{year(c.yr)}</td>
                    <td className="tnum px-3 py-2 text-right">{moneyCents(c.psf)}</td>
                  </tr>
                ))}
                {/* The subject, in the same units, so the table makes its own point. */}
                <tr className="border-t-2 border-brand bg-brand-soft">
                  <th scope="row" className="px-3 py-2 font-semibold">
                    {titleCase(subject.addr)} — your home
                  </th>
                  <td className="tnum px-3 py-2 text-right font-semibold">{money(subject.tv)}</td>
                  <td className="tnum whitespace-nowrap px-3 py-2 text-right">{sqft(subject.la)}</td>
                  <td className="tnum px-3 py-2 text-right">{year(subject.yr)}</td>
                  <td className="tnum px-3 py-2 text-right font-semibold">
                    {moneyCents(result.subjPsf)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {result.comps.length > PREVIEW_ROWS ? (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              aria-expanded={showAll}
              className="mt-3 rounded-full border border-lines bg-surface px-4 py-2 text-[0.9rem] font-semibold text-ink transition-colors hover:bg-brand-soft"
            >
              {showAll
                ? `Show only the closest ${PREVIEW_ROWS}`
                : `Show all ${result.comps.length} comparable homes`}
            </button>
          ) : null}
        </div>
      ) : null}
    </Console>
  )
}
