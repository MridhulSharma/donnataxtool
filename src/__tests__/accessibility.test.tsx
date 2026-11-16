/**
 * @vitest-environment happy-dom
 *
 * The accessibility rules this project treats as requirements, checked
 * rather than asserted in a README.
 *
 * These catch the regressions that are easy to introduce and hard to notice
 * with a mouse: a second `h1`, a heading level skipped, an input with no
 * label, a live region that fires every second, or a state shown only in
 * colour.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import App from '../App'

beforeAll(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: false, status: 503, json: async () => ({ success: false }) })),
  )
  window.scrollTo = () => undefined
})

afterEach(cleanup)

/** Render, and wait until the records have loaded into the page. */
async function loaded() {
  const result = render(<App />)
  await waitFor(() => expect(screen.getByText(/FY2026 assessed value/i)).toBeTruthy(), {
    timeout: 15_000,
  })
  return result
}

describe('document structure', () => {
  it('has exactly one h1', async () => {
    const { container } = await loaded()
    expect(container.querySelectorAll('h1')).toHaveLength(1)
  }, 30_000)

  it('skips no heading levels', async () => {
    const { container } = await loaded()
    const levels = [...container.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) =>
      Number(h.tagName[1]),
    )
    expect(levels[0]).toBe(1)
    for (let i = 1; i < levels.length; i++) {
      // A heading may close as many levels as it likes, but may only open one.
      expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1)
    }
  }, 30_000)

  it('offers a skip link as the first focusable element', async () => {
    const { container } = await loaded()
    const first = container.querySelector('a, button, input, select, textarea')
    expect(first?.textContent).toMatch(/skip to content/i)
    expect(first?.getAttribute('href')).toBe('#main')
  }, 30_000)

  it('names every section by its heading', async () => {
    const { container } = await loaded()
    for (const section of container.querySelectorAll('section[aria-labelledby]')) {
      const id = section.getAttribute('aria-labelledby')
      expect(container.querySelector(`#${id}`)).not.toBeNull()
    }
  }, 30_000)
})

describe('forms', () => {
  it('ties a label to every input', async () => {
    const { container } = await loaded()
    const inputs = [...container.querySelectorAll('input, select, textarea')]
    expect(inputs.length).toBeGreaterThan(3)
    for (const input of inputs) {
      const id = input.getAttribute('id')
      const labelled =
        (id && container.querySelector(`label[for="${id}"]`)) ||
        input.getAttribute('aria-label') ||
        input.getAttribute('aria-labelledby') ||
        input.closest('label') ||
        // A radio inside a fieldset is named by its legend and its own label.
        (input.getAttribute('type') === 'radio' && input.closest('fieldset'))
      expect(labelled, `input ${id ?? input.outerHTML.slice(0, 80)} has no label`).toBeTruthy()
    }
  }, 30_000)
})

describe('announcements', () => {
  it('never puts a per-second countdown in a live region', async () => {
    // A live region changing every second makes a page unusable with a
    // screen reader. The ticking figures are hidden; a sentence beside them
    // carries the same fact and changes at most once a day.
    const { container } = await loaded()
    for (const live of container.querySelectorAll('[aria-live]')) {
      expect(live.querySelector('[aria-hidden="true"] .tnum')).toBeNull()
    }
    const ticker = screen.getByText('Days').closest('[aria-hidden="true"]')
    expect(ticker).not.toBeNull()
  }, 30_000)

  it('announces search results politely', async () => {
    const { container } = await loaded()
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull()
  }, 30_000)
})

describe('state is never carried by colour alone', () => {
  it('writes out the verdict and the confidence in words', async () => {
    await loaded()
    await waitFor(
      () =>
        expect(
          screen.getAllByText(/above what the sales support|within what the sales support/i)
            .length,
        ).toBeGreaterThan(0),
      { timeout: 20_000 },
    )
    expect(screen.getAllByText(/evidence$/i).length).toBeGreaterThan(0)
  }, 40_000)

  it('labels the exemption states in words', async () => {
    await loaded()
    const words = screen.getAllByText(/Already applied|Worth claiming|Check if you qualify/i)
    expect(words.length).toBeGreaterThan(0)
  }, 30_000)
})
