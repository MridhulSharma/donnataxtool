import { describe, expect, it } from 'vitest'
import type { Property, Sale } from '../types'
import { buildObservations, fitMarketModel, valueBySales } from '../valuation'

/** A property with sane defaults, so a test states only what it cares about. */
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

function sale(date: string, price: number, armsLength = true): Sale {
  return {
    date,
    price,
    docType: 'DEED',
    armsLength,
    note: armsLength ? null : 'Nominal transfer, not a market sale',
  }
}

/**
 * A neighbourhood where value is a known function of size and time, so the
 * engine can be checked against an answer that exists.
 */
function syntheticMarket(count: number, options: { monthlyGrowth?: number } = {}) {
  const growth = options.monthlyGrowth ?? 0.004
  const pool: Property[] = []
  const sales = new Map<string, Sale[]>()
  const valuationDate = '2025-01-01'

  for (let i = 0; i < count; i++) {
    const area = 1200 + (i % 12) * 60
    const monthsBefore = (i % 20) + 1
    const saleDate = new Date(Date.UTC(2025, 0, 1))
    saleDate.setUTCMonth(saleDate.getUTCMonth() - monthsBefore)
    // $500 a square foot at the valuation date, discounted back in time.
    const price = Math.round(area * 500 * Math.exp(-growth * monthsBefore))
    const pid = `C${i}`
    pool.push(property({ pid, la: area, tv: Math.round(price * 0.95) }))
    sales.set(pid, [sale(saleDate.toISOString().slice(0, 10), price)])
  }
  return { pool, sales, valuationDate }
}

describe('screening transfers', () => {
  it('leaves out anything that is not an open-market sale', () => {
    const pool = [property({ pid: 'A' })]
    const sales = new Map<string, Sale[]>([
      ['A', [sale('2024-06-01', 1, false), sale('2024-03-01', 700_000)]],
    ])
    const observations = buildObservations(pool, sales, '2025-01-01', 'R1')
    expect(observations).toHaveLength(1)
    expect(observations[0].sale.price).toBe(700_000)
  })

  it('leaves out sales after the valuation date', () => {
    const pool = [property({ pid: 'A' })]
    const sales = new Map<string, Sale[]>([['A', [sale('2025-06-01', 900_000)]]])
    expect(buildObservations(pool, sales, '2025-01-01', 'R1')).toHaveLength(0)
  })

  it('keeps the comparison inside one property class', () => {
    const pool = [property({ pid: 'A', lu: 'R1' }), property({ pid: 'B', lu: 'CD' })]
    const sales = new Map<string, Sale[]>([
      ['A', [sale('2024-06-01', 700_000)]],
      ['B', [sale('2024-06-01', 400_000)]],
    ])
    const observations = buildObservations(pool, sales, '2025-01-01', 'R1')
    expect(observations.map((o) => o.property.pid)).toEqual(['A'])
  })
})

describe('the market model', () => {
  it('measures a trend it was given', () => {
    const { pool, sales, valuationDate } = syntheticMarket(80, { monthlyGrowth: 0.004 })
    const model = fitMarketModel(buildObservations(pool, sales, valuationDate, 'R1'))
    expect(model.method).toBe('regression-adjusted')
    // About 4.9% a year, from 0.4% a month.
    expect(model.annualTrend).toBeCloseTo(Math.exp(0.004 * 12) - 1, 2)
    expect(model.areaElasticity).toBeCloseTo(1, 1)
  })

  it('refuses to model a handful of sales', () => {
    const { pool, sales, valuationDate } = syntheticMarket(6)
    const model = fitMarketModel(buildObservations(pool, sales, valuationDate, 'R1'))
    expect(model.method).toBe('unadjusted')
    expect(model.note).toContain('too few')
  })
})

describe('the valuation', () => {
  it('recovers a value it can be checked against', () => {
    const { pool, sales, valuationDate } = syntheticMarket(80)
    // 1,500 sq ft at $500 is $750,000 at the valuation date.
    const subject = property({ pid: 'SUBJ', la: 1500, tv: 750_000 })
    const result = valueBySales({
      subject,
      pool,
      salesByPid: sales,
      valuationDate,
      fiscalYear: 2026,
    })
    expect(result.status).toBe('valued')
    if (result.status !== 'valued') return
    expect(result.indicatedValue).toBeGreaterThan(700_000)
    expect(result.indicatedValue).toBeLessThan(800_000)
    expect(result.overAssessed).toBe(false)
  })

  it('flags an assessment only when it clears the top of the range', () => {
    const { pool, sales, valuationDate } = syntheticMarket(80)
    const subject = property({ pid: 'SUBJ', la: 1500, tv: 1_400_000 })
    const result = valueBySales({
      subject,
      pool,
      salesByPid: sales,
      valuationDate,
      fiscalYear: 2026,
    })
    expect(result.status).toBe('valued')
    if (result.status !== 'valued') return
    expect(result.overAssessed).toBe(true)
    expect(result.assessedValue - result.high).toBe(result.aboveRange)
    expect(result.taxAtStake).not.toBeNull()
  })

  it('reports a shortfall rather than a verdict on thin evidence', () => {
    const pool = [property({ pid: 'A' }), property({ pid: 'B' })]
    const sales = new Map<string, Sale[]>([['A', [sale('2024-06-01', 700_000)]]])
    const result = valueBySales({
      subject: property({ pid: 'SUBJ' }),
      pool,
      salesByPid: sales,
      valuationDate: '2025-01-01',
      fiscalYear: 2026,
    })
    expect(result.status).toBe('insufficient-sales')
    if (result.status !== 'insufficient-sales') return
    expect(result.found).toBeLessThan(result.needed)
  })

  it('counts one parcel once, however often it changed hands', () => {
    const { pool, sales, valuationDate } = syntheticMarket(40)
    // Give one parcel three sales; it must still be a single comparable.
    sales.set('C1', [
      sale('2024-11-01', 700_000),
      sale('2024-05-01', 680_000),
      sale('2023-11-01', 650_000),
    ])
    const result = valueBySales({
      subject: property({ pid: 'SUBJ', la: 1260 }),
      pool,
      salesByPid: sales,
      valuationDate,
      fiscalYear: 2026,
    })
    if (result.status !== 'valued') throw new Error('expected a valuation')
    const parcels = result.comps.map((c) => c.property.pid)
    expect(new Set(parcels).size).toBe(parcels.length)
  })

  it('shows its working on every comparable', () => {
    const { pool, sales, valuationDate } = syntheticMarket(80)
    const result = valueBySales({
      subject: property({ pid: 'SUBJ', la: 1500, tv: 900_000 }),
      pool,
      salesByPid: sales,
      valuationDate,
      fiscalYear: 2026,
    })
    if (result.status !== 'valued') throw new Error('expected a valuation')
    for (const comp of result.comps) {
      // Every adjusted price must be reachable from the sale price by the
      // adjustments shown; nothing may move without being declared.
      const declared = comp.adjustments.reduce((sum, a) => sum + a.amount, 0)
      expect(Math.abs(comp.sale.price + declared - comp.adjustedPrice)).toBeLessThan(3)
    }
  })
})
