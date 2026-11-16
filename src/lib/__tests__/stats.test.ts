import { describe, expect, it } from 'vitest'
import {
  coefficientOfDispersion,
  leastSquares,
  median,
  milesBetween,
  priceRelatedDifferential,
  quantile,
} from '../stats'

describe('median and quantiles', () => {
  it('takes the middle of an odd list and the mean of an even one', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([1, 2, 3, 4])).toBe(2.5)
    expect(median([])).toBeNull()
  })

  it('interpolates between neighbours', () => {
    expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3)
    expect(quantile([1, 2, 3, 4], 0.25)).toBe(1.75)
  })
})

describe('ratio-study measures', () => {
  it('measures spread around the median as a percentage', () => {
    expect(coefficientOfDispersion([100, 100, 100])).toBe(0)
    const spread = coefficientOfDispersion([80, 100, 120])
    expect(spread).toBeGreaterThan(10)
    expect(spread).toBeLessThan(25)
  })

  it('reads above 1 when cheaper properties carry higher ratios', () => {
    const regressive = priceRelatedDifferential([
      { ratio: 1.2, value: 100_000 },
      { ratio: 1.0, value: 500_000 },
      { ratio: 0.8, value: 1_000_000 },
    ])
    expect(regressive).not.toBeNull()
    expect(regressive as number).toBeGreaterThan(1.03)
  })
})

describe('least squares', () => {
  it('recovers coefficients it was given', () => {
    // y = 2 + 3a - 1.5b, exactly.
    const x: number[][] = []
    const y: number[] = []
    for (let a = 0; a < 10; a++) {
      for (let b = 0; b < 10; b++) {
        x.push([a, b])
        y.push(2 + 3 * a - 1.5 * b)
      }
    }
    const fit = leastSquares(x, y)
    expect(fit).not.toBeNull()
    expect(fit!.coefficients[0]).toBeCloseTo(2, 1)
    expect(fit!.coefficients[1]).toBeCloseTo(3, 2)
    expect(fit!.coefficients[2]).toBeCloseTo(-1.5, 2)
    expect(fit!.r2).toBeGreaterThan(0.99)
  })

  it('refuses a fit with fewer observations than parameters', () => {
    expect(leastSquares([[1, 2]], [3])).toBeNull()
  })
})

describe('distance', () => {
  it('measures a short city distance in miles', () => {
    // Two points about a quarter of a mile apart in Allston.
    const miles = milesBetween(
      { lat: 42.3618, lon: -71.1348 },
      { lat: 42.3618, lon: -71.1300 },
    )
    expect(miles).toBeGreaterThan(0.2)
    expect(miles).toBeLessThan(0.3)
  })
})
