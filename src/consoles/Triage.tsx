/**
 * Console 03 — which ground fits.
 *
 * A few questions, answered or skipped, decide what the rest of the page
 * argues. This is the console that stops a homeowner walking into the
 * hardest ground in Massachusetts law by default.
 */
import * as Label from '@radix-ui/react-label'
import { useId } from 'react'
import { Console } from '../components/Console'
import { Chip, Note } from '../components/ui'
import { DISPROPORTIONATE_WARNING } from '../lib/legal'
import type { GroundAssessment, TriageAnswers } from '../lib/triage'
import type { Property } from '../lib/types'

interface Props {
  subject: Property | null
  answers: TriageAnswers
  onChange: (next: TriageAnswers) => void
  grounds: GroundAssessment[]
}

const STRENGTH_LABEL: Record<GroundAssessment['strength'], string> = {
  likely: 'Worth arguing',
  possible: 'Possible',
  unlikely: 'Unlikely to help',
}

function YesNo({
  id,
  question,
  why,
  value,
  onChange,
}: {
  id: string
  question: string
  why: string
  value: boolean | undefined
  onChange: (v: boolean | undefined) => void
}) {
  const name = useId()
  return (
    <fieldset className="m-0 rounded-xl border border-lines bg-paper px-4 py-3">
      <legend className="px-1 font-semibold">{question}</legend>
      <p className="m-0 mb-2 text-[0.88rem] text-muted">{why}</p>
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'Yes', v: true },
          { label: 'No', v: false },
          { label: 'Not sure', v: undefined },
        ].map((option) => {
          const checked = value === option.v
          const optionId = `${id}-${String(option.label).toLowerCase().replace(/\s+/g, '-')}`
          return (
            <span key={option.label} className="inline-flex">
              <input
                type="radio"
                id={optionId}
                name={name}
                checked={checked}
                onChange={() => onChange(option.v)}
                className="peer sr-only-focusable absolute"
              />
              <label
                htmlFor={optionId}
                className={[
                  'cursor-pointer rounded-full border px-4 py-1.5 text-[0.9rem] font-semibold transition-colors',
                  'peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--ring)]',
                  checked
                    ? 'border-brand bg-brand text-[var(--surface)]'
                    : 'border-lines bg-surface text-ink hover:bg-brand-soft',
                ].join(' ')}
              >
                {option.label}
              </label>
            </span>
          )
        })}
      </div>
    </fieldset>
  )
}

export function Triage({ subject, answers, onChange, grounds }: Props) {
  const priceId = useId()
  const dateId = useId()
  const set = (patch: Partial<TriageAnswers>) => onChange({ ...answers, ...patch })

  return (
    <Console
      n="03"
      id="situation"
      title="Your situation"
      lede="Five questions, all optional. They decide which ground your application should argue, and the answers never leave your browser."
    >
      {!subject ? (
        <Note>Choose a property in step 01 to answer these about it.</Note>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <YesNo
              id="owner"
              question="Do you live in this property as your main home?"
              why="Owner-occupants can claim the residential exemption, which is often worth more than an abatement."
              value={answers.ownerOccupied}
              onChange={(v) => set({ ownerOccupied: v })}
            />
            <YesNo
              id="value"
              question="Is the assessed value more than you could sell the property for?"
              why="That is overvaluation, the ground most abatements are actually won on."
              value={answers.valueTooHigh}
              onChange={(v) => set({ valueTooHigh: v })}
            />
            <YesNo
              id="bought"
              question="Did you buy the property in the last two years?"
              why="What you actually paid is the strongest single piece of evidence of what it is worth."
              value={answers.boughtRecently}
              onChange={(v) =>
                set(
                  v === true
                    ? { boughtRecently: v }
                    : { boughtRecently: v, purchasePrice: null, purchaseDate: null },
                )
              }
            />

            {answers.boughtRecently === true ? (
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-brand bg-brand-soft px-4 py-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label.Root htmlFor={priceId} className="font-semibold">
                    What did you pay?
                  </Label.Root>
                  <input
                    id={priceId}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="750,000"
                    value={answers.purchasePrice ? answers.purchasePrice.toLocaleString('en-US') : ''}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^0-9]/g, '')
                      set({ purchasePrice: digits ? Number(digits) : null })
                    }}
                    className="rounded-xl border border-lines bg-surface px-4 py-2.5 text-[1.05rem] text-ink placeholder:text-muted"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label.Root htmlFor={dateId} className="font-semibold">
                    When did you buy it?
                  </Label.Root>
                  <input
                    id={dateId}
                    type="date"
                    value={answers.purchaseDate ?? ''}
                    onChange={(e) => set({ purchaseDate: e.target.value || null })}
                    className="rounded-xl border border-lines bg-surface px-4 py-2.5 text-[1.05rem] text-ink"
                  />
                </div>
              </div>
            ) : null}

            <YesNo
              id="record"
              question="Is anything in the city’s record of your property wrong?"
              why="A wrong square footage, room count or year built is the easiest kind of abatement to win. Step 02 lists what the city holds."
              value={answers.recordWrong}
              onChange={(v) => set({ recordWrong: v })}
            />
            <YesNo
              id="condition"
              question="Does the property need major repairs, or have problems a buyer would see?"
              why="Condition is part of fair cash value, and the record may not reflect it. Photographs are good evidence."
              value={answers.conditionProblems}
              onChange={(v) => set({ conditionProblems: v })}
            />
          </div>

          <div className="mt-7 border-t border-lines pt-6" aria-live="polite">
            <h3 className="m-0 text-[1.1rem]">Which ground fits your case</h3>
            <p className="m-0 mt-1 max-w-[62ch] text-[0.94rem] text-muted">
              Massachusetts recognises more than one ground, and they are not equally winnable.
              This is how yours look on what we know so far.
            </p>
            <ul className="m-0 mt-4 flex list-none flex-col gap-3 p-0">
              {grounds.map((ground) => (
                <li
                  key={`${ground.id}-${ground.title}`}
                  className="rounded-xl border border-lines bg-paper px-4 py-3"
                >
                  <p className="m-0 flex flex-wrap items-center gap-2">
                    <Chip
                      tone={
                        ground.strength === 'likely'
                          ? 'good'
                          : ground.strength === 'possible'
                            ? 'neutral'
                            : 'neutral'
                      }
                    >
                      {STRENGTH_LABEL[ground.strength]}
                    </Chip>
                    <span className="font-semibold">{ground.title}</span>
                  </p>
                  <p className="m-0 mt-1.5 max-w-[66ch] text-[0.94rem]">{ground.reason}</p>
                  <p className="m-0 mt-1 max-w-[66ch] text-[0.88rem] text-muted">
                    What you would need: {ground.evidence}
                  </p>
                </li>
              ))}
            </ul>

            <Note tone="warn" title="About disproportionate assessment" className="mt-4">
              <p className="m-0">{DISPROPORTIONATE_WARNING}</p>
            </Note>
          </div>
        </>
      )}
    </Console>
  )
}
