import { useRef } from 'react'
import { gsap, useGSAP } from '../../lib/gsap'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { scrollToSection } from '../../lib/scrollToSection'

const LINKS = [
  { id: 'about', label: 'About' },
  { id: 'work', label: 'Work' },
  { id: 'contact', label: 'Contact' },
]

export default function Nav() {
  const reducedMotion = useReducedMotion()
  const navRef = useRef(null)

  // Site's first-paint entrance: nav drops in just ahead of the Hero copy so
  // the page doesn't feel like it's missing a beat before the title reveal.
  useGSAP(
    () => {
      if (reducedMotion) return
      gsap.set(navRef.current, { y: -18, opacity: 0 })
      const tween = gsap.to(navRef.current, {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: 'power3.out',
        delay: 0.1,
      })

      // Same StrictMode hazard as Hero's entrance: navRef.current is a
      // persistent node, so an interrupted first pass can leave it frozen
      // mid-fade — kill and clear back to fully visible before any re-run.
      return () => {
        tween.kill()
        gsap.set(navRef.current, { clearProps: 'opacity,y' })
      }
    },
    { scope: navRef, dependencies: [reducedMotion] }
  )

  const handleClick = (event, id) => {
    event.preventDefault()
    scrollToSection(id, reducedMotion)
  }

  return (
    <nav
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-edge py-7 [mix-blend-mode:difference] pointer-events-none [&>*]:pointer-events-auto"
      aria-label="Primary"
      ref={navRef}
    >
      <a
        href="#hero"
        className="font-display text-lg tracking-[0.06em] text-ink no-underline"
        onClick={(e) => handleClick(e, 'hero')}
      >
        ANDRÉ
      </a>
      <ul className="flex list-none gap-4 sm:gap-[clamp(20px,3vw,40px)] m-0 p-0">
        {LINKS.map((link) => (
          <li key={link.id}>
            <a
              href={`#${link.id}`}
              onClick={(e) => handleClick(e, link.id)}
              className="relative py-1 text-xs tracking-[0.14em] uppercase no-underline text-ink bg-none border-none cursor-pointer after:content-[''] after:absolute after:left-0 after:right-full after:-bottom-0.5 after:h-px after:bg-ink after:transition-[right] after:duration-[0.35s] after:ease-[cubic-bezier(0.22,1,0.36,1)] hover:after:right-0 focus-visible:after:right-0"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
