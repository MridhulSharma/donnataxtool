import { describe, expect, it } from 'vitest'
import { buildCaseSummary, leadingGround } from '../caseSummary'
import { buildEvidencePacket, explanationLines, formExplanation } from '../packet'
import { decodeReview, encodeReview } from '../referral'
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

const deadline = { year: 2027, month: 2, day: 1 }
const base = { subject, valuation: null, equity: null, deadline }

describe('which ground the statement argues', () => {
  it('leads with what the owner paid when that is below the assessment', () => {
    const input = { ...base, purchase: { price: 700_000, date: '2024-08-01' } }
    expect(leadingGround(input)).toBe('overvaluation')
    expect(buildCaseSummary(input)).toContain('$700,000')
  })

  it('leads with the record when the owner says it is wrong', () => {
    const input = { ...base, recordErrors: ['The floor area is 300 sq ft too high'] }
    expect(leadingGround(input)).toBe('record')
    const summary = buildCaseSummary(input)
    expect(summary).toContain('GROUND: Overvaluation')
    expect(summary).toContain('300 sq ft too high')
  })

  it('never puts disproportionate assessment at the top without evidence', () => {
    // The first version of this tool headed every statement with the ground
    // the Appellate Tax Board almost never grants.
    expect(buildCaseSummary(base)).toContain('GROUND: Overvaluation')
  })

  it('states the fiscal year and the assessment date it is arguing about', () => {
    const summary = buildCaseSummary(base)
    expect(summary).toContain('Fiscal year: 2026')
    expect(summary).toContain('January 1, 2025')
  })

  it('always says the tax is being paid as billed', () => {
    expect(buildCaseSummary(base)).toContain('paying my tax bill as assessed')
  })
})

describe('the short explanation on the form', () => {
  it('fits the seven lines the form provides', () => {
    const long = formExplanation({ ...base, recordErrors: ['x'.repeat(400)] })
    const lines = explanationLines(long)
    expect(lines.length).toBeLessThanOrEqual(7)
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(92)
  })

  it('never cuts a word in half', () => {
    const lines = explanationLines('alpha bravo charlie delta echo foxtrot', 12)
    expect(lines.join(' ').split(' ').every((w) => w.length > 0)).toBe(true)
    expect(lines[0]).toBe('alpha bravo')
  })
})

describe('the evidence packet', () => {
  it('lists what is in it and what the city holds', () => {
    const packet = buildEvidencePacket(base)
    expect(packet).toContain('State Tax Form 128')
    expect(packet).toContain('THE RECORD THE CITY HOLDS')
    expect(packet).toContain('$902,600')
    expect(packet).toContain('5:00 PM')
  })
})

describe('the review link', () => {
  it('survives a round trip, accents and all', () => {
    const text = 'Case for review — 3 Westford St · “condition” problems'
    expect(decodeReview(encodeReview(text))).toBe(text)
  })

  it('returns nothing for a truncated link rather than throwing', () => {
    expect(decodeReview('!!!not base64!!!')).toBeNull()
  })
})

describe('how comparables are presented to an assessor', () => {
  const comp = (addr: string, psf: number, tv: number) => ({
    pid: addr,
    addr,
    zip: '02134',
    la: 1500,
    areaSrc: 'living' as const,
    yr: 1920,
    lv: 1,
    bv: 1,
    tv,
    gt: null,
    ex: 0 as const,
    lu: 'R1',
    luDesc: 'SINGLE FAM DWELLING',
    fy: 2026,
    src: 'local' as const,
    lot: null,
    cond: null,
    remodel: null,
    beds: null,
    baths: null,
    units: null,
    lat: null,
    lon: null,
    ownerOcc: null,
    psf,
    miles: null,
  })

  it('does not put only the cheapest five in front of the assessors', () => {
    // The on-screen table is cheapest first, because that is how a reader
    // scans it. Carrying that order into the application is cherry-picking,
    // and it is what gets an application dismissed rather than read.
    const comps = Array.from({ length: 20 }, (_, i) =>
      comp(`${i + 1} MEDIAN ST`, 300 + i * 10, 450_000 + i * 15_000),
    )
    const summary = buildCaseSummary({
      ...base,
      equity: {
        status: 'scored',
        outOfLine: true,
        subjPsf: 640,
        medPsf: 395,
        lowPsf: 345,
        highPsf: 445,
        proportionate: 557_000,
        over: 345_600,
        ratio: 1.62,
        taxOver: null,
        comps,
        compCount: comps.length,
        criteria: {
          landUse: 'R1',
          landUseLabel: 'SINGLE FAM DWELLING',
          widened: false,
          areaLow: 1125,
          areaHigh: 1875,
          yearLow: 1896,
          yearHigh: 1926,
          areaSource: 'living',
          poolComplete: true,
        },
        confidence: { level: 'moderate', summary: '', factors: [] },
        fiscalYear: 2026,
      },
    })

    expect(summary).toContain('nearest the middle of that range')
    // The cheapest comparable must not be the one held up as typical.
    expect(summary).not.toContain('1 MEDIAN ST:')
    expect(summary).toContain('full list of 20 comparable properties')
  })
})
