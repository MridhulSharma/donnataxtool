# Level — project instructions

Level is a free, client-facing web tool that helps **Suffolk County, Massachusetts**
homeowners find out if their home is over-assessed for property tax, understand the
appeal process, track the deadline, and file the abatement themselves — with no
appraiser and no attorney.

It is a **public-interest tool**. Its users are disproportionately people the current
appeals system underserves: low-income and Black/Latino owners, who are over-assessed
more often and appeal less often. Accessibility and human-in-the-loop review are
first-class requirements, not nice-to-haves.

---

## Legal facts — use these exactly

These are load-bearing. Do not paraphrase them into something weaker or stronger, and
do not invent numbers, deadlines, or procedures that are not on this list.

- **The remedy** is an **abatement**, applied for on **State Tax Form 128**, filed with
  the **local Board of Assessors** (not a court, not the state).
- **The deadline** is the **due date of the first actual tax bill**, which in Boston is
  **typically February 1**. If February 1 falls on a weekend or holiday it moves to the
  next business day. **Missing the deadline forfeits appeal rights for that year** —
  there is no cure.
- **Two grounds** for an abatement:
  1. **Overvaluation** — the assessed value exceeds fair cash value as of **January 1**.
  2. **Disproportionate assessment** — the property is assessed at a higher percentage of
     fair cash value than comparable properties. *This is the ground Level's estimate
     uses.*
- The homeowner **must pay the tax as assessed**, on time, to preserve appeal rights.
  Applying for an abatement does not pause the bill.
- The assessors have **3 months** to act. If they do not, the application is
  **"deemed denied."**
- After denial (actual or deemed), the owner may petition the **Appellate Tax Board**
  within **3 months**. The ATB small-claims track costs roughly **$65**.
- Good evidence is **3–5 comparable sales from the last 6–12 months**.

## Responsible-AI guardrails — bake these into the UI copy

- Level provides **legal information and document preparation only**. It never gives
  individualized legal advice.
- **No outcome guarantees, ever.** Every estimate must display its **comp count** and its
  **arithmetic**, and must be labeled an estimate.
- A **human navigator or clinic reviews** the application before filing. Complex cases
  escalate to an attorney.
- **The homeowner makes and signs every decision.** Level never files anything.
- **Minimal PII, client-side only, no account, no tracking.** Nothing a user types leaves
  their browser except the public-dataset queries described below.
- Persistent disclaimer, on every page:
  *"This is legal information, not legal advice … you must still pay your tax bill as
  billed to keep your right to appeal."*

## Accessibility rules (WCAG 2.1 AA — required, not optional)

- Semantic HTML. **Exactly one `<h1>` per page**, headings in logical order, no level skips.
- Skip-to-content link as the first focusable element.
- **Full keyboard operation** with visible `:focus-visible` rings. Never remove an outline
  without replacing it.
- Every input has a `<label>` tied to it (Radix `Label`, or `htmlFor`).
- `aria-live="polite"` on the search status line and on the result/verdict regions, so
  screen-reader users hear results that appear without a page change.
- Contrast **≥ 4.5:1** for text. **Never signal anything by color alone** — always pair a
  color with a word or an icon.
- Usable down to **320px** wide and at **200% zoom**.
- `prefers-reduced-motion` respected. Light/dark toggle, and the CSS must honor the OS
  setting when the user has not chosen.

---

## Architecture

Vite + React + TypeScript + Tailwind, **client-side only, no backend**. Radix UI for
accessible primitives. Deployable as static files (Vercel/Netlify).

### Two data sources, one shape

Every property, from either source, is normalized to `Property` in `src/lib/types.ts`:

```ts
{ pid, addr, la, yr, lv, bv, tv, gt, sp, sd, ex, o, lu, src }
//       ^living ^year ^land ^bldg ^total ^tax ^salePrice ^saleDate ^resExemption
```

1. **`local`** — records extracted at build time from `02134.db` into
   `src/data/local.json` by `scripts/extract.mjs` (`npm run data`). Compact keys
   `{p,a,la,yr,lv,bv,tv,gt,sp,sd,ex,o,lu}` to keep the payload small.
2. **`live`** — the Analyze Boston CKAN API, queried at runtime from the browser.
   The dataset id is **discovered, never hardcoded** (`package_show?id=property-assessment`,
   then the `datastore_active` resource whose name holds the highest 4-digit year).
   Field names change year to year, so every field is read defensively through a
   list of candidate keys. All fetches are wrapped and **degrade gracefully** — a live
   failure must never blank out the local results.

**UI copy must never reveal that some records are "built in."** Both sources are
presented as one seamless set of public records. Do not add copy like "offline data" or
"bundled records."

### The over-assessment algorithm (`src/lib/assess.ts`)

Disproportionate-assessment method — compare the subject's assessed $/sq ft against the
median of comparable homes:

1. Comps come from the **same source** as the subject, and must have `la > 200`,
   `tv > 10000`, a different `pid`, living area **within ±25%** of the subject, and year
   built **within ±15 years** (only when both years are known).
2. **Require ≥ 3 comps.** Fewer means "not enough comparable data" — never a verdict.
3. `subjPsf = tv / la`; `medPsf = median(comp tv / comp la)`; `fair = medPsf × la`;
   `over = tv − fair`; `ratio = subjPsf / medPsf`.
4. Flag as over-assessed only when `over > 0 && ratio > 1.05`.
5. **Always show the work** — the division, the median, the proportionate value, and the
   table of comps actually used.

---

## Conventions

- Design tokens are CSS custom properties in `src/index.css`, surfaced to Tailwind in
  `tailwind.config.js`. **Use the token names** (`bg-surface`, `text-muted`, `border-lines`),
  never raw hex in components.
- All three theme states must keep working: bare `:root` (light),
  `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) }`, and
  `:root[data-theme='dark']`.
- Figures get `.tnum` (tabular numerals) so columns align.
- The five consoles on the Tool page are numbered **01–05** because they are a real
  sequence the user moves through. Keep the numbering if you add or reorder them.
- Money and dates are formatted only through `src/lib/format.ts`.
