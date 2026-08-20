import { useRef } from 'react'
import { gsap, useGSAP } from '../../lib/gsap'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { scrollToSection } from '../../lib/scrollToSection'
import styles from './Nav.module.css'

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
    <nav className={styles.nav} aria-label="Primary" ref={navRef}>
      <a href="#hero" className={styles.mark} onClick={(e) => handleClick(e, 'hero')}>
        ANDRÉ
      </a>
      <ul className={styles.links}>
        {LINKS.map((link) => (
          <li key={link.id}>
            <a href={`#${link.id}`} onClick={(e) => handleClick(e, link.id)}>
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
