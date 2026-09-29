# Donna — Massachusetts Property Tax Tool

A free, client-side web tool that helps **Suffolk County, Massachusetts** homeowners find out
whether their home is over-assessed for property tax, understand the appeal process, track the
filing deadline, and prepare the abatement application themselves — with no appraiser and no
attorney, and with a person reviewing the work before anything is filed.

It is a public-interest tool. Its users are disproportionately people the current appeals system
underserves, so accessibility (WCAG 2.1 AA) and human-in-the-loop review are requirements, not
nice-to-haves.

> This is legal information, not legal advice. Donna prepares documents and shows its arithmetic; it
> never represents anyone, never files anything, and never predicts an outcome. You must still pay
> your tax bill as billed to keep your right to appeal.

---

## Quick start

```bash
npm install
npm run dev        # dev server on http://localhost:5173
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload. |
| `npm run build` | `tsc -b` then a production build into `dist/`. |
| `npm run preview` | Serve the built `dist/` locally. |
| `npm run lint` | oxlint across the project. |
| `npm run data` | Re-extract `src/data/local.json` from `02134.db` (see below). |

The output of `npm run build` is static files. Deploy `dist/` to Vercel, Netlify, GitHub Pages, or
any static host — there is no server, no database, and no per-user cost.

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

## How the estimate works

`src/lib/assess.ts` implements the **disproportionate-assessment** method: not "my house isn't worth
that", but "my house is assessed at a higher share of its value than comparable houses are" — the
one ground a homeowner can document from public records alone.

1. Comps come from the same source as the subject, and must have living area within **±25%**, year
   built within **±15 years** (only when both years are known), living area > 200 sq ft, total value
   > $10,000, and a different parcel ID.
2. At least **3 comps** are required. Fewer produces "not enough comparable data" — never a verdict.
3. `subjPsf = tv / la`, `medPsf = median(comp tv / comp la)`, `fair = medPsf × la`,
   `over = tv − fair`, `ratio = subjPsf / medPsf`.
4. Flagged as over-assessed only when `over > 0 && ratio > 1.05`.
5. The division, the median, the proportionate value and the comps used are **always on screen**.

## Data

Every record, whichever source it came from, is normalised to `Property` in `src/lib/types.ts`.

- **Embedded records** — extracted at build time from `02134.db` into `src/data/local.json` by
  `scripts/extract.mjs` (`npm run data`), using compact keys to keep the payload small.
- **Citywide records** — the Analyze Boston CKAN API, queried from the browser at runtime. The
  dataset id is discovered rather than hardcoded, every field is read through a list of candidate
  column names because they drift year to year, and every fetch degrades gracefully: a live outage
  never blanks out the rest of the page.

Both are presented to the user as one set of public records.

## Legal facts the UI relies on

- The remedy is an **abatement**, applied for on **State Tax Form 128**, filed with the local
  **Board of Assessors** — not a court, not the state.
- The deadline is the **due date of the first actual tax bill**, in Boston typically **February 1**,
  rolling to the next business day if it falls on a weekend. **Missing it forfeits appeal rights for
  that year**; there is no cure.
- Two grounds: **overvaluation** (assessed value exceeds fair cash value as of January 1) and
  **disproportionate assessment** (assessed at a higher percentage of fair cash value than
  comparable properties). Donna's estimate uses the second.
- The homeowner **must pay the tax as assessed**, on time, to preserve appeal rights. Filing does
  not pause the bill.
- The assessors have **3 months** to act; if they do not, the application is **"deemed denied"**.
- After denial, actual or deemed, the owner may petition the **Appellate Tax Board** within
  **3 months**. Its small-claims track costs roughly **$65**.
- Good evidence is **3–5 comparable sales from the last 6–12 months**.

## Responsible AI and privacy

- Legal **information and document preparation only** — never individualised legal advice.
- **No outcome guarantees.** Every estimate shows its comp count and its arithmetic and is labelled
  an estimate.
- A **navigator or clinic reviews** the application before filing; complex cases escalate to an
  attorney.
- **The homeowner makes and signs every decision.** Donna files nothing.
- **Minimal PII, client-side only, no account, no tracking.** Nothing a user types leaves their
  browser except the public-dataset queries above.

## Accessibility

Semantic HTML with exactly one `<h1>` per page and no heading-level skips; a skip-to-content link as
the first focusable element; full keyboard operation with visible `:focus-visible` rings; a `<label>`
tied to every input; `aria-live` on the search status and on the result and verdict regions; text
contrast ≥ 4.5:1; nothing signalled by colour alone — every state carries a word or an icon; usable
at 320px wide and 200% zoom; `prefers-reduced-motion` respected; light/dark toggle that follows the
OS until the reader chooses.

## Stack

Vite · React 19 · TypeScript · Tailwind CSS · Radix UI primitives. Client-side only, no backend.
Design tokens are CSS custom properties in `src/index.css`, surfaced to Tailwind in
`tailwind.config.js` — components use the token names (`bg-surface`, `text-muted`, `border-lines`),
never raw hex. Money and dates are formatted only through `src/lib/format.ts`.

```
src/
  components/   Console, Fact, buttons, Note, Chip, TopBar, Disclaimer, ThemeToggle, Brand
  consoles/     01 FindProperty · 02 Assessment · 03 Estimate · 04 Deadline · 05 File
  pages/        ToolPage, AboutPage
  lib/          types, assess, deadline, ics, caseSummary, search, local, live, format,
                clipboard, useSubject, router, theme
  data/         local.json (generated by npm run data)
scripts/        extract.mjs
```
