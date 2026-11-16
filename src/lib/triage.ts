/**
 * Which ground to argue.
 *
 * The first version of this tool ran one comparison and put the answer under
 * the heading "disproportionate assessment", which is the hardest ground in
 * Massachusetts to win on. A homeowner is better served by being asked a few
 * questions first, because the answers usually point somewhere stronger: a
 * recent purchase below the assessment, a wrong square footage, an exemption
 * never claimed.
 *
 * Nothing the owner says here leaves the browser.
 */
import { GROUNDS, type GroundId } from './legal'
import type { Property } from './types'

export type AnswerId =
  | 'ownerOccupied'
  | 'boughtRecently'
  | 'purchasePrice'
  | 'purchaseDate'
  | 'recordWrong'
  | 'conditionProblems'
  | 'valueTooHigh'

/** What the owner has told us. Every field is optional and starts unknown. */
export interface TriageAnswers {
  ownerOccupied?: boolean
  boughtRecently?: boolean
  purchasePrice?: number | null
  purchaseDate?: string | null
  recordWrong?: boolean
  conditionProblems?: boolean
  valueTooHigh?: boolean
}

export interface TriageQuestion {
  id: AnswerId
  question: string
  /** Why it is being asked, in one line. */
  why: string
  kind: 'yes-no' | 'money' | 'date'
}

export const TRIAGE_QUESTIONS: TriageQuestion[] = [
  {
    id: 'ownerOccupied',
    question: 'Do you live in this property as your main home?',
    why: 'Owner-occupants can claim the residential exemption, which is often worth more than an abatement.',
    kind: 'yes-no',
  },
  {
    id: 'valueTooHigh',
    question: 'Is the assessed value more than you could sell the property for?',
    why: 'That is overvaluation, the ground most abatements are won on.',
    kind: 'yes-no',
  },
  {
    id: 'boughtRecently',
    question: 'Did you buy the property in the last two years?',
    why: 'What you actually paid is the strongest single piece of evidence of what it is worth.',
    kind: 'yes-no',
  },
  {
    id: 'purchasePrice',
    question: 'What did you pay for it?',
    why: 'An open-market purchase below the assessed value is direct evidence of overvaluation.',
    kind: 'money',
  },
  {
    id: 'purchaseDate',
    question: 'When did you buy it?',
    why: 'The closer to the January 1 valuation date, the more weight the price carries.',
    kind: 'date',
  },
  {
    id: 'recordWrong',
    question: 'Is anything in the city’s record of your property wrong?',
    why: 'A wrong square footage, room count or year built is the easiest kind of abatement to win.',
    kind: 'yes-no',
  },
  {
    id: 'conditionProblems',
    question: 'Does the property need major repairs, or have problems a buyer would see?',
    why: 'Condition is part of fair cash value, and the record may not reflect it.',
    kind: 'yes-no',
  },
]

export interface GroundAssessment {
  id: GroundId
  title: string
  /** Whether this looks worth raising for this property. */
  strength: 'likely' | 'possible' | 'unlikely'
  /** Why, in the reader's own terms. */
  reason: string
  /** What the owner would have to put in front of the assessors. */
  evidence: string
  /** The warning that travels with a hard ground. */
  caution: string | null
}

/**
 * Rank the grounds for this property and these answers.
 *
 * Questions the owner has not answered simply carry no weight; nothing is
 * assumed on their behalf.
 */
export function rankGrounds(
  subject: Property,
  answers: TriageAnswers,
  signals: {
    /** The sales comparison put the value below the assessment. */
    salesSaysLower?: boolean
    /** The equity comparison found the rate out of line. */
    equityOutOfLine?: boolean
    /** Checks on the record raised something. */
    recordFlags?: number
  } = {},
): GroundAssessment[] {
  const out: GroundAssessment[] = []

  /* Overvaluation. */
  {
    const purchaseBelow =
      answers.purchasePrice !== null &&
      answers.purchasePrice !== undefined &&
      answers.purchasePrice > 0 &&
      answers.purchasePrice < subject.tv
    const reasons: string[] = []
    if (purchaseBelow && answers.purchasePrice) {
      reasons.push(
        `you paid $${answers.purchasePrice.toLocaleString('en-US')} for it, below the assessed $${subject.tv.toLocaleString('en-US')}`,
      )
    }
    if (signals.salesSaysLower) reasons.push('comparable sales point to a lower value')
    if (answers.valueTooHigh) reasons.push('you believe the value is above what it would sell for')
    if (answers.conditionProblems) reasons.push('the condition of the property argues for less')

    const strength: GroundAssessment['strength'] =
      purchaseBelow || signals.salesSaysLower
        ? 'likely'
        : answers.valueTooHigh || answers.conditionProblems
          ? 'possible'
          : 'unlikely'

    out.push({
      id: 'overvaluation',
      title: GROUNDS.overvaluation.title,
      strength,
      reason:
        reasons.length > 0
          ? `Worth arguing because ${reasons.join(', and ')}.`
          : 'Nothing so far suggests the assessment is above what the property would sell for. Comparable sales are the test.',
      evidence: GROUNDS.overvaluation.evidence,
      caution: null,
    })
  }

  /* A wrong record. */
  {
    const flags = signals.recordFlags ?? 0
    const strength: GroundAssessment['strength'] =
      answers.recordWrong === true ? 'likely' : flags > 0 ? 'possible' : 'unlikely'
    out.push({
      id: 'overvaluation',
      title: 'The city’s record of the property is wrong',
      strength,
      reason:
        answers.recordWrong === true
          ? 'You have told us something in the record is wrong. An error in the facts feeds straight into the value, and it is the easiest thing for an assessor to put right.'
          : flags > 0
            ? `There ${flags === 1 ? 'is 1 thing' : `are ${flags} things`} in the record worth checking against the building itself.`
            : 'Nothing in the record stands out as wrong, but only you can confirm the details against the building.',
      evidence:
        'The correct figure, and how you know it: a floor plan, a survey, photographs, or a measurement you took yourself.',
      caution: null,
    })
  }

  /* Exemptions. */
  {
    const missing = answers.ownerOccupied === true && subject.ex === 0
    out.push({
      id: 'exemption',
      title: GROUNDS.exemption.title,
      strength: missing ? 'likely' : answers.ownerOccupied === true ? 'possible' : 'unlikely',
      reason: missing
        ? 'You live here, and the record does not show the residential exemption. That is usually worth more than an abatement, and it is a separate application.'
        : subject.ex === 1
          ? 'The residential exemption is already applied. Other personal exemptions may still be open to you.'
          : 'Exemptions depend on who owns and occupies the property rather than on its value.',
      evidence: 'Proof that you own and live in the property, and of any qualifying status.',
      caution: null,
    })
  }

  /* Disproportionate assessment, with its warning attached. */
  out.push({
    id: 'disproportionate',
    title: GROUNDS.disproportionate.title,
    strength: signals.equityOutOfLine ? 'possible' : 'unlikely',
    reason: signals.equityOutOfLine
      ? 'Your property is assessed at a higher rate per square foot than comparable homes of the same type. That inconsistency is worth putting to the local assessors, but it is not by itself a winning ground on appeal.'
      : 'Your assessment is broadly in line with the rate applied to comparable homes of the same type.',
    evidence: GROUNDS.disproportionate.evidence,
    caution: GROUNDS.disproportionate.burden,
  })

  const order = { likely: 0, possible: 1, unlikely: 2 }
  return out.sort((a, b) => order[a.strength] - order[b.strength])
}
