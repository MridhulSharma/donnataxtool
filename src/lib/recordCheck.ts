/**
 * Checks on the city's own record of the property.
 *
 * The cheapest abatement to win is the one where the record is simply wrong.
 * A house carried at the wrong square footage, a finished basement that was
 * never finished, a condition grade that does not match the building: these
 * are facts an assessor can verify and correct, and they do not require a
 * valuation argument at all.
 *
 * Each check compares one part of the record against another source already
 * on file. Nothing here is a finding: every item is a question for the owner
 * to confirm, because only they can see the building.
 */
import { median } from './stats'
import { CONDITION_LABEL, type ParcelDetail, type Property } from './types'

export type CheckSeverity = 'ask' | 'flag'

export interface RecordCheck {
  id: string
  severity: CheckSeverity
  title: string
  /** What the record says, and what it is being compared against. */
  detail: string
  /** The question to put to the owner. */
  question: string
}

/** How far from the neighbourhood norm a figure must sit to be worth asking about. */
const AREA_OUTLIER = 0.4

export function checkRecord(
  subject: Property,
  pool: readonly Property[],
  detail: ParcelDetail | null,
): RecordCheck[] {
  const checks: RecordCheck[] = []

  /* No floor area at all. */
  if (!subject.la || subject.la <= 0) {
    checks.push({
      id: 'no-area',
      severity: 'flag',
      title: 'The city has no floor area on file',
      detail:
        'Your record carries no living or gross area. An assessment set without it cannot be checked against other homes, by you or by anyone else.',
      question: 'Do you know the floor area of your home? It is worth asking how yours was valued.',
    })
  }

  /* Floor area far from its own class in the same area. */
  if (subject.la && subject.lu) {
    const sameClass = pool
      .filter((p) => p.lu === subject.lu && p.la && p.la > 200 && p.areaSrc === subject.areaSrc)
      .map((p) => p.la as number)
    if (sameClass.length >= 20) {
      const typical = median(sameClass)
      if (typical && Math.abs(subject.la - typical) / typical > AREA_OUTLIER) {
        const direction = subject.la > typical ? 'larger' : 'smaller'
        checks.push({
          id: 'area-outlier',
          severity: 'ask',
          title: `The recorded floor area is well ${direction} than others of this type`,
          detail: `Your record says ${subject.la.toLocaleString('en-US')} sq ft. The typical ${
            subject.luDesc?.toLowerCase() ?? 'property of this type'
          } nearby is recorded at about ${Math.round(typical).toLocaleString('en-US')} sq ft.`,
          question:
            'Measure the outside of your home, or check the figure against your deed or a floor plan. A square footage that is too high raises the assessment directly.',
        })
      }
    }
  }

  /* Condition grade worth confirming. */
  if (subject.cond && (subject.cond === 'G' || subject.cond === 'VG' || subject.cond === 'E')) {
    checks.push({
      id: 'condition',
      severity: 'ask',
      title: `The city records the condition as ${CONDITION_LABEL[subject.cond].toLowerCase()}`,
      detail:
        'Condition feeds the assessment. A grade above what the building deserves raises the value with it.',
      question:
        'Does that match your home? Deferred repairs, an old roof, old heating or wiring, water damage or structural problems all argue for a lower grade — and photographs are good evidence.',
    })
  }

  /* A remodel on the record. */
  if (subject.remodel && subject.yr && subject.remodel > subject.yr) {
    checks.push({
      id: 'remodel',
      severity: 'ask',
      title: `The record shows a remodel in ${subject.remodel}`,
      detail:
        'A recorded remodel usually lifts the assessment, and it is one of the most common reasons a value jumps.',
      question:
        'Was that work actually done, and was it as extensive as the record implies? If the work was routine repair rather than improvement, say so in the application.',
    })
  }

  /* Permits that may not line up with the record. */
  const permits = detail?.pm ?? []
  if (permits.length > 0) {
    const recent = permits[0]
    const permitYear = Number(recent.d.slice(0, 4))
    if (
      subject.remodel &&
      Number.isFinite(permitYear) &&
      Math.abs(permitYear - subject.remodel) <= 1
    ) {
      checks.push({
        id: 'permit-remodel',
        severity: 'ask',
        title: 'A permit lines up with the recorded remodel',
        detail: `A permit was issued on ${recent.d}${recent.x ? ` for ${recent.x.toLowerCase()}` : ''}${
          recent.v ? `, with a declared value of $${recent.v.toLocaleString('en-US')}` : ''
        }. The record shows a remodel in ${subject.remodel}.`,
        question:
          'If the permitted work cost far less than the rise in your assessment, that gap is worth putting in front of the assessors.',
      })
    } else if (!subject.remodel && recent.v && recent.v > 50_000) {
      checks.push({
        id: 'permit-no-remodel',
        severity: 'ask',
        title: 'Recent permitted work is not reflected as a remodel',
        detail: `A permit was issued on ${recent.d}${recent.x ? ` for ${recent.x.toLowerCase()}` : ''}, with a declared value of $${recent.v.toLocaleString('en-US')}.`,
        question:
          'Check that the work described matches what was actually done. Permits are often pulled for work that is scaled back or never finished.',
      })
    }
  }

  /* A jump in the assessment worth explaining. */
  const history = detail?.h ?? []
  if (history.length >= 2) {
    const [[thisYear, thisValue], [lastYear, lastValue]] = history
    if (lastValue > 0) {
      const change = (thisValue - lastValue) / lastValue
      if (change > 0.15) {
        checks.push({
          id: 'jump',
          severity: 'flag',
          title: `The assessment rose ${Math.round(change * 100)}% from FY${lastYear} to FY${thisYear}`,
          detail: `It went from $${lastValue.toLocaleString('en-US')} to $${thisValue.toLocaleString('en-US')}.`,
          question:
            'A rise far above the neighbourhood usually has a cause on the record: a remodel, a correction to the square footage, or a reclassification. Ask the assessors which it was, and whether it is right.',
        })
      }
    }
  }

  /* The residential exemption, which is worth more than most abatements. */
  if (subject.ex === 0) {
    checks.push({
      id: 'no-residential-exemption',
      severity: 'flag',
      title: 'The residential exemption is not applied to this property',
      detail:
        'The exemption is for owners who live in the property as their main home. It comes off the taxable value, and it is worth more than most abatements.',
      question:
        'Do you live here as your primary residence? If so, this is probably the first thing to fix.',
    })
  }

  return checks
}
