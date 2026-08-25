import { ScrollSmoother, ScrollTrigger } from './gsap'

// ScrollSmoother's content transform normally catches up to a scrollTo() jump
// via GSAP's rAF ticker, but rAF can be throttled to near-zero in occluded/
// automated tabs, leaving the transform stuck even though native scroll moved.
// setInterval isn't subject to the same throttling, so it's a reliable fallback
// to keep pumping updates until the smoothing settles.
function pumpScrollTriggerUpdates(durationMs) {
  ScrollTrigger.update()
  const start = performance.now()
  const id = setInterval(() => {
    ScrollTrigger.update()
    if (performance.now() - start >= durationMs) clearInterval(id)
  }, 16)
}

export function scrollToSection(id, reducedMotion) {
  const target = document.getElementById(id)
  if (!target) return

  // The hero is the pinned section, and resolving a pinned element's scroll
  // position gives the END of its pin range, not the top of the page — a
  // "back to top" click from mid-pin measured as jumping to 1980px, which is
  // exactly the pin's own end. The top of the document is unambiguous as an
  // absolute position, so ask for that instead of for the element.
  const destination = id === 'hero' ? 0 : target

  const smoother = ScrollSmoother.get()
  if (smoother) {
    smoother.scrollTo(destination, !reducedMotion)
    pumpScrollTriggerUpdates(reducedMotion ? 100 : 1600)
  } else if (destination === 0) {
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' })
  } else {
    target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' })
  }
}
