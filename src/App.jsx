import { useRef } from 'react'
import { useGSAP, ScrollSmoother, ScrollTrigger } from './lib/gsap'
import { useReducedMotion } from './hooks/useReducedMotion'
import Nav from './components/Nav/Nav'
import Hero from './sections/Hero/Hero'
import About from './sections/About/About'
import Work from './sections/Work/Work'
import Contact from './sections/Contact/Contact'

function App() {
  const reducedMotion = useReducedMotion()
  const rootRef = useRef(null)

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

      return () => smoother.kill()
    },
    { scope: rootRef, dependencies: [reducedMotion] }
  )

  return (
    <div ref={rootRef}>
      <Nav />
      <div id="smooth-wrapper">
        <div id="smooth-content">
          <Hero reducedMotion={reducedMotion} />
          <About reducedMotion={reducedMotion} />
          <Work reducedMotion={reducedMotion} />
          <Contact reducedMotion={reducedMotion} />
        </div>
      </div>
    </div>
  )
}

export default App
