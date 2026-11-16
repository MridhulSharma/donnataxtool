import { describe, expect, it } from 'vitest'
import { assess, findComps } from '../assess'
import type { Property } from '../types'

function property(over: Partial<Property> & { pid: string }): Property {
  return {
    addr: `${over.pid} TEST ST, ALLSTON`,
    zip: '02134',
    la: 1500,
    areaSrc: 'living',
    yr: 1920,
    lv: 300_000,
    bv: 500_000,
    tv: 800_000,
    gt: 10_000,
    ex: 0,
    lu: 'R1',
    luDesc: 'SINGLE FAM DWELLING',
    fy: 2026,
    src: 'local',
    lot: 4000,
    cond: 'A',
    remodel: null,
    beds: 3,
    baths: 2,
    units: 1,
    lat: 42.362,
    lon: -71.135,
    ownerOcc: 1,
    ...over,
  }
}

describe('choosing comparables', () => {
  it('stays inside the property class', () => {
    // The bug this replaces compared a single-family house against
    // condominiums, shops and subsidised housing, and flagged more than a
    // third of a whole neighbourhood as over-assessed.
    const subject = property({ pid: 'S', lu: 'R1' })
    const pool = [
      property({ pid: 'A', lu: 'R1' }),
      property({ pid: 'B', lu: 'CD' }),
      property({ pid: 'C', lu: 'RC' }),
    ]
    expect(findComps(subject, pool).map((c) => c.pid)).toEqual(['A'])
  })

  it('never mixes living area with gross floor area', () => {
    const subject = property({ pid: 'S', areaSrc: 'living' })
    const pool = [
      property({ pid: 'A', areaSrc: 'living' }),
      property({ pid: 'B', areaSrc: 'gross' }),
    ]
    expect(findComps(subject, pool).map((c) => c.pid)).toEqual(['A'])
  })

  it('keeps to the size and age bands', () => {
    const subject = property({ pid: 'S', la: 1500, yr: 1920 })
    const pool = [
      property({ pid: 'in', la: 1600, yr: 1925 }),
      property({ pid: 'too-big', la: 2500, yr: 1920 }),
      property({ pid: 'too-old', la: 1500, yr: 1850 }),
    ]
    expect(findComps(subject, pool).map((c) => c.pid)).toEqual(['in'])
  })

  it('drops anything more than a mile away', () => {
    const subject = property({ pid: 'S', lat: 42.362, lon: -71.135 })
    const pool = [
      property({ pid: 'near', lat: 42.363, lon: -71.136 }),
      property({ pid: 'far', lat: 42.42, lon: -71.05 }),
    ]
    expect(findComps(subject, pool).map((c) => c.pid)).toEqual(['near'])
  })

  it('keeps a comparable whose year is unknown', () => {
    const subject = property({ pid: 'S', yr: 1920 })
    const pool = [property({ pid: 'A', yr: null })]
    expect(findComps(subject, pool)).toHaveLength(1)
  })
})

describe('the equity comparison', () => {
  const evenNeighbourhood = (count: number) =>
    Array.from({ length: count }, (_, i) =>
      property({ pid: `N${i}`, la: 1500, tv: 790_000 + i * 1000 }),
    )

  it('gives no verdict on too few comparables', () => {
    const result = assess(property({ pid: 'S' }), [property({ pid: 'A' })])
    expect(result.status).toBe('insufficient-data')
  })

  it('leaves an assessment in line with its neighbours alone', () => {
    const result = assess(property({ pid: 'S', tv: 800_000 }), evenNeighbourhood(20))
    expect(result.status).toBe('scored')
    if (result.status !== 'scored') return
    expect(result.outOfLine).toBe(false)
  })

  it('flags only what clears the range and the noise band', () => {
    const pool = evenNeighbourhood(20)
    // 5% above the median is inside the noise of a mass appraisal.
    const slightly = assess(property({ pid: 'S', tv: 835_000 }), pool)
    if (slightly.status !== 'scored') throw new Error('expected a score')
    expect(slightly.outOfLine).toBe(false)

    // A third above it is not.
    const clearly = assess(property({ pid: 'S', tv: 1_100_000 }), pool)
    if (clearly.status !== 'scored') throw new Error('expected a score')
    expect(clearly.outOfLine).toBe(true)
    expect(clearly.over).toBeGreaterThan(0)
  })

  it('says when it had to cross property classes to find enough', () => {
    const pool = [
      ...Array.from({ length: 10 }, (_, i) => property({ pid: `C${i}`, lu: 'CD' })),
      property({ pid: 'R', lu: 'R1' }),
    ]
    const result = assess(property({ pid: 'S', lu: 'R1' }), pool)
    if (result.status !== 'scored') throw new Error('expected a score')
    expect(result.criteria.widened).toBe(true)
  })

  it('reports no floor area as a question rather than a verdict', () => {
    const result = assess(property({ pid: 'S', la: null, areaSrc: null }), evenNeighbourhood(20))
    expect(result.status).toBe('insufficient-data')
    if (result.status !== 'insufficient-data') return
    expect(result.reason).toContain('no floor area')
  })
})
