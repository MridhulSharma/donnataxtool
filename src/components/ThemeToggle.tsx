import { useTheme } from '../lib/theme'

/**
 * A single button that flips to the opposite of whatever is currently showing.
 * The accessible name says what pressing it will do, not what state we are in.
 */
export function ThemeToggle() {
  const { isDark, toggle } = useTheme()
  const next = isDark ? 'light' : 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-lines bg-surface text-ink transition-colors hover:bg-brand-soft"
    >
      {isDark ? (
        // Sun
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6" />
        </svg>
      ) : (
        // Moon
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 14.6A8.4 8.4 0 1 1 9.4 4a6.6 6.6 0 0 0 10.6 10.6Z" />
        </svg>
      )}
    </button>
  )
}
