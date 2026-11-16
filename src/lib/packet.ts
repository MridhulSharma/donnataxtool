/**
 * The evidence packet: a filled State Tax Form 128 and the pages that go
 * behind it.
 *
 * The official form is filled in the browser, from the figures already on
 * screen. Nothing is uploaded, and nothing is filed: the owner downloads it,
 * reads every line, signs it, and takes it to the Assessing Department
 * themselves.
 *
 * Two fields are deliberately left blank for the owner to complete by hand:
 * the signature, and the opinion of value. The opinion is the number they are
 * asking the city to accept, and it has to be theirs.
 */
import type { AssessmentResult } from './assess'
import { buildCaseSummary, leadingGround, type CaseInput } from './caseSummary'
import type { CalendarDay } from './deadline'
import { longDate, money, prettyDate, titleCase } from './format'
import { ASSESSORS_OFFICE, EVIDENCE_GUIDANCE } from './legal'
import type { Property } from './types'
import type { ValuationResult } from './valuation'

/** Where the blank form is served from. */
export const FORM_128_PATH = `${import.meta.env.BASE_URL}forms/form128.pdf`

export interface PacketInput extends CaseInput {
  /** What the owner wants the value reduced to, when they have decided. */
  opinionOfValue?: number | null
  /** The owner's name, as it appears on the bill. */
  ownerName?: string | null
  /** A telephone number for the assessors to call. */
  phone?: string | null
}

/* ------------------------------------------------------------------ *
 * The form
 * ------------------------------------------------------------------ */

/**
 * Field names as the published form carries them. They are matched loosely,
 * so a revision of the form that renames a field leaves the rest filled
 * rather than failing outright.
 */
const FIELDS = {
  cityOrTown: 'Name of City or Town',
  realPropertyTax: 'REAL PROPERTY TAX',
  fiscalYear: 'FISCAL YEAR',
  assessedOwner: 'Names of assessed owner',
  streetNumber: 'No',
  street: 'Street',
  cityTown: 'CityTown',
  zip: 'Zip Code',
  assessedValuation: 'Assessed valuation',
  location: 'Location',
  parcelId: 'Parcel ID no mapblocklot',
  landArea: 'Land area',
  propertyType: 'Property types',
  overvaluation: 'Overvaluation',
  disproportionate: 'Disproportionate assessment',
  classification: 'Incorrect usage classification',
  opinionOfValue: 'Applicants opinion of Value',
  telephone: 'Telephone No',
  explanation: (n: number) => `Explanation ${n}`,
} as const

/** Split a line of prose into the seven short lines the form provides. */
export function explanationLines(text: string, width = 92, max = 7): string[] {
  // A single run of characters longer than the line has to be broken, or it
  // runs off the edge of the form and out of the printed page.
  const words = text
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((word) =>
      word.length <= width ? [word] : (word.match(new RegExp(`.{1,${width}}`, 'g')) ?? [word]),
    )

  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (current.length === 0) current = word
    else if (current.length + 1 + word.length <= width) current += ` ${word}`
    else {
      lines.push(current)
      current = word
      if (lines.length === max) break
    }
  }
  if (lines.length < max && current) lines.push(current)
  return lines.slice(0, max)
}

/** The short explanation that goes on the form itself. */
export function formExplanation(input: PacketInput): string {
  const ground = leadingGround(input)
  const { subject, valuation, equity, purchase } = input

  if (ground === 'record') {
    const errors = input.recordErrors ?? []
    return `The Assessing Department's record of this property is incorrect: ${errors.join('; ')}. The assessed value of ${money(subject.tv)} reflects those errors. A full statement and supporting evidence are attached. I am happy to arrange an inspection.`
  }

  if (ground === 'equity' && equity?.status === 'scored') {
    return `This property is assessed at ${money(subject.tv)}, which is ${(equity.ratio * 100 - 100).toFixed(1)}% above the median assessed value per square foot of ${equity.compCount} comparable properties of the same type nearby. At that median rate the property would be assessed at ${money(equity.proportionate)}. The comparable properties and the calculation are attached.`
  }

  const parts: string[] = []
  parts.push(
    `This property is assessed at ${money(subject.tv)}, above its fair cash value as of January 1, ${subject.fy - 1}.`,
  )
  if (purchase && purchase.price > 0) {
    parts.push(
      `I purchased it on ${prettyDate(purchase.date)} for ${money(purchase.price)} in an open-market sale.`,
    )
  }
  if (valuation?.status === 'valued') {
    parts.push(
      `${valuation.comps.length} comparable sales, adjusted for time, size, age and condition, indicate a value of about ${money(valuation.indicatedValue)} (range ${money(valuation.low)} to ${money(valuation.high)}).`,
    )
  }
  parts.push('The comparable sales, the adjustments and the calculation are attached.')
  return parts.join(' ')
}

/**
 * Fill the official form.
 *
 * pdf-lib is loaded only when a packet is actually built, so the library is
 * not part of the first page load.
 */
export async function fillForm128(input: PacketInput): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib')

  const response = await fetch(FORM_128_PATH)
  if (!response.ok) {
    throw new Error('Could not load the blank State Tax Form 128.')
  }
  const pdf = await PDFDocument.load(await response.arrayBuffer())
  const form = pdf.getForm()

  const setText = (name: string, value: string | null | undefined) => {
    if (!value) return
    try {
      form.getTextField(name).setText(value)
    } catch {
      // A revised form may rename or drop a field. The rest still fills.
    }
  }
  const check = (name: string) => {
    try {
      form.getCheckBox(name).check()
    } catch {
      // As above.
    }
  }

  const { subject } = input
  const ground = leadingGround(input)

  // Where and what.
  setText(FIELDS.cityOrTown, 'Boston')
  check(FIELDS.realPropertyTax)
  setText(FIELDS.fiscalYear, String(subject.fy))
  setText(FIELDS.assessedOwner, input.ownerName ?? '')
  setText(FIELDS.location, titleCase(subject.addr))
  setText(FIELDS.parcelId, subject.pid)
  setText(FIELDS.assessedValuation, money(subject.tv))
  setText(FIELDS.propertyType, subject.luDesc ?? subject.lu ?? '')
  setText(FIELDS.landArea, subject.lot ? `${subject.lot.toLocaleString('en-US')} sq ft` : '')
  setText(FIELDS.telephone, input.phone ?? '')

  // The applicant's address, taken from the property itself: the owner can
  // overwrite it if they are served somewhere else.
  const [streetPart] = subject.addr.split(',')
  const houseNumber = /^(\d+[A-Za-z]?(?:-\d+)?)\s+(.*)$/.exec(streetPart.trim())
  if (houseNumber) {
    setText(FIELDS.streetNumber, houseNumber[1])
    setText(FIELDS.street, titleCase(houseNumber[2]))
  } else {
    setText(FIELDS.street, titleCase(streetPart))
  }
  setText(FIELDS.cityTown, 'Boston')
  setText(FIELDS.zip, subject.zip ?? '')

  // The ground. Only the one the evidence supports is ticked.
  if (ground === 'equity') check(FIELDS.disproportionate)
  else check(FIELDS.overvaluation)

  // The opinion of value is the owner's to give, so it is filled only when
  // they have actually set one.
  if (input.opinionOfValue && input.opinionOfValue > 0) {
    setText(FIELDS.opinionOfValue, money(input.opinionOfValue))
  }

  const lines = explanationLines(formExplanation(input))
  lines.forEach((line, i) => setText(FIELDS.explanation(i + 1), line))

  // Leave every field editable: the owner has to be able to correct this.
  return pdf.save()
}

/* ------------------------------------------------------------------ *
 * The pages behind the form
 * ------------------------------------------------------------------ */

/** A plain-text packet the owner prints and staples behind the form. */
export function buildEvidencePacket(input: PacketInput): string {
  const { subject, valuation, equity, deadline } = input
  const lines: string[] = []
  const rule = '='.repeat(72)

  lines.push(rule)
  lines.push('ABATEMENT APPLICATION — SUPPORTING EVIDENCE')
  lines.push(`${titleCase(subject.addr)}  ·  Parcel ${subject.pid}  ·  FY${subject.fy}`)
  lines.push(rule)
  lines.push('')
  lines.push('WHAT IS IN THIS PACKET')
  lines.push('  1. State Tax Form 128, filled in and signed by me')
  lines.push('  2. This statement of my case')
  lines.push('  3. The comparable properties and the arithmetic')
  lines.push('  4. The record the city holds for my property')
  lines.push('')
  lines.push(rule)
  lines.push('')
  lines.push(buildCaseSummary(input))
  lines.push('')
  lines.push(rule)
  lines.push('THE RECORD THE CITY HOLDS')
  lines.push(rule)
  lines.push(`  Assessed total value   ${money(subject.tv)}`)
  lines.push(`  Land value             ${money(subject.lv)}`)
  lines.push(`  Building value         ${money(subject.bv)}`)
  if (subject.la) {
    lines.push(
      `  ${subject.areaSrc === 'gross' ? 'Gross floor area      ' : 'Living area           '} ${subject.la.toLocaleString('en-US')} sq ft`,
    )
  }
  if (subject.lot) lines.push(`  Lot size               ${subject.lot.toLocaleString('en-US')} sq ft`)
  if (subject.yr) lines.push(`  Year built             ${subject.yr}`)
  if (subject.remodel) lines.push(`  Year remodelled        ${subject.remodel}`)
  if (subject.beds) lines.push(`  Bedrooms               ${subject.beds}`)
  if (subject.baths) lines.push(`  Bathrooms              ${subject.baths}`)
  if (subject.cond) lines.push(`  Recorded condition     ${subject.cond}`)
  if (subject.luDesc) lines.push(`  Property type          ${subject.luDesc}`)
  lines.push(
    `  Residential exemption  ${subject.ex === 1 ? 'Applied' : subject.ex === 0 ? 'Not applied' : 'Unknown'}`,
  )
  lines.push('')

  if (valuation?.status === 'valued') {
    lines.push(rule)
    lines.push('COMPARABLE SALES, ADJUSTED')
    lines.push(rule)
    lines.push(valuation.model.note)
    lines.push('')
    for (const comp of valuation.comps) {
      lines.push(`  ${titleCase(comp.property.addr)}`)
      lines.push(`    Sold ${prettyDate(comp.sale.date)}${' '.repeat(2)}${money(comp.sale.price)}`)
      for (const adjustment of comp.adjustments) {
        const sign = adjustment.amount >= 0 ? '+' : '−'
        lines.push(
          `    ${adjustment.label.padEnd(34)} ${sign}${money(Math.abs(adjustment.amount))}`,
        )
      }
      lines.push(`    ${'Adjusted value'.padEnd(34)}  ${money(comp.adjustedPrice)}`)
      lines.push('')
    }
    lines.push(
      `  Indicated value: ${money(valuation.indicatedValue)}  (range ${money(valuation.low)} to ${money(valuation.high)})`,
    )
    lines.push(`  Assessed value:  ${money(valuation.assessedValue)}`)
    lines.push('')
    if (valuation.excluded.length > 0) {
      lines.push('  Transfers I did not treat as market sales, and why:')
      for (const excluded of valuation.excluded) {
        lines.push(
          `    ${titleCase(excluded.address)}, ${prettyDate(excluded.date)}, ${money(excluded.price)} — ${excluded.reason}`,
        )
      }
      lines.push('')
    }
  }

  if (equity?.status === 'scored') {
    lines.push(rule)
    lines.push('COMPARABLE ASSESSMENTS')
    lines.push(rule)
    lines.push(
      `  ${equity.compCount} properties of the same type, within 25% of my floor area.`,
    )
    lines.push('')
    lines.push(`  ${'Address'.padEnd(34)}${'Assessed'.padStart(12)}${'Sq ft'.padStart(9)}${'Per sq ft'.padStart(11)}`)
    for (const comp of equity.comps.slice(0, 12)) {
      lines.push(
        `  ${titleCase(comp.addr).slice(0, 33).padEnd(34)}${money(comp.tv).padStart(12)}${(comp.la ?? 0).toLocaleString('en-US').padStart(9)}${comp.psf.toFixed(2).padStart(11)}`,
      )
    }
    lines.push(
      `  ${'MY PROPERTY'.padEnd(34)}${money(subject.tv).padStart(12)}${(subject.la ?? 0).toLocaleString('en-US').padStart(9)}${equity.subjPsf.toFixed(2).padStart(11)}`,
    )
    lines.push('')
  }

  lines.push(rule)
  lines.push('BEFORE I FILE')
  lines.push(rule)
  lines.push(`  Deadline:  ${longDate(deadline)}, 5:00 PM`)
  lines.push(`  Where:     ${ASSESSORS_OFFICE.name}, ${ASSESSORS_OFFICE.room}`)
  lines.push(`             ${ASSESSORS_OFFICE.address}`)
  lines.push(`  Evidence:  ${EVIDENCE_GUIDANCE}`)
  lines.push('')
  lines.push('  I must pay the tax as billed, on time, to keep my right to appeal.')
  lines.push('')
  lines.push(
    '  This packet was prepared from public records. It is legal information,',
  )
  lines.push(
    '  not legal advice, and a navigator or clinic should review it before filing.',
  )
  return lines.join('\n')
}

/** A short file name for the packet, built from the address. */
export function packetFilename(subject: Property, kind: 'form' | 'packet'): string {
  const slug = subject.addr
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return kind === 'form'
    ? `form-128-${slug}-fy${subject.fy}.pdf`
    : `abatement-evidence-${slug}-fy${subject.fy}.txt`
}

export type { AssessmentResult, CalendarDay, ValuationResult }
