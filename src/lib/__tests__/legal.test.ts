import { describe, expect, it } from 'vitest'
import { atbEntryFee, ATB_MUNICIPAL_TRANSFER_FEE, GROUNDS } from '../legal'

describe('Appellate Tax Board entry fees', () => {
  it('charges by assessed value, not a flat $65', () => {
    // $65 is what a municipality pays to move an appeal to the formal
    // procedure. Quoting it to a homeowner understates the real fee.
    expect(atbEntryFee(15_000).amount).toBe(10)
    expect(atbEntryFee(80_000).amount).toBe(50)
    expect(atbEntryFee(902_600).amount).toBe(100)
    expect(ATB_MUNICIPAL_TRANSFER_FEE).toBe(65)
  })

  it('charges a tenth of a dollar per thousand above a million', () => {
    expect(atbEntryFee(1_000_000).amount).toBe(100)
    expect(atbEntryFee(2_500_000).amount).toBe(250)
  })

  it('caps at $5,000', () => {
    expect(atbEntryFee(900_000_000).amount).toBe(5000)
  })

  it('says so rather than guessing when there is no value', () => {
    expect(atbEntryFee(null).amount).toBeNull()
  })
})

describe('the grounds', () => {
  it('marks disproportionate assessment as the hard one', () => {
    expect(GROUNDS.disproportionate.difficulty).toBe('high-bar')
    expect(GROUNDS.overvaluation.difficulty).toBe('standard')
  })
})
