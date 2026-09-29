import * as Label from '@radix-ui/react-label'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Console } from '../components/Console'
import { btnPrimary, btnSecondary, Chip, Note } from '../components/ui'
import { money, sqft, titleCase, year } from '../lib/format'
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
  const runId = useRef(0)
  const debounce = useRef<number | undefined>(undefined)

  const run = useCallback(async (raw: string) => {
    const q = raw.trim()
    const id = ++runId.current

    if (q.length < MIN_QUERY) {
      setResults([])
      setSearching(false)
      setStatus(q.length === 0 ? '' : 'Keep typing — enter at least two characters.')
      return
    }

    // Instant matches render first, then the wider search fills in behind them.
    const fast = immediateResults(q)
    setResults(fast)
    setSearching(true)
    setStatus(
      fast.length > 0
        ? `${fast.length} ${fast.length === 1 ? 'record' : 'records'} found. Choose your property below:`
        : 'Searching public records…',
    )

    const outcome = await appendLiveResults(q, fast)
    if (runId.current !== id) return // a newer query is in flight

    setResults(outcome.results)
    setSearching(false)

    const n = outcome.results.length
    if (n === 0) {
      setStatus('No matching records found. Try just the street name.')
    } else {
      setStatus(`${n} ${n === 1 ? 'record' : 'records'} found. Choose your property below:`)
    }
  }, [])

  // Debounced so we are not firing a network request on every keystroke.
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
      lede="Type your street address as it appears on your tax bill. Searching is anonymous — nothing you type is saved or sent anywhere that identifies you."
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
                    Assessed {money(p.tv)}
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
              This page opened on a real, genuinely over-assessed property so you can see how the
              estimate works. Search above to check your own home.
            </p>
          </Note>
        ) : (
          <button type="button" onClick={onLoadExample} className={btnPrimary}>
            Try a real example: {EXAMPLE_LABEL}
          </button>
        )}
      </div>
    </Console>
  )
}
