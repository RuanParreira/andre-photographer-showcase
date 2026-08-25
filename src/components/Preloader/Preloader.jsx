import { useRef } from 'react'
import { gsap, useGSAP, SplitText } from '../../lib/gsap'
import { heroSlideImages } from '../../lib/images'

// Even on a warm cache the curtain holds this long before lifting. A preloader
// that flashes for 80ms reads as a glitch, not as an intro — and the Hero's own
// entrance cascade wants a settled frame to start from. This is only the floor;
// the exit also waits on the wordmark finishing its rise, which on a cold load
// is usually the later of the two.
const MIN_HOLD = 1.4

// Fonts arrive from Google Fonts, so a slow/blocked connection could otherwise
// keep the counter hidden indefinitely. Past this the type shows in the
// fallback stack and swaps in place — worse than perfect, better than a blank
// screen.
const FONT_TIMEOUT = 1.2

// Share of the counter the fonts own; the photo owns the rest. The photo is by
// far the bigger download and the only one that reports byte progress, so it
// gets the majority — otherwise the number would spend most of its travel on a
// task that can only ever report "done".
const FONT_SHARE = 0.25

function afterDelay(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000))
}

// XHR rather than `new Image()` purely for `onprogress`: two binary tasks give
// the counter a visible flat spot at 50 while a 1MB photo streams in, and real
// byte progress is what removes it. The response is thrown away — this is a
// cache-warming request, so the <img>/three.js load that actually consumes the
// URL later reads it straight out of the HTTP cache.
function loadImage(url, onProgress) {
  return new Promise((resolve) => {
    const request = new XMLHttpRequest()
    request.open('GET', url, true)
    // Without this the JPEG bytes would be decoded into a responseText string
    // nothing ever reads.
    request.responseType = 'blob'
    request.onprogress = (event) => {
      // Falls back to a plain settle when the response has no Content-Length —
      // the counter just holds until onloadend instead of streaming.
      if (event.lengthComputable) onProgress(event.loaded / event.total)
    }
    // loadend covers success, error and abort alike: a missing photo must never
    // wedge the curtain shut.
    request.onloadend = () => {
      onProgress(1)
      resolve()
    }
    request.send()
  })
}

/**
 * Full-bleed curtain shown over the page until the first-paint assets are in.
 *
 * `onReveal` fires as the curtain starts lifting (Hero's entrance overlaps the
 * lift so the two read as one move), `onComplete` when it is fully off-screen
 * and the component can be unmounted.
 */
export default function Preloader({ reducedMotion, onReveal, onComplete }) {
  const rootRef = useRef(null)
  const innerRef = useRef(null)
  const counterRef = useRef(null)
  const barRef = useRef(null)
  const wordmarkRef = useRef(null)

  useGSAP(
    () => {
      let cancelled = false
      let wordmark = null

      // The counter reads as the lower of two things: how far the minimum hold
      // has run, and how much has actually loaded. Time alone would be a fake
      // progress bar; the handful of real tasks alone would step 0 -> 50 -> 100
      // in visible jumps. Clamping one by the other gives a number that always
      // travels smoothly and still never claims more than is really done.
      const paced = { value: 0 }
      const real = { value: 0 }
      const setBarScale = gsap.quickSetter(barRef.current, 'scaleX')
      const renderProgress = () => {
        const value = Math.min(paced.value, real.value)
        setBarScale(value)
        if (counterRef.current) {
          counterRef.current.textContent = String(Math.round(value * 100)).padStart(2, '0')
        }
      }

      const fontsReady = Promise.race([
        document.fonts?.ready ?? Promise.resolve(),
        afterDelay(FONT_TIMEOUT),
      ])

      // Hold the type hidden until the real faces are in, then fade it up — the
      // counter is set in Fraunces and a mid-count fallback swap is exactly the
      // kind of seam a preloader exists to hide. Splitting the wordmark waits
      // on the same promise for a second reason: SplitText measures glyph boxes
      // at split time, so splitting against the fallback face would freeze the
      // letters at the wrong widths.
      //
      // Resolves as the last letter lands, and the exit gate waits on it. That
      // wait is not cosmetic: fonts can land late enough that the hold below
      // expires mid-assembly, and the two staggers then run at once — letters
      // arriving on the right while the ones on the left are already leaving.
      const wordmarkSettled = fontsReady.then(() => {
        if (cancelled) return undefined
        gsap.to(innerRef.current, { opacity: 1, duration: 0.6, ease: 'power2.out' })

        if (reducedMotion) return undefined
        // mask: 'chars' wraps each letter in its own clipping box, so they rise
        // out of nothing instead of sliding up from visibly below the line.
        wordmark = new SplitText(wordmarkRef.current, { type: 'chars', mask: 'chars' })
        return new Promise((resolve) => {
          gsap.from(wordmark.chars, {
            yPercent: 115,
            duration: 0.9,
            stagger: 0.035,
            ease: 'power4.out',
            onComplete: resolve,
          })
        })
      })

      // Only the first slide, not all five: these are the JPEG fallbacks the
      // 3D LCD samples (up to ~1MB each) and the later ones don't appear until
      // the slideshow has already cycled — waiting on the whole set would trade
      // several megabytes for a longer blank screen. Coarse-pointer visitors
      // never render the LCD at all, so this stays at one image for them too.
      const firstSlide = heroSlideImages[0]
      let fontShare = 0
      let imageShare = firstSlide ? 0 : 1
      const pushReal = () => {
        if (cancelled) return
        gsap.to(real, {
          value: FONT_SHARE * fontShare + (1 - FONT_SHARE) * imageShare,
          duration: 0.4,
          ease: 'power2.out',
          // Byte progress arrives in bursts, so each one supersedes the tween
          // still easing toward the previous reading rather than stacking on it.
          overwrite: true,
          onUpdate: renderProgress,
        })
      }

      const trackedTasks = [
        fontsReady.then(() => {
          fontShare = 1
          pushReal()
        }),
        firstSlide
          ? loadImage(firstSlide, (ratio) => {
              imageShare = ratio
              pushReal()
            })
          : Promise.resolve(),
      ]

      gsap.to(paced, {
        value: 1,
        duration: MIN_HOLD,
        ease: 'power1.inOut',
        onUpdate: renderProgress,
      })

      Promise.all([...trackedTasks, wordmarkSettled, afterDelay(MIN_HOLD)]).then(() => {
        if (cancelled) return

        const exit = gsap.timeline()

        // Both inputs are at 1 by now in the common case; this is the guarantee
        // that a still-settling tween can't let the curtain leave on a counter
        // short of 100.
        exit.to([paced, real], {
          value: 1,
          duration: 0.35,
          ease: 'power2.inOut',
          // Beats any progress tween still easing out its final reading, so the
          // close to 100 can't be overwritten from under the exit.
          overwrite: true,
          onUpdate: renderProgress,
        }, 0)

        // The wordmark leaves the way it arrived — letter by letter, back into
        // its own mask — rather than riding out on the panel's fade. Faster and
        // tighter than the entrance: an exit that takes as long as the reveal
        // reads as hesitation.
        //
        // from: 'end' matters more than it looks. Emptying left-to-right leaves
        // the tail of the word stranded mid-screen ("...olio") for a beat,
        // which reads as a glitch; unwinding from the end keeps a shrinking
        // "André Portf" -> "André" -> "A", so every intermediate frame still
        // reads as the name.
        if (wordmark) {
          exit.to(wordmark.chars, {
            yPercent: -115,
            duration: 0.6,
            stagger: { each: 0.025, from: 'end' },
            ease: 'power3.in',
          }, 0)
        }

        if (reducedMotion) {
          exit
            .to(rootRef.current, { opacity: 0, duration: 0.25, onStart: onReveal })
            .add(onComplete)
          return
        }

        exit
          // The gold rule sits on the curtain's bottom edge, so lifting the
          // panel sweeps that hairline up the screen — the progress bar becomes
          // the reveal edge instead of just disappearing with it.
          .to(rootRef.current, {
            yPercent: -100,
            duration: 1.15,
            ease: 'power4.inOut',
            onStart: onReveal,
          }, '+=0.15')
          // Slower than the panel, so the counter trails the lift slightly
          // rather than being stapled to it.
          .to(innerRef.current, { yPercent: 24, duration: 1.15, ease: 'power4.inOut' }, '<')
          .to(innerRef.current, { opacity: 0, duration: 0.5, ease: 'power2.in' }, '<0.35')
          .add(onComplete)
      })

      renderProgress()

      return () => {
        cancelled = true
        // Puts the plain text node back — the split spans are torn down before
        // React can be handed a DOM it never rendered.
        wordmark?.revert()
      }
    },
    { scope: rootRef, dependencies: [] }
  )

  return (
    <div
      className="fixed inset-0 z-100 bg-bg overflow-hidden"
      ref={rootRef}
      role="status"
      aria-label="Loading"
    >
      <div
        // opacity is held at 0 inline (not via a class) so GSAP owns the single
        // fade-in on fonts-ready without fighting a utility for the property.
        className="absolute inset-0 flex flex-col justify-between px-edge pt-[calc(var(--spacing-edge)+18px)] pb-[clamp(28px,5vw,56px)]"
        style={{ opacity: 0 }}
        ref={innerRef}
      >
        <p className="text-xs tracking-[0.22em] uppercase text-gold">
          Urban — Landscape — Nature
        </p>

        {/* Sits roughly where the Hero title lands, so the letters that rise
            here and the ones the curtain uncovers occupy the same patch of
            screen. leading is left loose enough that SplitText's per-char masks
            don't crop the accent on the É. */}
        {/* Deliberately a <p>: the Hero's real <h1> is already in the DOM
            underneath the curtain, and a second one would be a duplicate
            top-level heading for the seconds the two overlap. */}
        <p
          className="font-display font-medium text-[clamp(34px,6vw,86px)] leading-[1.12] tracking-[-0.015em] text-ink"
          ref={wordmarkRef}
        >
          André Portfolio
        </p>

        <div className="flex items-end justify-between gap-6">
          <p className="mb-[clamp(8px,1.6vw,18px)] text-[11px] tracking-[0.18em] uppercase text-ink-faint">
            André — Photographer
          </p>
          {/* Same type and scale as the Hero title it hands off to, so the eye
              is already parked at that size when the curtain clears. The digits
              get their own span because GSAP writes them via textContent, which
              would wipe out any sibling markup living inside the same node.
              aria-hidden: the root's role="status" makes this whole panel an
              implicit live region, and without this a screen reader would
              queue every one of these textContent writes as its own
              announcement — a flood of numbers instead of one "Loading" cue. */}
          <p
            className="flex items-baseline gap-[0.08em] font-display font-medium text-[clamp(64px,13vw,180px)] leading-[0.78] tracking-[-0.02em] tabular-nums text-ink"
            aria-hidden="true"
          >
            <span ref={counterRef}>00</span>
            <span className="text-[0.2em] tracking-[0.02em] text-gold-dim">%</span>
          </p>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-px bg-line">
        <div
          className="h-full origin-left bg-gold"
          style={{ transform: 'scaleX(0)' }}
          ref={barRef}
        />
      </div>
    </div>
  )
}
