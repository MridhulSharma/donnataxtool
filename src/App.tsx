import { TopBar } from './components/TopBar'
import { useRoute, useRouteEffects } from './lib/router'
import { AboutPage } from './pages/AboutPage'
import { ToolPage } from './pages/ToolPage'

export default function App() {
  const route = useRoute()
  useRouteEffects(route)

  return (
    <>
      {/* First focusable element on the page. */}
      <a
        href="#main"
        className="sr-only-focusable absolute left-4 top-3 z-50 rounded-full bg-brand px-4 py-2 font-semibold text-[var(--surface)] no-underline"
      >
        Skip to content
      </a>

      {/* Decorative ambient frame. Fixed, non-interactive, below the top bar. */}
      <div className="ambient-edge" aria-hidden="true" />

      <TopBar route={route} />

      <main id="main" className="mx-auto max-w-content px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
        {route === 'about' ? <AboutPage /> : <ToolPage />}
      </main>

      <footer className="border-t border-lines bg-surface">
        <div className="mx-auto max-w-content px-4 py-8 text-[0.9rem] text-muted sm:px-6">
          <p className="m-0">
            Donna is a free, non-commercial tool for Suffolk County, Massachusetts homeowners. It
            keeps no account and stores nothing about you.
          </p>
          <p className="m-0 mt-2">
            Assessment figures come from public records published by the City of Boston. Always
            confirm the numbers and dates against your own tax bill.
          </p>
        </div>
      </footer>
    </>
  )
}
