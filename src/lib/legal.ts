/**
 * Every legal fact the product relies on, in one place, with its source.
 *
 * Nothing in the UI may state a deadline, a fee, a ground or a procedure that
 * is not derived from this file. Figures that change (fees, exemption amounts)
 * carry the date they were last checked, so a stale number is visible rather
 * than silent.
 *
 * Sources are cited inline and surfaced on the About page.
 */

/** When the facts below were last checked against their sources. */
export const FACTS_CHECKED = '2026-11-15'

/* ------------------------------------------------------------------ *
 * Grounds for abatement
 * ------------------------------------------------------------------ */

export type GroundId =
  | 'overvaluation'
  | 'disproportionate'
  | 'classification'
  | 'exemption'

export interface Ground {
  id: GroundId
  /** The name used on State Tax Form 128. */
  formLabel: string
  /** Plain-language name for the reader. */
  title: string
  /** What the owner has to show. */
  burden: string
  /** What evidence actually carries it. */
  evidence: string
  /**
   * How hard this ground is to win on the public record alone. This is the
   * single most important thing the tool can tell a homeowner, and it is the
   * one most legal-tech tools get wrong.
   */
  difficulty: 'standard' | 'high-bar'
}

export const GROUNDS: Record<GroundId, Ground> = {
  overvaluation: {
    id: 'overvaluation',
    formLabel: 'Overvaluation',
    title: 'The assessment is higher than the property is worth',
    burden:
      'That the assessed value is above fair cash value as of January 1 before the fiscal year began.',
    evidence:
      'Sales of comparable properties close to that January 1, a recent arm’s-length purchase of the property itself, or an appraisal.',
    difficulty: 'standard',
  },
  disproportionate: {
    id: 'disproportionate',
    formLabel: 'Disproportionate assessment',
    title: 'The property is assessed at a higher share of value than others',
    burden:
      'Massachusetts requires proof of an intentional policy or scheme of assessing other properties at a lower percentage of fair cash value. A comparison against a handful of neighbours does not meet it.',
    evidence:
      'Evidence of a widespread, deliberate scheme across a class of property. The Appellate Tax Board rejects claims built only on nearby assessed values.',
    difficulty: 'high-bar',
  },
  classification: {
    id: 'classification',
    formLabel: 'Incorrect usage classification',
    title: 'The property is in the wrong class',
    burden: 'That the property is taxed in the wrong usage class.',
    evidence: 'The actual use of the property, and the class the record assigns it.',
    difficulty: 'standard',
  },
  exemption: {
    id: 'exemption',
    formLabel: 'Other',
    title: 'A statutory exemption was not applied',
    burden: 'That the owner qualifies for an exemption the bill does not reflect.',
    evidence: 'Proof of the qualifying status, filed on the exemption application.',
    difficulty: 'standard',
  },
}

/**
 * Why the disproportionate-assessment ground is a trap for a self-represented
 * homeowner. Shown wherever the tool mentions that ground.
 */
export const DISPROPORTIONATE_WARNING =
  'To win on disproportionate assessment in Massachusetts you must prove the assessors ran an intentional, widespread scheme of under-assessing other properties. The Appellate Tax Board routinely rejects applications that rest on the assessed values of a few nearby homes. An equity comparison can still help persuade a local Board of Assessors, but overvaluation — backed by comparable sales — is the ground a homeowner is far more likely to win on.'

export const CASE_CITATIONS = [
  {
    cite: 'Frost v. Assessors of Burlington, ATB (2007)',
    held:
      'Evidence of the assessed values of a handful of nearby properties fell well short of proving an intentional, widespread scheme.',
    url: 'https://www.mass.gov/doc/james-m-frost-v-board-of-assessors-of-the-town-of-burlington-october-2-2007/download',
  },
  {
    cite: 'Eaton v. Assessors of Acton, ATB (2025)',
    held:
      'The appellant did not establish the requisite intentional scheme, and offered no comparable sales.',
    url: 'https://www.mass.gov/doc/eaton-casey-v-board-of-assessors-of-the-town-of-acton-march-17-2025/download',
  },
  {
    cite: 'Brown v. Assessors of Brookline, 58 Mass. App. Ct. (1997)',
    held:
      'A taxpayer must clear a threshold showing of a deliberate scheme of discriminatory assessment.',
    url: 'https://case-law.vlex.com/vid/brown-v-board-of-889131471',
  },
  {
    cite: 'G.L. c. 59, §§ 63–65; G.L. c. 58A, § 6',
    held:
      'An application not acted on within three months of filing is deemed denied; an appeal runs three months from the decision or the deemed denial.',
    url: 'https://malegislature.gov/laws/generallaws/parti/titleix/chapter59/section64',
  },
] as const

/* ------------------------------------------------------------------ *
 * Deadlines
 * ------------------------------------------------------------------ */

/**
 * The abatement application is due on the due date of the first actual tax
 * bill. In Boston that is typically February 1, rolling to the next business
 * day when it falls on a weekend or holiday. Missing it forfeits appeal rights
 * for the year, and there is no cure.
 *
 * Boston's FY2025 notice set a 5:00 pm cut-off at City Hall on the deadline
 * day, so the tool states a 5:00 pm Eastern cut-off and tells the reader to
 * confirm the time printed on their own bill.
 * https://cityofboston.gov/Assessing/search
 */
export const FILING_CUTOFF_HOUR_ET = 17

/** The assessors have three months from filing to act. G.L. c. 59, s. 64. */
export const ASSESSORS_MONTHS = 3

/** Three months from denial, actual or deemed, to petition the ATB. s. 64-65. */
export const ATB_MONTHS = 3

/**
 * Where the assessors fail to send written notice of their inaction within ten
 * days of the deemed-denial date, the Board may extend the appeal deadline by
 * two months. G.L. c. 59, s. 65C. Never relied on as the operative date.
 */
export const ATB_LATE_NOTICE_EXTENSION_MONTHS = 2

/* ------------------------------------------------------------------ *
 * Appellate Tax Board entry fees
 * ------------------------------------------------------------------ */

/**
 * The entry fee a taxpayer pays is set by the assessed value of the property.
 * The widely repeated "$65 small claims" figure is not a taxpayer fee at all:
 * it is what a municipality pays to transfer an appeal from the informal to
 * the formal procedure.
 *
 * Source: Appellate Tax Board filing fee schedule, checked 2026-11-15.
 * https://www.mass.gov/how-to/local-real-estate-tax-appeals
 */
export const ATB_FEES_SOURCE = 'https://www.mass.gov/how-to/local-real-estate-tax-appeals'

/** The fee a municipality pays to move an appeal to the formal procedure. */
export const ATB_MUNICIPAL_TRANSFER_FEE = 65

export interface AtbFee {
  /** Dollars, or null when the fee is calculated per thousand. */
  amount: number | null
  /** How the figure was arrived at, in the reader's words. */
  basis: string
}

/**
 * The entry fee for an assessed value, per the Board's published schedule.
 * Above $1,000,000 the fee is $0.10 per $1,000 of assessed value, capped at
 * $5,000.
 */
export function atbEntryFee(assessedValue: number | null | undefined): AtbFee {
  if (assessedValue === null || assessedValue === undefined || !Number.isFinite(assessedValue)) {
    return {
      amount: null,
      basis: 'The entry fee depends on your assessed value. See the Board’s fee schedule.',
    }
  }
  if (assessedValue <= 20_000) {
    return { amount: 10, basis: 'Assessed value of $20,000 or less.' }
  }
  if (assessedValue <= 100_000) {
    return { amount: 50, basis: 'Assessed value over $20,000 and up to $100,000.' }
  }
  if (assessedValue < 1_000_000) {
    return { amount: 100, basis: 'Assessed value over $100,000 and under $1,000,000.' }
  }
  const perThousand = Math.round((assessedValue / 1000) * 0.1)
  const capped = Math.min(perThousand, 5000)
  return {
    amount: capped,
    basis:
      capped === 5000
        ? '$0.10 per $1,000 of assessed value, capped at the $5,000 maximum.'
        : '$0.10 per $1,000 of assessed value.',
  }
}

/* ------------------------------------------------------------------ *
 * Official pages
 * ------------------------------------------------------------------ */

export const LINKS = {
  form128: 'https://www.mass.gov/lists/property-tax-forms-and-guides',
  bostonAssessing: 'https://www.boston.gov/departments/assessing',
  bostonAbatements: 'https://www.boston.gov/node/15952506',
  bostonPropertyLookup: 'https://www.boston.gov/departments/assessing/boston-property-lookup',
  residentialExemption: 'https://www.boston.gov/departments/assessing/residential-exemption',
  abatementGuide: 'https://www.sec.state.ma.us/divisions/cis/tax/property-abatement.htm',
  atb: 'https://www.mass.gov/orgs/appellate-tax-board',
  atbFees: ATB_FEES_SOURCE,
  analyzeBoston: 'https://data.boston.gov/dataset/property-assessment',
} as const

/** Where the application is filed. */
export const ASSESSORS_OFFICE = {
  name: 'City of Boston Assessing Department',
  room: 'Room 301, Boston City Hall',
  address: '1 City Hall Square, Boston, MA 02201',
  alsoAt: 'Taxpayer Referral & Assistance Center (TRAC), mezzanine level, City Hall',
  phone: '617-635-4287',
} as const

/** Evidence the assessors actually look for. */
export const EVIDENCE_GUIDANCE =
  '3–5 comparable sales from the last 6–12 months, as close as possible to the January 1 valuation date.'

/** The sentence that must appear on every page. */
export const DISCLAIMER_SHORT =
  'This is legal information, not legal advice. You must still pay your tax bill as billed to keep your right to appeal.'
