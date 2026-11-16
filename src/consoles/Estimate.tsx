/**
 * Console 04 — what the property is worth, and what that means.
 *
 * Two comparisons, in the order their evidence deserves:
 *
 *   The sales comparison leads. It answers the question an abatement turns
 *   on — what was this worth on January 1 — with what comparable homes
 *   actually sold for, adjusted and shown line by line.
 *
 *   The equity comparison follows, as supporting material. It is honest
 *   about being the weaker of the two, because standing alone it supports
 *   only the ground the Appellate Tax Board almost never grants.
 *
 * Neither is a verdict. Both show a range, their confidence, and every step
 * of the arithmetic.
 */
import { useState } from 'react'
import { Console, Fact } from '../components/Console'
import { Chip, ConfidenceBadge, Note, RangeBar } from '../components/ui'
import type { AssessmentResult } from '../lib/assess'
import { MIN_COMPS } from '../lib/assess'
import { scoreConfidence } from '../lib/confidence'
import {
  money,
  moneyCents,
  months as monthsWord,
  pct,
  prettyDate,
  signedMoney,
  sqft,
  titleCase,
  valuationDateLabel,
  year,
} from '../lib/format'
import type { Property } from '../lib/types'
import type { AdjustedComp, ValuationResult } from '../lib/valuation'

interface Props {
  subject: Property | null
  valuation: ValuationResult | null
  equity: AssessmentResult | null
  loading: boolean
  hasSales: boolean
}

const PREVIEW_ROWS = 8

/** One comparable sale, with every adjustment that was made to it. */
function CompCard({ comp }: { comp: AdjustedComp }) {
  return (
    <li className="rounded-xl border border-lines bg-paper px-4 py-3">
      <p className="m-0 flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="font-semibold">{titleCase(comp.property.addr)}</span>
        <span className="tnum text-[0.9rem] text-muted">
          sold {prettyDate(comp.sale.date)} for {money(comp.sale.price)}
        </span>
      </p>
      <p className="m-0 mt-0.5 text-[0.86rem] text-muted">
        {comp.property.la ? sqft(comp.property.la) : 'area not on file'}
        {comp.property.yr ? ` · built ${year(comp.property.yr)}` : ''}
        {comp.miles !== null ? ` · ${comp.miles.toFixed(2)} miles away` : ''}
      </p>

      {comp.adjustments.length > 0 ? (
        <dl className="m-0 mt-3 flex flex-col gap-1 border-t border-lines pt-2 text-[0.9rem]">
          {comp.adjustments.map((adjustment) => (
            <div key={adjustment.label} className="flex flex-wrap items-baseline gap-x-2">
              <dt className="text-muted">{adjustment.label}</dt>
              <dd className="tnum m-0 ml-auto font-medium">{signedMoney(adjustment.amount)}</dd>
              <dd className="m-0 w-full text-[0.82rem] text-muted">
                yours {adjustment.subject}, theirs {adjustment.comp}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <p className="tnum m-0 mt-2 border-t border-lines pt-2 font-semibold">
        Adjusted to your property: {money(comp.adjustedPrice)}
      </p>
    </li>
  )
}

function SalesSection({ subject, valuation }: { subject: Property; valuation: ValuationResult }) {
  const [showWorking, setShowWorking] = useState(false)

  if (valuation.status === 'insufficient-sales') {
    return (
      <Note tone="warn" title="Not enough comparable sales to value this property">
        <p className="m-0">{valuation.reason}</p>
        <p className="m-0 mt-2">
          That is a limit of the public record, not a finding about your assessment. The
          comparison below, against what the city assessed similar homes at, is the next best
          check — and a navigator can help build a case from evidence this tool cannot see.
        </p>
        {valuation.nearMisses.length > 0 ? (
          <>
            <p className="m-0 mt-3 font-semibold text-ink">
              The {valuation.nearMisses.length === 1 ? 'sale' : 'sales'} we did find:
            </p>
            <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
              {valuation.nearMisses.map((comp) => (
                <CompCard key={`${comp.property.pid}-${comp.sale.date}`} comp={comp} />
              ))}
            </ul>
          </>
        ) : null}
      </Note>
    )
  }

  const confidence = scoreConfidence({
    count: valuation.comps.length,
    values: valuation.comps.map((c) => c.adjustedPrice),
    distances: valuation.comps.map((c) => c.miles),
    monthsOld: valuation.comps.map((c) => c.monthsBefore),
    fromSales: true,
    modelled: valuation.model.method === 'regression-adjusted',
  })

  return (
    <>
      <div
        className={`rounded-card border px-5 py-5 ${
          valuation.overAssessed
            ? 'border-[var(--bad)] bg-[var(--bad-soft)]'
            : 'border-[var(--good)] bg-[var(--good-soft)]'
        }`}
      >
        <p className="m-0 flex flex-wrap items-center gap-2">
          <Chip tone={valuation.overAssessed ? 'bad' : 'good'}>
            {valuation.overAssessed
              ? 'Above what the sales support · estimate'
              : 'Within what the sales support · estimate'}
          </Chip>
          <ConfidenceBadge level={confidence.level} />
        </p>

        <p className="tnum m-0 mt-3 font-display text-[1.9rem] font-semibold leading-tight sm:text-[2.4rem]">
          {valuation.overAssessed
            ? `Assessed ${money(valuation.aboveRange)} above the range`
            : 'Assessment sits inside the range'}
        </p>

        <p className="m-0 mt-2 max-w-[62ch]">
          {valuation.comps.length} comparable {valuation.comps.length === 1 ? 'sale' : 'sales'},
          adjusted to your property and to {valuationDateLabel(valuation.fiscalYear)}, point to a
          value of about <strong className="font-semibold">{money(valuation.indicatedValue)}</strong>
          , in a range of {money(valuation.low)} to {money(valuation.high)}. The city assesses it
          at {money(valuation.assessedValue)}.
          {valuation.overAssessed && valuation.taxAtStake
            ? ` At your current tax rate the gap above that range is roughly ${money(valuation.taxAtStake)} of property tax a year.`
            : ''}
        </p>

        <RangeBar
          low={valuation.low}
          high={valuation.high}
          marker={valuation.assessedValue}
          markerLabel={`Assessed ${money(valuation.assessedValue)}`}
          rangeLabel={`Sales support ${money(valuation.low)} to ${money(valuation.high)}`}
        />

        <p className="m-0 mt-3 text-[0.9rem]">
          This is an estimate from public records, not an appraisal and not a prediction. Only the
          Board of Assessors can grant an abatement.
        </p>
      </div>

      <div className="mt-5 rounded-xl border border-lines bg-paper px-4 py-3">
        <p className="m-0 text-[0.94rem]">{valuation.model.note}</p>
        {valuation.model.annualTrend !== null ? (
          <p className="m-0 mt-1 text-[0.9rem] text-muted">
            Market movement applied: {(valuation.model.annualTrend * 100).toFixed(1)}% a year.
            Comparable sales are drawn from the {monthsWord(valuation.windowMonths)} before the
            valuation date.
          </p>
        ) : null}
      </div>

      <h3 className="m-0 mt-7 text-[1.1rem]">
        The {valuation.comps.length} comparable {valuation.comps.length === 1 ? 'sale' : 'sales'},
        and every adjustment
      </h3>
      <p className="m-0 mt-1 max-w-[62ch] text-[0.94rem] text-muted">
        Each is the same property type, within 25% of your floor area
        {subject.yr ? ', within 15 years of your year built' : ''}, and within a mile. An
        adjustment you cannot check is one you cannot defend, so every one is shown.
      </p>
      <ul className="m-0 mt-4 flex list-none flex-col gap-3 p-0">
        {valuation.comps.map((comp) => (
          <CompCard key={`${comp.property.pid}-${comp.sale.date}`} comp={comp} />
        ))}
      </ul>

      {valuation.excluded.length > 0 ? (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setShowWorking((v) => !v)}
            aria-expanded={showWorking}
            className="rounded-full border border-lines bg-surface px-4 py-2 text-[0.9rem] font-semibold text-ink transition-colors hover:bg-brand-soft"
          >
            {showWorking ? 'Hide' : 'Show'} the {valuation.excluded.length} transfers we left out
          </button>
          {showWorking ? (
            <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0 text-[0.9rem]">
              {valuation.excluded.map((excluded) => (
                <li
                  key={`${excluded.address}-${excluded.date}`}
                  className="rounded-xl border border-lines bg-paper px-4 py-2"
                >
                  <span className="font-medium">{titleCase(excluded.address)}</span>,{' '}
                  {prettyDate(excluded.date)}, {money(excluded.price)} —{' '}
                  <span className="text-muted">{excluded.reason}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <details className="mt-5 rounded-xl border border-lines bg-paper px-4 py-3">
        <summary className="cursor-pointer font-semibold">
          How confident is this, and why
        </summary>
        <p className="m-0 mt-2 text-[0.94rem]">{confidence.summary}</p>
        <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0 text-[0.92rem]">
          {confidence.factors.map((factor) => (
            <li key={factor.label} className="flex items-start gap-2">
              <span aria-hidden="true" className="mt-[2px] shrink-0 font-semibold">
                {factor.good ? '✓' : '!'}
              </span>
              <span>
                <span className="sr-only">{factor.good ? 'Strength: ' : 'Limitation: '}</span>
                <span className="font-medium">{factor.label}.</span>{' '}
                <span className="text-muted">{factor.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </details>
    </>
  )
}

function EquitySection({ subject, equity }: { subject: Property; equity: AssessmentResult }) {
  const [showAll, setShowAll] = useState(false)

  if (equity.status === 'insufficient-data') {
    return (
      <Note tone="neutral" title="Not enough comparable assessments either">
        <p className="m-0">{equity.reason}</p>
      </Note>
    )
  }

  const visible = showAll ? equity.comps : equity.comps.slice(0, PREVIEW_ROWS)

  return (
    <>
      <p className="m-0 flex flex-wrap items-center gap-2">
        <Chip tone={equity.outOfLine ? 'warn' : 'neutral'}>
          {equity.outOfLine ? 'Out of line with similar homes' : 'In line with similar homes'}
        </Chip>
        <ConfidenceBadge level={equity.confidence.level} />
      </p>
      <p className="m-0 mt-3 max-w-[64ch]">
        Your property is assessed at{' '}
        <strong className="font-semibold">{moneyCents(equity.subjPsf)}</strong> per square foot.
        The median across {equity.compCount} comparable{' '}
        {equity.criteria.landUseLabel
          ? `${equity.criteria.landUseLabel.toLowerCase()} properties`
          : 'properties of the same type'}{' '}
        nearby is {moneyCents(equity.medPsf)}, ranging from {moneyCents(equity.lowPsf)} to{' '}
        {moneyCents(equity.highPsf)}.{' '}
        {equity.outOfLine
          ? `That puts yours ${pct(equity.ratio - 1)} above the median and above the top of the range.`
          : 'Yours sits inside that range.'}
      </p>

      {equity.criteria.widened ? (
        <Note tone="warn" title="This comparison crosses property types" className="mt-3">
          <p className="m-0">
            Too few properties of your own type were on record nearby, so the net was widened to
            other types. A condominium and a three-decker are not assessed on the same basis, so
            treat this as a rough signal only.
          </p>
        </Note>
      ) : null}

      {!equity.criteria.poolComplete ? (
        <Note tone="warn" title="This is part of your area, not all of it" className="mt-3">
          <p className="m-0">
            Your ZIP code holds more parcels than can be read in one pass, so this compares
            against a portion of it. The middle figure may shift once the rest is included.
          </p>
        </Note>
      ) : null}

      <dl className="m-0 mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Fact
          label="Your value per sq ft"
          value={moneyCents(equity.subjPsf)}
          hint={`${money(subject.tv)} ÷ ${sqft(subject.la)}`}
        />
        <Fact
          label={`Median of ${equity.compCount}`}
          value={moneyCents(equity.medPsf)}
          hint="The middle value, so one outlier cannot move it"
        />
        <Fact
          label="At that median rate"
          value={money(equity.proportionate)}
          hint={`${moneyCents(equity.medPsf)} × ${sqft(subject.la)}`}
        />
      </dl>

      <h3 id="comps-heading" className="m-0 mt-7 text-[1.05rem]">
        The {equity.compCount} comparable {equity.compCount === 1 ? 'property' : 'properties'} used
      </h3>
      <p className="m-0 mt-1 max-w-[62ch] text-[0.94rem] text-muted">
        Each is the same property type, within 25% of your floor area
        {subject.yr ? ' and within 15 years of your year built' : ''}, listed cheapest per square
        foot first. This comparison needs at least {MIN_COMPS}.
      </p>

      <div
        role="region"
        aria-labelledby="comps-heading"
        tabIndex={0}
        className="mt-4 overflow-x-auto rounded-xl border border-lines"
      >
        <table className="w-full border-collapse text-left text-[0.92rem]">
          <caption className="sr-only">
            Comparable properties used in this comparison, with assessed value, floor area, year
            built, and assessed value per square foot. Your own property is the last row.
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
                Floor area
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
            {visible.map((comp) => (
              <tr key={`${comp.src}-${comp.pid}`} className="border-b border-lines">
                <th scope="row" className="px-3 py-2 font-normal">
                  {titleCase(comp.addr)}
                </th>
                <td className="tnum px-3 py-2 text-right">{money(comp.tv)}</td>
                <td className="tnum whitespace-nowrap px-3 py-2 text-right">{sqft(comp.la)}</td>
                <td className="tnum px-3 py-2 text-right">{year(comp.yr)}</td>
                <td className="tnum px-3 py-2 text-right">{moneyCents(comp.psf)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-brand bg-brand-soft">
              <th scope="row" className="px-3 py-2 font-semibold">
                {titleCase(subject.addr)} — your property
              </th>
              <td className="tnum px-3 py-2 text-right font-semibold">{money(subject.tv)}</td>
              <td className="tnum whitespace-nowrap px-3 py-2 text-right">{sqft(subject.la)}</td>
              <td className="tnum px-3 py-2 text-right">{year(subject.yr)}</td>
              <td className="tnum px-3 py-2 text-right font-semibold">
                {moneyCents(equity.subjPsf)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {equity.comps.length > PREVIEW_ROWS ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="mt-3 rounded-full border border-lines bg-surface px-4 py-2 text-[0.9rem] font-semibold text-ink transition-colors hover:bg-brand-soft"
        >
          {showAll
            ? `Show only the closest ${PREVIEW_ROWS}`
            : `Show all ${equity.comps.length} comparable properties`}
        </button>
      ) : null}
    </>
  )
}

export function Estimate({ subject, valuation, equity, loading, hasSales }: Props) {
  return (
    <Console
      n="04"
      id="estimate"
      title="What your property is worth"
      lede="An abatement turns on what the property was worth on January 1 before the fiscal year. The strongest answer to that comes from what comparable homes actually sold for, so that is what this starts with."
    >
      <div aria-live="polite">
        {!subject ? (
          <Note>Choose a property in step 01 and its estimate will appear here.</Note>
        ) : loading ? (
          <Note tone="brand" title="Gathering comparable properties…">
            <p className="m-0">
              We are reading the other records in this area so the comparison has something to
              stand on. This takes a few seconds.
            </p>
          </Note>
        ) : (
          <>
            {valuation ? (
              <SalesSection subject={subject} valuation={valuation} />
            ) : (
              <Note tone="neutral" title="No sale prices are published for this area">
                <p className="m-0">
                  {hasSales
                    ? 'Sale prices were not available for this property.'
                    : 'The citywide assessment records carry no sale prices, so a sales comparison cannot be run for this property yet. This build holds recorded sales for Allston (02134) only; other neighbourhoods follow as the data is loaded.'}{' '}
                  The comparison below is the next best check available from the public record.
                </p>
              </Note>
            )}

            {equity ? (
              <div className="mt-8 border-t border-lines pt-6">
                <h3 className="m-0 text-[1.15rem]">
                  Supporting: how your assessment compares with similar homes
                </h3>
                <p className="m-0 mt-1 max-w-[64ch] text-[0.94rem] text-muted">
                  This compares what the city assessed you at against what it assessed comparable
                  homes at. It can show an inconsistency worth raising with the local assessors,
                  but on appeal it supports only the disproportionate-assessment ground, which
                  requires proof of a deliberate scheme. Treat it as support for the valuation
                  above, not as a case on its own.
                </p>
                <div className="mt-4">
                  <EquitySection subject={subject} equity={equity} />
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </Console>
  )
}
