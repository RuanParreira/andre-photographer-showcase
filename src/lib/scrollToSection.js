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

  const smoother = ScrollSmoother.get()
  if (smoother) {
    smoother.scrollTo(target, !reducedMotion)
    pumpScrollTriggerUpdates(reducedMotion ? 100 : 1600)
  } else {
    target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' })
  }
}
