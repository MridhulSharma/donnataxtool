import { beforeEach, describe, expect, it, vi } from 'vitest'
import { caseStatus, newCase, readCase, writeCase, type CaseRecord } from '../caseTrack'

/** A minimal localStorage, so storage behaviour can be exercised in node. */
function fakeStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage())
})

const deadline = { year: 2027, month: 2, day: 1 }

const filed = (over: Partial<CaseRecord> = {}): CaseRecord => ({
  ...newCase('123', '3 TEST ST', 2027),
  filedOn: '2027-01-05',
  ...over,
})

describe('storage', () => {
  it('keeps a case and reads it back', () => {
    const record = filed()
    expect(writeCase(record)).toBe(true)
    expect(readCase('123')?.filedOn).toBe('2027-01-05')
  })

  it('says so rather than throwing when storage is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('blocked')
      },
    })
    expect(writeCase(filed())).toBe(false)
  })

  it('survives malformed stored data', () => {
    vi.stubGlobal('localStorage', { ...fakeStorage(), getItem: () => 'not json' })
    expect(readCase('123')).toBeNull()
  })
})

describe('where the case stands', () => {
  it('points at the filing deadline before anything is filed', () => {
    const status = caseStatus(null, { year: 2027, month: 1, day: 10 }, deadline)
    expect(status.stage).toBe('not-filed')
    expect(status.nextDate).toEqual(deadline)
    expect(status.urgent).toBe(true)
  })

  it('counts the assessors three months from the filing date', () => {
    const status = caseStatus(filed(), { year: 2027, month: 2, day: 1 }, deadline)
    expect(status.stage).toBe('awaiting-assessors')
    expect(status.timeline.deemedDeniedOn).toEqual({ year: 2027, month: 4, day: 5 })
  })

  it('moves to deemed denied once those three months are up', () => {
    const status = caseStatus(filed(), { year: 2027, month: 4, day: 6 }, deadline)
    expect(status.stage).toBe('deemed-denied')
    expect(status.nextDate).toEqual({ year: 2027, month: 7, day: 5 })
  })

  it('counts from a written denial when one arrived', () => {
    const record = filed({ decidedOn: '2027-02-20', decision: 'denied' })
    const status = caseStatus(record, { year: 2027, month: 3, day: 1 }, deadline)
    expect(status.stage).toBe('denied')
    expect(status.timeline.atbPetitionBy).toEqual({ year: 2027, month: 5, day: 20 })
  })

  it('says when the appeal window has closed rather than showing a live date', () => {
    const status = caseStatus(filed(), { year: 2027, month: 8, day: 1 }, deadline)
    expect(status.stage).toBe('atb-window-closed')
    expect(status.daysUntil).toBeLessThan(0)
  })

  it('stops counting once an abatement is granted', () => {
    const record = filed({ decidedOn: '2027-03-01', decision: 'granted' })
    const status = caseStatus(record, { year: 2027, month: 3, day: 5 }, deadline)
    expect(status.stage).toBe('granted')
    expect(status.nextDate).toBeNull()
  })
})
