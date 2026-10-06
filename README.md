# Donna — Massachusetts Property Tax Tool

A free, client-side web tool that helps **Suffolk County, Massachusetts** homeowners find out
whether their home is over-assessed for property tax, understand the appeal process, track the
filing deadline, and prepare the abatement application themselves — with no appraiser and no
attorney, and with a person reviewing the work before anything is filed.

It is a public-interest tool. Its users are disproportionately people the current appeals system
underserves: low-income and Black/Latino owners, who are over-assessed more often and appeal less
often. Accessibility (WCAG 2.1 AA) and human-in-the-loop review are requirements here, not
nice-to-haves.

> **This is legal information, not legal advice.** Donna prepares documents and shows its
> arithmetic; it never represents anyone, never files anything, and never predicts an outcome.
> You must still pay your tax bill as billed to keep your right to appeal.

---

## Contents

- [Why this exists](#why-this-exists)
- [Quick start](#quick-start)
- [The five consoles](#the-five-consoles)
- [How the estimate works](#how-the-estimate-works)
- [Data](#data)
- [Legal facts the UI relies on](#legal-facts-the-ui-relies-on)
- [Responsible AI and privacy](#responsible-ai-and-privacy)
- [Accessibility](#accessibility)
- [Stack and architecture](#stack-and-architecture)
- [Project structure](#project-structure)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [Status and scope](#status-and-scope)

---

## Why this exists

A Massachusetts homeowner who believes their assessment is too high has a real, cheap remedy: an
abatement application to the local Board of Assessors, on a one-page state form, with no filing fee.
Very few people use it. The reasons are mundane rather than legal — the deadline is easy to miss, the
form asks for an opinion of value most owners have no way to form, and the evidence that actually
persuades assessors (a comparison against similar nearby homes) sits in public datasets that are
free but not usable.

Donna closes that gap. It finds the property in the public record, lays the assessment out line by
line, runs the comparison an assessor would recognise, shows every step of the arithmetic, counts
down to the deadline, and hands the owner a draft statement of case and a link to the official form.
The owner reads it, decides, signs, and files. Donna does none of those last four things.

---

## Quick start

**Prerequisites:** Node.js 20+ (developed on 24) and npm.

```bash
git clone https://github.com/MridhulSharma/donnataxtool.git
cd donnataxtool
npm install
npm run dev
```

The dev server runs at **http://127.0.0.1:5173/**.

> Use `127.0.0.1`, not `localhost`. On Windows, `localhost` resolves to `::1` first and Vite then
> binds IPv6 only, so anything reaching for `127.0.0.1` gets connection refused. `vite.config.ts`
> pins the IPv4 loopback for exactly this reason. Pass `--host` when you want it on the local
> network too — useful for checking the 320px layout on a real phone.

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload. |
| `npm run build` | `tsc -b` then a production build into `dist/`. |
| `npm run preview` | Serve the built `dist/` locally on port 4173. |
| `npm run lint` | oxlint across the project. |
| `npm run data` | Re-extract `src/data/local.json` from `02134.db` (see [Data](#data)). |

There is no backend, no database server, no API key and no environment file. A clean clone runs with
nothing but `npm install`.

### Routes

The app uses hash routing so it deploys as plain static files with no server rewrite rules.

| Route | Page |
| --- | --- |
| `#/` (default) | The tool — consoles 01 through 05. |
| `#/about` | How the method works, what the tool will not do, and the sources it cites. |

On a route change the document title updates and focus moves to the new `<h1>`, so a keyboard or
screen-reader user is told the page changed instead of being left parked where the old page ended.

---

## The five consoles

The tool page is one page, numbered **01–05** because it is a real sequence the homeowner moves
through. It opens on a worked example (3 Westford St, Allston) so it is never a blank form.

| # | Console | What it does |
| --- | --- | --- |
| 01 | **Find your property** | Address search over public assessment records. No account, nothing stored. |
| 02 | **Your assessment** | Assessed value, land/building split, living area, year built, parcel ID, residential exemption — laid out to check line by line against the tax bill. |
| 03 | **Over-assessment estimate** | The disproportionate-assessment comparison, with the verdict, the comp count, the full arithmetic, and the table of comparable homes actually used. |
| 04 | **Your filing deadline** | Live countdown to the next February 1, the dates that follow it, an `.ics` calendar export, and copyable deadline details. |
| 05 | **File your appeal** | Links to State Tax Form 128, the Board of Assessors, the abatement guide and the Appellate Tax Board, plus a draft statement of case generated from the figures above. |

---

## How the estimate works

`src/lib/assess.ts` implements the **disproportionate-assessment** method: not "my house isn't worth
that", but "my house is assessed at a higher share of its value than comparable houses are" — the one
ground a homeowner can document from public records alone, without an appraisal.

1. Comps come from the same source as the subject, and must have living area within **±25%**, year
   built within **±15 years** (only when both years are known), living area > 200 sq ft, total value
   > $10,000, and a different parcel ID.
2. At least **3 comps** are required. Fewer produces "not enough comparable data" — never a verdict.
3. `subjPsf = tv / la`, `medPsf = median(comp tv / comp la)`, `fair = medPsf × la`,
   `over = tv − fair`, `ratio = subjPsf / medPsf`.
4. Flagged as over-assessed only when `over > 0 && ratio > 1.05`. The 5% band keeps ordinary noise in
   the data from reading as a finding.
5. The division, the median, the proportionate value and the comps actually used are **always on
   screen**. An estimate the owner cannot check is worse than no estimate, because they would have to
   take it on trust in front of a board that will not.

The median is used rather than the mean so one mis-keyed parcel cannot move the result.

---

## Data

Every record, whichever source it came from, is normalised to `Property` in `src/lib/types.ts`:

```ts
{ pid, addr, la, yr, lv, bv, tv, gt, sp, sd, ex, o, lu, src }
//       ^living ^year ^land ^bldg ^total ^tax ^salePrice ^saleDate ^resExemption
```

**Embedded records.** Extracted at build time from `02134.db` into `src/data/local.json` by
`scripts/extract.mjs` (`npm run data`), using compact single-letter keys to keep the payload small.
The 40MB source database is a local input, not a repo artifact, so it is gitignored — but the
generated `src/data/local.json` **is** committed, which is what lets a clean clone and a CI build
work without the database present. You only need `npm run data` if you are changing the extraction
itself. `better-sqlite3` is a devDependency and never ships to the browser.

**Citywide records.** The Analyze Boston CKAN API, queried from the browser at runtime. Two things
make this fiddly, and both are handled defensively in `src/lib/live.ts`:

- The resource id changes every assessment year, so it is **discovered at runtime**
  (`package_show?id=property-assessment`, then the `datastore_active` resource whose name holds the
  highest 4-digit year) rather than hardcoded.
- Column names drift year to year (`PID` vs `PARCEL_ID`, `TOTAL_VALUE` vs `AV_TOTAL`, …), so every
  field is read through a list of candidate keys.

Every live call has a 12-second timeout and degrades to an empty result instead of throwing. An
outage at Analyze Boston must never blank out the rest of the page.

Both sources are presented to the user as one set of public records.

---

## Legal facts the UI relies on

- The remedy is an **abatement**, applied for on **State Tax Form 128**, filed with the local
  **Board of Assessors** — not a court, not the state.
- The deadline is the **due date of the first actual tax bill**, in Boston typically **February 1**,
  rolling to the next business day if it falls on a weekend or holiday. **Missing it forfeits appeal
  rights for that year**; there is no cure.
- Two grounds: **overvaluation** (assessed value exceeds fair cash value as of January 1) and
  **disproportionate assessment** (assessed at a higher percentage of fair cash value than comparable
  properties). Donna's estimate uses the second.
- The homeowner **must pay the tax as assessed**, on time, to preserve appeal rights. Applying for an
  abatement does not pause the bill.
- The assessors have **3 months** to act; if they do not, the application is **"deemed denied."**
- After denial, actual or deemed, the owner may petition the **Appellate Tax Board** within
  **3 months**. Its small-claims track costs roughly **$65**.
- Good evidence is **3–5 comparable sales from the last 6–12 months**.

These are load-bearing. They are not paraphrased into something weaker or stronger anywhere in the
UI, and no number, deadline or procedure appears in the product that is not on this list.

---

## Responsible AI and privacy

- Legal **information and document preparation only** — never individualised legal advice.
- **No outcome guarantees, ever.** Every estimate displays its comp count and its arithmetic and is
  labelled an estimate.
- A **navigator or clinic reviews** the application before filing; complex cases escalate to an
  attorney.
- **The homeowner makes and signs every decision.** Donna files nothing.
- **Minimal PII, client-side only, no account, no tracking.** Nothing a user types leaves their
  browser except the public-dataset queries described above. There is no analytics script, no cookie
  banner and no server to log anything — an address you search is matched against data already in the
  page, or sent only to Analyze Boston's public API.
- A persistent disclaimer appears on every page.

---

## Accessibility

Targeting **WCAG 2.1 AA**:

- Semantic HTML, exactly one `<h1>` per page, headings in logical order with no level skips.
- A skip-to-content link as the first focusable element.
- Full keyboard operation with visible `:focus-visible` rings. An outline is never removed without
  something replacing it.
- A `<label>` tied to every input (Radix `Label`, or `htmlFor`).
- `aria-live="polite"` on the search status line and on the result and verdict regions, so
  screen-reader users hear results that appear without a page change.
- Text contrast **≥ 4.5:1**, and **nothing is signalled by colour alone** — every state carries a word
  or an icon alongside the colour.
- Usable down to **320px** wide and at **200% zoom**.
- `prefers-reduced-motion` respected.
- Light/dark toggle that follows the OS setting until the reader chooses otherwise.

---

## Stack and architecture

Vite · React 19 · TypeScript · Tailwind CSS · Radix UI primitives. **Client-side only, no backend**,
deployable as static files.

Design tokens are CSS custom properties in `src/index.css`, surfaced to Tailwind in
`tailwind.config.js`. Components use the token names (`bg-surface`, `text-muted`, `border-lines`),
never raw hex. All three theme states must keep working: bare `:root` (light),
`@media (prefers-color-scheme: dark)` for the OS default, and `:root[data-theme='dark']` for an
explicit choice. Figures carry `.tnum` (tabular numerals) so columns align. Money and dates are
formatted only through `src/lib/format.ts`.

## Project structure

```
src/
  components/   Console, Fact, buttons, Note, Chip, TopBar, Disclaimer, ThemeToggle, Brand
  consoles/     01 FindProperty · 02 Assessment · 03 Estimate · 04 Deadline · 05 File
  pages/        ToolPage, AboutPage
  lib/          types        normalised Property shape, shared by both sources
                assess       the disproportionate-assessment comparison
                deadline     February-1 rollover and the countdown
                ics          calendar export for the deadline
                caseSummary  draft statement of case from the figures on screen
                search       address matching across both sources
                local        embedded records
                live         Analyze Boston CKAN client — discovery, defensive field reads
                format       the only place money and dates are formatted
                clipboard, useSubject, router, theme
  data/         local.json   generated by npm run data
scripts/        extract.mjs  02134.db -> src/data/local.json
```

---

## Deployment

`npm run build` emits static files to `dist/`. Deploy that directory to Vercel, Netlify, GitHub
Pages, Cloudflare Pages or any static host — there is no server, no database and no per-user cost.

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Output directory | `dist` |
| Install command | `npm install` |
| Node version | 20+ |

Routing is hash-based, so no SPA rewrite rule is needed. The only runtime network dependency is
`data.boston.gov`, and the app stays usable when it is unreachable.

---

## Contributing

Before changing anything that touches the numbers, the deadline or the disclaimers, read
`CLAUDE.md` — it carries the project's non-negotiables: the legal facts verbatim, the responsible-AI
guardrails, the accessibility rules, and the conventions for tokens, formatting and console
numbering. The short version:

- Do not invent numbers, deadlines or procedures that are not in the legal-facts list.
- Do not weaken or strengthen a legal fact by paraphrase.
- Never present a verdict on fewer than 3 comps.
- Never signal state by colour alone, and never remove a focus outline without replacing it.
- Use design tokens, not raw hex. Format money and dates only through `src/lib/format.ts`.
- Both data sources are presented as one seamless set of public records; UI copy never describes any
  record as "built in," "offline" or "bundled."

Run `npm run lint` and `npm run build` before opening a pull request.

---

## Status and scope

Suffolk County, Massachusetts — Boston assessment data. The abatement procedure described here is
Massachusetts state law (M.G.L. c. 59), but the deadline, the data source and the filing links are
Boston-specific, so treat the tool as scoped to Boston until a second municipality is wired in.

Donna is not affiliated with the City of Boston, the Board of Assessors, the Appellate Tax Board or
the Commonwealth of Massachusetts. It presents public records and public procedure, and it is not a
substitute for a lawyer.
