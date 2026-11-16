/**
 * The tool itself: one page, eight consoles, in the order a homeowner moves
 * through them. The selected property lives here, so everything below it
 * recomputes from a single source of truth the moment 01 changes.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Disclaimer } from '../components/Disclaimer'
import { Chip, Note } from '../components/ui'
import { Assessment } from '../consoles/Assessment'
import { Deadline } from '../consoles/Deadline'
import { Estimate } from '../consoles/Estimate'
import { Exemptions } from '../consoles/Exemptions'
import { FileAppeal } from '../consoles/File'
import { FindProperty } from '../consoles/FindProperty'
import { Track } from '../consoles/Track'
import { Triage } from '../consoles/Triage'
import type { CaseRecord } from '../lib/caseTrack'
import { nextFilingDeadline, useToday } from '../lib/deadline'
import { nextExemptionDeadline } from '../lib/exemptions'
import { exampleProperty } from '../lib/local'
import { rankGrounds, type TriageAnswers } from '../lib/triage'
import type { Property } from '../lib/types'
import { useSubject } from '../lib/useSubject'

export function ToolPage() {
  // Open on a real property so the page is never a blank form. It is
  // labelled as an example in console 01.
  const [picked, setPicked] = useState<Property | null>(null)
  const [isExample, setIsExample] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<TriageAnswers>({})
  const [caseRecord, setCaseRecord] = useState<CaseRecord | null>(null)
  /** Set when a change came from the user, so focus only moves on purpose. */
  const moveFocus = useRef(false)

  // The records load after first paint, so the page appears immediately.
  useEffect(() => {
    let cancelled = false
    exampleProperty()
      .then((property) => {
        if (!cancelled && property) setPicked(property)
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(
            'The local property records could not be loaded. Searching still works, and uses the city’s live records.',
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const { subject, loading, valuation, equity, checks, detail, error, hasSales } =
    useSubject(picked)

  const today = useToday()
  const filing = useMemo(() => nextFilingDeadline(today), [today])
  const exemptionDeadline = useMemo(() => nextExemptionDeadline(today), [today])

  const grounds = useMemo(() => {
    if (!subject) return []
    return rankGrounds(subject, answers, {
      salesSaysLower: valuation?.status === 'valued' && valuation.overAssessed,
      equityOutOfLine: equity?.status === 'scored' && equity.outOfLine,
      recordFlags: checks.length,
    })
  }, [subject, answers, valuation, equity, checks.length])

  const onSelect = useCallback((property: Property) => {
    moveFocus.current = true
    setIsExample(false)
    setPicked(property)
    // A new property is a new case: last property's answers do not carry.
    setAnswers({})
    setCaseRecord(null)
  }, [])

  const onLoadExample = useCallback(() => {
    moveFocus.current = true
    setIsExample(true)
    setAnswers({})
    setCaseRecord(null)
    void exampleProperty().then((property) => {
      if (property) setPicked(property)
    })
  }, [])

  /**
   * A new property rewrites every console below. Without moving focus, a
   * keyboard or screen-reader user is left parked on the search results with
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
          attorney, no fee. Find your property, see what comparable homes actually sold for, and
          prepare the application in the next few minutes.
        </p>
        <p className="m-0 mt-4 flex flex-wrap gap-2">
          <Chip tone="brand">Free</Chip>
          <Chip tone="neutral">No account</Chip>
          <Chip tone="neutral">Nothing leaves your browser</Chip>
        </p>
      </div>

      {loadError ? (
        <Note tone="warn" title="Some records could not be loaded">
          <p className="m-0">{loadError}</p>
        </Note>
      ) : null}

      {error ? (
        <Note tone="warn" title="The city’s records did not answer">
          <p className="m-0">{error}</p>
        </Note>
      ) : null}

      <div className="float float-2">
        <FindProperty
          selected={subject}
          onSelect={onSelect}
          isExample={isExample}
          onLoadExample={onLoadExample}
        />
      </div>

      <div className="float float-3">
        <Assessment subject={subject} checks={checks} detail={detail} />
      </div>

      <div className="float float-4">
        <Triage subject={subject} answers={answers} onChange={setAnswers} grounds={grounds} />
      </div>

      <div className="float float-1">
        <Estimate
          subject={subject}
          valuation={valuation}
          equity={equity}
          loading={loading}
          hasSales={hasSales}
        />
      </div>

      <div className="float float-2">
        <Exemptions subject={subject} answers={answers} deadline={exemptionDeadline} />
      </div>

      <div className="float float-3">
        <Deadline subject={subject} caseRecord={caseRecord} />
      </div>

      <div className="float float-4">
        <FileAppeal
          subject={subject}
          valuation={valuation}
          equity={equity}
          checks={checks}
          answers={answers}
          deadline={filing.date}
        />
      </div>

      <div className="float float-1">
        <Track
          subject={subject}
          deadline={filing.date}
          caseRecord={caseRecord}
          onChange={setCaseRecord}
        />
      </div>

      <Disclaimer />
    </div>
  )
}
