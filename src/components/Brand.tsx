/** The product name, used wherever it is shown to the reader. */
export const BRAND_NAME = 'Donna'

/**
 * The mark is a spirit level: a vial with the bubble centred. It reads as
 * "balance" and "check it yourself", which is the whole product.
 */
export function LevelMark({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      width="28"
      height="28"
      role="img"
      aria-label={BRAND_NAME}
      focusable="false"
    >
      <rect
        x="1.5"
        y="9.5"
        width="29"
        height="13"
        rx="4"
        fill="var(--brand-soft)"
        stroke="var(--brand)"
        strokeWidth="1.75"
      />
      {/* the vial */}
      <rect x="9" y="13" width="14" height="6" rx="3" fill="var(--surface)" stroke="var(--brand)" strokeWidth="1.25" />
      {/* the bubble, dead centre */}
      <circle cx="16" cy="16" r="1.9" fill="var(--brand)" />
      {/* index marks */}
      <path d="M12.2 12.4v-1.1M19.8 12.4v-1.1M12.2 20.7v1.1M19.8 20.7v1.1" stroke="var(--brand)" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  )
}
