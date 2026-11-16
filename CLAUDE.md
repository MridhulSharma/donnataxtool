# Donna — project instructions

Donna is a free, client-facing web tool that helps **Boston, Massachusetts**
homeowners find out whether their property is assessed above its fair cash value,
understand which ground to argue, track the deadlines, and prepare the abatement
themselves — with no appraiser and no attorney.

It is a **public-interest tool**. Its users are disproportionately people the current
appeals system underserves: low-income and Black/Latino owners, who are over-assessed
more often and appeal less often. Accessibility and human-in-the-loop review are
first-class requirements, not nice-to-haves.

---

## Legal facts — `src/lib/legal.ts` is the only source

Every deadline, fee, ground and procedure the UI states must come from
`src/lib/legal.ts`. Do not hardcode one anywhere else, and do not state one that is
not in that file. Each figure there carries its source; `FACTS_CHECKED` records when
they were last verified.

The facts that most often get stated wrongly, and the correct version:

- **The remedy** is an **abatement**, applied for on **State Tax Form 128**, filed with
  the **local Board of Assessors** (not a court, not the state).
- **The filing deadline** is the **due date of the first actual tax bill**, in Boston
  typically **February 1**, rolling to the next business day when it falls on a weekend.
  Boston has used a **5:00 pm cut-off** at City Hall on that day. Missing it forfeits
  appeal rights for the year, and there is no cure. All of this is **Boston time**:
  never render it in the reader's own zone.
- **Two grounds matter, and they are not equally winnable.**
  1. **Overvaluation** — the assessed value exceeds fair cash value as of **January 1**
     before the fiscal year. *This is the ground the tool leads with.* It is argued with
     comparable **sales**.
  2. **Disproportionate assessment** — Massachusetts requires proof of an **intentional,
     widespread scheme** of assessing other property at a lower share of value. The
     Appellate Tax Board routinely rejects applications resting on the assessed values of
     a few neighbours (*Frost v. Burlington*, *Eaton v. Acton*, *Brown v. Brookline*).
     **Never present it as the easy ground a homeowner can document from public records.**
     It is offered as supporting material for a local board, with its burden stated.
- The homeowner **must pay the tax as assessed**, on time, to preserve appeal rights.
- **The dates after filing run from the FILING DATE, not from February 1.** The assessors
  have **3 months from the day the application was filed** to act; if they do not, it is
  **"deemed denied"** on that date. The owner then has **3 months from the denial**,
  actual or deemed, to petition the **Appellate Tax Board**. Both limits are
  **jurisdictional**. Never compute them from the deadline when a filing date is known,
  and never show them as fixed dates before one is.
- **The ATB entry fee is set by assessed value**: $10 up to $20,000; $50 to $100,000;
  $100 to $999,999; $0.10 per $1,000 above $1,000,000, capped at $5,000. The widely
  repeated **"$65 small claims" figure is wrong** — that is what a *municipality* pays to
  transfer an appeal to the formal procedure. Use `atbEntryFee()`.
- **Exemptions are a separate application** with a different deadline (**April 1** in
  Boston) and are often worth more than an abatement. They are not an abatement ground.
- Good evidence is **3–5 comparable sales from the last 6–12 months**, as close as
  possible to the January 1 valuation date.

## Responsible-AI guardrails — bake these into the UI copy

- Donna provides **legal information and document preparation only**. It never gives
  individualized legal advice.
- **No outcome guarantees, ever.** Every estimate shows its **comparable count**, its
  **range**, its **confidence** and its **arithmetic**, and is labelled an estimate.
- **Every figure carries its fiscal year.** An application filed against the wrong
  year's value is wasted. Never show an assessed value without saying which year it is
  and which January 1 it was measured on.
- **A finding is a range, not a number.** Flag an assessment as high only when it sits
  **above the top** of the range the evidence supports.
- A **human navigator or clinic reviews** the application before filing, and the
  product must actually provide that path (`src/lib/referral.ts`, `#/review`), not
  merely claim it. Complex cases escalate to an attorney.
- **The homeowner makes and signs every decision.** Donna files nothing. The signature
  and the opinion of value are left blank on the form.
- **Minimal PII, client-side only, no account, no tracking.** Nothing a user types
  leaves their browser. Owner names are not shipped in the data payload.
- Persistent disclaimer on every page: *"This is legal information, not legal advice …
  you must still pay your tax bill as billed to keep your right to appeal."*

## Accessibility rules (WCAG 2.1 AA — required, not optional)

- Semantic HTML. **Exactly one `<h1>` per page**, headings in logical order, no level skips.
- Skip-to-content link as the first focusable element.
- **Full keyboard operation** with visible `:focus-visible` rings. Never remove an outline
  without replacing it.
- Every input has a `<label>` tied to it (Radix `Label`, or `htmlFor`).
- `aria-live="polite"` on the search status line and on result and verdict regions, so
  screen-reader users hear results that appear without a page change. A per-second
  countdown is `aria-hidden`, with a sentence beside it carrying the same fact.
- Contrast **≥ 4.5:1** for text. **Never signal anything by colour alone** — always pair a
  colour with a word or an icon.
- Usable down to **320px** wide and at **200% zoom**.
- `prefers-reduced-motion` respected. Light/dark toggle, and the CSS must honour the OS
  setting when the user has not chosen.

---

## Architecture

Vite + React + TypeScript + Tailwind, **client-side only, no backend**. Radix UI for
accessible primitives. Deployable as static files. Node **22.5+** (the data script uses
the built-in `node:sqlite`).

### Data

`scripts/extract.mjs` (`npm run data`) reads `02134.db` and writes three payloads into
`src/data/`, each imported dynamically so the first paint waits for none of them:

| File | Holds | Loaded when |
| --- | --- | --- |
| `parcels.json` | one record per parcel: value, area, class, condition, lot, centroid | the app starts |
| `sales.json` | recorded transfers, screened for arm's length | a valuation runs |
| `details.json` | assessment history and permits | a property is opened |

The extract **reads its fiscal year** from `assessment_history` and refuses to run if
`parcel.total_value` does not agree with it. It ships **no owner names**.

The citywide source is the Analyze Boston CKAN API (`src/lib/ckan.ts`). The resource id
is **discovered, never hardcoded**; column names drift year to year so every field is
read through an alias list and, for year-stamped columns, a pattern (`src/lib/fields.ts`).
A comparable cohort is fetched **whole, paged, and filtered server-side to the subject's
land-use class** — a truncated cohort is biased, not merely small, because row order
follows parcel id and so runs ward by ward.

Both sources are normalised to `Property` in `src/lib/types.ts`. Every record carries its
`fy` and its `areaSrc`.

### The two comparisons

**`src/lib/valuation.ts` — sales comparison. This is the one that leads.** Adjustments
are *measured from local sales by regression*, never invented: a time trend, a floor-area
elasticity, age and condition. The model is used only if it is credible (enough sales,
enough explained variance, coefficients inside bands a valuer would accept); otherwise it
falls back to a two-parameter time trend plus price per square foot, and says so. The
output is a **range**, and the assessment is called high only above the top of it.

**`src/lib/assess.ts` — equity comparison. Supporting material only.** Comparables must be
the **same land-use class**, the **same area measurement**, within ±25% area, ±15 years
and 1 mile. Minimum 5. Flagged only above the top of the range *and* past a 1.1 ratio.
Mixing classes once flagged a third of a whole neighbourhood; do not undo that.

### Conventions

- Design tokens are CSS custom properties in `src/index.css`, surfaced to Tailwind in
  `tailwind.config.js`. **Use the token names** (`bg-surface`, `text-muted`,
  `border-lines`), never raw hex in components.
- All three theme states must keep working: bare `:root` (light),
  `@media (prefers-color-scheme: dark)`, and `:root[data-theme='dark']`.
- Figures get `.tnum` (tabular numerals) so columns align.
- Money, dates and numbers are formatted only through `src/lib/format.ts`. Dates are
  `CalendarDay` values, never timestamps, so nothing drifts across a time zone.
- The consoles on the Tool page are numbered **01–08** because they are a real sequence
  the user moves through. Keep the numbering if you add or reorder them.
- `npm run lint`, `npm test` and `npm run build` must all pass before a pull request.

### What the UI must not claim

- Do not describe the local records as "built in", "offline" or "bundled", and do not
  present them as covering the whole city. They cover the ZIPs in `parcels.json`;
  everything else comes from the citywide records, which carry **no sale prices**. Say
  which is which rather than implying a sales comparison was run when it was not.
- Do not promise a human review the build cannot deliver.
