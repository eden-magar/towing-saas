/**
 * Viewport-clamp for Google Places legacy .pac-container.
 * Mirrors PortalSuggestDropdown horizontal clamping so widened panels
 * (min-width CSS) do not overflow narrow cells or clip under RTL.
 */

const VIEWPORT_MARGIN = 8

let installCount = 0
let observer: MutationObserver | null = null
let rafId = 0
let applying = false

/** Same left-edge math as PortalSuggestDropdown.computePosition. */
export function clampLeftToViewport(left: number, width: number): number {
  let next = left
  if (next + width > window.innerWidth - VIEWPORT_MARGIN) {
    next = window.innerWidth - width - VIEWPORT_MARGIN
  }
  if (next < VIEWPORT_MARGIN) {
    next = VIEWPORT_MARGIN
  }
  return next
}

function clampPacElement(el: HTMLElement) {
  if (getComputedStyle(el).display === 'none') return

  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return

  const viewportMax = window.innerWidth - VIEWPORT_MARGIN * 2
  const width = Math.min(rect.width, viewportMax)
  const desiredLeft = clampLeftToViewport(rect.left, width)

  if (Math.abs(desiredLeft - rect.left) < 0.5 && width >= rect.width - 0.5) {
    return
  }

  const position = getComputedStyle(el).position
  const leftPx =
    position === 'fixed' ? desiredLeft : desiredLeft + window.scrollX

  el.style.left = `${leftPx}px`
  if (width < rect.width - 0.5) {
    el.style.width = `${width}px`
  }
}

function clampAllVisiblePacContainers() {
  document.querySelectorAll<HTMLElement>('.pac-container').forEach(clampPacElement)
}

function scheduleClamp() {
  if (applying) return
  if (rafId) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(() => {
    rafId = 0
    applying = true
    try {
      clampAllVisiblePacContainers()
    } finally {
      applying = false
    }
  })
}

function onScrollOrResize() {
  scheduleClamp()
}

/**
 * Install a document-level observer that keeps .pac-container inside the viewport.
 * Ref-counted so all three Autocomplete init sites can call it safely.
 * Returns a disposer that decrements the ref count.
 */
export function installPacContainerViewportClamp(): () => void {
  installCount += 1

  if (installCount === 1) {
    observer = new MutationObserver(scheduleClamp)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    })
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    scheduleClamp()
  }

  let disposed = false
  return () => {
    if (disposed) return
    disposed = true
    installCount = Math.max(0, installCount - 1)
    if (installCount === 0) {
      observer?.disconnect()
      observer = null
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = 0
      }
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }
}
