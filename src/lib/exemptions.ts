/**
 * Exemptions, which are a separate application from an abatement and often
 * worth considerably more.
 *
 * An abatement argues the value is wrong. An exemption says the owner
 * qualifies for relief whatever the value is. The two have different
 * deadlines, different forms, and no connection to one another, and a
 * homeowner who only hears about abatements can easily miss the larger
 * saving.
 *
 * Eligibility rules for the personal exemptions turn on age, income, assets,
 * service record and disability, and those thresholds change. Nothing is
 * invented here: each one is named with what it is for, and the reader is
 * sent to the city for the current rules.
 */
import { LINKS } from './legal'
import type { Property } from './types'

export interface ExemptionLead {
  id: string
  title: string
  /** Who it is for. */
  who: string
  /** What the record suggests, if anything. */
  status: 'applied' | 'missing' | 'worth-checking'
  detail: string
  /** The page with the current rules and the application. */
  link: string
}

/**
 * The residential exemption deadline is its own, and it is not February 1.
 * Boston's published FY2027 date is April 1, 2027.
 * https://www.boston.gov/departments/assessing/residential-exemption
 */
export const EXEMPTION_DEADLINE = { month: 4, day: 1 } as const

/**
 * Boston reports the residential exemption saved qualifying owners up to
 * $4,353.74 in the last fiscal year. It is quoted as what it was, never as
 * what this year's will be.
 */
export const RESIDENTIAL_EXEMPTION_LAST_YEAR = {
  amount: 4353.74,
  wording: 'saved qualifying Boston homeowners up to $4,353.74 last fiscal year',
} as const

export function exemptionLeads(
  subject: Property,
  answers: { ownerOccupied?: boolean } = {},
): ExemptionLead[] {
  const leads: ExemptionLead[] = []

  const occupies = answers.ownerOccupied ?? (subject.ownerOcc === 1 ? true : undefined)

  if (subject.ex === 1) {
    leads.push({
      id: 'residential',
      title: 'Residential exemption',
      who: 'Owners who live in the property as their main home.',
      status: 'applied',
      detail:
        'The record shows this is already applied to your property, so the saving is in your bill. Check it is still there each year.',
      link: LINKS.residentialExemption,
    })
  } else {
    leads.push({
      id: 'residential',
      title: 'Residential exemption',
      who: 'Owners who live in the property as their main home.',
      status: occupies === true ? 'missing' : 'worth-checking',
      detail:
        occupies === true
          ? `You have told us you live here, and the record does not show this exemption. It ${RESIDENTIAL_EXEMPTION_LAST_YEAR.wording}, and it is a separate application from an abatement, with its own deadline.`
          : `The record does not show this exemption. If you live in the property as your main home you may be able to claim it. It ${RESIDENTIAL_EXEMPTION_LAST_YEAR.wording}.`,
      link: LINKS.residentialExemption,
    })
  }

  const personal: { id: string; title: string; who: string }[] = [
    {
      id: '41c',
      title: 'Elderly exemption (Clause 41C)',
      who: 'Older owners who meet the city’s age, income and asset limits.',
    },
    {
      id: '17d',
      title: 'Clause 17D',
      who: 'Older owners, surviving spouses and surviving minor children, with an asset limit but no income limit.',
    },
    {
      id: 'veteran',
      title: 'Veteran exemption',
      who: 'Veterans with a qualifying service-connected disability, and some surviving family.',
    },
    {
      id: 'blind',
      title: 'Blind exemption (Clause 37A)',
      who: 'Owners registered as legally blind with the Massachusetts Commission for the Blind.',
    },
    {
      id: 'hardship',
      title: 'Hardship exemption',
      who: 'Owners in financial hardship through age, infirmity or poverty.',
    },
    {
      id: 'workoff',
      title: 'Senior work-off',
      who: 'Older owners who can work off part of the bill through volunteering for the city.',
    },
  ]

  for (const item of personal) {
    leads.push({
      id: item.id,
      title: item.title,
      who: item.who,
      status: 'worth-checking',
      detail:
        'Eligibility turns on rules the city sets and reviews each year, so check the current ones before you apply. These are separate from an abatement and do not affect it.',
      link: LINKS.bostonAbatements,
    })
  }

  return leads
}

/** The next exemption deadline on or after a given day. */
export function nextExemptionDeadline(today: { year: number; month: number; day: number }): {
  year: number
  month: number
  day: number
} {
  const thisYear = { year: today.year, ...EXEMPTION_DEADLINE }
  const past =
    today.month > EXEMPTION_DEADLINE.month ||
    (today.month === EXEMPTION_DEADLINE.month && today.day > EXEMPTION_DEADLINE.day)
  return past ? { year: today.year + 1, ...EXEMPTION_DEADLINE } : thisYear
}
