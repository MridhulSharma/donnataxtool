/**
 * The statement the homeowner attaches to State Tax Form 128.
 *
 * It states facts and arithmetic, in the first person, and claims nothing
 * about the outcome. The ground at the top of it is the ground the evidence
 * actually supports: a sales case says so and leads with the sales, and an
 * equity comparison is offered as supporting material rather than as the
 * headline, because standing alone it is the ground an appeal is most likely
 * to fail on.
 *
 * This is document preparation. The homeowner reads it, edits it, and signs.
 */
import type { AssessmentResult } from './assess'
import type { CalendarDay } from './deadline'
import { longDate, money, moneyCents, prettyDate, shortDate, titleCase } from './format'
import { EVIDENCE_GUIDANCE, GROUNDS } from './legal'
import type { Property } from './types'
import type { ValuationResult } from './valuation'

const sf = (n: number) => n.toLocaleString('en-US')

/**
 * The comparables closest to the middle of the range, in address order.
 *
 * The on-screen table is sorted cheapest per square foot first, because that
 * is how a reader scans it. Carrying that order into the application would
 * put the five most favourable properties in front of an assessor and
 * nothing else, which is the kind of selection that gets an application
 * dismissed rather than read.
 */
function aroundTheMedian<T extends { psf: number; addr: string }>(
  comps: readonly T[],
  count: number,
): T[] {
  if (comps.length <= count) return [...comps]
  const middle = Math.floor(comps.length / 2)
  const start = Math.max(0, Math.min(middle - Math.floor(count / 2), comps.length - count))
  return comps
    .slice(start, start + count)
    .sort((a, b) => a.addr.localeCompare(b.addr, 'en', { numeric: true }))
}

export interface CaseInput {
  subject: Property
  valuation: ValuationResult | null
  equity: AssessmentResult | null
  deadline: CalendarDay
  /** What the owner paid, when they bought recently and told us. */
  purchase?: { price: number; date: string } | null
  /** Things the owner says the record gets wrong. */
  recordErrors?: string[]
}

/** Which ground the statement should lead with, given the evidence. */
export function leadingGround(input: CaseInput): 'overvaluation' | 'record' | 'equity' {
  const { valuation, equity, purchase, subject } = input
  if (purchase && purchase.price > 0 && purchase.price < subject.tv) return 'overvaluation'
  if (valuation?.status === 'valued' && valuation.overAssessed) return 'overvaluation'
  if (input.recordErrors && input.recordErrors.length > 0) return 'record'
  if (equity?.status === 'scored' && equity.outOfLine) return 'equity'
  return 'overvaluation'
}

export function buildCaseSummary(input: CaseInput): string {
  const { subject, valuation, equity, deadline, purchase, recordErrors } = input
  const address = titleCase(subject.addr)
  const ground = leadingGround(input)
  const lines: string[] = []

  lines.push('APPLICATION FOR ABATEMENT — SUPPORTING STATEMENT')
  lines.push(`Property: ${address}`)
  lines.push(`Parcel ID: ${subject.pid || 'see tax bill'}`)
  lines.push(`Fiscal year: ${subject.fy}`)
  lines.push(`Assessed value under appeal: ${money(subject.tv)}`)
  lines.push(`Assessment date: January 1, ${subject.fy - 1}`)
  lines.push(`Filing deadline: ${longDate(deadline)}`)
  lines.push('')
  lines.push(
    ground === 'equity'
      ? `GROUND: ${GROUNDS.disproportionate.formLabel}`
      : `GROUND: ${GROUNDS.overvaluation.formLabel}`,
  )
  lines.push('')

  /* ---------------------------------------------------------------- *
   * The case
   * ---------------------------------------------------------------- */

  if (ground === 'overvaluation') {
    lines.push(
      `I believe my property at ${address} is assessed above its fair cash value as of January 1, ${subject.fy - 1}.`,
    )
    lines.push('')

    if (purchase && purchase.price > 0) {
      lines.push('WHAT I PAID FOR THE PROPERTY')
      lines.push(
        `  I bought this property on ${prettyDate(purchase.date)} for ${money(purchase.price)} in an open-market transaction.`,
      )
      if (purchase.price < subject.tv) {
        lines.push(
          `  The assessed value is ${money(subject.tv - purchase.price)} above that price.`,
        )
      }
      lines.push('')
    }

    if (valuation?.status === 'valued') {
      lines.push('COMPARABLE SALES')
      lines.push(
        `  I identified ${valuation.comps.length} comparable ${
          valuation.comps.length === 1 ? 'sale' : 'sales'
        } of similar properties, each of the same property type, within 25% of my floor area${
          subject.yr ? ' and within 15 years of my year built' : ''
        }, sold within ${valuation.windowMonths} months before the assessment date.`,
      )
      lines.push('')
      for (const comp of valuation.comps) {
        lines.push(`  ${titleCase(comp.property.addr)}`)
        lines.push(
          `    Sold ${prettyDate(comp.sale.date)} for ${money(comp.sale.price)}${
            comp.property.la ? `, ${sf(comp.property.la)} sq ft` : ''
          }${comp.property.yr ? `, built ${comp.property.yr}` : ''}`,
        )
        for (const adjustment of comp.adjustments) {
          const sign = adjustment.amount >= 0 ? '+' : '−'
          lines.push(
            `    ${adjustment.label}: ${sign}${money(Math.abs(adjustment.amount))} (mine ${adjustment.subject}, theirs ${adjustment.comp})`,
          )
        }
        lines.push(`    Adjusted to my property: ${money(comp.adjustedPrice)}`)
        lines.push('')
      }

      if (valuation.model.method === 'regression-adjusted') {
        lines.push('  How the adjustments were measured')
        lines.push(`    ${valuation.model.note}`)
        if (valuation.model.annualTrend !== null) {
          lines.push(
            `    Market movement used: ${(valuation.model.annualTrend * 100).toFixed(1)}% a year.`,
          )
        }
        lines.push('')
      }

      lines.push('THE VALUE THESE SALES INDICATE')
      lines.push(
        `  Adjusted, these sales indicate a value of about ${money(valuation.indicatedValue)}, in a range of ${money(valuation.low)} to ${money(valuation.high)}.`,
      )
      lines.push(`  My property is assessed at ${money(valuation.assessedValue)}.`)
      if (valuation.overAssessed) {
        lines.push(
          `  That is ${money(valuation.aboveRange)} above the top of the range the comparable sales support.`,
        )
        if (valuation.taxAtStake) {
          lines.push(
            `  At my current tax rate that difference is roughly ${money(valuation.taxAtStake)} of property tax a year.`,
          )
        }
      }
      lines.push('')
      lines.push('REQUEST')
      lines.push(
        `  I respectfully request that the assessed value be abated to ${money(valuation.indicatedValue)}, or to such value as the Board of Assessors determines reflects fair cash value as of January 1, ${subject.fy - 1}.`,
      )
    } else {
      lines.push(
        `  The assessed value of my property is ${money(subject.tv)}${
          subject.la ? ` for ${sf(subject.la)} square feet of floor area` : ''
        }. I am gathering comparable sales to document the value and will provide them in support of this application.`,
      )
      lines.push('')
      lines.push('REQUEST')
      lines.push(
        '  I request that the assessment be reviewed and abated to fair cash value as of the assessment date.',
      )
    }
  }

  if (ground === 'record') {
    lines.push(
      `I believe the Assessing Department’s record of my property at ${address} is incorrect, and that the assessed value of ${money(subject.tv)} reflects that error.`,
    )
    lines.push('')
    lines.push('WHAT THE RECORD GETS WRONG')
    for (const error of recordErrors ?? []) lines.push(`  — ${error}`)
    lines.push('')
    lines.push(
      '  I am happy to arrange an inspection so the department can confirm these facts for itself.',
    )
    lines.push('')
    lines.push('REQUEST')
    lines.push(
      '  I request that the record be corrected and the assessed value abated to reflect the corrected facts.',
    )
  }

  if (ground === 'equity' && equity?.status === 'scored') {
    lines.push(
      `I believe my property is assessed at a higher proportion of fair cash value than comparable properties of the same type in my neighbourhood.`,
    )
    lines.push('')
    lines.push('MY PROPERTY')
    lines.push(`  Assessed total value:      ${money(subject.tv)}`)
    if (subject.la) lines.push(`  Floor area:                ${sf(subject.la)} sq ft`)
    if (subject.yr) lines.push(`  Year built:                ${subject.yr}`)
    lines.push(`  Assessed value per sq ft:  ${moneyCents(equity.subjPsf)}`)
    lines.push('')
    lines.push('COMPARABLE ASSESSMENTS')
    lines.push(
      `  I identified ${equity.compCount} comparable ${
        equity.compCount === 1 ? 'property' : 'properties'
      }${
        equity.criteria.landUseLabel
          ? ` of the same type (${equity.criteria.landUseLabel.toLowerCase()})`
          : ''
      }, each within 25% of my floor area${subject.yr ? ' and within 15 years of its year built' : ''}.`,
    )
    lines.push(`  Median assessed value per square foot: ${moneyCents(equity.medPsf)}`)
    lines.push(
      `  Range across those properties: ${moneyCents(equity.lowPsf)} to ${moneyCents(equity.highPsf)}`,
    )
    lines.push('')
    // Listing the five cheapest would read as cherry-picking, and an assessor
    // would say so. These are the ones nearest the middle of the range, which
    // is the figure the request below is built on.
    const shown = aroundTheMedian(equity.comps, 5)
    lines.push(
      '  The properties nearest the middle of that range, on which the figure below is based:',
    )
    for (const comp of shown) {
      lines.push(
        `    — ${titleCase(comp.addr)}: ${money(comp.tv)}, ${
          comp.la ? `${sf(comp.la)} sq ft` : 'area n/a'
        }, ${moneyCents(comp.psf)}/sq ft${comp.yr ? `, built ${comp.yr}` : ''}`,
      )
    }
    const rest = equity.comps.length - shown.length
    if (rest > 0) {
      lines.push(
        `    (The full list of ${equity.compCount} comparable properties is available on request.)`,
      )
    }
    lines.push('')
    lines.push('THE CALCULATION')
    lines.push(
      `  At the median rate of ${moneyCents(equity.medPsf)} per square foot, my ${
        subject.la ? sf(subject.la) : ''
      } square feet would be assessed at ${money(equity.proportionate)}.`,
    )
    lines.push(
      `  My property is assessed at ${money(subject.tv)}, which is ${money(equity.over)} above that figure, and ${(equity.ratio * 100 - 100).toFixed(1)}% above the median rate per square foot.`,
    )
    lines.push('')
    lines.push('REQUEST')
    lines.push(
      `  I respectfully request that the assessed value be abated to ${money(equity.proportionate)}, or to such value as the Board of Assessors determines is proportionate to comparable properties, and that my assessment be reviewed against fair cash value as of January 1, ${subject.fy - 1}.`,
    )
  }

  /* ---------------------------------------------------------------- *
   * Supporting material
   * ---------------------------------------------------------------- */

  if (ground !== 'record' && recordErrors && recordErrors.length > 0) {
    lines.push('')
    lines.push('ADDITIONALLY, THE RECORD APPEARS INCORRECT')
    for (const error of recordErrors) lines.push(`  — ${error}`)
  }

  if (ground === 'overvaluation' && equity?.status === 'scored' && equity.outOfLine) {
    lines.push('')
    lines.push('SUPPORTING: COMPARISON WITH SIMILAR ASSESSMENTS')
    lines.push(
      `  My property is assessed at ${moneyCents(equity.subjPsf)} per square foot. The median for ${equity.compCount} comparable properties of the same type nearby is ${moneyCents(equity.medPsf)}, in a range of ${moneyCents(equity.lowPsf)} to ${moneyCents(equity.highPsf)}.`,
    )
    lines.push(
      '  I offer this as supporting context for the valuation above rather than as a separate ground.',
    )
  }

  lines.push('')
  lines.push(
    `These figures come from public assessment records for fiscal year ${subject.fy}. I am paying my tax bill as assessed while this application is pending.`,
  )
  lines.push('')
  lines.push('Signature: _______________________________   Date: ______________')

  return lines.join('\n')
}

/** The text behind "Copy your dates" in the deadline console. */
export function buildDeadlineDetails(input: {
  subject: Property | null
  filingDeadline: CalendarDay
  filedOn: CalendarDay | null
  assessorsDecideBy: CalendarDay | null
  atbPetitionBy: CalendarDay | null
  atbFee: string
}): string {
  const { subject, filingDeadline, filedOn, assessorsDecideBy, atbPetitionBy, atbFee } = input
  const lines: string[] = []
  lines.push('PROPERTY TAX ABATEMENT — KEY DATES')
  if (subject) {
    lines.push(`Property: ${titleCase(subject.addr)}`)
    if (subject.pid) lines.push(`Parcel ID: ${subject.pid}`)
    lines.push(`Fiscal year: ${subject.fy}`)
  }
  lines.push('')
  lines.push(`1. FILE BY ${longDate(filingDeadline)}, 5:00 PM`)
  lines.push('   File State Tax Form 128 (Application for Abatement) with the')
  lines.push('   Board of Assessors. This is the due date of the first actual tax')
  lines.push('   bill. Missing it forfeits your appeal rights for the year.')
  lines.push('   Confirm the exact date and time printed on your own bill.')
  lines.push('')
  lines.push('2. PAY YOUR TAX BILL AS BILLED')
  lines.push('   You must pay the tax as assessed, on time, to keep your right to')
  lines.push('   appeal. Filing does not pause the bill.')
  lines.push('')
  if (filedOn && assessorsDecideBy) {
    lines.push(`   You filed on ${longDate(filedOn)}.`)
    lines.push('')
    lines.push(`3. BY ${longDate(assessorsDecideBy)} — the assessors must act`)
    lines.push('   Three months from the day you filed. If they have not acted by')
    lines.push('   then, your application is "deemed denied" on that date.')
    lines.push('')
    if (atbPetitionBy) {
      lines.push(`4. BY ${longDate(atbPetitionBy)} — Appellate Tax Board`)
      lines.push('   Three months from the denial, actual or deemed. This deadline is')
      lines.push('   jurisdictional: the Board cannot hear a late appeal.')
      lines.push(`   Entry fee for your assessed value: ${atbFee}`)
    }
  } else {
    lines.push('3. AFTER YOU FILE — dates that depend on your filing date')
    lines.push('   The assessors have three months FROM THE DAY YOU FILE to act. If')
    lines.push('   they do not, the application is deemed denied on that date, and')
    lines.push('   you have three months from then to petition the Appellate Tax')
    lines.push('   Board. Both limits are jurisdictional.')
    lines.push('   Tell this page the date you filed and it will work them out.')
    lines.push(`   Entry fee for your assessed value: ${atbFee}`)
  }
  lines.push('')
  lines.push('EVIDENCE TO GATHER')
  lines.push(`   ${EVIDENCE_GUIDANCE}`)
  lines.push('')
  lines.push('WHERE TO FILE')
  lines.push('   City of Boston Assessing Department, Room 301, City Hall')
  lines.push('   1 City Hall Square, Boston, MA 02201')
  lines.push('   boston.gov/departments/assessing')
  lines.push('   Form 128: mass.gov/lists/property-tax-forms-and-guides')
  lines.push('')
  lines.push(
    'This is legal information, not legal advice. Have a navigator or clinic review your application before you file.',
  )
  return lines.join('\n')
}

/** A one-line summary of the dates, for a reviewer scanning a case. */
export const datesLine = (filing: CalendarDay, atb: CalendarDay | null): string =>
  atb ? `File by ${shortDate(filing)} · ATB by ${shortDate(atb)}` : `File by ${shortDate(filing)}`
