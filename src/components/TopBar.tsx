import { BRAND_NAME, LevelMark } from './Brand'
import { ThemeToggle } from './ThemeToggle'
import type { Route } from '../lib/router'

const TABS: { route: Route; href: string; label: string }[] = [
  { route: 'tool', href: '#tool', label: 'Tool' },
  { route: 'about', href: '#about', label: 'About' },
]

export function TopBar({ route }: { route: Route }) {
  return (
    <header className="sticky top-0 z-40 border-b border-lines bg-[var(--bar)] backdrop-blur-md">
      <div className="mx-auto flex max-w-content flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <a
          href="#tool"
          className="flex items-center gap-2.5 rounded-md text-ink no-underline"
          aria-label={`${BRAND_NAME}, home`}
        >
          <LevelMark />
          <span className="font-display text-[1.35rem] font-semibold tracking-tight">
            {BRAND_NAME}
          </span>
        </a>

        <nav aria-label="Main" className="ml-auto">
          <ul className="flex list-none items-center gap-1 p-0">
            {TABS.map((t) => {
              const current = route === t.route
              return (
                <li key={t.route}>
                  <a
                    href={t.href}
                    aria-current={current ? 'page' : undefined}
                    className={[
                      'inline-block rounded-full px-4 py-2 text-[0.95rem] font-medium no-underline transition-colors',
                      current
                        // Not colour alone: the current tab is also the only filled one.
                        ? 'bg-brand text-[var(--surface)]'
                        : 'text-muted hover:bg-brand-soft hover:text-ink',
                    ].join(' ')}
                  >
                    {t.label}
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>

        <ThemeToggle />
      </div>
    </header>
  )
}
