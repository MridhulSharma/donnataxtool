/**
 * The equity comparison: how this property's assessment per square foot sits
 * against comparable homes assessed by the same city.
 *
 * Read the warning in legal.ts before putting any weight on this. Standing
 * alone it supports the disproportionate-assessment ground, which in
 * Massachusetts requires proof of an intentional scheme and which the
 * Appellate Tax Board rejects when it rests on a handful of neighbours.
 *
 * It is still worth running, for two reasons. A local Board of Assessors is
 * less formal than the Board, and an inconsistency it can see in its own
 * records is persuasive there. And where no sales exist, this is the only
 * check a homeowner can make at all. So the comparison is kept, tightened,
 * and labelled for what it is.
 *
 * Three things changed from the first version of this file, and each was
 * producing wrong answers:
 *
 *   - Comparables are drawn from the subject's own land-use class. Comparing
 *     a single-family house against condominiums, shops and subsidised
 *     housing in the same size band flagged more than a third of an entire
 *     neighbourhood as over-assessed.
 *   - Living area and gross area are never mixed.
 *   - The result is a range, and the verdict is "worth asking about" rather
 *     than a finding.
 */
import { scoreConfidence, type Confidence } from './confidence'
import { median, milesBetween, quantile } from './stats'
import type { Property } from './types'

export const LIVING_TOLERANCE = 0.25
export const YEAR_TOLERANCE = 15
export const MIN_COMPS = 5
export const MAX_MILES = 1
/** Below this the gap sits inside the noise of a mass appraisal. */
export const RATIO_THRESHOLD = 1.1

export interface Comp extends Property {
  /** This comparable's assessed dollars per square foot. */
  psf: number
  /** Miles from the subject, when both have a location on file. */
  miles: number | null
}

/** How the comparable pool was chosen, stated so the reader can check it. */
export interface CompCriteria {
  /** The land-use class the comparison was held within. */
  landUse: string | null
  landUseLabel: string | null
  /** True when no same-class comparables existed and the net was widened. */
  widened: boolean
  areaLow: number
  areaHigh: number
  yearLow: number | null
  yearHigh: number | null
  areaSource: 'living' | 'gross'
  /** False when the pool was capped and may not be the whole area. */
  poolComplete: boolean
}

export type AssessmentResult =
  | {
      status: 'insufficient-data'
      reason: string
      compCount: number
      criteria: CompCriteria | null
    }
  | {
      status: 'scored'
      /** True only when the assessment sits above the top of the range. */
      outOfLine: boolean
      subjPsf: number
      medPsf: number
      /** The range of rates comparable homes are assessed at. */
      lowPsf: number
      highPsf: number
      /** The subject at the median rate for its class. */
      proportionate: number
      /** Assessed value less the proportionate value. Positive means above. */
      over: number
      ratio: number
      taxOver: number | null
      comps: Comp[]
      compCount: number
      criteria: CompCriteria
      confidence: Confidence
      fiscalYear: number
    }

export { median }

/**
 * Comparables: same class, similar size, similar age, nearby, and measured
 * the same way. Year is applied only when both years are known, because an
 * unknown year is not a reason to throw away an otherwise good comparable.
 */
export function findComps(
  subject: Property,
  pool: readonly Property[],
  options: { widen?: boolean } = {},
): Comp[] {
  const area = subject.la
  if (!area || area <= 200 || !subject.areaSrc) return []

  const minArea = area * (1 - LIVING_TOLERANCE)
  const maxArea = area * (1 + LIVING_TOLERANCE)
  const matchClass = !options.widen && Boolean(subject.lu)

  const comps: Comp[] = []
  for (const candidate of pool) {
    if (candidate.pid === subject.pid) continue
    if (!candidate.la || candidate.la <= 200) continue
    if (candidate.tv <= 10_000) continue
    // Two different measurements must never land in the same median.
    if (candidate.areaSrc !== subject.areaSrc) continue
    if (matchClass && candidate.lu !== subject.lu) continue
    if (candidate.la < minArea || candidate.la > maxArea) continue
    if (subject.yr && candidate.yr && Math.abs(candidate.yr - subject.yr) > YEAR_TOLERANCE) {
      continue
    }

    let miles: number | null = null
    if (
      subject.lat !== null &&
      subject.lon !== null &&
      candidate.lat !== null &&
      candidate.lon !== null
    ) {
      miles = milesBetween(
        { lat: subject.lat, lon: subject.lon },
        { lat: candidate.lat, lon: candidate.lon },
      )
      if (miles > MAX_MILES) continue
    }

    comps.push({ ...candidate, psf: candidate.tv / candidate.la, miles })
  }

  // Cheapest per square foot first: the table then reads as the argument the
  // homeowner would make, strongest evidence at the top.
  comps.sort((a, b) => a.psf - b.psf)
  return comps
}

export function assess(
  subject: Property,
  pool: readonly Property[],
  options: { poolComplete?: boolean } = {},
): AssessmentResult {
  if (!subject.la || subject.la <= 200 || !subject.areaSrc) {
    return {
      status: 'insufficient-data',
      reason:
        'This record has no floor area on file, so there is no square footage to compare against other homes. That gap is itself worth raising with the assessors.',
      compCount: 0,
      criteria: null,
    }
  }

  let widened = false
  let comps = findComps(subject, pool)
  if (comps.length < MIN_COMPS && subject.lu) {
    // Widening crosses property classes, which weakens the comparison, so it
    // happens only when the strict pass found too little, and it is declared.
    const wider = findComps(subject, pool, { widen: true })
    if (wider.length > comps.length) {
      comps = wider
      widened = true
    }
  }

  const criteria: CompCriteria = {
    landUse: subject.lu,
    landUseLabel: subject.luDesc,
    widened,
    areaLow: Math.round(subject.la * (1 - LIVING_TOLERANCE)),
    areaHigh: Math.round(subject.la * (1 + LIVING_TOLERANCE)),
    yearLow: subject.yr ? subject.yr - YEAR_TOLERANCE : null,
    yearHigh: subject.yr ? subject.yr + YEAR_TOLERANCE : null,
    areaSource: subject.areaSrc,
    poolComplete: options.poolComplete ?? true,
  }

  if (comps.length < MIN_COMPS) {
    return {
      status: 'insufficient-data',
      reason: `We found ${comps.length} comparable ${
        comps.length === 1 ? 'property' : 'properties'
      } of the same type, close in size and age, and this comparison needs at least ${MIN_COMPS}. That does not mean the assessment is right — it means the public records nearby are too thin to check it this way.`,
      compCount: comps.length,
      criteria,
    }
  }

  const rates = comps.map((c) => c.psf)
  const subjPsf = subject.tv / subject.la
  const medPsf = median(rates) ?? 0
  const lowPsf = quantile(rates, 0.25) ?? medPsf
  const highPsf = quantile(rates, 0.75) ?? medPsf
  const proportionate = medPsf * subject.la
  const over = subject.tv - proportionate
  const ratio = medPsf === 0 ? 1 : subjPsf / medPsf

  // Out of line only when the rate sits above the top of the range AND
  // clears the noise band. Either test alone flags far too much.
  const outOfLine = subjPsf > highPsf && ratio > RATIO_THRESHOLD

  const taxOver =
    subject.gt && subject.gt > 0 && over > 0 ? (subject.gt / subject.tv) * over : null

  const confidence = scoreConfidence({
    count: comps.length,
    values: rates,
    distances: comps.map((c) => c.miles),
    fromSales: false,
  })

  return {
    status: 'scored',
    outOfLine,
    subjPsf,
    medPsf,
    lowPsf,
    highPsf,
    proportionate,
    over,
    ratio,
    taxOver,
    comps,
    compCount: comps.length,
    criteria,
    confidence,
    fiscalYear: subject.fy,
  }
}
