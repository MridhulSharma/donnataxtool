/**
 * How much weight an estimate can carry.
 *
 * A number with no sense of its own reliability is the thing most likely to
 * send someone to the Board of Assessors with a case that falls apart. Every
 * estimate in this tool is scored here, on the same four questions: how much
 * evidence, how consistent, how close, how recent.
 */
import { coefficientOfDispersion, median } from './stats'

export type ConfidenceLevel = 'none' | 'weak' | 'moderate' | 'strong'

export interface Confidence {
  level: ConfidenceLevel
  /** What the level means, for the reader. */
  summary: string
  /** The specific things that strengthen or weaken it. */
  factors: { label: string; detail: string; good: boolean }[]
}

export interface ConfidenceInput {
  /** Comparables the estimate rests on. */
  count: number
  /** The adjusted figures, used to measure how much they agree. */
  values: readonly number[]
  /** Distance to each comparable in miles, where known. */
  distances?: readonly (number | null)[]
  /** Months before the valuation date each sale happened, where relevant. */
  monthsOld?: readonly number[]
  /** True when the comparison rests on sales rather than other assessments. */
  fromSales: boolean
  /** True when the adjustments were measured rather than assumed. */
  modelled?: boolean
}

const LEVEL_SUMMARY: Record<ConfidenceLevel, string> = {
  none: 'There is not enough evidence here to support a finding either way.',
  weak: 'Treat this as a first look. It is worth a conversation with a navigator, but it is not yet a case.',
  moderate:
    'A reasonable case on the evidence available. A navigator should check it against the details of your home before you file.',
  strong:
    'The evidence here is consistent and close to your property. This is the kind of case assessors take seriously, and a navigator should still review it.',
}

export function scoreConfidence(input: ConfidenceInput): Confidence {
  const factors: Confidence['factors'] = []

  if (input.count === 0) {
    return { level: 'none', summary: LEVEL_SUMMARY.none, factors }
  }

  let score = 0

  // How much evidence there is.
  if (input.count >= 6) {
    score += 2
    factors.push({
      label: 'Number of comparables',
      detail: `${input.count} comparable properties, which is enough for the middle figure to be stable.`,
      good: true,
    })
  } else if (input.count >= 3) {
    score += 1
    factors.push({
      label: 'Number of comparables',
      detail: `${input.count} comparable properties. Enough to make the comparison, few enough that one unusual property still moves it.`,
      good: true,
    })
  } else {
    factors.push({
      label: 'Number of comparables',
      detail: `Only ${input.count}. One unusual property would move this figure a long way.`,
      good: false,
    })
  }

  // Whether they agree with one another.
  const dispersion = coefficientOfDispersion(input.values)
  if (dispersion !== null) {
    if (dispersion <= 15) {
      score += 2
      factors.push({
        label: 'Agreement between them',
        detail: `The comparables agree closely once adjusted, within about ${dispersion.toFixed(0)}% of each other.`,
        good: true,
      })
    } else if (dispersion <= 25) {
      score += 1
      factors.push({
        label: 'Agreement between them',
        detail: `The comparables are spread about ${dispersion.toFixed(0)}% around the middle figure, which is wide but workable.`,
        good: true,
      })
    } else {
      factors.push({
        label: 'Agreement between them',
        detail: `The comparables disagree by about ${dispersion.toFixed(0)}% around the middle figure, so the range matters more than any single number.`,
        good: false,
      })
    }
  }

  // Whether the evidence is the kind that persuades.
  if (input.fromSales) {
    score += 2
    factors.push({
      label: 'Kind of evidence',
      detail:
        'Based on what comparable homes actually sold for, which is the evidence an abatement turns on.',
      good: true,
    })
  } else {
    factors.push({
      label: 'Kind of evidence',
      detail:
        'Based on what the city assessed other homes at, not on sale prices. This can show an inconsistency, but it is weaker evidence than sales.',
      good: false,
    })
  }

  if (input.modelled) {
    score += 1
    factors.push({
      label: 'Adjustments',
      detail:
        'Differences in size, age and condition were measured from local sales rather than assumed.',
      good: true,
    })
  }

  // How close they are.
  const known = (input.distances ?? []).filter((d): d is number => d !== null)
  if (known.length > 0) {
    const middle = median(known) ?? 0
    if (middle <= 0.3) {
      score += 1
      factors.push({
        label: 'How close they are',
        detail: `Typically ${middle.toFixed(2)} miles away — the same streets as your home.`,
        good: true,
      })
    } else {
      factors.push({
        label: 'How close they are',
        detail: `Typically ${middle.toFixed(2)} miles away, so local differences may not be fully accounted for.`,
        good: false,
      })
    }
  }

  // How recent they are.
  const months = input.monthsOld ?? []
  if (months.length > 0) {
    const middle = median([...months]) ?? 0
    if (middle <= 12) {
      score += 1
      factors.push({
        label: 'How recent they are',
        detail: `Typically ${middle.toFixed(0)} months before the valuation date.`,
        good: true,
      })
    } else {
      factors.push({
        label: 'How recent they are',
        detail: `Typically ${middle.toFixed(0)} months before the valuation date, so the market may have moved between the sale and the assessment.`,
        good: false,
      })
    }
  }

  const level: ConfidenceLevel = score >= 7 ? 'strong' : score >= 4 ? 'moderate' : 'weak'
  return { level, summary: LEVEL_SUMMARY[level], factors }
}
