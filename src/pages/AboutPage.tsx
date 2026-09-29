/**
 * About — what this is, who it is for, and the limits it keeps.
 *
 * Every claim on this page is one the tool actually honours in code: the
 * arithmetic is on screen, a person reviews the application, and the homeowner
 * signs it. Nothing here promises an outcome.
 */
import type { ReactNode } from 'react'
import { Disclaimer } from '../components/Disclaimer'
import { Chip, ExternalLink, Note, btnSecondary } from '../components/ui'

/** A titled band of the page. Every heading is an h2, in document order. */
function Section({
  id,
  title,
  lede,
  children,
  float = 'float-1',
}: {
  id: string
  title: string
  lede?: ReactNode
  children: ReactNode
  float?: string
}) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={`float ${float}`}>
      <h2 id={`${id}-h`} className="m-0 text-[1.45rem] sm:text-[1.7rem]">
        {title}
      </h2>
      {lede ? <p className="m-0 mt-2 max-w-[68ch] text-muted">{lede}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Card({
  title,
  children,
  float = 'float-2',
}: {
  title: string
  children: ReactNode
  float?: string
}) {
  return (
    <div
      className={`float ${float} rounded-card border border-lines bg-surface p-5 shadow-card sm:p-6`}
    >
      <h3 className="m-0 text-[1.15rem]">{title}</h3>
      <div className="mt-2 text-[0.97rem]">{children}</div>
    </div>
  )
}

/** A figure with the words that make it mean something. Never a number alone. */
function Stat({
  figure,
  label,
  detail,
  float = 'float-3',
}: {
  figure: string
  label: string
  detail: string
  float?: string
}) {
  return (
    <div
      className={`float ${float} rounded-card border border-lines bg-surface px-5 py-5 shadow-card`}
    >
      <p className="tnum m-0 font-display text-[2.1rem] font-semibold leading-none text-brand sm:text-[2.5rem]">
        {figure}
      </p>
      <p className="m-0 mt-2 font-semibold">{label}</p>
      <p className="m-0 mt-1 text-[0.92rem] text-muted">{detail}</p>
    </div>
  )
}

const STEPS: { n: string; title: string; body: ReactNode }[] = [
  {
    n: '01',
    title: 'Find the property',
    body: 'Search public assessment records by street address. No account, no sign-up, and nothing typed here identifies the person typing it.',
  },
  {
    n: '02',
    title: 'Read the assessment',
    body: 'Assessed value, land and building split, living area, year built, parcel ID, and whether the residential exemption is applied — laid out to be checked line by line against the tax bill. A wrong square footage is itself a ground to ask for an abatement.',
  },
  {
    n: '03',
    title: 'Estimate the over-assessment',
    body: (
      <>
        The tool compares the home’s assessed dollars per square foot against the median of
        comparable homes — within 25% of its living area and 15 years of its age. That comparison is{' '}
        <strong className="font-semibold">disproportionate assessment</strong>, a ground recognised
        under <abbr title="Massachusetts General Laws, chapter 59">G.L. c. 59</abbr>, and the one
        ground a homeowner can document from public records alone, with no appraiser. Fewer than
        three comparable homes produces no verdict at all.
      </>
    ),
  },
  {
    n: '04',
    title: 'Hold the deadline',
    body: 'A live countdown to the due date of the first actual tax bill — in Boston, typically February 1 — plus the dates that follow it, exportable to a calendar. Missing that date forfeits the year, and no part of the process can undo it.',
  },
  {
    n: '05',
    title: 'Prepare and file',
    body: 'Direct links to State Tax Form 128, the Board of Assessors, and the Appellate Tax Board, and a draft statement of case written from the figures already on screen — in the homeowner’s own voice, for the homeowner to edit, review with a navigator, and sign.',
  },
]

export function AboutPage() {
  return (
    <div className="flex flex-col gap-10">
      <div className="float float-1">
        <h1 className="m-0 text-[2rem] sm:text-[2.6rem]">About Donna</h1>
        <p className="m-0 mt-4 max-w-[64ch] text-[1.1rem]">
          Donna is a free tool that helps a Suffolk County homeowner find out whether their home is
          assessed unfairly, understand what the law actually allows them to do about it, and prepare
          the application themselves — with a person reviewing the work before anything is filed.
        </p>
        <p className="m-0 mt-4 flex flex-wrap gap-2">
          <Chip tone="brand">Free and non-commercial</Chip>
          <Chip tone="neutral">No account, no tracking</Chip>
          <Chip tone="neutral">Human review before filing</Chip>
          <Chip tone="neutral">WCAG 2.1 AA</Chip>
        </p>
      </div>

      <Section
        id="mission"
        title="Mission and vision"
        lede="What this tool is for, and what it is aiming at."
        float="float-2"
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card title="Our mission" float="float-2">
            <p className="m-0">
              To put the power to challenge an unfair assessment in{' '}
              <strong className="font-semibold">every homeowner’s hands</strong> — not only those who
              can afford a lawyer. The arithmetic is shown, the deadline is tracked, the paperwork
              is prepared, and a person is always in the loop before anything reaches the city.
            </p>
          </Card>
          <Card title="Our vision" float="float-3">
            <p className="m-0">
              A commonwealth where a{' '}
              <strong className="font-semibold">fair assessment is the default</strong>, not a
              privilege you have to fight for — and where residents keep full agency over their own
              homes, their own records, and their own decisions.
            </p>
          </Card>
        </div>
      </Section>

      <Section
        id="problem"
        title="The problem we address"
        lede="Property tax is the largest source of municipal revenue in Massachusetts, and the way it is assessed is quietly regressive."
        float="float-2"
      >
        <div className="flex flex-col gap-4 text-[0.98rem]">
          <p className="m-0 max-w-[68ch]">
            Mass appraisal values thousands of homes at once from models, not from visits. Those
            models systematically overvalue modest homes and undervalue expensive ones, so the owner
            of a three-decker carries a higher share of their home’s real worth than the owner of a
            townhouse across the river. National research puts the effect starkly: Black and Hispanic
            homeowners pay an estimated{' '}
            <strong className="font-semibold">10–13% more in property tax</strong> than white
            homeowners for the same bundle of municipal services.
          </p>
          <p className="m-0 max-w-[68ch]">
            The remedy is real, and it is free to ask for. But the remedy itself favours the
            wealthy: an abatement is won with comparable-sales evidence, and the people who know that
            — who can hire an appraiser, or a tax attorney on contingency — appeal routinely. The
            households most likely to be over-assessed are the least likely to appeal. That gap, not
            the assessment model, is what this tool is built to close.
          </p>
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <Stat
          figure="10–13%"
          label="The racial tax gap"
          detail="Estimated extra property tax Black and Hispanic homeowners pay for the same services."
          float="float-3"
        />
        <Stat
          figure="Feb 1"
          label="One date, no cure"
          detail="Abatement applications are due on the first actual tax bill — typically February 1. Miss it and the year is gone."
          float="float-4"
        />
        <Stat
          figure="$0"
          label="What this costs"
          detail="No fee, no account, no appraiser, no attorney required to ask for an abatement."
          float="float-1"
        />
      </div>

      <Section
        id="what"
        title="What it does"
        lede="Five steps, in the order a homeowner actually moves through them. The work spans two domains at once — Massachusetts property tax law and municipal finance — and the tool is careful to stay inside both."
        float="float-3"
      >
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {STEPS.map((s) => (
            <li
              key={s.n}
              className="rounded-card border border-lines bg-surface px-5 py-4 shadow-card"
            >
              <p className="m-0 flex items-baseline gap-3">
                <span
                  aria-hidden="true"
                  className="tnum font-display text-[1.05rem] font-semibold text-brand"
                >
                  {s.n}
                </span>
                <span className="font-semibold">{s.title}</span>
              </p>
              <p className="m-0 mt-1.5 max-w-[68ch] text-[0.96rem] text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        id="responsible"
        title="Responsible AI, by design"
        lede="These are not aspirations bolted onto a finished product. Each one is a constraint the tool is built around, and each one is visible in the interface."
        float="float-4"
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Information and preparation only" float="float-1">
            <p className="m-0">
              Donna explains what the law allows and prepares documents from public records. It never
              gives individualised legal advice, never represents anyone, and never claims to know
              what the assessors will decide.
            </p>
          </Card>
          <Card title="Uncertainty is shown, not hidden" float="float-2">
            <p className="m-0">
              Every estimate displays its comparable count and its full arithmetic — the division,
              the median, the proportionate value, and the table of homes actually used. Below three
              comparable homes there is no verdict at all, only an honest “not enough data”. There
              are no outcome guarantees anywhere in this tool.
            </p>
          </Card>
          <Card title="A human in the loop" float="float-3">
            <p className="m-0">
              A navigator or legal-aid clinic reviews the application before it is filed, and complex
              cases — ownership questions, trusts, probate, hardship — are escalated to an attorney.
              The estimate is the start of a conversation with a person, not a substitute for one.
            </p>
          </Card>
          <Card title="The homeowner decides and signs" float="float-4">
            <p className="m-0">
              Donna files nothing. It drafts, and the homeowner reads, edits, signs, and submits.
              Agency stays where it belongs, at every step.
            </p>
          </Card>
          <Card title="Minimal data, kept in the browser" float="float-1">
            <p className="m-0">
              There is no account and no analytics. Searches run against public datasets; nothing a
              user types is stored, profiled, or sent anywhere that identifies them. Close the tab and
              nothing of them remains.
            </p>
          </Card>
          <Card title="Public records, checkable by anyone" float="float-2">
            <p className="m-0">
              Every figure comes from published municipal assessment data, and every comparable home
              is named on screen with its address and value. Anyone — a homeowner, a navigator, an
              assessor — can check the work.
            </p>
          </Card>
        </div>
      </Section>

      <Section
        id="feasibility"
        title="Feasibility and reach"
        lede="This is a static web application with no backend, no database, and no per-user cost. It deploys as files behind a CDN, which is what makes the next paragraph credible."
        float="float-1"
      >
        <div className="flex flex-col gap-4 text-[0.98rem]">
          <p className="m-0 max-w-[68ch]">
            <strong className="font-semibold">Pilot-ready.</strong> The tool works today for Suffolk
            County and can be put in front of residents through housing clinics, legal-aid intake, and
            neighbourhood associations well before the next February 1 — the one deadline that cannot
            be rescheduled. A navigator needs no training beyond the page itself: the arithmetic is on
            screen, so a reviewer can verify a case in under a minute.
          </p>
          <p className="m-0 max-w-[68ch]">
            <strong className="font-semibold">Scales by data, not by rewrite.</strong> A new city or
            county comes online by loading its published assessment records — the comparison method,
            the legal timeline, and the document preparation are the same everywhere in the
            Commonwealth. One reusable pattern covers every municipality that publishes its
            assessments, which is systems thinking rather than a series of one-off tools.
          </p>
          <p className="m-0 max-w-[68ch]">
            <strong className="font-semibold">Safeguards scale with it.</strong> The guardrails are
            in the product, not in a policy document: the comparable-count floor, the visible
            arithmetic, the absence of any outcome claim, and the human review step all travel with
            the code to every new jurisdiction. Growth cannot quietly erode them.
          </p>
        </div>
      </Section>

      <Section
        id="access"
        title="Scalability and ADA compliance"
        lede="A remedy that is only reachable by someone with a screen, a keyboard, fluent English, and broadband is not actually reachable by the people who need it most."
        float="float-2"
      >
        <Note tone="brand" title="Next: a voice AI agent that makes the call" className="mb-4">
          <p className="m-0">
            The next step for this project is a voice agent that telephones the assessor’s office on
            a resident’s behalf — for someone whose disability makes a web form impractical, someone
            more comfortable in a language other than English, or someone with no home internet at
            all. The resident says what they need; the agent places the call, asks the questions, and
            reports back in plain language.
          </p>
          <p className="m-0 mt-2">
            It stays inside the same guardrails as everything else here:{' '}
            <strong className="font-semibold">navigator-supervised</strong>, scripted to request
            information rather than to argue a case, never authorised to file, settle, or agree to
            anything, and always handing the decision back to the resident.
          </p>
        </Note>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card title="Built for keyboards and screen readers" float="float-3">
            <p className="m-0">
              Semantic headings in order, a skip link as the first stop, visible focus rings on
              everything reachable, labels tied to every input, and live regions that announce
              results as they appear rather than leaving them silent.
            </p>
          </Card>
          <Card title="Readable in any condition" float="float-4">
            <p className="m-0">
              Text contrast meets WCAG 2.1 AA at 4.5:1 or better, nothing is signalled by colour
              alone — every state carries a word or an icon — motion is reduced when the system asks
              for it, and light and dark both follow the operating system until the reader says
              otherwise.
            </p>
          </Card>
          <Card title="Works on the device people have" float="float-1">
            <p className="m-0">
              Usable at 320 pixels wide and at 200% zoom, on an old phone, over a slow connection.
              There is no app to install and nothing to log into.
            </p>
          </Card>
          <Card title="Plain language, no jargon tax" float="float-2">
            <p className="m-0">
              “Deemed denied”, “fair cash value”, and “disproportionate assessment” are all explained
              where they are used. Understanding the process should not require already understanding
              the process.
            </p>
          </Card>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <ExternalLink
            href="https://www.sec.state.ma.us/divisions/cis/tax/property-abatement.htm"
            className={btnSecondary}
          >
            How an abatement works
          </ExternalLink>
          <ExternalLink
            href="https://www.mass.gov/orgs/appellate-tax-board"
            className={btnSecondary}
          >
            Appellate Tax Board
          </ExternalLink>
        </div>
      </Section>

      <section
        aria-labelledby="closing-h"
        className="float float-3 rounded-card border border-brand bg-brand-soft px-6 py-7"
      >
        <h2 id="closing-h" className="m-0 text-[1.45rem] sm:text-[1.7rem]">
          Who this is built for
        </h2>
        <blockquote className="m-0 mt-4 max-w-[60ch] border-l-4 border-brand pl-5">
          <p className="m-0 font-display text-[1.25rem] leading-snug sm:text-[1.5rem]">
            “Built for the homeowner who was never told this was possible. The one who is heard is
            the resident. The one who decides, signs, and keeps the last word is the resident.”
          </p>
        </blockquote>
        <p className="m-0 mt-4 max-w-[62ch] text-[0.96rem]">
          Not the appraiser they could not afford, and not the software. Donna does the arithmetic and
          the paperwork so a person can do the deciding.
        </p>
      </section>

      <Disclaimer />
    </div>
  )
}
