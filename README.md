# Donna — Boston Property Tax Tool

A free, client-side web tool that helps **Boston homeowners** find out whether their property
is assessed above what it is worth, work out which ground to argue, hold the deadlines, and
prepare the abatement application themselves — with no appraiser, no attorney, and a person
reviewing the work before anything is filed.

It is a public-interest tool. Its users are disproportionately people the current appeals
system underserves: low-income and Black/Latino owners, who are over-assessed more often and
appeal less often. Accessibility and human-in-the-loop review are requirements here, not
nice-to-haves.

> **This is legal information, not legal advice.** Donna prepares documents and shows its
> arithmetic; it never represents anyone, never files anything, and never predicts an outcome.
> You must still pay your tax bill as billed to keep your right to appeal.

---

## Contents

- [Why this exists](#why-this-exists)
- [Quick start](#quick-start)
- [The eight consoles](#the-eight-consoles)
- [How the valuation works](#how-the-valuation-works)
- [Why the ground matters](#why-the-ground-matters)
- [Data](#data)
- [Legal facts](#legal-facts)
- [Responsible AI and privacy](#responsible-ai-and-privacy)
- [Accessibility](#accessibility)
- [Stack and architecture](#stack-and-architecture)
- [Project structure](#project-structure)
- [Configuration](#configuration)
- [Testing](#testing)
- [Keeping the data current](#keeping-the-data-current)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [Status and scope](#status-and-scope)

---

## Why this exists

A Massachusetts homeowner who believes their assessment is too high has a real, cheap remedy:
an abatement application to the local Board of Assessors, on a one-page state form, with no
filing fee. Very few people use it. The reasons are mundane rather than legal — the deadline
is easy to miss, the form asks for an opinion of value most owners have no way to form, and
the evidence that actually persuades assessors sits in public datasets that are free but not
usable.

Donna closes that gap. It finds the property, lays the record out line by line and questions
it, asks which ground fits, values the property against what comparable homes actually sold
for, counts down to the deadline in Boston's own clock, fills the official form, and hands the
case to a navigator to check. The owner reads it, decides, signs, and files. Donna does none
of those last four things.

---

## Quick start

**Prerequisites:** Node.js **22.5 or later** (the data script uses the built-in `node:sqlite`)
and npm.

```bash
git clone https://github.com/MridhulSharma/donnataxtool.git
cd donnataxtool
npm install
npm run dev
```

The dev server runs at **http://127.0.0.1:5173/**.

> Use `127.0.0.1`, not `localhost`. On Windows, `localhost` resolves to `::1` first and Vite
> then binds IPv6 only, so anything reaching for `127.0.0.1` gets connection refused.
> `vite.config.ts` pins the IPv4 loopback for exactly this reason. Pass `--host` when you want
> it on the local network too — useful for checking the 320px layout on a real phone.

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload. |
| `npm run build` | `tsc -b` then a production build into `dist/`. |
| `npm run preview` | Serve the built `dist/` locally on port 4173. |
| `npm run lint` | oxlint across the project. |
| `npm test` | The full test suite, once. |
| `npm run test:watch` | The suite in watch mode. |
| `npm run data` | Re-extract `src/data/*.json` from `02134.db` (see [Data](#data)). |
| `npm run check:source` | Check the city's published data for a new fiscal year or a renamed column. |

There is no backend, no database server, no API key and no environment file. A clean clone
runs with nothing but `npm install`.

### Routes

Hash routing, so it deploys as plain static files with no server rewrite rules.

| Route | Page |
| --- | --- |
| `#/` (default) | The tool — consoles 01 through 08. |
| `#/about` | How the method works, what the tool will not do, and its sources. |
| `#/review/<case>` | The reviewer's view. A navigator opens a case from a link that carries it. |

On a route change the document title updates and focus moves to the new `<h1>`, so a keyboard
or screen-reader user is told the page changed.

---

## The eight consoles

| # | Console | What it does |
| --- | --- | --- |
| 01 | **Find your property** | Address search over public assessment records. No account, nothing stored. |
| 02 | **What the city has on record** | Value, splits, floor area, lot, condition, year built, remodel, exemption status and six years of assessment history — every figure labelled with its fiscal year. Then it questions the record against permits and against other properties of the same type. |
| 03 | **Your situation** | Five optional questions that decide which ground the application argues, and a ranking of the grounds with what each would need. |
| 04 | **What your property is worth** | The sales comparison, with every adjustment in dollars, a range, and a confidence level. The equity comparison follows as supporting material. |
| 05 | **Exemptions you may be owed** | A separate application with its own April deadline, often worth more than an abatement. |
| 06 | **Your filing deadline** | Countdown in Boston time to the 5:00 pm cut-off, the dates that follow a filing, and a calendar export. |
| 07 | **Prepare your application** | The official Form 128 filled in the browser, an evidence packet, the statement of case, and the referral to a navigator. |
| 08 | **Track your case** | The deemed-denial date and the Appellate Tax Board deadline, counted from the day you actually filed. |

---

## How the valuation works

`src/lib/valuation.ts` implements a **sales comparison**, because an abatement turns on fair
cash value as of January 1 before the fiscal year, and what comparable properties sold for is
the evidence that answers it.

1. **Screen the transfers.** Nominal transfers, foreclosure deeds, master deeds and
   confirmatory deeds are recorded as sales but none is an open-market price. Each exclusion
   carries its reason, and the interface will show them.
2. **Measure the adjustments, never invent them.** A regression over local sales of the same
   property type estimates a market trend, a floor-area elasticity, and age and condition
   effects. It is used only if it is credible: at least 30 sales, enough explained variance,
   and coefficients inside bands a valuer would accept. Otherwise the tool falls back to a
   two-parameter time trend plus price per square foot — and says so on screen.
3. **Select comparables.** Same land-use class, same area measurement, within ±25% floor area,
   ±15 years, one mile, sold within a widening window of 12 to 48 months before the valuation
   date. One sale per parcel. At least 3, or there is no estimate.
4. **Adjust each sale** to the subject and to the valuation date, showing every adjustment in
   dollars beside the figures behind it.
5. **Report a range.** The indicated value is the median of the adjusted sales, with the
   interquartile range around it. The assessment is called high **only when it sits above the
   top of that range**.

`src/lib/confidence.ts` scores every estimate on the same four questions: how much evidence,
how consistent, how close, how recent.

---

## Why the ground matters

This is the part most property-tax tools get wrong.

It is tempting to build around the comparison that is easy to compute: assessed value per
square foot against the neighbours. That argues **disproportionate assessment** — and in
Massachusetts the taxpayer must prove an **intentional, widespread scheme** of assessing other
property at a lower share of value. The Appellate Tax Board rejects applications resting on a
handful of neighbours' assessed values as a matter of routine:

- *Frost v. Assessors of Burlington* (ATB 2007) — evidence of the assessed values of a handful
  of nearby properties "fell well short".
- *Eaton v. Assessors of Acton* (ATB 2025) — no intentional scheme established, and no
  comparable sales offered.
- *Brown v. Assessors of Brookline* (Mass. App. Ct. 1997) — a threshold showing of a deliberate
  scheme is required.

So Donna leads with **overvaluation**, argued with sales. The equity comparison is still run
and still shown — it can persuade a local Board of Assessors, and where no sales exist it is
the only check available — but it is presented as supporting material with its burden stated,
and the drafted statement never heads with it unless the evidence points there.

---

## Data

Every record, whichever source it came from, is normalised to `Property` in
`src/lib/types.ts`, and carries the **fiscal year** it belongs to and which **area
measurement** it holds.

**Local records.** `scripts/extract.mjs` (`npm run data`) reads `02134.db` and writes three
payloads into `src/data/`, each imported dynamically so the first paint waits for none of them:

| File | Holds | Loaded when |
| --- | --- | --- |
| `parcels.json` | one row per parcel: value, area, class, condition, lot, parcel centroid | the app starts |
| `sales.json` | recorded transfers, screened for arm's length with the reason kept | a valuation runs |
| `details.json` | assessment history and recent permits | a property is opened |

The extract **reads its fiscal year** from `assessment_history` and refuses to run if
`parcel.total_value` does not agree with it, because shipping last year's values under this
year's label would send people to file against the wrong assessment. It ships **no owner
names**. The 40MB source database is a local input, not a repo artifact, so it is gitignored —
the generated payloads are committed, which is what lets a clean clone and a CI build work
without it.

**Citywide records.** The Analyze Boston CKAN API, queried from the browser at runtime
(`src/lib/ckan.ts`). Three things make this fiddly, and all are handled defensively:

- The resource id changes every assessment year, so it is **discovered at runtime** and cached
  for a day.
- Column names drift year to year (`PID` vs `PARCEL_ID`, `TOTAL_VALUE` vs `AV_TOTAL`, and one
  year shipped `LIVING _AREA` with a stray space), so keys are normalised and every field is
  read through an alias list, with a pattern for year-stamped columns (`src/lib/fields.ts`).
- A comparable cohort is fetched **whole, paged, and filtered server-side to the subject's
  land-use class**. A truncated cohort is biased rather than small: row order follows the
  parcel id, which runs ward by ward, so a first page silently compares a home against one
  corner of its ZIP.

The citywide extract carries **no sale prices**, so outside the ZIPs in `parcels.json` only the
equity comparison can run — and the interface says which one you are getting.

---

## Legal facts

`src/lib/legal.ts` is the only source of them. Nothing in the UI states a deadline, fee, ground
or procedure that is not in that file, and each carries its source and the date it was checked.

- The remedy is an **abatement**, on **State Tax Form 128**, filed with the local **Board of
  Assessors**.
- The deadline is the **due date of the first actual tax bill**, in Boston typically
  **February 1**, rolling to the next business day, with a **5:00 pm** cut-off at City Hall,
  **in Boston time**. Missing it forfeits appeal rights for the year, with no cure.
- The homeowner **must pay the tax as assessed**, on time, to preserve appeal rights.
- The assessors have **3 months from the day the application was filed** to act; if they do
  not, it is **deemed denied** on that date. The owner then has **3 months from the denial**,
  actual or deemed, to petition the **Appellate Tax Board**. Both limits are jurisdictional.
- The **ATB entry fee is set by assessed value**: $10 up to $20,000; $50 to $100,000; $100 to
  $999,999; $0.10 per $1,000 above $1,000,000, capped at $5,000. The widely repeated "$65 small
  claims" figure is not a taxpayer fee — it is what a *municipality* pays to transfer an appeal
  to the formal procedure.
- **Exemptions** are a separate application with an **April 1** deadline in Boston.
- Good evidence is **3–5 comparable sales from the last 6–12 months**.

---

## Responsible AI and privacy

- Legal **information and document preparation only** — never individualised legal advice.
- **No outcome guarantees.** Every estimate gives a range, its comparable count, how much they
  agree, and its confidence. Below the minimum there is no verdict, only an honest shortfall.
- **Nothing is adjusted by an invented rate.** Adjustments are measured from local sales and
  shown in dollars; when the data cannot support a credible model the tool says so.
- **A navigator or clinic reviews** the application before filing — and the product provides
  that path (`src/lib/referral.ts`, `#/review`) rather than merely claiming it.
- **The homeowner decides and signs.** Donna fills the form but leaves the signature and the
  opinion of value blank, and files nothing.
- **Minimal PII, client-side only, no account, no tracking.** Nothing a user types leaves the
  browser except the public-dataset queries described above. No analytics, no cookie banner,
  no server to log anything, and no owner names in the shipped data.
- A persistent disclaimer on every page.

---

## Accessibility

Targeting **WCAG 2.1 AA**:

- Semantic HTML, exactly one `<h1>` per page, headings in order with no level skips.
- A skip-to-content link as the first focusable element.
- Full keyboard operation with visible `:focus-visible` rings.
- A `<label>` tied to every input.
- `aria-live="polite"` on the search status line and on result and verdict regions. The
  per-second countdown is `aria-hidden`, with a sentence beside it carrying the same fact.
- Text contrast **≥ 4.5:1**, and **nothing signalled by colour alone**.
- Usable down to **320px** wide and at **200% zoom**.
- `prefers-reduced-motion` respected; light/dark follows the OS until the reader chooses.

---

## Stack and architecture

Vite · React 19 · TypeScript · Tailwind CSS · Radix UI primitives · pdf-lib. **Client-side
only, no backend**, deployable as static files.

Data payloads and the PDF library are loaded on demand, so the first paint carries only the
app. Design tokens are CSS custom properties in `src/index.css`, surfaced to Tailwind in
`tailwind.config.js`; components use the token names, never raw hex. Money, numbers and dates
are formatted only through `src/lib/format.ts`, and dates are `CalendarDay` values rather than
timestamps so nothing drifts across a time zone.

## Project structure

```
src/
  components/   Console, Fact, buttons, Note, Chip, ConfidenceBadge, RangeBar, TopBar, Disclaimer
  consoles/     01 FindProperty · 02 Assessment · 03 Triage · 04 Estimate
                05 Exemptions · 06 Deadline · 07 File · 08 Track
  pages/        ToolPage, AboutPage, ReviewPage
  data/         generated payloads + the loader that fetches them on demand
  lib/          legal        every deadline, fee and ground, with its source
                types        the normalised Property shape
                valuation    the sales comparison, and the regression behind it
                assess       the equity comparison, supporting material only
                confidence   how much weight an estimate can carry
                stats        median, quantiles, dispersion, PRD, least squares, distance
                recordCheck  questions about the city's record of the property
                triage       which ground fits
                exemptions   the separate relief, and its separate deadline
                deadline     Boston-time dates, counted from the filing date
                caseTrack    the case after it is filed, kept in the browser
                packet       the filled Form 128 and the evidence behind it
                caseSummary  the statement of case, by ground
                referral     the hand-off to a navigator
                outreach     answers sized for a text message
                ckan/fields  the citywide client, and the column drift it survives
                live/local/search/format/ics/clipboard/router/theme
scripts/        extract.mjs       02134.db -> src/data/*.json
                check-source.mjs  watches the city's data for drift
```

---

## Configuration

Optional, set at build time. A clinic can run its own copy without touching the code.

| Variable | Effect |
| --- | --- |
| `VITE_NAVIGATOR_EMAIL` | Where the referral button sends the case. Without it the tool offers the summary to copy instead of pretending there is somewhere to send it. |
| `VITE_NAVIGATOR_NAME` | How that partner is named in the interface. |

---

## Testing

```bash
npm test
```

Unit tests run in node; the ones that mount the whole app ask for a DOM with a
`@vitest-environment happy-dom` comment. The suite covers the things that would be most
damaging to get wrong: the statutory dates and their month arithmetic, the fee schedule, the
screening of transfers, the regression recovering coefficients it was given, comparables
staying inside their property class, the filled Form 128 reading back with the right values in
the right fields, and the app rendering against the real data payloads.

---

## Keeping the data current

Boston publishes a new assessment table each December, and column names drift between years.
Either change leaves the app looking right and being wrong, so:

```bash
npm run check:source
```

reports a newer published fiscal year than the one this build ships, and any column it can no
longer find under a known spelling. `.github/workflows/check-source.yml` runs it weekly and
opens an issue when something needs a person.

**Before each filing season:** re-run `npm run data` against the new database and commit the
payloads in `src/data/`.

---

## Deployment

`npm run build` emits static files to `dist/`. Deploy that directory to any static host —
there is no server, no database and no per-user cost.

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Output directory | `dist` |
| Install command | `npm ci` |
| Node version | 22.5+ |

Routing is hash-based, so no SPA rewrite rule is needed. The only runtime network dependency is
`data.boston.gov`, and the app stays usable when it is unreachable.

GitHub Pages serves a project site from `/<repo>/`, so `vite.config.ts` sets `base` to match
the repository name. **Rename the repository and that has to change with it.**

---

## Contributing

Before changing anything that touches the numbers, the deadlines or the disclaimers, read
`CLAUDE.md` — it carries the project's non-negotiables. The short version:

- Legal facts live in `src/lib/legal.ts`. Do not state one that is not there.
- Dates after a filing are counted from the **filing date**, never from February 1.
- Never present disproportionate assessment as the easy ground.
- Comparables stay inside one land-use class, and living area is never mixed with gross area.
- A finding is a **range**; flag an assessment only above the top of it.
- Every figure shown carries its fiscal year.
- Never signal state by colour alone, and never remove a focus outline without replacing it.
- Use design tokens, not raw hex. Format through `src/lib/format.ts`.

`npm run lint`, `npm test` and `npm run build` must pass before opening a pull request.

---

## Status and scope

Boston, Massachusetts. The abatement procedure is Massachusetts state law (M.G.L. c. 59), but
the deadline, the data source and the filing links are Boston-specific, so treat the tool as
scoped to Boston until a second municipality is wired in. Recorded sales are currently held for
Allston (02134); everywhere else in the city the citywide records carry no sale prices, so only
the equity comparison runs, and the interface says so.

Donna is not affiliated with the City of Boston, the Board of Assessors, the Appellate Tax
Board or the Commonwealth of Massachusetts. It presents public records and public procedure,
and it is not a substitute for a lawyer.
