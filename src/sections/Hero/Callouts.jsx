import { forwardRef, useImperativeHandle, useRef } from 'react'
import { gsap, useGSAP } from '../../lib/gsap'

// One callout per interaction the turn actually reveals, in the order the
// rotation brings each face into view. The numbering is not decoration: these
// are a sequence, and the number is which of the three the turn has reached.
//
// `from`/`to` are scroll-progress windows on Hero's pin, and they are not
// guesses: each was read off the scene's own occlusion test as the body
// rotates. The lens faces the viewer until ~0.44, the dial stays in view
// throughout, and the screen clears the body at ~0.56 — which is also where
// CameraScene's CLICK_MIN_PROGRESS starts accepting the click, so the callout
// appears exactly when the thing it promises becomes true.
//
// The windows are deliberately non-overlapping. Two leader lines at once reads
// as clutter rather than as a diagram, and the draw/retract rhythm is what
// carries the section. The shutter button is not here on purpose: it sits on
// the far shoulder and the occlusion probe found it hidden at every angle the
// turn passes through, so a callout for it would have spent its whole window
// faded out.
//
// `side`/`dx`/`dy` place the elbow **relative to the part**, not at a fixed
// spot on the page. Anchoring labels to the left edge meant every leader had to
// cross the whole viewport to reach a model sitting right of centre, which read
// as a mistake rather than as a diagram — real plates hug their subject. Offsets
// are in pixels and tuned to clear the body's silhouette at the angle each
// callout appears at, so the leaders stay roughly 300px whatever the part does.
//
// The lens and dial both sit on the side of the body facing away from the
// camera's own bulk at their moment, so a right-side label is the short way
// out. The screen is the exception: by the time it faces the viewer the model
// fills the right of the frame, and its only nearby clear space is on the left.
// The statement copy is parked at the top of that column precisely so this one
// can still use the middle of it.
const CALLOUTS = [
  { id: 'lens', index: '01', name: 'Lens barrel', action: 'Click to spin', from: 0.2, to: 0.46, side: 'right', dx: 250, dy: -150 },
  { id: 'dial', index: '02', name: 'Mode dial', action: 'Click to turn', from: 0.48, to: 0.62, side: 'right', dx: 210, dy: -230 },
  { id: 'screen', index: '03', name: 'Screen', action: 'Click to open', from: 0.62, to: 0.92, side: 'left', dx: -300, dy: -140 },
]

// Length of the horizontal run under the label before the line turns and heads
// for the part — the shelf is what makes this read as a technical callout
// rather than as an arrow. The label always sits above the shelf's left end and
// reads rightward, on both sides, so the two orientations stay one device.
const SHELF = 110

/**
 * Scroll-driven technical callouts over the 3D camera.
 *
 * Anchors come from CameraScene projecting the real world position of each
 * named node every frame, so a line stays on its part while the body rotates
 * instead of pointing at a remembered position. Hero drives this imperatively —
 * both inputs arrive from animation frames, and routing them through React
 * state would re-render the section sixty times a second for no benefit.
 */
const Callouts = forwardRef(function Callouts({ hotspotTargetsRef }, ref) {
  const rootRef = useRef(null)
  const boxRef = useRef({ w: 0, h: 0 })
  const activeIdRef = useRef(null)
  // id -> { path, ring, label, timeline, target: {x, y}, occluded }
  const partsRef = useRef({})

  useGSAP(
    () => {
      const parts = partsRef.current

      for (const callout of CALLOUTS) {
        const part = parts[callout.id]
        if (!part?.path) continue

        // Built once and then played/reversed, rather than a fresh tween per
        // transition: a scrub that reverses mid-draw has to pick up from where
        // the line actually is, not restart it.
        part.timeline = gsap
          .timeline({ paused: true })
          .fromTo(part.ring, { attr: { r: 0 } }, { attr: { r: 4 }, duration: 0.35, ease: 'power2.out' })
          // Drawn from the part outward — the camera points at itself, rather
          // than a label reaching in to grab it.
          .fromTo(part.path, { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 0.7, ease: 'power2.inOut' }, 0.1)
          .fromTo(part.label, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.5, ease: 'power2.out' }, 0.55)
      }

      return () => {
        for (const part of Object.values(parts)) part.timeline?.kill()
      }
    },
    { scope: rootRef, dependencies: [] }
  )

  // The box only has to be re-measured when it resizes. Reading it per frame
  // would force a layout on every tick of the render loop, and ScrollSmoother
  // moves this element by transform anyway — which changes where it is, never
  // how big it is.
  useGSAP(
    () => {
      const el = rootRef.current
      if (!el) return
      const measure = () => {
        boxRef.current = { w: el.clientWidth, h: el.clientHeight }
      }
      measure()
      const observer = new ResizeObserver(measure)
      observer.observe(el)
      return () => observer.disconnect()
    },
    { scope: rootRef, dependencies: [] }
  )

  const draw = (callout, part) => {
    const { w, h } = boxRef.current
    if (!w || !part.target) return

    const targetX = part.target.x * w
    const targetY = part.target.y * h
    const elbowX = targetX + callout.dx
    const elbowY = targetY + callout.dy
    // The shelf runs away from the part on a right-side callout and back toward
    // it on a left-side one, but the label hangs off its left end either way.
    const shelfEndX = callout.side === 'right' ? elbowX + SHELF : elbowX - SHELF
    const labelX = Math.min(elbowX, shelfEndX)

    part.path.setAttribute('d', `M ${targetX} ${targetY} L ${elbowX} ${elbowY} L ${shelfEndX} ${elbowY}`)
    part.ring.setAttribute('cx', targetX)
    part.ring.setAttribute('cy', targetY)
    // The anchor carries position only. GSAP owns `x` on the node inside it for
    // the reveal, so the two transforms cannot overwrite each other.
    part.anchor.style.transform = `translate3d(${labelX}px, ${elbowY}px, 0)`
  }

  useImperativeHandle(ref, () => ({
    // Called from the pin's onUpdate.
    setProgress(progress) {
      const next = CALLOUTS.find((c) => progress >= c.from && progress < c.to)?.id ?? null
      if (next === activeIdRef.current) return

      const previous = activeIdRef.current
      activeIdRef.current = next
      if (previous) partsRef.current[previous]?.timeline?.reverse()
      if (next) {
        // Position the line before it draws, or the first frame of the reveal
        // snaps in from wherever the part was last time it was tracked.
        const callout = CALLOUTS.find((c) => c.id === next)
        const part = partsRef.current[next]
        if (part?.target) draw(callout, part)
        part?.timeline?.play()
      }

      // Only the visible callout is tracked: every id costs a projection and a
      // raycast per frame inside the render loop.
      hotspotTargetsRef?.current?.(next ? [next] : [])
    },

    // Called from CameraScene's render loop, once per frame.
    applyHotspots(positions) {
      const activeId = activeIdRef.current
      if (!activeId) return
      const position = positions[activeId]
      const part = partsRef.current[activeId]
      const callout = CALLOUTS.find((c) => c.id === activeId)
      if (!position || !part) return

      part.target = position
      draw(callout, part)

      // A part that has rotated behind the body should not keep a line pinned
      // to its silhouette. Eased toward the target rather than switched, so
      // grazing angles fade instead of strobing.
      //
      // Applied to the label as well as the line: the label is a sibling DOM
      // node, not a child of the SVG group, so hiding only the group left the
      // text captioning a part that was no longer on screen. It is written to
      // an inner wrapper because GSAP owns the outer node's opacity for the
      // reveal — nesting them lets the two multiply instead of overwriting
      // each other.
      const want = position.occluded ? 0 : 1
      part.visibility = (part.visibility ?? want) + (want - (part.visibility ?? want)) * 0.12
      part.group.style.opacity = part.visibility
      part.veil.style.opacity = part.visibility
    },
  }))

  return (
    <div className="absolute inset-0 pointer-events-none" ref={rootRef} aria-hidden="true">
      {/* No viewBox on purpose: an SVG without one maps one user unit to one
          CSS pixel, so the hairlines keep their weight at any viewport size
          instead of being scaled by a fitted coordinate system. */}
      <svg className="absolute inset-0 w-full h-full overflow-visible" fill="none">
        {CALLOUTS.map((callout) => (
          <g
            key={callout.id}
            ref={(el) => {
              if (el) partsRef.current[callout.id] = { ...partsRef.current[callout.id], group: el }
            }}
          >
            <path
              className="stroke-gold-dim"
              strokeWidth="1"
              ref={(el) => {
                if (el) partsRef.current[callout.id] = { ...partsRef.current[callout.id], path: el }
              }}
            />
            <circle
              className="stroke-gold"
              strokeWidth="1"
              r="0"
              ref={(el) => {
                if (el) partsRef.current[callout.id] = { ...partsRef.current[callout.id], ring: el }
              }}
            />
          </g>
        ))}
      </svg>

      {/* Three nested nodes, each owning one transform so none clobbers
          another: the anchor is positioned per frame from the part, the middle
          node is GSAP's reveal, and the inner one carries occlusion. */}
      {CALLOUTS.map((callout) => (
        <div
          key={callout.id}
          className="absolute top-0 left-0 w-max"
          ref={(el) => {
            if (el) partsRef.current[callout.id] = { ...partsRef.current[callout.id], anchor: el }
          }}
        >
          <div
            className="opacity-0 -translate-y-full pb-2.5"
            ref={(el) => {
              if (el) partsRef.current[callout.id] = { ...partsRef.current[callout.id], label: el }
            }}
          >
            <div
              ref={(el) => {
                if (el) partsRef.current[callout.id] = { ...partsRef.current[callout.id], veil: el }
              }}
            >
              <p className="flex items-baseline gap-2.5 text-[10.5px] tracking-[0.16em] uppercase">
                <span className="tabular-nums text-gold-dim">{callout.index}</span>
                <span className="text-ink">{callout.name}</span>
              </p>
              <p className="mt-1 text-[12.5px] tracking-[0.04em] text-ink-dim">{callout.action}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
})

export default Callouts
