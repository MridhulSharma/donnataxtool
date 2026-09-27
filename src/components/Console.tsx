import type { ReactNode } from 'react'

interface ConsoleProps {
  /** "01" through "05" — a real sequence the homeowner moves through. */
  n: string
  title: string
  /** One line of orientation under the title. */
  lede?: ReactNode
  id: string
  children: ReactNode
}

export function Console({ n, title, lede, id, children }: ConsoleProps) {
  const headingId = `${id}-heading`
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="rounded-card border border-lines bg-surface p-5 shadow-card sm:p-7"
    >
      <div className="flex items-baseline gap-3">
        <span
          aria-hidden="true"
          className="tnum select-none font-display text-[1.05rem] font-semibold text-brand"
        >
          {n}
        </span>
        <h2 id={headingId} className="m-0 text-[1.35rem] sm:text-[1.5rem]">
          {title}
        </h2>
      </div>
      {lede ? <p className="mt-2 max-w-[62ch] text-[0.97rem] text-muted">{lede}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  )
}

/** A label/value pair in the facts grid. */
export function Fact({
  label,
  value,
  hint,
  emphasis = false,
}: {
  label: string
  value: ReactNode
  hint?: string
  emphasis?: boolean
}) {
  return (
    <div className="rounded-xl border border-lines bg-paper px-4 py-3">
      <dt className="text-[0.8rem] font-semibold uppercase tracking-[0.06em] text-muted">{label}</dt>
      <dd
        className={[
          'tnum mt-1 m-0 font-display tabular-nums',
          emphasis ? 'text-[1.6rem] font-semibold' : 'text-[1.2rem]',
        ].join(' ')}
      >
        {value}
      </dd>
      {hint ? <p className="m-0 mt-0.5 text-[0.82rem] text-muted">{hint}</p> : null}
    </div>
  )
}
