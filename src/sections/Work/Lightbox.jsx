import { useEffect, useRef } from 'react'
import { gsap, useGSAP, Observer, ScrollSmoother } from '../../lib/gsap'
import { workImages } from '../../lib/images'
import styles from './Lightbox.module.css'

const EXIT_MS = 160
const ENTER_MS = 320

export default function Lightbox({ items, activeIndex, onClose, onNavigate, reducedMotion }) {
  const overlayRef = useRef(null)
  const closeButtonRef = useRef(null)
  const figureRef = useRef(null)
  const isAnimatingRef = useRef(false)
  const directionRef = useRef(1)
  const onNavigateRef = useRef(onNavigate)
  const isFirstIndexRender = useRef(true)
  const item = items[activeIndex]
  const image = workImages[item.slug]

  useEffect(() => {
    onNavigateRef.current = onNavigate
  }, [onNavigate])

  // Guards against overlapping triggers — this is what fixed the freeze on
  // fast scrolling — and plays a quick directional dissolve before swapping
  // the photo, so a step reads as a transition instead of a hard cut. The
  // actual index change is scheduled with setTimeout, not the tween's
  // onComplete: a tween that never finishes (dropped frame, backgrounded
  // tab) used to mean the photo never advanced and stayed locked forever.
  // GSAP only drives the visuals now; a plain timer drives the interaction.
  const requestNavigate = (direction) => {
    if (reducedMotion) {
      onNavigateRef.current(direction)
      return
    }
    if (isAnimatingRef.current) return
    isAnimatingRef.current = true
    directionRef.current = direction
    gsap.to(figureRef.current, {
      opacity: 0.12,
      x: direction * -22,
      scale: 0.985,
      duration: EXIT_MS / 1000,
      ease: 'power1.in',
    })
    setTimeout(() => onNavigateRef.current(direction), EXIT_MS)
  }

  useEffect(() => {
    const smoother = ScrollSmoother.get()
    smoother?.paused(true)
    closeButtonRef.current?.focus()

    // Pausing ScrollSmoother stops it re-applying its own transform, but the
    // document itself is still natively scrollable underneath — wheel/touch
    // over the lightbox (used for prev/next navigation) was silently scrolling
    // the real page too, hidden behind the opaque overlay, which then jumped
    // into view as soon as the modal closed and the smoother resynced.
    // Block the scroll before it happens (preventDefault on the raw event) —
    // correcting it after the fact with scrollTo() in a 'scroll' handler
    // fights the browser every frame and is what caused the visible flicker.
    const { style } = document.documentElement
    const previousOverflow = style.overflow
    style.overflow = 'hidden'

    const blockScroll = (event) => event.preventDefault()
    window.addEventListener('wheel', blockScroll, { passive: false })
    window.addEventListener('touchmove', blockScroll, { passive: false })

    return () => {
      window.removeEventListener('wheel', blockScroll)
      window.removeEventListener('touchmove', blockScroll)
      style.overflow = previousOverflow
      smoother?.paused(false)
    }
  }, [])

  useEffect(() => {
    const handleKeydown = (event) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') requestNavigate(1)
      if (event.key === 'ArrowLeft') requestNavigate(-1)
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, reducedMotion])

  // Overlay fade-in and the wheel/touch Observer are set up once, for the
  // lifetime of the modal. They used to live in an effect keyed on
  // activeIndex and get torn down/rebuilt on every photo change — killing
  // and recreating the Observer mid-gesture reset its internal wheel-tracking
  // state, which is exactly what made fast scrolling "stick" and stop cycling.
  useGSAP(
    () => {
      if (reducedMotion) return
      gsap.fromTo(
        overlayRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.35, ease: 'power2.out' }
      )
      gsap.fromTo(
        figureRef.current,
        { opacity: 0, scale: 0.96 },
        { opacity: 1, scale: 1, duration: 0.45, ease: 'power3.out', delay: 0.05 }
      )

      const observer = Observer.create({
        target: overlayRef.current,
        type: 'wheel,touch',
        preventDefault: true,
        onUp: () => requestNavigate(1),
        onDown: () => requestNavigate(-1),
        onLeft: () => requestNavigate(1),
        onRight: () => requestNavigate(-1),
        wheelSpeed: -1,
        tolerance: 10,
      })

      return () => observer.kill()
    },
    { scope: overlayRef, dependencies: [reducedMotion] }
  )

  // Dissolves the new photo in once the index actually changes — skipped on
  // first mount since the effect above already handles the opening reveal.
  // The lock unlocks on a timer, same reasoning as requestNavigate above.
  useGSAP(
    () => {
      if (isFirstIndexRender.current) {
        isFirstIndexRender.current = false
        return
      }
      if (reducedMotion) {
        isAnimatingRef.current = false
        return
      }

      gsap.fromTo(
        figureRef.current,
        { opacity: 0.12, x: directionRef.current * 22, scale: 0.985 },
        { opacity: 1, x: 0, scale: 1, duration: ENTER_MS / 1000, ease: 'power2.out' }
      )

      const unlock = setTimeout(() => {
        isAnimatingRef.current = false
      }, ENTER_MS)

      return () => clearTimeout(unlock)
    },
    { scope: overlayRef, dependencies: [activeIndex] }
  )

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={`${item.title} — expanded view`}
      onClick={(event) => {
        if (event.target === overlayRef.current) onClose()
      }}
    >
      <button
        ref={closeButtonRef}
        type="button"
        className={styles.close}
        onClick={onClose}
        aria-label="Close"
      >
        ×
      </button>

      {items.length > 1 && (
        <>
          <button
            type="button"
            className={`${styles.nav} ${styles.prev}`}
            onClick={() => requestNavigate(-1)}
            aria-label="Previous photo"
          >
            ‹
          </button>
          <button
            type="button"
            className={`${styles.nav} ${styles.next}`}
            onClick={() => requestNavigate(1)}
            aria-label="Next photo"
          >
            ›
          </button>
        </>
      )}

      <figure ref={figureRef} className={styles.figure}>
        <div className={styles.imageWrap}>
          {image && (
            <img
              className={styles.image}
              src={image.src}
              srcSet={image.srcSet}
              sizes="90vw"
              alt={`${item.title} — ${item.location}`}
            />
          )}
        </div>
        <figcaption className={styles.caption}>
          <span className={styles.captionTitle}>{item.title}</span>
          <span>{item.location}</span>
          <span>{item.year}</span>
        </figcaption>
      </figure>
    </div>
  )
}
