import { useCallback, useRef, useState, type ReactNode } from 'react'
import { copyText } from '../lib/clipboard'

/* ------------------------------------------------------------------ *
 * Buttons and links
 * ------------------------------------------------------------------ */

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[0.95rem] font-semibold no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-55'

export const btnPrimary = `${BASE} bg-brand text-[var(--surface)] hover:bg-[var(--brand-ink)]`
export const btnSecondary = `${BASE} border border-lines bg-surface text-ink hover:bg-brand-soft`

/** An official page, opened in a new tab. Screen readers are told it's new. */
export function ExternalLink({
  href,
  children,
  className = btnSecondary,
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      <svg
        viewBox="0 0 24 24"
        width="15"
        height="15"
        aria-hidden="true"
        focusable="false"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 4h6v6M20 4l-8.5 8.5" />
        <path d="M18 14.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.5" />
      </svg>
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  )
}

/* ------------------------------------------------------------------ *
 * Copy button
 * ------------------------------------------------------------------ */

/**
 * Copies text and reports the outcome in words, not just a colour change, in a
 * live region so it is announced. There is no file download anywhere in Level.
 */
export function CopyButton({
  text,
  label,
  copiedLabel = 'Copied',
  className = btnPrimary,
}: {
  text: string | (() => string)
  label: string
  copiedLabel?: string
  className?: string
}) {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle')
  const timer = useRef<number | undefined>(undefined)

  const onClick = useCallback(async () => {
    const value = typeof text === 'function' ? text() : text
    const ok = await copyText(value)
    setState(ok ? 'ok' : 'fail')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setState('idle'), 4000)
  }, [text])

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" onClick={onClick} className={className}>
        {state === 'ok' ? (
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12.5l5 5L20 6.5" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M15 5.5A1.5 1.5 0 0 0 13.5 4H6a2 2 0 0 0-2 2v7.5A1.5 1.5 0 0 0 5.5 15" />
          </svg>
        )}
        {state === 'ok' ? copiedLabel : label}
      </button>
      <span role="status" aria-live="polite" className="text-[0.88rem] text-muted">
        {state === 'ok'
          ? 'Copied to your clipboard.'
          : state === 'fail'
            ? 'Copy was blocked — select the text and copy it manually.'
            : ''}
      </span>
    </span>
  )
}

/* ------------------------------------------------------------------ *
 * Notes and ribbons
 * ------------------------------------------------------------------ */

type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'brand'

const TONES: Record<Tone, string> = {
  neutral: 'border-lines bg-paper text-ink',
  good: 'border-[var(--good)] bg-[var(--good-soft)] text-ink',
  warn: 'border-[var(--warn)] bg-[var(--warn-soft)] text-ink',
  bad: 'border-[var(--bad)] bg-[var(--bad-soft)] text-ink',
  brand: 'border-brand bg-brand-soft text-ink',
}

/** A callout. The tone is never the only thing carrying the meaning. */
export function Note({
  tone = 'neutral',
  title,
  children,
  className = '',
}: {
  tone?: Tone
  title?: string
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-xl border px-4 py-3 text-[0.94rem] ${TONES[tone]} ${className}`}>
      {title ? <p className="m-0 font-semibold">{title}</p> : null}
      {children ? <div className={title ? 'mt-1' : ''}>{children}</div> : null}
    </div>
  )
}

/** Small inline chip, e.g. the "Example" ribbon. */
export function Chip({ tone = 'brand', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.78rem] font-semibold uppercase tracking-[0.06em] ${TONES[tone]}`}
    >
      {children}
    </span>
  )
}
