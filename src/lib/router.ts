import { useEffect, useState } from 'react'

export type Route = 'tool' | 'about'

function parse(hash: string): Route {
  return hash.replace(/^#\/?/, '').toLowerCase() === 'about' ? 'about' : 'tool'
}

/** Hash routing, so the app deploys as plain static files with no rewrites. */
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() =>
    parse(typeof location === 'undefined' ? '' : location.hash),
  )

  useEffect(() => {
    const onHash = () => setRoute(parse(location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return route
}

const TITLES: Record<Route, string> = {
  tool: 'Level — Is your Boston home over-assessed?',
  about: 'About Level — Why property tax appeals are uneven',
}

/**
 * On a route change, update the title and move focus to the new main heading.
 * Without this a keyboard or screen-reader user stays parked wherever the old
 * page left them and is never told the page changed.
 */
export function useRouteEffects(route: Route) {
  useEffect(() => {
    document.title = TITLES[route]
  }, [route])

  useEffect(() => {
    // Skip the very first render: stealing focus on load is hostile.
    if (!firstRenderDone) {
      firstRenderDone = true
      return
    }
    const h1 = document.querySelector<HTMLElement>('main h1')
    if (h1) {
      h1.setAttribute('tabindex', '-1')
      h1.focus({ preventScroll: true })
    }
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [route])
}

let firstRenderDone = false
