/**
 * The tool itself: one page, five consoles, in the order a homeowner moves
 * through them. The selected property lives here, so 02–05 all recompute from a
 * single source of truth the moment 01 changes.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Disclaimer } from '../components/Disclaimer'
import { Chip } from '../components/ui'
import { Assessment } from '../consoles/Assessment'
import { Deadline } from '../consoles/Deadline'
import { Estimate } from '../consoles/Estimate'
import { FileAppeal } from '../consoles/File'
import { FindProperty } from '../consoles/FindProperty'
import { exampleProperty } from '../lib/local'
import type { Property } from '../lib/types'
import { useSubject } from '../lib/useSubject'

export function ToolPage() {
  // Open on a real, genuinely over-assessed property so the page is never a
  // blank form. It is labelled as an example in console 01.
  const [picked, setPicked] = useState<Property | null>(() => exampleProperty())
  /** True while the page is still showing the worked example, not the user's home. */
  const [isExample, setIsExample] = useState(true)
  /** Set when a change came from the user, so focus only moves on purpose. */
  const moveFocus = useRef(false)

  const { subject, poolLoading, result } = useSubject(picked)

  const onSelect = useCallback((p: Property) => {
    moveFocus.current = true
    setIsExample(false)
    setPicked(p)
  }, [])

  const onLoadExample = useCallback(() => {
    moveFocus.current = true
    setIsExample(true)
    setPicked(exampleProperty())
  }, [])

  /**
   * A new property rewrites four consoles below the fold. Without moving focus,
   * a keyboard or screen-reader user is left parked on the search results with
   * no way to know anything happened.
   */
  useEffect(() => {
    if (!moveFocus.current || !subject) return
    moveFocus.current = false
    const region = document.getElementById('assessment')
    if (!region) return
    region.setAttribute('tabindex', '-1')
    region.focus()
  }, [subject])

  return (
    <div className="flex flex-col gap-7">
      <div className="float float-1">
        <h1 className="m-0 text-[2rem] sm:text-[2.6rem]">Is your home over-assessed?</h1>
        <p className="m-0 mt-3 max-w-[60ch] text-[1.05rem] text-muted">
          Boston homeowners can challenge an unfair assessment themselves — no appraiser, no
          attorney, no fee. Find your property, see the arithmetic, and prepare the application in
          the next few minutes.
        </p>
        <p className="m-0 mt-4 flex flex-wrap gap-2">
          <Chip tone="brand">Free</Chip>
          <Chip tone="neutral">No account</Chip>
          <Chip tone="neutral">Reviewed by a person</Chip>
        </p>
      </div>

      <div className="float float-2">
        <FindProperty
          selected={subject}
          onSelect={onSelect}
          isExample={isExample}
          onLoadExample={onLoadExample}
        />
      </div>

      <div className="float float-3">
        <Assessment subject={subject} />
      </div>

      <div className="float float-4">
        <Estimate subject={subject} result={result} poolLoading={poolLoading} />
      </div>

      <div className="float float-1">
        <Deadline subject={subject} />
      </div>

      <div className="float float-2">
        <FileAppeal subject={subject} result={result} />
      </div>

      <Disclaimer />
    </div>
  )
}
