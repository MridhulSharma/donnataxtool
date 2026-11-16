/**
 * The official form, filled.
 *
 * Field names come from the published PDF, so a revision of the form could
 * silently leave boxes empty. This reads the filled document back and checks
 * the values actually landed in the right fields — and that the two the
 * owner must complete themselves are still blank.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fillForm128 } from '../packet'
import type { Property } from '../types'

const subject: Property = {
  pid: '2201050000',
  addr: '3 WESTFORD ST, ALLSTON',
  zip: '02134',
  la: 1410,
  areaSrc: 'living',
  yr: 1911,
  lv: 288_000,
  bv: 614_600,
  tv: 902_600,
  gt: 11_192,
  ex: 1,
  lu: 'R1',
  luDesc: 'SINGLE FAM DWELLING',
  fy: 2026,
  src: 'local',
  lot: 3828,
  cond: 'A',
  remodel: 2024,
  beds: 3,
  baths: 2.5,
  units: null,
  lat: 42.361871,
  lon: -71.134798,
  ownerOcc: 1,
}

const blank = readFileSync(resolve(process.cwd(), 'public/forms/form128.pdf'))

beforeAll(() => {
  // The browser fetches the blank form from the site; here it comes off disk.
  vi.stubGlobal('fetch', async () => ({
    ok: true,
    arrayBuffer: async () => blank.buffer.slice(blank.byteOffset, blank.byteOffset + blank.byteLength),
  }))
})

async function fieldsOf(bytes: Uint8Array) {
  const { PDFDocument } = await import('pdf-lib')
  const form = (await PDFDocument.load(bytes)).getForm()
  const text = new Map<string, string>()
  const checked = new Set<string>()
  for (const field of form.getFields()) {
    const name = field.getName()
    if (field.constructor.name === 'PDFTextField') {
      text.set(name, form.getTextField(name).getText() ?? '')
    } else if (field.constructor.name === 'PDFCheckBox') {
      if (form.getCheckBox(name).isChecked()) checked.add(name)
    }
  }
  return { text, checked }
}

describe('State Tax Form 128', () => {
  it('fills the identifying fields from the record', async () => {
    const { text, checked } = await fieldsOf(
      await fillForm128({
        subject,
        valuation: null,
        equity: null,
        deadline: { year: 2027, month: 2, day: 1 },
        ownerName: 'A Homeowner',
        phone: '617-555-0100',
      }),
    )

    expect(text.get('Name of City or Town')).toBe('Boston')
    expect(text.get('FISCAL YEAR')).toBe('2026')
    expect(text.get('Parcel ID no mapblocklot')).toBe('2201050000')
    expect(text.get('Assessed valuation')).toBe('$902,600')
    expect(text.get('Names of assessed owner')).toBe('A Homeowner')
    expect(text.get('Telephone No')).toBe('617-555-0100')
    expect(text.get('No')).toBe('3')
    expect(text.get('Zip Code')).toBe('02134')
    expect(checked.has('REAL PROPERTY TAX')).toBe(true)
  })

  it('ticks overvaluation, not the ground that needs a proven scheme', async () => {
    const { checked } = await fieldsOf(
      await fillForm128({
        subject,
        valuation: null,
        equity: null,
        deadline: { year: 2027, month: 2, day: 1 },
        purchase: { price: 700_000, date: '2024-08-01' },
      }),
    )
    expect(checked.has('Overvaluation')).toBe(true)
    expect(checked.has('Disproportionate assessment')).toBe(false)
  })

  it('leaves the signature and the opinion of value for the owner', async () => {
    const { text } = await fieldsOf(
      await fillForm128({
        subject,
        valuation: null,
        equity: null,
        deadline: { year: 2027, month: 2, day: 1 },
      }),
    )
    expect(text.get('Signature of Applicant')).toBe('')
    expect(text.get('Applicants opinion of Value')).toBe('')
  })

  it('fills the opinion of value only once the owner has set one', async () => {
    const { text } = await fieldsOf(
      await fillForm128({
        subject,
        valuation: null,
        equity: null,
        deadline: { year: 2027, month: 2, day: 1 },
        opinionOfValue: 719_000,
      }),
    )
    expect(text.get('Applicants opinion of Value')).toBe('$719,000')
  })

  it('writes the explanation across the lines the form gives it', async () => {
    const { text } = await fieldsOf(
      await fillForm128({
        subject,
        valuation: null,
        equity: null,
        deadline: { year: 2027, month: 2, day: 1 },
        recordErrors: ['The floor area is recorded 300 sq ft too high'],
      }),
    )
    const written = [1, 2, 3, 4, 5, 6, 7]
      .map((n) => text.get(`Explanation ${n}`) ?? '')
      .join(' ')
      .trim()
    expect(written).toContain('record')
    expect(written.length).toBeGreaterThan(40)
  })
})
