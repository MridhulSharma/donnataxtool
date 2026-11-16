/**
 * The reviewer's view.
 *
 * A navigator opens a case through a link that carries it, so a clinic can
 * check an application without this project running a server, holding
 * anybody's data, or asking a homeowner to create an account. The case is in
 * the link; close the tab and it is gone.
 */
import { useMemo } from 'react'
import { Disclaimer } from '../components/Disclaimer'
import { CopyButton, Note } from '../components/ui'
import { decodeReview } from '../lib/referral'

const CHECKLIST = [
  'Does the owner of record match the person applying, and is the property held in a trust, an LLC or an estate?',
  'Has the tax been paid as billed and on time? Appeal rights depend on it.',
  'Do the comparable sales look like this property to someone who knows the street?',
  'Is there anything about the condition of the building that the record does not show?',
  'Is an exemption open to this household that nobody has claimed?',
  'Is a second ground worth raising alongside the first?',
  'Is the case complex enough to need an attorney rather than a navigator?',
]

export function ReviewPage({ payload }: { payload: string | null }) {
  const text = useMemo(() => (payload ? decodeReview(payload) : null), [payload])

  return (
    <div className="flex flex-col gap-7">
      <div>
        <h1 className="m-0 text-[2rem] sm:text-[2.6rem]">Case review</h1>
        <p className="m-0 mt-3 max-w-[62ch] text-[1.05rem] text-muted">
          A homeowner has prepared an abatement application and asked for it to be checked. The
          case is carried in the link itself: nothing about it is stored on any server, and
          closing this tab is the end of it.
        </p>
      </div>

      {!text ? (
        <Note tone="warn" title="No case in this link">
          <p className="m-0">
            This page shows a case that a homeowner has shared with you. The link they send
            carries it, so an empty or truncated link shows nothing. Ask them to copy the review
            link again from step 07.
          </p>
        </Note>
      ) : (
        <>
          <section
            aria-label="The case"
            className="rounded-card border border-lines bg-surface p-5 shadow-card sm:p-7"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="m-0 text-[1.35rem]">What the homeowner prepared</h2>
              <CopyButton text={text} label="Copy this case" copiedLabel="Case copied" />
            </div>
            <div
              role="region"
              aria-label="Case summary"
              tabIndex={0}
              className="mt-4 max-h-[36rem] overflow-auto rounded-xl border border-lines bg-paper"
            >
              <pre className="tnum m-0 whitespace-pre-wrap break-words px-4 py-4 font-sans text-[0.9rem] leading-relaxed">
                {text}
              </pre>
            </div>
          </section>

          <section
            aria-label="Reviewer checklist"
            className="rounded-card border border-brand bg-brand-soft p-5 shadow-card sm:p-7"
          >
            <h2 className="m-0 text-[1.35rem]">Before you tell them it is ready</h2>
            <p className="m-0 mt-2 max-w-[64ch] text-[0.96rem]">
              The arithmetic above can be checked on screen. These are the things it cannot see.
            </p>
            <ul className="m-0 mt-4 flex list-none flex-col gap-2 p-0">
              {CHECKLIST.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[0.96rem]">
                  <span
                    aria-hidden="true"
                    className="mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full bg-brand"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <Disclaimer />
    </div>
  )
}
