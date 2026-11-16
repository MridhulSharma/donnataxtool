import { describe, expect, it } from 'vitest'
import { answer, classify, handle, split, stubTransport, SMS_LIMIT } from '../outreach'
import type { Property } from '../types'

const deadline = { year: 2027, month: 2, day: 1 }

const subject = {
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
} satisfies Property

describe('reading what someone asked', () => {
  it('recognises the common questions', () => {
    expect(classify('when is the deadline?')).toBe('deadline')
    expect(classify('How much is my house assessed at')).toBe('assessment')
    expect(classify('am i eligible for the residential exemption')).toBe('exemption')
    expect(classify('hi')).toBe('help')
    expect(classify('zzzzz')).toBe('unknown')
  })
})

describe('answers', () => {
  it('gives the deadline with the time and the place', () => {
    const [first] = answer('deadline', { property: null, filingDeadline: deadline })
    expect(first).toContain('February 1, 2027')
    expect(first).toContain('5pm')
  })

  it('reads back the assessment with its fiscal year', () => {
    const parts = answer('assessment', { property: subject, filingDeadline: deadline })
    const text = parts.join(' ')
    expect(text).toContain('$902,600')
    expect(text).toContain('FY2026')
  })

  it('asks for an address when it has no property', () => {
    const parts = answer('assessment', { property: null, filingDeadline: deadline })
    expect(parts.join(' ')).toContain('address')
  })

  it('keeps every part inside one message', () => {
    const parts = answer('exemption', {
      property: subject,
      filingDeadline: deadline,
      navigatorPhone: '617-555-0100',
    })
    for (const part of parts) expect(part.length).toBeLessThanOrEqual(SMS_LIMIT)
  })
})

describe('splitting', () => {
  it('leaves a short message alone', () => {
    expect(split('Short enough.')).toEqual(['Short enough.'])
  })

  it('breaks on sentences and numbers the parts', () => {
    const long = `${'One sentence here. '.repeat(30)}`
    const parts = split(long)
    expect(parts.length).toBeGreaterThan(1)
    expect(parts[0]).toMatch(/^\(1\/\d+\)/)
    for (const part of parts) expect(part.length).toBeLessThanOrEqual(SMS_LIMIT + 10)
  })
})

describe('the stub transport', () => {
  it('composes a reply and is honest that it sent nothing', async () => {
    stubTransport.sent.length = 0
    const result = await handle('when is the deadline', {
      property: subject,
      filingDeadline: deadline,
    })
    expect(result.intent).toBe('deadline')
    expect(result.sent).toBe(false)
    expect(result.reason).toContain('not sent')
    expect(stubTransport.sent).toHaveLength(1)
  })
})
