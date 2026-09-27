/**
 * Copy to the clipboard with a fallback for browsers and contexts where the
 * async Clipboard API is unavailable or blocked. There is deliberately no file
 * download anywhere in Level.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the textarea approach.
  }

  try {
    const ta = document.createElement('textarea')
    ta.value = text
    // Keep it out of sight and out of the tab order, but still selectable.
    ta.setAttribute('readonly', '')
    ta.setAttribute('aria-hidden', 'true')
    ta.tabIndex = -1
    ta.style.position = 'fixed'
    ta.style.top = '-1000px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    ta.setSelectionRange(0, ta.value.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
