import { useEffect, useRef, useState } from 'react'
import { gsap } from '../../lib/gsap'

// What counts as "you can do something here". Kept as one selector rather than
// a list of checks so a section can opt a non-standard element in by marking it
// `data-cursor="hover"` — the hero's 3D canvas is clickable but is none of the
// tags below.
const INTERACTIVE =
  'a, button, [role="button"], input, textarea, select, summary, label, [data-cursor="hover"]'

// The ring trails the dot rather than tracking it. That gap is the whole
// effect: a ring pinned to the pointer is just a bigger cursor, while one that
// arrives a beat late reads as something being carried.
//
// The gap has a ceiling, though. At 0.4s the ring fell far enough behind on a
// fast sweep to read as a second, unrelated object drifting across the page
// rather than as the same cursor catching up — the two stop being one thing.
// Keeping the ring's follow to roughly twice the dot's is what holds them
// together as a pair while still leaving the lag visible.
const DOT_FOLLOW = 0.07
const RING_FOLLOW = 0.16

const RING_HOVER_SCALE = 1.7
const RING_PRESS_SCALE = 0.78

/**
 * The custom pointer.
 *
 * Rendered outside `#smooth-content` (see App.jsx) because it is
 * `position: fixed`, and ScrollSmoother's transform on that wrapper would turn
 * a fixed descendant into an absolute one — the cursor would scroll off with
 * the page instead of staying under the pointer.
 *
 * Gated on `(pointer: fine)` and on reduced motion, and it renders nothing at
 * all when either fails: a trailing ring is motion, and on a touch device there
 * is no pointer to replace. The native cursor is only hidden while this is
 * actually on screen, so nothing can leave a visitor with no pointer.
 */
export default function Cursor({ reducedMotion }) {
  const dotRef = useRef(null)
  const ringRef = useRef(null)

  const [finePointer, setFinePointer] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches
  )

  // Same matchMedia + 'change' pattern as useReducedMotion: a laptop with a
  // touchscreen can switch between the two mid-session, and plugging in a mouse
  // should bring the cursor back rather than waiting for a reload.
  useEffect(() => {
    const query = window.matchMedia('(pointer: fine)')
    const handler = (event) => setFinePointer(event.matches)
    query.addEventListener('change', handler)
    return () => query.removeEventListener('change', handler)
  }, [])

  const active = finePointer && !reducedMotion

  useEffect(() => {
    if (!active) return undefined
    const dot = dotRef.current
    const ring = ringRef.current
    if (!dot || !ring) return undefined

    // Both nodes are positioned by their centre, so the transform GSAP writes
    // is the pointer coordinate directly with no offset arithmetic per frame.
    gsap.set([dot, ring], { xPercent: -50, yPercent: -50, opacity: 0 })

    // quickTo rather than a tween per move: `pointermove` fires several times a
    // frame on a high-polling mouse, and this reuses one tween per property
    // instead of allocating (and overwriting) four new ones each time.
    const toDotX = gsap.quickTo(dot, 'x', { duration: DOT_FOLLOW, ease: 'power3' })
    const toDotY = gsap.quickTo(dot, 'y', { duration: DOT_FOLLOW, ease: 'power3' })
    const toRingX = gsap.quickTo(ring, 'x', { duration: RING_FOLLOW, ease: 'power3' })
    const toRingY = gsap.quickTo(ring, 'y', { duration: RING_FOLLOW, ease: 'power3' })

    let hovering = false
    let pressed = false
    // Held hidden until the pointer has actually moved. Without this the cursor
    // would spend the page load parked at the top-left corner, which is where
    // no real pointer is.
    let placed = false

    const ringScale = () => {
      if (pressed) return hovering ? RING_HOVER_SCALE * 0.85 : RING_PRESS_SCALE
      return hovering ? RING_HOVER_SCALE : 1
    }

    const applyState = () => {
      gsap.to(ring, {
        scale: ringScale(),
        borderColor: hovering ? 'rgba(201,162,92,0.95)' : 'rgba(201,162,92,0.55)',
        duration: 0.45,
        ease: 'power3.out',
        overwrite: 'auto',
      })
      // The dot shrinks as the ring opens, so the pair reads as one aperture
      // widening rather than as two unrelated things changing size.
      gsap.to(dot, {
        scale: hovering ? 0.35 : 1,
        duration: 0.45,
        ease: 'power3.out',
        overwrite: 'auto',
      })
    }

    const handleMove = (event) => {
      if (!placed) {
        placed = true
        gsap.set([dot, ring], { x: event.clientX, y: event.clientY })
        gsap.to([dot, ring], { opacity: 1, duration: 0.35, ease: 'power2.out' })
      }
      toDotX(event.clientX)
      toDotY(event.clientY)
      toRingX(event.clientX)
      toRingY(event.clientY)
    }

    // `pointerover` fires on every element boundary crossed, so the early
    // return on an unchanged state is what keeps this from starting a tween
    // for each span of text passed over.
    const handleOver = (event) => {
      const next = Boolean(event.target?.closest?.(INTERACTIVE))
      if (next === hovering) return
      hovering = next
      applyState()
    }

    const handleDown = () => {
      pressed = true
      applyState()
    }
    const handleUp = () => {
      pressed = false
      applyState()
    }

    // Leaving the window (or tabbing to devtools) should take the cursor with
    // it, otherwise a stale ring sits over the page until the pointer returns.
    const handleLeave = () => {
      gsap.to([dot, ring], { opacity: 0, duration: 0.25, ease: 'power2.out', overwrite: 'auto' })
    }
    const handleEnter = () => {
      if (!placed) return
      gsap.to([dot, ring], { opacity: 1, duration: 0.25, ease: 'power2.out', overwrite: 'auto' })
    }

    window.addEventListener('pointermove', handleMove, { passive: true })
    window.addEventListener('pointerdown', handleDown, { passive: true })
    window.addEventListener('pointerup', handleUp, { passive: true })
    document.addEventListener('pointerover', handleOver)
    document.documentElement.addEventListener('pointerleave', handleLeave)
    document.documentElement.addEventListener('pointerenter', handleEnter)

    // Only now is the native cursor hidden — after the replacement exists and
    // its listeners are attached.
    document.documentElement.classList.add('cursor-hidden')

    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerdown', handleDown)
      window.removeEventListener('pointerup', handleUp)
      document.removeEventListener('pointerover', handleOver)
      document.documentElement.removeEventListener('pointerleave', handleLeave)
      document.documentElement.removeEventListener('pointerenter', handleEnter)
      document.documentElement.classList.remove('cursor-hidden')
      gsap.killTweensOf([dot, ring])
    }
  }, [active])

  if (!active) return null

  return (
    // z-110 puts it over everything that can be on screen — the nav at z-50,
    // the lightbox and preloader at z-100 — since a cursor that slides under a
    // panel it is pointing at is worse than no custom cursor.
    <div className="fixed inset-0 z-110 pointer-events-none" aria-hidden="true">
      <span
        ref={ringRef}
        className="absolute top-0 left-0 block w-9 h-9 rounded-full border border-gold-dim will-change-transform [filter:drop-shadow(0_0_2px_rgba(11,11,10,0.5))]"
      />
      <span
        ref={dotRef}
        className="absolute top-0 left-0 block w-[7px] h-[7px] rounded-full bg-ink will-change-transform [filter:drop-shadow(0_0_2px_rgba(11,11,10,0.5))]"
      />
    </div>
  )
}
