import { useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { gsap, useGSAP, SplitText, ScrollTrigger } from '../../lib/gsap'
import CameraCanvas from '../../three/CameraCanvas'
import { workImages } from '../../lib/images'
import { works } from '../../data/work'
import { scrollToSection } from '../../lib/scrollToSection'
import styles from './Hero.module.css'

// The first few entries in data/work.js — the LCD cycles through these
// (CameraScene's slideshow) instead of showing a single static photo.
// Clicking dollies the 3D camera toward whichever one is on screen at that
// moment and hands off to the real Work grid, so the DOM crossfade below
// shows that same photo (framing isn't pixel-identical — the LCD's own
// aspect differs from the viewport's — so the handoff fades rather than
// cutting).
const SCREEN_IMAGES = works.slice(0, 5).map((work) => workImages[work.slug]?.src).filter(Boolean)

function smoothstep(edge0, edge1, x) {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1)
  return t * t * (3 - 2 * t)
}

export default function Hero({ reducedMotion }) {
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
      if (screenRevealImgRef.current && imageUrl) screenRevealImgRef.current.src = imageUrl
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

      const title = new SplitText(titleRef.current, { type: 'chars' })
      const sub = new SplitText(subRef.current, { type: 'lines' })

      // Full page entrance cascade: kicker -> title -> role -> sub -> scroll
      // cue, each overlapping the previous so it reads as one continuous
      // reveal rather than separate pieces arriving on their own.
      const tl = gsap.timeline({ delay: 0.3 })
      tl.set(kickerRef.current, { y: 14, opacity: 0 })
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

      // quickSetter instead of gsap.set/to: onUpdate fires on every scrub
      // tick, and this just needs a cheap direct style write, not a tween.
      const setContentOpacity = gsap.quickSetter(contentRef.current, 'opacity')
      const setScrollCueOpacity = gsap.quickSetter(scrollCueRef.current, 'opacity')

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
          scrollProgress.current = self.progress
          // The intro text only makes sense for the "presentation" state —
          // once the camera starts its turn, fade it out of the way so it
          // doesn't compete with the model moving through the frame.
          const textOpacity = 1 - smoothstep(0.02, 0.18, self.progress)
          setContentOpacity(textOpacity)
          setScrollCueOpacity(textOpacity)
        },
      })

      return () => {
        pin.kill()
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
    { scope: sectionRef, dependencies: [reducedMotion] }
  )

  return (
    <section id="hero" ref={sectionRef} className={styles.hero}>
      <div className={styles.canvasWrap}>
        <CameraCanvas
          scrollProgressRef={scrollProgress}
          reducedMotion={reducedMotion}
          screenImages={SCREEN_IMAGES}
          onScreenEnter={handleScreenEnter}
          onScreenExit={handleScreenExit}
          onShutterFire={handleShutterFire}
        />
      </div>

      <div className={styles.content} ref={contentRef}>
        <p className={styles.kicker} ref={kickerRef}>Urban — Landscape — Nature</p>
        <h1 className={styles.title} ref={titleRef}>
          <span className={styles.titleLine}>André</span>
        </h1>
        <p className={styles.role} ref={roleRef}>Photographer</p>
        <p className={styles.sub} ref={subRef}>
          Fine-art photography shaped by natural light — cities at dusk,
          open landscapes, and quiet studies of nature.
        </p>
      </div>

      <div className={styles.scrollCue} ref={scrollCueRef} aria-hidden="true">
        <span className={styles.scrollLine} />
        Scroll
      </div>

      {SCREEN_IMAGES.length > 0 &&
        createPortal(
          // position: fixed has to live outside #smooth-content — ScrollSmoother
          // applies a transform to that wrapper, and a transformed ancestor
          // turns descendant `fixed` elements into `absolute` ones (a new
          // containing block), which would make this scroll away instead of
          // staying pinned to the viewport during the crossfade. src starts
          // at the first slide and is repointed to whichever one was
          // actually on screen at click time (see handleScreenEnter).
          <div className={styles.screenReveal} ref={screenRevealRef} aria-hidden="true">
            <img ref={screenRevealImgRef} src={SCREEN_IMAGES[0]} alt="" />
          </div>,
          document.body
        )}

      {createPortal(
        // Same `position: fixed` reasoning as screenReveal above — it has to
        // sit outside #smooth-content to stay locked to the viewport. Sits
        // above that overlay in z so a shot fired at any point of the
        // narrative always flashes over whatever is on screen.
        <div className={styles.shutterFlash} ref={flashRef} aria-hidden="true" />,
        document.body
      )}
    </section>
  )
}
