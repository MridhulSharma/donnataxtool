import { useEffect, useMemo, useRef, useState } from 'react'
import { assess, type AssessmentResult } from './assess'
import { localRecords } from './local'
import { liveByZip } from './live'
import type { Property } from './types'

interface SubjectState {
  subject: Property | null
  /** True while the comp pool for a citywide record is being fetched. */
  poolLoading: boolean
  result: AssessmentResult | null
}

/**
 * Holds the chosen property and the pool its comps are drawn from.
 *
 * Comps always come from the same source as the subject, so the comparison is
 * apples to apples: an embedded record is compared against the other records in
 * its area, and a citywide record against the rest of its ZIP.
 */
export function useSubject(subject: Property | null): SubjectState {
  const [livePool, setLivePool] = useState<Property[]>([])
  const [poolLoading, setPoolLoading] = useState(false)
  const reqId = useRef(0)

  const zip = subject?.src === 'live' ? (subject.zip ?? null) : null

  useEffect(() => {
    if (!zip) {
      setLivePool([])
      setPoolLoading(false)
      return
    }
    const id = ++reqId.current
    setPoolLoading(true)
    setLivePool([])
    liveByZip(zip)
      .then((rows) => {
        // Ignore a response that arrived after the user moved on.
        if (reqId.current !== id) return
        setLivePool(rows)
      })
      .catch(() => {
        if (reqId.current === id) setLivePool([])
      })
      .finally(() => {
        if (reqId.current === id) setPoolLoading(false)
      })
  }, [zip])

  const result = useMemo<AssessmentResult | null>(() => {
    if (!subject) return null
    if (subject.src === 'local') return assess(subject, localRecords())
    // Still waiting on the ZIP pool: don't publish a verdict off an empty set.
    if (poolLoading) return null
    return assess(subject, livePool)
  }, [subject, livePool, poolLoading])

  return { subject, poolLoading, result }
}
