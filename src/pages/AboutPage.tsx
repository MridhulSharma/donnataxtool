/**
 * About — what this is, who it is for, and the limits it keeps.
 *
 * Every claim on this page is one the tool actually honours in code. If a
 * claim here cannot be pointed at a file, it does not belong on the page.
 */
import type { ReactNode } from 'react'
import { Disclaimer } from '../components/Disclaimer'
import { Chip, ExternalLink, Note, btnSecondary } from '../components/ui'
import { CASE_CITATIONS, FACTS_CHECKED, LINKS } from '../lib/legal'

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

const STEPS: { n: string; title: string; body: ReactNode }[] = [
  {
    n: '01',
    title: 'Find the property',
    body: 'Search public assessment records by address. No account, no sign-up, and nothing typed here identifies the person typing it.',
  },
  {
    n: '02',
    title: 'Read the record, and question it',
    body: 'Value, land and building split, floor area, lot, condition, year built, remodel, exemption status and the last six years of assessments — each labelled with the fiscal year it belongs to. The tool then compares the record against permits and against other properties of the same type, and asks about anything that looks off. A wrong square footage is the cheapest abatement there is.',
  },
  {
    n: '03',
    title: 'Work out which ground fits',
    body: (
      <>
        Five optional questions decide what the application should argue. This matters more than
        anything else on the page:{' '}
        <strong className="font-semibold">overvaluation</strong>, argued with comparable sales,
        is the ground homeowners win on, while{' '}
        <strong className="font-semibold">disproportionate assessment</strong> requires proof of
        a deliberate, widespread scheme by the assessors.
      </>
    ),
  },
  {
    n: '04',
    title: 'Value it against real sales',
    body: 'Comparable sales of the same property type, screened so that nominal transfers, foreclosures and master deeds are set aside, then adjusted to the subject and to the January 1 valuation date. The adjustments are measured from local sales, not invented, and every one is shown in dollars. The answer is a range with a confidence level, and the assessment is called high only when it sits above the top of that range.',
  },
  {
    n: '05',
    title: 'Check the exemptions',
    body: 'An exemption is a separate application with its own April deadline, and for many households it is worth more than an abatement. The residential exemption alone has been worth thousands to owner-occupants.',
  },
  {
    n: '06',
    title: 'Hold the deadline',
    body: 'A countdown to the due date of the first actual tax bill, in Boston time with the 5:00 pm cut-off, exportable to a calendar. Missing it forfeits the year, and nothing can undo it.',
  },
  {
    n: '07',
    title: 'Prepare, and have a person check it',
    body: 'The official State Tax Form 128 is filled in the browser from the figures on screen, with the signature and the opinion of value left blank. An evidence packet goes behind it. A reviewer summary goes to a navigator, who opens the case from a link that carries it — so a clinic can check the work without this project holding anybody’s data.',
  },
  {
    n: '08',
    title: 'Track what follows',
    body: 'The deadlines after filing run from the day the application went in, not from February 1, and both are jurisdictional. Enter the filing date and the tool works out the deemed-denial date and the last day to petition the Appellate Tax Board.',
  },
]

export function AboutPage() {
  return (
    <div className="flex flex-col gap-10">
      <div className="float float-1">
        <h1 className="m-0 text-[2rem] sm:text-[2.6rem]">About Donna</h1>
        <p className="m-0 mt-4 max-w-[64ch] text-[1.1rem]">
          Donna is a free tool that helps a Boston homeowner find out whether their property is
          assessed above what it is worth, understand what the law actually allows them to do
          about it, and prepare the application themselves — with a person reviewing the work
          before anything is filed.
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
              <strong className="font-semibold">every homeowner’s hands</strong> — not only those
              who can afford a lawyer. The arithmetic is shown, the deadlines are tracked, the
              paperwork is prepared, and a person is always in the loop before anything reaches
              the city.
            </p>
          </Card>
          <Card title="Our vision" float="float-3">
            <p className="m-0">
              A commonwealth where a{' '}
              <strong className="font-semibold">fair assessment is the default</strong>, not a
              privilege you have to fight for — and where residents keep full agency over their
              own homes, their own records, and their own decisions.
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
            models systematically overvalue modest homes and undervalue expensive ones, so the
            owner of a three-decker carries a higher share of their home’s real worth than the
            owner of a townhouse across the river. National research puts the effect starkly:
            Black and Hispanic homeowners pay an estimated{' '}
            <strong className="font-semibold">10–13% more in property tax</strong> than white
            homeowners for the same bundle of municipal services.
          </p>
          <p className="m-0 max-w-[68ch]">
            The remedy is real, and it is free to ask for. But the remedy itself favours the
            wealthy: an abatement is won with comparable-sales evidence, and the people who know
            that — who can hire an appraiser, or a tax attorney on contingency — appeal
            routinely. The households most likely to be over-assessed are the least likely to
            appeal. That gap, not the assessment model, is what this tool is built to close.
          </p>
        </div>
      </Section>

      <Section
        id="what"
        title="What it does"
        lede="Eight steps, in the order a homeowner actually moves through them."
        float="float-3"
      >
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {STEPS.map((step) => (
            <li
              key={step.n}
              className="rounded-card border border-lines bg-surface px-5 py-4 shadow-card"
            >
              <p className="m-0 flex items-baseline gap-3">
                <span
                  aria-hidden="true"
                  className="tnum font-display text-[1.05rem] font-semibold text-brand"
                >
                  {step.n}
                </span>
                <span className="font-semibold">{step.title}</span>
              </p>
              <p className="m-0 mt-1.5 max-w-[68ch] text-[0.96rem] text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        id="grounds"
        title="Why the ground matters more than the number"
        lede="This is the thing most property-tax tools get wrong, and getting it wrong costs a homeowner their appeal."
        float="float-4"
      >
        <div className="flex flex-col gap-4 text-[0.98rem]">
          <p className="m-0 max-w-[68ch]">
            It is tempting to build a tool around the comparison that is easy to compute: take
            the assessed value per square foot, compare it with the neighbours, and report the
            gap. That comparison argues{' '}
            <strong className="font-semibold">disproportionate assessment</strong>, and under
            Massachusetts law the taxpayer must prove an{' '}
            <strong className="font-semibold">intentional, widespread scheme</strong> of
            assessing other property at a lower share of its value. The Appellate Tax Board
            rejects applications built on the assessed values of a few nearby homes as a matter
            of routine.
          </p>
          <p className="m-0 max-w-[68ch]">
            So Donna leads with <strong className="font-semibold">overvaluation</strong>: what
            comparable properties actually sold for, around the January 1 the assessment was
            measured on. The equity comparison is still run, still shown, and still useful in
            front of a local Board of Assessors — but it is offered as supporting material, with
            its burden stated, rather than as the headline ground.
          </p>
          <ul className="m-0 mt-1 flex list-none flex-col gap-2 p-0">
            {CASE_CITATIONS.map((citation) => (
              <li
                key={citation.cite}
                className="rounded-xl border border-lines bg-paper px-4 py-3 text-[0.94rem]"
              >
                <p className="m-0 font-semibold">{citation.cite}</p>
                <p className="m-0 mt-1 text-muted">{citation.held}</p>
              </li>
            ))}
          </ul>
          <p className="m-0 text-[0.88rem] text-muted">
            Legal facts in this tool were last checked against their sources on {FACTS_CHECKED}.
          </p>
        </div>
      </Section>

      <Section
        id="responsible"
        title="Responsible AI, by design"
        lede="These are not aspirations bolted onto a finished product. Each is a constraint the tool is built around, and each is visible in the interface."
        float="float-1"
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Information and preparation only" float="float-1">
            <p className="m-0">
              Donna explains what the law allows and prepares documents from public records. It
              never gives individualised legal advice, never represents anyone, and never claims
              to know what the assessors will decide.
            </p>
          </Card>
          <Card title="Uncertainty is shown, not hidden" float="float-2">
            <p className="m-0">
              Every estimate gives a range rather than a number, states how many comparables it
              rests on and how much they agree, and scores its own confidence. Below the minimum
              there is no verdict at all, only an honest shortfall. An assessment is called high
              only when it sits above the top of the range.
            </p>
          </Card>
          <Card title="Nothing is adjusted by an invented rate" float="float-3">
            <p className="m-0">
              The adjustments between a comparable sale and your property are measured from
              local sales by regression, and shown in dollars with the figures behind them. When
              the data cannot support a credible model, the tool says so and falls back to a
              simpler comparison rather than inventing a number.
            </p>
          </Card>
          <Card title="A human in the loop, with a path" float="float-4">
            <p className="m-0">
              A navigator or legal-aid clinic reviews the application before it is filed.
              That is a working feature, not a promise: the tool builds a reviewer summary, and
              a reviewer opens the case from a link that carries it. Complex cases — ownership
              questions, trusts, probate, hardship — go to an attorney.
            </p>
          </Card>
          <Card title="The homeowner decides and signs" float="float-1">
            <p className="m-0">
              Donna files nothing. It fills the official form but leaves the signature and the
              opinion of value blank, because the figure you are asking the city to accept has
              to be yours. You read, edit, sign and submit.
            </p>
          </Card>
          <Card title="Minimal data, kept in the browser" float="float-2">
            <p className="m-0">
              There is no account and no analytics. Searches run against public datasets; what
              you type is never stored, profiled or sent anywhere that identifies you. The
              records this tool ships carry no owner names.
            </p>
          </Card>
        </div>
      </Section>

      <Section
        id="limits"
        title="What it cannot do"
        lede="A tool that does not state its limits is asking to be trusted further than it deserves."
        float="float-2"
      >
        <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[0.97rem]">
          {[
            'It cannot see your building. Condition, damage, a finished basement that was never finished — only you or an inspector can confirm those.',
            'It carries recorded sales for one neighbourhood so far. Everywhere else in the city, the published records hold no sale prices, so only the weaker comparison can be run — and the tool says which you are getting.',
            'It does not know who owns the property in law, whether the tax has been paid, or whether a trust or an estate changes anything. All three can decide an appeal.',
            'It is not an appraisal, and no estimate here predicts what the assessors will do.',
            'It cannot file anything, extend a deadline, or speak to the city for you.',
          ].map((item) => (
            <li
              key={item}
              className="flex items-start gap-2.5 rounded-xl border border-lines bg-paper px-4 py-3"
            >
              <span
                aria-hidden="true"
                className="mt-[9px] h-[7px] w-[7px] shrink-0 rounded-full bg-[var(--warn)]"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="access"
        title="Reach and accessibility"
        lede="A remedy only reachable by someone with a screen, a keyboard, fluent English and broadband is not actually reachable by the people who need it most."
        float="float-3"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card title="Built for keyboards and screen readers" float="float-3">
            <p className="m-0">
              Semantic headings in order, a skip link as the first stop, visible focus rings on
              everything reachable, labels tied to every input, and live regions that announce
              results as they appear. The ticking countdown is hidden from screen readers, with
              a sentence beside it carrying the same fact.
            </p>
          </Card>
          <Card title="Readable in any condition" float="float-4">
            <p className="m-0">
              Text contrast meets WCAG 2.1 AA at 4.5:1 or better, nothing is signalled by colour
              alone — every state carries a word or an icon — motion is reduced when the system
              asks for it, and light and dark both follow the operating system until the reader
              says otherwise.
            </p>
          </Card>
          <Card title="Works on the device people have" float="float-1">
            <p className="m-0">
              Usable at 320 pixels wide and at 200% zoom, on an old phone, over a slow
              connection. Records load after the page does, so nothing waits on data it does not
              need yet. There is no app to install and nothing to log into.
            </p>
          </Card>
          <Card title="Plain language, no jargon tax" float="float-2">
            <p className="m-0">
              “Deemed denied”, “fair cash value” and “disproportionate assessment” are explained
              where they are used. Understanding the process should not require already
              understanding the process.
            </p>
          </Card>
        </div>

        <Note tone="brand" title="Next: reaching people who are not on this page" className="mt-5">
          <p className="m-0">
            The answers a resident most often needs — the deadline, the assessment, which
            exemptions exist — are written to fit in a text message, so they can be reached by
            phone rather than by browser. The content and the length limits are built; what is
            missing is a partner with a number to send them from. It will stay inside the same
            guardrails as everything else here: navigator-supervised, scripted to give
            information rather than argue a case, never authorised to file or settle anything,
            and always handing the decision back to the resident.
          </p>
        </Note>

        <div className="mt-5 flex flex-wrap gap-3">
          <ExternalLink href={LINKS.abatementGuide} className={btnSecondary}>
            How an abatement works
          </ExternalLink>
          <ExternalLink href={LINKS.atb} className={btnSecondary}>
            Appellate Tax Board
          </ExternalLink>
          <ExternalLink href={LINKS.analyzeBoston} className={btnSecondary}>
            The city’s assessment data
          </ExternalLink>
        </div>
      </Section>

      <section
        aria-labelledby="closing-h"
        className="float float-4 rounded-card border border-brand bg-brand-soft px-6 py-7"
      >
        <h2 id="closing-h" className="m-0 text-[1.45rem] sm:text-[1.7rem]">
          Who this is built for
        </h2>
        <blockquote className="m-0 mt-4 max-w-[60ch] border-l-4 border-brand pl-5">
          <p className="m-0 font-display text-[1.25rem] leading-snug sm:text-[1.5rem]">
            “Built for the homeowner who was never told this was possible. The one who is heard
            is the resident. The one who decides, signs, and keeps the last word is the
            resident.”
          </p>
        </blockquote>
        <p className="m-0 mt-4 max-w-[62ch] text-[0.96rem]">
          Not the appraiser they could not afford, and not the software. Donna does the
          arithmetic and the paperwork so a person can do the deciding.
        </p>
      </section>

      <Disclaimer />
    </div>
  )
}
