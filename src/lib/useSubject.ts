import { useEffect, useMemo, useRef, useState } from 'react'
import { assess, type AssessmentResult } from './assess'
import { checkRecord, type RecordCheck } from './recordCheck'
import { loadDetail } from '../data'
import { isLocalZip, localRecords, localVintage, allSales } from './local'
import { fetchLiveCohort } from './live'
import type { ParcelDetail, Property } from './types'
import { valueBySales, type ValuationResult } from './valuation'

export interface SubjectState {
  subject: Property | null
  /** True while the comparables or the detail are still being fetched. */
  loading: boolean
  /** The sales comparison, where the data supports one. */
  valuation: ValuationResult | null
  /** The equity comparison. */
  equity: AssessmentResult | null
  /** Questions about the city's record of the property. */
  checks: RecordCheck[]
  detail: ParcelDetail | null
  /** Set when the citywide records could not be read. */
  error: string | null
  /** True when this property has sales data behind it. */
  hasSales: boolean
}

const EMPTY: SubjectState = {
  subject: null,
  loading: false,
  valuation: null,
  equity: null,
  checks: [],
  detail: null,
  error: null,
  hasSales: false,
}

/** Everything derived from the chosen property, gathered in one place. */
interface Gathered {
  pool: Property[]
  poolComplete: boolean
  valuation: ValuationResult | null
  detail: ParcelDetail | null
  hasSales: boolean
}

/** What was gathered, and which property it belongs to. */
interface Held {
  key: string
  value: Gathered
}

/** A property is identified by where it came from as well as its id. */
const keyOf = (property: Property) => `${property.src}:${property.pid}`

/**
 * Holds the chosen property and everything worked out from it.
 *
 * Comparables come from the same source as the subject, so the comparison is
 * like for like. A locally held record is compared against the rest of its
 * neighbourhood and valued against its recorded sales; a citywide record is
 * compared against the rest of its ZIP, which carries no sales, so only the
 * equity comparison is available for it.
 */
export function useSubject(subject: Property | null): SubjectState {
  const [held, setHeld] = useState<Held | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  const key = subject ? keyOf(subject) : null

  /**
   * Derived during render, not stored: a result gathered for the previous
   * property must never be read against the new one. Without this, choosing
   * a second property briefly shows it compared against the first one's
   * neighbours.
   */
  const gathered = held && held.key === key ? held.value : null

  useEffect(() => {
    if (!subject) return

    const id = ++requestId.current
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    const run = async (): Promise<Gathered> => {
      if (subject.src === 'local') {
        const [pool, vintage, sales, detail] = await Promise.all([
          localRecords(),
          localVintage(),
          allSales(),
          loadDetail(subject.pid),
        ])
        const valuation = valueBySales({
          subject,
          pool,
          salesByPid: sales,
          valuationDate: vintage.valuationDate,
          fiscalYear: vintage.fy,
        })
        return { pool, poolComplete: true, valuation, detail, hasSales: true }
      }

      // A citywide record: fetch its whole ZIP, filtered to its own class.
      let cohort = await fetchLiveCohort(subject, {}, controller.signal)
      if (cohort.pool.length < 10) {
        const wider = await fetchLiveCohort(subject, { widen: true }, controller.signal)
        if (wider.pool.length > cohort.pool.length) cohort = wider
      }
      // The deep local set covers only some ZIPs; say so rather than imply
      // a sales comparison was run when there were no sales to run it on.
      const local = await isLocalZip(subject.zip)
      return {
        pool: cohort.pool,
        poolComplete: cohort.complete,
        valuation: null,
        detail: null,
        hasSales: local,
      }
    }

    run()
      .then((result) => {
        if (requestId.current !== id) return
        setHeld({ key: keyOf(subject), value: result })
      })
      .catch(async (cause: unknown) => {
        if (requestId.current !== id || controller.signal.aborted) return
        const { userMessage } = await import('./errors')
        setError(userMessage(cause))
        setHeld(null)
      })
      .finally(() => {
        if (requestId.current === id) setLoading(false)
      })

    return () => controller.abort()
    // The identity of the property is what matters, not the object.
  }, [subject, key])

  const equity = useMemo<AssessmentResult | null>(() => {
    if (!subject || !gathered) return null
    return assess(subject, gathered.pool, { poolComplete: gathered.poolComplete })
  }, [subject, gathered])

  const checks = useMemo<RecordCheck[]>(() => {
    if (!subject || !gathered) return []
    return checkRecord(subject, gathered.pool, gathered.detail)
  }, [subject, gathered])

  if (!subject) return EMPTY

  return {
    subject,
    // Nothing gathered yet means the consoles below are still waiting, not
    // that there is nothing to show. A failure is the exception: it ends the
    // wait, and the error is what gets rendered.
    loading: loading || (gathered === null && error === null),
    valuation: gathered?.valuation ?? null,
    equity,
    checks,
    detail: gathered?.detail ?? null,
    error,
    hasSales: gathered?.hasSales ?? false,
  }
}
