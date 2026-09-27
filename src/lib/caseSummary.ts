/**
 * Builds the plain-language case summary a homeowner can paste into the
 * "reason for the application" section of State Tax Form 128.
 *
 * It states facts and arithmetic, in the first person, and claims nothing about
 * the outcome. It is document preparation, not legal advice — the homeowner
 * reads it, edits it, and signs it.
 */
import type { AssessmentResult } from './assess'
import { longDate, money, moneyCents, prettyDate, titleCase } from './format'
import type { Property } from './types'

const sf = (n: number) => n.toLocaleString('en-US')

export function buildCaseSummary(
  subject: Property,
  result: AssessmentResult,
  deadline: Date,
): string {
  const addr = titleCase(subject.addr)
  const lines: string[] = []

  lines.push('APPLICATION FOR ABATEMENT — SUPPORTING STATEMENT')
  lines.push(`Property: ${addr}`)
  lines.push(`Parcel ID: ${subject.pid || 'see tax bill'}`)
  lines.push(`Fiscal year: ${deadline.getFullYear()}`)
  lines.push(`Filing deadline: ${longDate(deadline)}`)
  lines.push('')
  lines.push('GROUND FOR ABATEMENT: Disproportionate assessment')
  lines.push('')

  if (result.status !== 'scored') {
    lines.push(
      `I believe my property at ${addr} is assessed at more than its fair cash value as of January 1, and at a higher proportion of value than comparable properties in my neighborhood.`,
    )
    lines.push('')
    lines.push(
      `The assessed value of my property is ${money(subject.tv)}${
        subject.la ? ` for ${sf(subject.la)} square feet of living area` : ''
      }. I am gathering comparable properties to document the disproportion and will provide them in support of this application.`,
    )
    lines.push('')
    lines.push('I request that the assessment be reviewed and abated accordingly.')
    return lines.join('\n')
  }

  const { subjPsf, medPsf, fair, over, ratio, compCount, comps } = result

  lines.push(
    'I believe my property is assessed at a higher proportion of fair cash value than comparable properties, which is a ground for abatement under Massachusetts law.',
  )
  lines.push('')
  lines.push('MY PROPERTY')
  lines.push(`  Assessed total value:      ${money(subject.tv)}`)
  if (subject.la) lines.push(`  Living area:               ${sf(subject.la)} sq ft`)
  if (subject.yr) lines.push(`  Year built:                ${subject.yr}`)
  lines.push(`  Assessed value per sq ft:  ${moneyCents(subjPsf)}`)
  lines.push('')
  lines.push('COMPARABLE PROPERTIES')
  lines.push(
    `  I identified ${compCount} comparable ${
      compCount === 1 ? 'property' : 'properties'
    } from public assessment records, each within 25% of my home's living area${
      subject.yr ? ' and within 15 years of its year built' : ''
    }.`,
  )
  lines.push(`  Median assessed value per sq ft of those properties:  ${moneyCents(medPsf)}`)
  lines.push('')

  // A short, concrete sample; the full list goes in as an attachment.
  const sample = comps.slice(0, 5)
  if (sample.length) {
    lines.push('  Examples (lowest assessed value per square foot first):')
    for (const c of sample) {
      lines.push(
        `    - ${titleCase(c.addr)} — ${money(c.tv)}, ${
          c.la ? `${sf(c.la)} sq ft` : 'area n/a'
        }, ${moneyCents(c.psf)}/sq ft${c.yr ? `, built ${c.yr}` : ''}`,
      )
    }
    const rest = comps.length - sample.length
    if (rest > 0) {
      lines.push(
        `    (${rest} further comparable ${rest === 1 ? 'property' : 'properties'} available on request.)`,
      )
    }
    lines.push('')
  }

  lines.push('THE CALCULATION')
  lines.push(
    `  Applying the median assessed rate of ${moneyCents(medPsf)} per square foot to my ${
      subject.la ? sf(subject.la) : ''
    } square feet gives a proportionate assessed value of ${money(fair)}.`,
  )

  if (over > 0) {
    lines.push(
      `  My property is assessed at ${money(subject.tv)}, which is ${money(
        over,
      )} above that proportionate value — approximately ${(ratio * 100 - 100).toFixed(
        1,
      )}% higher per square foot than comparable properties.`,
    )
    if (result.taxOver) {
      lines.push(
        `  At my current tax rate that difference is roughly ${money(
          result.taxOver,
        )} of property tax per year.`,
      )
    }
    lines.push('')
    lines.push('REQUEST')
    lines.push(
      `  I respectfully request that the assessed value of my property be abated to ${money(
        fair,
      )}, or to such value as the Board of Assessors determines is proportionate to comparable properties.`,
    )
  } else {
    lines.push(
      `  My property is assessed at ${money(
        subject.tv,
      )}, which is at or below that proportionate value. On this measure my assessment appears to be in line with comparable properties.`,
    )
    lines.push('')
    lines.push('REQUEST')
    lines.push(
      '  I request that the Board of Assessors review the assessment and abate it if the property is assessed above its fair cash value as of January 1.',
    )
  }

  if (subject.sp && subject.sd) {
    lines.push('')
    lines.push('ADDITIONAL FACT')
    lines.push(`  The property last sold for ${money(subject.sp)} on ${prettyDate(subject.sd)}.`)
  }

  lines.push('')
  lines.push(
    'These figures are drawn from public assessment records. I am paying my tax bill as assessed while this application is pending.',
  )
  lines.push('')
  lines.push('Signature: _______________________________   Date: ______________')

  return lines.join('\n')
}

/** The text behind "Copy deadline details" in console 04. */
export function buildDeadlineDetails(
  subject: Property | null,
  deadline: Date,
  assessorsDecideBy: Date,
  atbPetitionBy: Date,
): string {
  const lines: string[] = []
  lines.push('PROPERTY TAX ABATEMENT — KEY DATES')
  if (subject) {
    lines.push(`Property: ${titleCase(subject.addr)}`)
    if (subject.pid) lines.push(`Parcel ID: ${subject.pid}`)
  }
  lines.push('')
  lines.push(`1. FILE BY ${longDate(deadline)}`)
  lines.push('   File State Tax Form 128 (Application for Abatement) with the')
  lines.push('   Board of Assessors. This is the due date of the first actual tax')
  lines.push('   bill. Missing it forfeits your appeal rights for the year.')
  lines.push('   Confirm the exact date printed on your own bill.')
  lines.push('')
  lines.push('2. PAY YOUR TAX BILL AS BILLED')
  lines.push('   You must pay the tax as assessed, on time, to keep your right to')
  lines.push('   appeal. Filing does not pause the bill.')
  lines.push('')
  lines.push(`3. BY ${longDate(assessorsDecideBy)} — the assessors must act`)
  lines.push('   The assessors have 3 months to act. If they do not respond, your')
  lines.push('   application is "deemed denied" on this date.')
  lines.push('')
  lines.push(`4. BY ${longDate(atbPetitionBy)} — Appellate Tax Board`)
  lines.push('   If denied (actually or deemed), you have 3 months from that')
  lines.push('   denial to petition the Appellate Tax Board. The small-claims')
  lines.push('   track costs about $65.')
  lines.push('')
  lines.push('EVIDENCE TO GATHER')
  lines.push('   3-5 comparable sales from the last 6-12 months.')
  lines.push('')
  lines.push('WHERE TO FILE')
  lines.push('   City of Boston Assessing Department')
  lines.push('   boston.gov/departments/assessing')
  lines.push('   Form 128: mass.gov/lists/property-tax-forms-and-guides')
  lines.push('')
  lines.push(
    'This is legal information, not legal advice. Have a navigator or clinic review your application before you file.',
  )
  return lines.join('\n')
}
