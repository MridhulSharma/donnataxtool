/**
 * Persistent on every page. The wording is load-bearing: Level provides legal
 * information and document preparation, and the tax bill must still be paid.
 */
export function Disclaimer() {
  return (
    <aside
      aria-label="Legal disclaimer"
      className="rounded-card border border-[var(--warn)] bg-[var(--warn-soft)] px-5 py-4"
    >
      <p className="m-0 flex items-start gap-2.5 text-[0.94rem]">
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          aria-hidden="true"
          focusable="false"
          className="mt-[3px] shrink-0"
          fill="none"
          stroke="var(--warn)"
          strokeWidth="2.2"
          strokeLinecap="round"
        >
          <circle cx="12" cy="12" r="9.2" />
          <path d="M12 7.6v6.1M12 16.6v.1" />
        </svg>
        <span>
          <strong className="font-semibold">This is legal information, not legal advice.</strong>{' '}
          Donna helps you understand your assessment and prepare your own application. It does not
          represent you, and its estimates do not predict what the assessors will decide. Have a
          navigator, clinic, or attorney review your application before you file — and{' '}
          <strong className="font-semibold">
            you must still pay your tax bill as billed to keep your right to appeal.
          </strong>
        </span>
      </p>
    </aside>
  )
}
