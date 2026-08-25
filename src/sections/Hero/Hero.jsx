import { forwardRef, Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { gsap, useGSAP, SplitText, ScrollTrigger, ScrollSmoother } from '../../lib/gsap'
import CameraCanvas from '../../three/CameraCanvas'
import Callouts from './Callouts'
import { supportsHeavyMotion } from '../../lib/capabilities'
import { heroSlides, heroSlideImages } from '../../lib/images'
import { works } from '../../data/work'
import { scrollToSection } from '../../lib/scrollToSection'

// Shot metadata for the camera actually on screen. It is the one piece of copy
// that belongs to the turn rather than to the intro: as the hero text clears,
// this fades in and gives the frame something to read while the model is the
// subject — and in the flat fallback it becomes the photo's caption, so the two
// versions of the section share a voice instead of looking like different pages.
const READOUT = [
  { label: 'Body', value: 'Canon EOS 4000D' },
  { label: 'Lens', value: 'EF-S 18–55mm' },
  { label: 'Light', value: 'Available, handheld' },
]

// How long to wait for the GLB before giving up and laying the section out flat.
// Generous, because the alternative to waiting is a visible re-layout — but
// bounded, because a section pinned over an empty canvas is the exact failure
// this whole stage system exists to prevent.
const MODEL_TIMEOUT_MS = 9000

// The first few entries in data/work.js — the LCD cycles through these
// (CameraScene's slideshow) instead of showing a single static photo.
// Clicking dollies the 3D camera toward whichever one is on screen at that
// moment and hands off to the real Work grid, so the DOM crossfade below
// shows that same photo (framing isn't pixel-identical — the LCD's own
// aspect differs from the viewport's — so the handoff fades rather than
// cutting). Shared with the Preloader, which waits on this same set.
const SCREEN_IMAGES = heroSlideImages

// CameraScene only knows a slide by the texture URL it was handed, so the
// fullscreen overlay looks the full responsive set back up by it rather than
// blowing the small LCD variant up to viewport width.
const SLIDE_BY_TEXTURE = new Map(heroSlides.map((slide) => [slide.texture, slide]))

function smoothstep(edge0, edge1, x) {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1)
  return t * t * (3 - 2 * t)
}

// Same label/value pairing About and Contact already use for their detail
// blocks, so the hero's furniture reads as part of the same system rather than
// as a widget invented for this section.
const Readout = forwardRef(function Readout({ className = '' }, ref) {
  return (
    <dl
      className={`grid grid-cols-[auto_1fr] gap-x-[clamp(16px,2.2vw,32px)] gap-y-2.5 m-0 ${className}`}
      ref={ref}
    >
      {READOUT.map((row) => (
        <Fragment key={row.label}>
          <dt className="text-[10.5px] tracking-[0.16em] uppercase text-ink-faint">{row.label}</dt>
          <dd className="m-0 text-[12.5px] tracking-[0.04em] text-ink-dim">{row.value}</dd>
        </Fragment>
      ))}
    </dl>
  )
})

export default function Hero({ reducedMotion, ready }) {
  const sectionRef = useRef(null)
  const contentRef = useRef(null)
  const kickerRef = useRef(null)
  const titleRef = useRef(null)
  const roleRef = useRef(null)
  const subRef = useRef(null)
  const scrollCueRef = useRef(null)
  const screenRevealRef = useRef(null)
  const screenRevealImgRef = useRef(null)
  const flashRef = useRef(null)
  const flashTlRef = useRef(null)
  const scrollProgress = useRef(0)
  const readoutRef = useRef(null)
  const railFillRef = useRef(null)
  const statementRef = useRef(null)
  const flatFrameRef = useRef(null)
  const calloutsRef = useRef(null)
  // Set by CameraCanvas once the scene exists; calling it tells the render loop
  // which parts to project this frame.
  const hotspotTargetsRef = useRef(null)

  const handleHotspots = useCallback((positions) => {
    calloutsRef.current?.applyHotspots(positions)
  }, [])

  // 'pending' -> 'live' | 'flat'. Devices that were never going to run WebGL
  // skip straight to 'flat' at mount, so they never reserve scroll distance for
  // an experience they will not get; the rest start pending and are resolved by
  // the GLB (or by the timeout below).
  const [cameraStage, setCameraStage] = useState(() =>
    supportsHeavyMotion() && !reducedMotion ? 'pending' : 'flat'
  )
  const immersive = cameraStage === 'live'

  // supportsHeavyMotion() above only runs once, at mount — a window resized
  // narrow after load (or a devtools device-toolbar toggle on an already-open
  // tab) never re-checks it, so a session that mounted wide stays 'pending'
  // or 'live' at any width afterward: the 220% pin keeps reserving its scroll
  // distance for a camera turn that no longer fits the viewport it's pinned
  // in. Same matchMedia + 'change' listener pattern as useReducedMotion.js.
  // Downgrade-only: crossing back above the gate doesn't re-attempt 'live',
  // since upgrading mid-session would yank a pin in under whatever the
  // visitor is currently reading.
  useEffect(() => {
    if (cameraStage === 'flat') return
    const widthQuery = window.matchMedia('(min-width: 860px)')
    const pointerQuery = window.matchMedia('(pointer: fine)')
    const handleChange = () => {
      if (!supportsHeavyMotion()) setCameraStage('flat')
    }
    widthQuery.addEventListener('change', handleChange)
    pointerQuery.addEventListener('change', handleChange)
    return () => {
      widthQuery.removeEventListener('change', handleChange)
      pointerQuery.removeEventListener('change', handleChange)
    }
  }, [cameraStage])

  const handleModelReady = useCallback(() => {
    setCameraStage((stage) => {
      if (stage !== 'pending') return stage
      // Upgrading to the pinned layout changes the height of everything below
      // it. That is free while the visitor is still looking at the top of the
      // hero, and a content-jumping-under-the-cursor bug once they are not — so
      // a late arrival stays flat rather than yanking the page.
      if (window.scrollY > window.innerHeight * 0.25) return 'flat'
      return 'live'
    })
  }, [])

  const handleModelFail = useCallback(() => {
    setCameraStage((stage) => (stage === 'pending' ? 'flat' : stage))
  }, [])

  // The loader can also simply never call back — a stalled request reports
  // neither success nor error. Resolving pending either way is what guarantees
  // the section always ends up with a real layout.
  useEffect(() => {
    if (cameraStage !== 'pending') return
    const id = setTimeout(handleModelFail, MODEL_TIMEOUT_MS)
    return () => clearTimeout(id)
  }, [cameraStage, handleModelFail])

  // Fires when CameraScene's click-triggered camera-dolly transition
  // completes, with the URL of whichever slide was on screen at that moment
  // (the slideshow freezes on it — see CameraScene's screenGrowTarget guard
  // in _updateSlideshow). The DOM overlay is pointed at that same photo
  // (crops slightly differently — the LCD's own aspect isn't the
  // viewport's — so this fades in rather than cutting) to mask the
  // ScrollSmoother jump to Work, then fades away once the real grid is in
  // view underneath it.
  const screenEnterHandlerRef = useRef(null)
  useEffect(() => {
    screenEnterHandlerRef.current = (imageUrl) => {
      const slide = SLIDE_BY_TEXTURE.get(imageUrl)
      if (screenRevealImgRef.current && slide) {
        screenRevealImgRef.current.srcset = slide.srcSet
        screenRevealImgRef.current.src = slide.src
      }
      if (screenRevealRef.current) {
        gsap.to(screenRevealRef.current, { opacity: 1, duration: 0.35, overwrite: true })
      }
      scrollToSection('work', reducedMotion)
      gsap.delayedCall(reducedMotion ? 0.1 : 1, () => {
        if (screenRevealRef.current) {
          gsap.to(screenRevealRef.current, { opacity: 0, duration: 0.6, overwrite: true })
        }
      })
    }
  })
  // Stable identity (created once via useCallback) so passing it to
  // CameraCanvas doesn't retrigger its setup effect on every Hero render —
  // always calls whatever is current in the ref above.
  const handleScreenEnter = useCallback((imageUrl) => {
    screenEnterHandlerRef.current?.(imageUrl)
  }, [])

  // Fires when CameraScene force-resets after having been left open/opening
  // while scrolled out of view (Work is far enough below Hero that this
  // always happens right after the click-to-enter transition navigates
  // there). Without this, scrolling back up to Hero later could still find
  // this overlay mid- or un-faded from its own timer above, stacked on top
  // of the now-freshly-reset (but correct) 3D scene — a stale fullscreen
  // photo where the settled camera shot should be. Kill it outright, no
  // fade: the user isn't watching this happen, it's already off-screen.
  const screenExitHandlerRef = useRef(null)
  useEffect(() => {
    screenExitHandlerRef.current = () => {
      if (screenRevealRef.current) gsap.set(screenRevealRef.current, { opacity: 0, overwrite: true })
    }
  })
  const handleScreenExit = useCallback(() => {
    screenExitHandlerRef.current?.()
  }, [])

  // Fires at the bottom of the shutter-button press (CameraScene's
  // _fireShutter, which simultaneously plays the shutter sound and kicks the
  // 3D body). This half is the fullscreen clarão: a DOM layer rather than
  // anything in the scene, so it covers the whole viewport regardless of
  // where the camera model happens to be sitting or which way it's facing —
  // the light burst on the model itself is handled scene-side.
  //
  // Deliberately short and low-peak: the shot should read as a flash going
  // off, not as the page blinking. The timeline is kept in a ref and killed
  // on re-fire so rapid clicks restart cleanly from black instead of
  // stacking opacity tweens on the same node.
  const handleShutterFire = useCallback(() => {
    const el = flashRef.current
    if (!el) return
    flashTlRef.current?.kill()
    flashTlRef.current = gsap
      .timeline()
      .set(el, { opacity: 0 })
      .to(el, { opacity: 0.78, duration: 0.05, ease: 'power2.out' })
      .to(el, { opacity: 0, duration: 0.3, ease: 'power2.in' })
  }, [])

  // Lives outside the useGSAP block below because that one early-returns
  // under reducedMotion (and is scoped to the section, while this timeline
  // targets a node portalled into document.body) — an in-flight flash still
  // has to be killed if Hero unmounts mid-burst.
  useEffect(() => () => flashTlRef.current?.kill(), [])

  useGSAP(
    () => {
      if (reducedMotion) return

      // Held blank behind the Preloader's curtain: the entrance cascade is the
      // payoff of the reveal, so nothing here may be on screen — even for the
      // frames where the lifting curtain has uncovered part of it — before
      // `ready` flips as that lift begins.
      if (!ready) {
        gsap.set([contentRef.current, scrollCueRef.current], { opacity: 0 })
        return
      }

      const title = new SplitText(titleRef.current, { type: 'chars' })
      const sub = new SplitText(subRef.current, { type: 'lines' })

      // Full page entrance cascade: kicker -> title -> role -> sub -> scroll
      // cue, each overlapping the previous so it reads as one continuous
      // reveal rather than separate pieces arriving on their own.
      const tl = gsap.timeline({ delay: 0.3 })
      // contentRef itself is what the !ready branch above blanked — clear that
      // here rather than relying on the context revert having already run.
      tl.set(contentRef.current, { opacity: 1 })
        .set(kickerRef.current, { y: 14, opacity: 0 })
        .set(title.chars, { yPercent: 130, opacity: 0 })
        .set(roleRef.current, { y: 12, opacity: 0 })
        .set(sub.lines, { y: 18, opacity: 0 })
        .set(scrollCueRef.current, { opacity: 0 })
        .to(kickerRef.current, { y: 0, opacity: 1, duration: 0.9, ease: 'power2.out' })
        .to(
          title.chars,
          {
            yPercent: 0,
            opacity: 1,
            duration: 1.4,
            stagger: 0.03,
            ease: 'power4.out',
          },
          '-=0.5'
        )
        .to(
          roleRef.current,
          { y: 0, opacity: 1, duration: 0.9, ease: 'power2.out' },
          '-=0.8'
        )
        .to(
          sub.lines,
          { y: 0, opacity: 1, duration: 1, stagger: 0.12, ease: 'power2.out' },
          '-=0.7'
        )
        .to(
          scrollCueRef.current,
          { opacity: 1, duration: 1.1, ease: 'power1.out' },
          '-=0.3'
        )

      return () => {
        // title/sub self-heal via SplitText.revert() (restores plain text,
        // discarding the animated spans). kicker/role/scrollCue are plain
        // persistent nodes with no such reset, so if this effect re-runs
        // (StrictMode double-invoke, dependency change) while tl is still
        // mid-tween, tl.kill() + clearProps resets them to a clean, fully
        // visible state instead of leaving them stuck at a partial fade.
        tl.kill()
        title.revert()
        sub.revert()
        gsap.set([contentRef.current, kickerRef.current, roleRef.current, scrollCueRef.current], {
          clearProps: 'opacity,y',
        })
        if (screenRevealRef.current) gsap.set(screenRevealRef.current, { clearProps: 'opacity' })
      }
    },
    // Deliberately NOT dependent on the camera stage. The stage can resolve a
    // second after mount, and re-running this would replay the whole entrance
    // in front of someone already reading the finished text.
    { scope: sectionRef, dependencies: [reducedMotion, ready] }
  )

  // The scroll narrative, which *is* stage-dependent: pinned and scrubbed when
  // the camera is live, a short parallax on the still frame when it is not.
  useGSAP(
    () => {
      if (reducedMotion || !ready) return

      if (!immersive) {
        // No pin, no reserved scroll: the flat section is one screen tall and
        // scrolls away like any other. The frame gets a slow counter-drift so
        // the fallback still has some life in it, on a single scrubbed trigger.
        if (!flatFrameRef.current) return
        const drift = gsap.fromTo(
          flatFrameRef.current,
          { yPercent: -3 },
          {
            yPercent: 3,
            ease: 'none',
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top top',
              end: 'bottom top',
              scrub: true,
            },
          }
        )
        return () => drift.scrollTrigger?.kill()
      }

      // quickSetter instead of gsap.set/to: onUpdate fires on every scrub
      // tick, and this just needs a cheap direct style write, not a tween.
      // Every element the turn drives is written from this one trigger's
      // onUpdate rather than getting a ScrollTrigger of its own.
      const setContentOpacity = gsap.quickSetter(contentRef.current, 'opacity')
      const setScrollCueOpacity = gsap.quickSetter(scrollCueRef.current, 'opacity')
      const setContentY = gsap.quickSetter(contentRef.current, 'y', 'px')
      const setReadoutOpacity = gsap.quickSetter(readoutRef.current, 'opacity')
      const setReadoutY = gsap.quickSetter(readoutRef.current, 'y', 'px')
      const setRailScale = gsap.quickSetter(railFillRef.current, 'scaleY')
      const setStatementOpacity = gsap.quickSetter(statementRef.current, 'opacity')
      const setStatementY = gsap.quickSetter(statementRef.current, 'y', 'px')

      // True while ScrollTrigger is re-measuring the page. See the listeners
      // below the trigger for why anything driven by progress has to sit still
      // during that window.
      let remeasuring = false
      let heldProgress = null

      const applyProgress = (progress) => {
          scrollProgress.current = progress

          // The intro text only makes sense for the "presentation" state —
          // once the camera starts its turn, fade it out of the way so it
          // doesn't compete with the model moving through the frame. It also
          // lifts slightly as it goes, so it reads as being carried out of the
          // composition rather than switched off.
          const textOut = smoothstep(0.02, 0.18, progress)
          setContentOpacity(1 - textOut)
          setContentY(textOut * -40)
          setScrollCueOpacity(1 - textOut)

          // The intro copy does not simply leave — this takes its place and is
          // the section's one piece of real writing about André. It holds for
          // the whole turn and only clears as the pin is releasing, so the
          // frame is carrying something the entire way down and the statement
          // is the last thing read before About picks the thought up.
          const statementIn = smoothstep(0.18, 0.3, progress) * (1 - smoothstep(0.86, 0.98, progress))
          setStatementOpacity(statementIn)
          setStatementY((1 - smoothstep(0.18, 0.3, progress)) * 24)

          // Handover: the readout arrives just after the intro copy has gone,
          // so the frame is never carrying zero text. It leaves again at the
          // very end, as the pin releases into About.
          const readoutIn = smoothstep(0.16, 0.34, progress) * (1 - smoothstep(0.9, 1, progress))
          setReadoutOpacity(readoutIn)
          setReadoutY((1 - smoothstep(0.16, 0.34, progress)) * 18)

          // The rail is the honest answer to "how much of this is left" — the
          // one thing a pinned section normally takes away from the visitor.
          setRailScale(progress)

          // Which part the turn is currently showing off. Callouts.jsx owns the
          // windows and the draw/retract; this only forwards the signal.
          calloutsRef.current?.setProgress(progress)
      }

      // 220% covers just the turn (CameraScene.js's rotationT/dollyT/
      // revealT) — enough physical scroll distance for the camera's turn to
      // read as one unhurried move rather than a quick flick of the wheel.
      // Scrolling further past this just continues into About normally;
      // filling the screen is now a deliberate click on the LCD (see
      // handleScreenEnter above), not something scroll drives.
      const pin = ScrollTrigger.create({
        trigger: sectionRef.current,
        start: 'top top',
        end: '+=220%',
        pin: true,
        scrub: 0.4,
        onUpdate: (self) => {
          if (remeasuring) return
          applyProgress(self.progress)
        },
      })

      // Zooming the page changes the viewport height, and this pin is 220% of
      // it — so the same scroll offset lands at a different point in the turn
      // and the camera swings to a new pose on every zoom step. Measured, the
      // model's silhouette shifted ~8% and then settled back, which reads as
      // the camera being unstable rather than as the page reflowing.
      //
      // What is worth preserving across a re-measure is the visitor's place in
      // the turn, not their pixel offset. Progress is held while ScrollTrigger
      // re-measures (so nothing animates through the intermediate values), then
      // the scroll is moved to wherever that same progress now lives. The page
      // below reflows normally; the camera does not move at all.
      const holdProgress = () => {
        remeasuring = true
        // Only meaningful mid-pin; at either end the position is already the
        // one the visitor asked for.
        heldProgress = pin.progress > 0 && pin.progress < 1 ? pin.progress : null
      }
      const releaseProgress = () => {
        remeasuring = false
        if (heldProgress !== null) {
          // The pin is shorter or longer than it was, so the old pixel offset
          // now points somewhere else in the turn. Move to wherever the pose
          // the visitor was looking at lives under the new metrics.
          const target = pin.start + heldProgress * (pin.end - pin.start)
          const smoother = ScrollSmoother.get()
          if (smoother) smoother.scrollTop(target)
          else window.scrollTo(0, target)
          heldProgress = null
          ScrollTrigger.update()
        }
        applyProgress(pin.progress)
      }
      ScrollTrigger.addEventListener('refreshInit', holdProgress)
      ScrollTrigger.addEventListener('refresh', releaseProgress)

      return () => {
        ScrollTrigger.removeEventListener('refreshInit', holdProgress)
        ScrollTrigger.removeEventListener('refresh', releaseProgress)
        pin.kill()
        gsap.set([contentRef.current, scrollCueRef.current], { clearProps: 'opacity,y' })
      }
    },
    { scope: sectionRef, dependencies: [reducedMotion, ready, immersive] }
  )

  return (
    <section
      id="hero"
      ref={sectionRef}
      className="relative min-h-svh flex flex-col justify-center pt-[calc(var(--spacing-edge)+56px)] px-edge pb-edge overflow-hidden bg-[radial-gradient(120%_90%_at_78%_18%,rgba(201,162,92,0.14),transparent_60%),var(--color-bg)]"
    >
      {cameraStage !== 'flat' && (
        <div className="absolute inset-x-[-5%] inset-y-[-10%] z-0 pointer-events-none [&_canvas]:w-full [&_canvas]:h-full [&_canvas]:block">
          <CameraCanvas
            scrollProgressRef={scrollProgress}
            reducedMotion={reducedMotion}
            screenImages={SCREEN_IMAGES}
            onScreenEnter={handleScreenEnter}
            onScreenExit={handleScreenExit}
            onShutterFire={handleShutterFire}
            onModelReady={handleModelReady}
            onModelFail={handleModelFail}
            onHotspots={handleHotspots}
            hotspotTargetsRef={hotspotTargetsRef}
          />
          {/* Shares the canvas wrapper's box, so a hotspot reported in 0..1
              canvas coordinates maps straight onto this overlay with no
              cross-element measuring. */}
          {immersive && <Callouts ref={calloutsRef} hotspotTargetsRef={hotspotTargetsRef} />}
        </div>
      )}

      {/* One column while the camera owns the frame, two once it doesn't — the
          still frame takes the space the model would have occupied instead of
          leaving the right half of the screen empty. */}
      <div
        className={
          immersive
            ? 'relative z-1 w-full'
            : 'relative z-1 w-full grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,36%)] gap-[clamp(40px,6vw,80px)] items-center'
        }
      >
        <div className="max-w-295" ref={contentRef}>
          <p className="text-xs tracking-[0.22em] uppercase text-gold mb-[clamp(18px,3vw,32px)]" ref={kickerRef}>
            Urban — Landscape — Nature
          </p>
          <h1
            className="font-display font-medium text-[clamp(72px,15vw,220px)] leading-[0.88] tracking-[-0.01em] m-0"
            ref={titleRef}
          >
            <span className="block overflow-hidden">André</span>
          </h1>
          <p className="font-sans text-[clamp(16px,2.2vw,28px)] tracking-[0.28em] uppercase text-ink-dim mt-[clamp(14px,2vw,26px)]" ref={roleRef}>
            Photographer
          </p>
          <p className="mt-[clamp(28px,5vw,56px)] max-w-120 text-[clamp(15px,1.4vw,18px)] leading-[1.6] text-ink-dim" ref={subRef}>
            Fine-art photography shaped by natural light — cities at dusk,
            open landscapes, and quiet studies of nature.
          </p>

          {/* Shown for 'pending' too, not just 'flat': the alternative was an
              empty right column and a fully transparent canvas for up to
              MODEL_TIMEOUT_MS with nothing on screen to look at. Once the
              model resolves to 'live' this unmounts in the same render that
              switches the layout to one column, so the cut lands exactly
              when the live scene actually has something drawn to replace it. */}
          {!immersive && <Readout className="mt-[clamp(32px,4vw,52px)] border-t border-line pt-6 max-w-120" />}
        </div>

        {!immersive && heroSlides[0] && (
          <figure className="relative m-0 overflow-hidden" ref={flatFrameRef}>
            <div className="relative aspect-[4/5] overflow-hidden bg-bg-soft">
              <img
                className="absolute inset-x-0 inset-y-[-4%] w-full h-[108%] object-cover will-change-transform"
                srcSet={heroSlides[0].srcSet}
                src={heroSlides[0].src}
                sizes="(max-width: 860px) 90vw, 34vw"
                alt={`${works[0].title} — ${works[0].location}`}
              />
            </div>
            {/* Same caption grammar as the gallery's frames — display face for
                the title, city (not country) and year set small on the right —
                so the fallback reads as one of the plates rather than as a
                stand-in for something missing. */}
            <figcaption className="mt-3 pt-3 border-t border-line flex items-baseline justify-between gap-4">
              <span className="font-display text-[clamp(16px,1.6vw,20px)] text-ink">
                {works[0].title}
              </span>
              <span className="text-[10.5px] tracking-[0.14em] uppercase text-ink-faint">
                {works[0].location.split(',')[0].trim()} — {works[0].year}
              </span>
            </figcaption>
          </figure>
        )}
      </div>

      {/* Takes over from the intro copy. Deliberately a different register from
          both the hero sub it replaces and About's opening below — those
          describe the work; this states the method, which is what the camera on
          screen is demonstrating.

          Parked at the top of the left column rather than at the copy's own
          height: that strip is the one region the model never reaches at any
          point in the turn, so the statement can hold all the way to the pin's
          release without colliding with callout 03, which needs the middle of
          the same column once the screen comes around. */}
      {immersive && (
        <p
          className="absolute left-edge top-[calc(var(--spacing-edge)+104px)] z-1 max-w-[clamp(280px,28vw,420px)] font-display text-[clamp(19px,2.05vw,29px)] leading-[1.35] text-ink opacity-0 pointer-events-none"
          ref={statementRef}
        >
          One body, one lens, no flash — every frame here is what the light was
          already doing.
        </p>
      )}

      <div
        className="hidden sm:flex absolute left-edge bottom-9 z-1 items-center gap-3 text-[11px] tracking-[0.18em] uppercase text-ink-faint"
        ref={scrollCueRef}
        aria-hidden="true"
      >
        <span className="w-px h-10 bg-[linear-gradient(var(--color-gold),transparent)]" />
        Scroll
      </div>

      {/* The turn's own furniture. It occupies the corner the scroll cue vacates
          and only ever appears while the section is pinned, so the composition
          hands off from copy to instrumentation instead of emptying out. */}
      {immersive && (
        <div className="absolute inset-x-edge bottom-9 z-1 flex items-end justify-between gap-10 pointer-events-none">
          <Readout ref={readoutRef} className="opacity-0" />

          {/* Reinstates what a pinned section takes away: some sense of how
              much of it is left. Same hairline vocabulary as the scroll cue.
              The standing "click the screen" line that used to sit beside it is
              gone — callout 03 says the same thing, pointing at the screen. */}
          <span className="relative block w-px h-14 bg-line" aria-hidden="true">
            <span
              className="absolute inset-x-0 top-0 h-full origin-top scale-y-0 bg-gold"
              ref={railFillRef}
            />
          </span>
        </div>
      )}

      {SCREEN_IMAGES.length > 0 &&
        createPortal(
          // position: fixed has to live outside #smooth-content — ScrollSmoother
          // applies a transform to that wrapper, and a transformed ancestor
          // turns descendant `fixed` elements into `absolute` ones (a new
          // containing block), which would make this scroll away instead of
          // staying pinned to the viewport during the crossfade. src starts
          // at the first slide and is repointed to whichever one was
          // actually on screen at click time (see handleScreenEnter).
          <div
            className="fixed inset-0 z-60 opacity-0 pointer-events-none"
            ref={screenRevealRef}
            aria-hidden="true"
          >
            <img
              className="w-full h-full object-cover block"
              ref={screenRevealImgRef}
              srcSet={heroSlides[0]?.srcSet}
              src={heroSlides[0]?.src}
              sizes="100vw"
              // Nothing sees this until a click that can't happen for several
              // seconds, so it must not compete with the LCD texture the
              // Preloader is actually waiting on.
              fetchPriority="low"
              alt=""
            />
          </div>,
          document.body
        )}

      {createPortal(
        // Same `position: fixed` reasoning as screenReveal above — it has to
        // sit outside #smooth-content to stay locked to the viewport. Sits
        // above that overlay in z so a shot fired at any point of the
        // narrative always flashes over whatever is on screen.
        //
        // Shutter clarão. A radial burst rather than a flat white sheet: a flat
        // fill at any usable opacity reads as the page blinking, while the
        // falloff reads as a light source firing in the room. Kept slightly
        // warm at the core to match the scene's key light (0xfff2d9), and
        // screen-blended so it lifts the dark background instead of painting a
        // grey film over it.
        //
        // Deliberately tight (46%/42%, fully transparent by 72%): a wider,
        // softer falloff was tried first and lifted the entire frame to an even
        // mid-grey at peak, which reads as fog rolling in rather than a flash
        // going off. Keeping the corners near-black is what makes it read as a
        // burst of light with a source, and it keeps the effect off the
        // nav/scroll cue at the edges. Opacity is the only thing animated — see
        // handleShutterFire above.
        <div
          className="fixed inset-0 z-70 opacity-0 pointer-events-none mix-blend-screen bg-[radial-gradient(46%_42%_at_50%_45%,rgba(255,252,244,0.98),rgba(255,243,221,0.4)_38%,rgba(255,236,202,0)_72%)]"
          ref={flashRef}
          aria-hidden="true"
        />,
        document.body
      )}
    </section>
  )
}
