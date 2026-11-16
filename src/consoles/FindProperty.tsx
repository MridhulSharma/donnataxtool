import * as Label from '@radix-ui/react-label'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Console } from '../components/Console'
import { btnPrimary, btnSecondary, Chip, Note } from '../components/ui'
import { fiscalYearLabel, money, sqft, titleCase, year } from '../lib/format'
import { EXAMPLE_LABEL } from '../lib/local'
import { appendLiveResults, immediateResults } from '../lib/search'
import type { Property } from '../lib/types'

interface Props {
  selected: Property | null
  onSelect: (p: Property) => void
  /** True while the page is still showing the worked example. */
  isExample: boolean
  onLoadExample: () => void
}

const MIN_QUERY = 2

export function FindProperty({ selected, onSelect, isExample, onLoadExample }: Props) {
  const inputId = useId()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Property[]>([])
  const [status, setStatus] = useState('')
  const [searching, setSearching] = useState(false)
  const [liveError, setLiveError] = useState<string | null>(null)
  const runId = useRef(0)
  const debounce = useRef<number | undefined>(undefined)

  const run = useCallback(async (raw: string) => {
    const q = raw.trim()
    const id = ++runId.current

    if (q.length < MIN_QUERY) {
      setResults([])
      setSearching(false)
      setLiveError(null)
      setStatus(q.length === 0 ? '' : 'Keep typing — enter at least two characters.')
      return
    }

    setSearching(true)
    setLiveError(null)
    setStatus('Searching public records…')

    // Records held in the page match instantly; the citywide search fills in
    // behind them.
    const fast = await immediateResults(q)
    if (runId.current !== id) return
    if (fast.length > 0) {
      setResults(fast)
      setStatus(
        `${fast.length} ${fast.length === 1 ? 'record' : 'records'} found. Choose your property below:`,
      )
    }

    try {
      const outcome = await appendLiveResults(q, fast)
      if (runId.current !== id) return
      setResults(outcome.results)
      setLiveError(outcome.liveError)
      const n = outcome.results.length
      setStatus(
        n === 0
          ? 'No matching records found. Try just the street name.'
          : `${n} ${n === 1 ? 'record' : 'records'} found. Choose your property below:`,
      )
    } catch {
      if (runId.current !== id) return
      setStatus(
        fast.length > 0
          ? `${fast.length} ${fast.length === 1 ? 'record' : 'records'} found. Choose your property below:`
          : 'No matching records found. Try just the street name.',
      )
    } finally {
      if (runId.current === id) setSearching(false)
    }
  }, [])

  // Debounced, so a network request does not fire on every keystroke.
  useEffect(() => {
    window.clearTimeout(debounce.current)
    debounce.current = window.setTimeout(() => void run(query), 250)
    return () => window.clearTimeout(debounce.current)
  }, [query, run])

  return (
    <Console
      n="01"
      id="find"
      title="Find your property"
      lede="Type your street address as it appears on your tax bill. Searching is anonymous — nothing you type is saved, and nothing identifies you."
    >
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          void run(query)
        }}
        className="flex flex-col gap-3"
      >
        <Label.Root htmlFor={inputId} className="font-semibold">
          Street address
        </Label.Root>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="street-address"
            spellCheck={false}
            enterKeyHint="search"
            placeholder="e.g. 3 Westford St"
            aria-describedby={`${inputId}-help`}
            className="min-w-0 flex-1 rounded-xl border border-lines bg-paper px-4 py-3 text-[1.05rem] text-ink placeholder:text-muted"
          />
          <button type="submit" className={btnSecondary}>
            Search
          </button>
        </div>
        <p id={`${inputId}-help`} className="m-0 text-[0.88rem] text-muted">
          A street name on its own works well — try “Westford”, “Pratt”, or “Adella”.
        </p>
      </form>

      {/* Announced without stealing focus, so results are heard as they appear. */}
      <p role="status" aria-live="polite" className="mt-4 min-h-[1.5rem] text-[0.95rem] text-muted">
        {status}
        {searching ? <span className="sr-only"> Still searching.</span> : null}
      </p>

      {liveError ? (
        <Note tone="warn" title="The citywide search did not answer" className="mt-2">
          <p className="m-0">{liveError}</p>
        </Note>
      ) : null}

      {results.length > 0 ? (
        <ul className="m-0 mt-1 flex list-none flex-col gap-2 p-0">
          {results.map((p) => {
            const current = selected?.pid === p.pid && selected?.src === p.src
            return (
              <li key={`${p.src}-${p.pid}`}>
                <button
                  type="button"
                  onClick={() => onSelect(p)}
                  aria-current={current ? 'true' : undefined}
                  className={[
                    'flex w-full flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition-colors',
                    current
                      ? 'border-brand bg-brand-soft'
                      : 'border-lines bg-paper hover:border-brand hover:bg-brand-soft',
                  ].join(' ')}
                >
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold">{titleCase(p.addr)}</span>
                    {/* Never colour alone: the chosen row says so in words. */}
                    {current ? <Chip tone="brand">Selected</Chip> : null}
                  </span>
                  <span className="tnum text-[0.9rem] text-muted">
                    {fiscalYearLabel(p.fy)} assessed {money(p.tv)}
                    {p.la ? ` · ${sqft(p.la)}` : ''}
                    {p.yr ? ` · built ${year(p.yr)}` : ''}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}

      <div className="mt-6 border-t border-lines pt-5">
        {isExample ? (
          <Note tone="brand" title={`Example: ${EXAMPLE_LABEL}`}>
            <p className="m-0">
              This page opened on a real property so you can see how the tool works before you
              search for your own. Everything below is worked out from its public record.
            </p>
          </Note>
        ) : (
          <button type="button" onClick={onLoadExample} className={btnPrimary}>
            Back to the example: {EXAMPLE_LABEL}
          </button>
        )}
      </div>
    </Console>
  )
}
