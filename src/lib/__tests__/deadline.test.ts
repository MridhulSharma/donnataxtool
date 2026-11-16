import { describe, expect, it } from 'vitest'
import {
  addMonths,
  appealTimeline,
  countdown,
  cutoffInstant,
  daysBetween,
  nextFilingDeadline,
  parseISO,
  rollToBusinessDay,
  todayInBoston,
  toISO,
} from '../deadline'

describe('calendar arithmetic', () => {
  it('clamps a month addition to the end of a short month', () => {
    // Three months from 31 January is 30 April, not 1 May. Overshooting a
    // statutory period by a day is how a jurisdictional deadline is lost.
    expect(addMonths({ year: 2027, month: 1, day: 31 }, 3)).toEqual({
      year: 2027,
      month: 4,
      day: 30,
    })
  })

  it('rolls a year boundary', () => {
    expect(addMonths({ year: 2026, month: 11, day: 15 }, 3)).toEqual({
      year: 2027,
      month: 2,
      day: 15,
    })
  })

  it('handles a leap day', () => {
    expect(addMonths({ year: 2027, month: 11, day: 29 }, 3)).toEqual({
      year: 2028,
      month: 2,
      day: 29,
    })
  })

  it('rolls weekend dates forward to Monday', () => {
    // 1 February 2026 is a Sunday.
    expect(rollToBusinessDay({ year: 2026, month: 2, day: 1 })).toEqual({
      year: 2026,
      month: 2,
      day: 2,
    })
    // 1 February 2025 is a Saturday.
    expect(rollToBusinessDay({ year: 2025, month: 2, day: 1 })).toEqual({
      year: 2025,
      month: 2,
      day: 3,
    })
    // 1 February 2027 is a Monday and does not move.
    expect(rollToBusinessDay({ year: 2027, month: 2, day: 1 })).toEqual({
      year: 2027,
      month: 2,
      day: 1,
    })
  })

  it('rejects a date that does not exist', () => {
    expect(parseISO('2026-02-30')).toBeNull()
    expect(parseISO('not a date')).toBeNull()
    expect(toISO(parseISO('2027-02-01')!)).toBe('2027-02-01')
  })
})

describe('the filing deadline', () => {
  it('is read in Boston time, not the reader s own', () => {
    // 23:30 on 31 January in Los Angeles is already 1 February in Boston.
    const lateInCalifornia = new Date('2027-02-01T07:30:00Z')
    expect(todayInBoston(lateInCalifornia)).toEqual({ year: 2027, month: 2, day: 1 })
  })

  it('takes the next February 1 that has not passed', () => {
    const deadline = nextFilingDeadline({ year: 2026, month: 11, day: 15 })
    expect(deadline.date).toEqual({ year: 2027, month: 2, day: 1 })
    expect(deadline.fiscalYear).toBe(2027)
    expect(deadline.rolled).toBe(false)
  })

  it('moves to the next fiscal year once the deadline has gone', () => {
    const deadline = nextFilingDeadline({ year: 2027, month: 6, day: 1 })
    expect(deadline.fiscalYear).toBe(2028)
  })

  it('runs out at 5pm Boston time, not midnight anywhere', () => {
    const cutoff = cutoffInstant({ year: 2027, month: 2, day: 1 })
    // February is Eastern Standard Time, five hours behind UTC.
    expect(cutoff.toISOString()).toBe('2027-02-01T22:00:00.000Z')
  })

  it('is still open at 4pm on the day and closed at 6pm', () => {
    const fourPm = countdown(new Date('2027-02-01T21:00:00Z'))
    expect(fourPm.passed).toBe(false)
    expect(fourPm.deadline.date).toEqual({ year: 2027, month: 2, day: 1 })

    const sixPm = countdown(new Date('2027-02-01T23:00:00Z'))
    expect(sixPm.passed).toBe(true)
  })

  it('counts whole days from Boston s calendar', () => {
    expect(daysBetween({ year: 2026, month: 11, day: 15 }, { year: 2027, month: 2, day: 1 })).toBe(
      78,
    )
  })
})

describe('what follows the filing', () => {
  it('counts the assessors three months from the FILING date', () => {
    // The bug this replaces counted from February 1, so an owner who filed
    // on 5 January was shown an appeal deadline almost a month too late.
    const timeline = appealTimeline({ filedOn: { year: 2027, month: 1, day: 5 } })
    expect(timeline.deemedDeniedOn).toEqual({ year: 2027, month: 4, day: 5 })
    expect(timeline.atbPetitionBy).toEqual({ year: 2027, month: 7, day: 5 })
    expect(timeline.atbCountedFrom).toBe('deemed-denial')
  })

  it('counts from a written denial when there is one', () => {
    const timeline = appealTimeline({
      filedOn: { year: 2027, month: 1, day: 5 },
      deniedOn: { year: 2027, month: 2, day: 20 },
    })
    // Earlier than the deemed denial, so the appeal window opens and closes
    // earlier with it.
    expect(timeline.atbPetitionBy).toEqual({ year: 2027, month: 5, day: 20 })
    expect(timeline.atbCountedFrom).toBe('written-denial')
  })

  it('gives no dates at all when nothing has been filed', () => {
    const timeline = appealTimeline({})
    expect(timeline.atbPetitionBy).toBeNull()
    expect(timeline.projected).toBe(true)
  })
})
