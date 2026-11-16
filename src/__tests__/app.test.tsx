/**
 * @vitest-environment happy-dom
 *
 * Mounting the whole app, against the real data payloads.
 *
 * Typechecking cannot tell you that a page renders. This does: it starts the
 * app as a browser would, waits for the records to load, and reads the page
 * the way a person would. Most of what it asserts are the claims that would
 * be most damaging to get wrong — the fiscal year on the figures, the ground
 * the application leads with, and the dates that follow a filing.
 */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import App from '../App'

beforeAll(() => {
  // The citywide API is not called in a test run; local records are enough.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: false, status: 503, json: async () => ({ success: false }) })),
  )
  // happy-dom has no layout, so anything that scrolls is a no-op here.
  window.scrollTo = () => undefined
})

afterEach(cleanup)

const section = (name: RegExp) => {
  const heading = screen.getByRole('heading', { name })
  const found = heading.closest('section')
  if (!found) throw new Error(`no section for ${String(name)}`)
  return found
}

describe('the tool page', () => {
  it('renders, loads the example property, and labels its fiscal year', async () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(
      'Is your home over-assessed?',
    )

    // The records load after the first paint, so the example arrives late.
    // Wait for a figure from the record itself, not for the example's label,
    // which is a constant and is on screen before anything has loaded.
    await waitFor(() => expect(screen.getByText(/FY2026 assessed value/i)).toBeTruthy(), {
      timeout: 15_000,
    })

    // Every figure must say which year it belongs to: an application filed
    // against the wrong year's value is wasted.
    expect(screen.getByText(/valued as of January 1, 2025/i)).toBeTruthy()
    expect(screen.getAllByText(/3 Westford St, Allston/i).length).toBeGreaterThan(0)
  }, 30_000)

  it('shows all eight consoles', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText(/What the city has on record/i)).toBeTruthy(), {
      timeout: 15_000,
    })

    for (const title of [
      'Find your property',
      'What the city has on record',
      'Your situation',
      'What your property is worth',
      'Exemptions you may be owed',
      'Your filing deadline',
      'Prepare your application',
      'Track your case',
    ]) {
      expect(screen.getByRole('heading', { name: new RegExp(title, 'i') })).toBeTruthy()
    }
  }, 30_000)

  it('values the example against real sales and shows every adjustment', async () => {
    render(<App />)

    const estimate = await waitFor(
      () => {
        const found = section(/What your property is worth/i)
        if (!/comparable sale/i.test(found.textContent ?? '')) throw new Error('still loading')
        return found
      },
      { timeout: 20_000 },
    )

    const text = estimate.textContent ?? ''
    // A range, not a single number, and the working behind it.
    expect(text).toMatch(/in a range of/i)
    expect(text).toMatch(/Adjusted to your property/i)
    expect(text).toMatch(/Time to January 1/i)
    // The equity comparison is present but demoted to supporting material.
    expect(within(estimate).getByText(/Supporting: how your assessment compares/i)).toBeTruthy()
  }, 40_000)

  it('warns about the ground that is hardest to win on', async () => {
    render(<App />)
    await waitFor(
      () => expect(screen.getByText(/About disproportionate assessment/i)).toBeTruthy(),
      { timeout: 15_000 },
    )
    expect(screen.getByText(/intentional, widespread scheme/i)).toBeTruthy()
  }, 30_000)

  it('states the deadline in Boston time, with its cut-off and the real entry fee', async () => {
    render(<App />)
    const deadline = await waitFor(() => section(/Your filing deadline/i), { timeout: 15_000 })

    const text = deadline.textContent ?? ''
    expect(text).toMatch(/5:00 pm/)
    expect(text).toMatch(/Boston time/)
    // Counted from the filing date, never from February 1.
    expect(text).toMatch(/counted from the day you actually file/i)
    // $100 for this property's assessed value, not the $65 myth.
    expect(text).toMatch(/\$100/)
    expect(text).toMatch(/not a taxpayer fee/i)
  }, 30_000)

  it('offers the exemption deadline, which is not the abatement one', async () => {
    render(<App />)
    const exemptions = await waitFor(() => section(/Exemptions you may be owed/i), {
      timeout: 15_000,
    })
    expect(exemptions.textContent).toMatch(/April 1/)
    expect(exemptions.textContent).toMatch(/Residential exemption/i)
  }, 30_000)
})

describe('the reviewer view', () => {
  it('says so when the link carries no case', async () => {
    window.location.hash = '#/review'
    render(<App />)
    await waitFor(() => expect(screen.getByText(/No case in this link/i)).toBeTruthy())
    window.location.hash = ''
  })
})
