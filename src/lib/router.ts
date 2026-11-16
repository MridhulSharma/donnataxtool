import { useEffect, useState } from 'react'

export type Route = 'tool' | 'about' | 'review'

export interface Location {
  route: Route
  /** Anything after the route, used by the reviewer view to carry a case. */
  payload: string | null
}

function parse(hash: string): Location {
  const raw = hash.replace(/^#\/?/, '')
  const [first, ...rest] = raw.split('/')
  const name = first.toLowerCase()
  if (name === 'about') return { route: 'about', payload: null }
  if (name === 'review') return { route: 'review', payload: rest.join('/') || null }
  return { route: 'tool', payload: null }
}

/** Hash routing, so the app deploys as plain static files with no rewrites. */
export function useLocation(): Location {
  const [location, setLocation] = useState<Location>(() =>
    parse(typeof window === 'undefined' ? '' : window.location.hash),
  )

  useEffect(() => {
    const onHash = () => setLocation(parse(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return location
}

const TITLES: Record<Route, string> = {
  tool: 'Massachusetts Property Tax Tool',
  about: 'About — Massachusetts Property Tax Tool',
  review: 'Case review — Massachusetts Property Tax Tool',
}

let firstRenderDone = false

/**
 * On a route change, update the title and move focus to the new main
 * heading. Without this a keyboard or screen-reader user stays parked where
 * the old page left them and is never told the page changed.
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
