import { useCallback, useEffect, useRef, useState } from 'react'
import { useGSAP, ScrollSmoother, ScrollTrigger } from './lib/gsap'
import { useReducedMotion } from './hooks/useReducedMotion'
import Nav from './components/Nav/Nav'
import Preloader from './components/Preloader/Preloader'
import Cursor from './components/Cursor/Cursor'
import Hero from './sections/Hero/Hero'
import About from './sections/About/About'
import Work from './sections/Work/Work'
import Contact from './sections/Contact/Contact'

function App() {
  const reducedMotion = useReducedMotion()
  const rootRef = useRef(null)
  // Two stages, deliberately not one: `ready` releases the Hero's entrance
  // cascade as the curtain *starts* lifting so the two overlap into a single
  // move, while `preloading` keeps the curtain mounted (and the page locked)
  // until it is fully off-screen.
  const [ready, setReady] = useState(false)
  const [preloading, setPreloading] = useState(true)

  const handleReveal = useCallback(() => setReady(true), [])
  const handlePreloadComplete = useCallback(() => setPreloading(false), [])

  // Nothing should move under the curtain — including a scroll position the
  // browser restored from a previous visit, which would otherwise drop the
  // visitor mid-page the instant the curtain clears.
  useEffect(() => {
    if (!preloading) return
    const previousRestoration = window.history.scrollRestoration
    if (previousRestoration) window.history.scrollRestoration = 'manual'
    window.scrollTo(0, 0)
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = ''
      if (previousRestoration) window.history.scrollRestoration = previousRestoration
    }
  }, [preloading])

  useGSAP(
    () => {
      if (reducedMotion) return

      const smoother = ScrollSmoother.create({
        wrapper: '#smooth-wrapper',
        content: '#smooth-content',
        smooth: 1.2,
        smoothTouch: 0.1,
      })

      // Google Fonts finish loading after first paint and can reflow section
      // heights (Fraunces headings especially); refresh so cached scroll
      // positions stay accurate for nav jumps and pinning.
      document.fonts?.ready.then(() => ScrollTrigger.refresh())

      // ScrollTrigger re-measures ~200ms after a resize. For a drag-resize that
      // debounce is right, but a zoom step is instant, and for those 200ms the
      // pinned Hero keeps the explicit size the pin gave it — a section still
      // laid out for the old viewport, which is most of what reads as the 3D
      // camera jumping when you zoom. A shorter debounce still coalesces a drag
      // while closing that window; GSAP's own refresh lands afterwards and is
      // then a no-op.
      let refreshTimer
      const refreshSoon = () => {
        clearTimeout(refreshTimer)
        refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 60)
      }
      window.addEventListener('resize', refreshSoon)

      return () => {
        clearTimeout(refreshTimer)
        window.removeEventListener('resize', refreshSoon)
        smoother.kill()
      }
    },
    { scope: rootRef, dependencies: [reducedMotion] }
  )

  return (
    <div ref={rootRef}>
      {preloading && (
        <Preloader
          reducedMotion={reducedMotion}
          onReveal={handleReveal}
          onComplete={handlePreloadComplete}
        />
      )}
      <Nav ready={ready} />
      {/* Outside #smooth-content on purpose: it is `position: fixed`, and
          ScrollSmoother's transform on that wrapper would make it scroll away
          from the pointer it is supposed to be under. */}
      <Cursor reducedMotion={reducedMotion} />
      <div id="smooth-wrapper">
        <div id="smooth-content">
          <Hero reducedMotion={reducedMotion} ready={ready} />
          <About reducedMotion={reducedMotion} />
          <Work reducedMotion={reducedMotion} />
          <Contact reducedMotion={reducedMotion} />
        </div>
      </div>
    </div>
  )
}

export default App
