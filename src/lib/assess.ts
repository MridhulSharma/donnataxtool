/**
 * The disproportionate-assessment estimate.
 *
 * Massachusetts recognises two grounds for an abatement. This is the second one:
 * not "my house isn't worth that", but "my house is assessed at a higher share of
 * its value than comparable houses are." It is provable with public data alone,
 * which is what makes it usable without an appraiser.
 *
 * The method is deliberately simple and fully shown to the user. It is an
 * estimate, never a prediction of the outcome.
 */
import type { Property } from './types'

/** Comps must be this close to the subject to count. */
export const LIVING_TOLERANCE = 0.25 // +/- 25% of living area
export const YEAR_TOLERANCE = 15 // +/- 15 years built
export const MIN_COMPS = 3
/** Below this ratio the gap is inside the noise of a mass appraisal. */
export const RATIO_THRESHOLD = 1.05

export interface Comp extends Property {
  /** This comp's assessed dollars per square foot. */
  psf: number
}

export type AssessmentResult =
  | {
      status: 'insufficient-data'
      /** Why we cannot score it, in plain language. */
      reason: string
      compCount: number
    }
  | {
      status: 'scored'
      overAssessed: boolean
      /** The subject's assessed $/sq ft. */
      subjPsf: number
      /** Median assessed $/sq ft across the comps. */
      medPsf: number
      /** What the subject would be assessed at, at the median rate. */
      fair: number
      /** Assessed value minus the proportionate value. Positive means over. */
      over: number
      /** subjPsf / medPsf. 1.0 is exactly in line. */
      ratio: number
      /** Estimated annual tax overpayment, when the tax rate is knowable. */
      taxOver: number | null
      comps: Comp[]
      compCount: number
    }

export function median(values: number[]): number {
  if (values.length === 0) return NaN
  const s = [...values].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * Comparable properties: same source as the subject, similar size, similar age.
 * Year is only applied when both years are known — an unknown year is not a
 * reason to throw away an otherwise good comp.
 */
export function findComps(subject: Property, pool: Property[]): Comp[] {
  const la = subject.la
  if (!la || la <= 200) return []

  const minLa = la * (1 - LIVING_TOLERANCE)
  const maxLa = la * (1 + LIVING_TOLERANCE)

  const comps: Comp[] = []
  for (const c of pool) {
    if (c.pid === subject.pid) continue
    if (!c.la || c.la <= 200) continue
    if (c.tv <= 10000) continue
    if (c.la < minLa || c.la > maxLa) continue
    if (subject.yr && c.yr && Math.abs(c.yr - subject.yr) > YEAR_TOLERANCE) continue
    comps.push({ ...c, psf: c.tv / c.la })
  }

  // Cheapest per sq ft first: the strongest evidence for the homeowner sits at
  // the top, and the table reads as an argument rather than a dump.
  comps.sort((a, b) => a.psf - b.psf)
  return comps
}

export function assess(subject: Property, pool: Property[]): AssessmentResult {
  if (!subject.la || subject.la <= 200) {
    return {
      status: 'insufficient-data',
      reason:
        'This record has no living area on file, so there is no square footage to compare against other homes.',
      compCount: 0,
    }
  }

  const comps = findComps(subject, pool)

  if (comps.length < MIN_COMPS) {
    return {
      status: 'insufficient-data',
      reason: `We found ${comps.length} comparable ${
        comps.length === 1 ? 'property' : 'properties'
      } for this home, and this estimate needs at least ${MIN_COMPS}. That does not mean the assessment is correct — it means the public records nearby are too thin to check it this way.`,
      compCount: comps.length,
    }
  }

  const subjPsf = subject.tv / subject.la
  const medPsf = median(comps.map((c) => c.psf))
  const fair = medPsf * subject.la
  const over = subject.tv - fair
  const ratio = subjPsf / medPsf

  // If we know this year's tax, the effective rate lets us put the gap in the
  // terms the homeowner actually feels: dollars on the bill.
  const taxOver =
    subject.gt && subject.gt > 0 && over > 0 ? (subject.gt / subject.tv) * over : null

  return {
    status: 'scored',
    overAssessed: over > 0 && ratio > RATIO_THRESHOLD,
    subjPsf,
    medPsf,
    fair,
    over,
    ratio,
    taxOver,
    comps,
    compCount: comps.length,
  }
}
