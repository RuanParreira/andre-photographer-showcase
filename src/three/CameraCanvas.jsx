import { useEffect, useRef, useState } from 'react'
import { supportsHeavyMotion } from '../lib/capabilities'

export default function CameraCanvas({
  scrollProgressRef,
  reducedMotion,
  className,
  screenImages,
  onScreenEnter,
  onScreenExit,
  onShutterFire,
  onModelReady,
  onModelFail,
  onHotspots,
  hotspotTargetsRef,
}) {
  const canvasRef = useRef(null)
  const [eligible] = useState(() => supportsHeavyMotion() && !reducedMotion)

  useEffect(() => {
    if (!eligible || !canvasRef.current) return

    // Three.js is only pulled into a separate chunk and downloaded for the
    // devices that will actually render it — mobile/coarse-pointer visitors
    // never pay for it.
    let cancelled = false
    let scene

    import('./CameraScene')
      .then(({ CameraScene }) => {
        if (cancelled || !canvasRef.current) return
        scene = new CameraScene(canvasRef.current, {
          getScrollProgress: () => scrollProgressRef?.current ?? 0,
          screenImages,
          onScreenEnter,
          onScreenExit,
          onShutterFire,
          onModelReady: () => !cancelled && onModelReady?.(),
          onModelFail: () => !cancelled && onModelFail?.(),
          onHotspots: (positions) => !cancelled && onHotspots?.(positions),
        })
        // Read through a ref rather than taken as a value: which parts are
        // tracked changes on every scroll tick, and threading that through
        // props would tear down and rebuild the whole scene each time.
        if (hotspotTargetsRef) {
          hotspotTargetsRef.current = (ids) => scene?.setHotspotTargets(ids)
        }
        window.addEventListener('pointermove', handlePointerMove)
        window.addEventListener('click', handleClick)
        observer.observe(canvasRef.current)
      })
      // A chunk that never downloads (offline, blocked, WebGL context refused
      // on construction) has to report the same way a failed model load does,
      // or Hero would sit in its pending state forever.
      .catch((error) => {
        console.error('[CameraCanvas] camera scene unavailable', error)
        if (!cancelled) onModelFail?.()
      })

    // Measured against the canvas's own box, not the viewport. The two are
    // only interchangeable while the Hero is pinned and the canvas happens to
    // sit over the whole screen; the canvas is actually inset -10%/-5% inside
    // the section (so it is already larger than the viewport), and once the
    // pin releases it scrolls with the section and stops covering it at all.
    // Using window dimensions there put every raycast into a space that no
    // longer matched what was on screen, so hit-tests silently missed —
    // clicks stopped registering even with the cursor directly over a part.
    // rect is read per event rather than cached because ScrollSmoother
    // transforms this element continuously, so any cached box goes stale the
    // moment the page moves.
    //
    // setPointer's y is deliberately NOT flipped (positive = pointer below
    // center) to match its existing use in CameraScene's pointer-parallax
    // tilt. THREE's raycaster wants standard NDC instead (positive = above
    // center), which is just the negation of that same value.
    const toPointerNdc = (event) => {
      const canvas = canvasRef.current
      // React detaches refs in the mutation phase, before effect cleanup pulls
      // these window listeners — so an event landing in that window would
      // otherwise read a rect off null.
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return null
      return [
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        ((event.clientY - rect.top) / rect.height) * 2 - 1,
      ]
    }

    // The canvas itself is `pointer-events: none` (so the Hero text/links
    // underneath stay clickable everywhere else) — pointer/click are listened
    // for on the window instead, then converted into the canvas's own space
    // above, and only act when a raycast actually lands on a part.
    const handlePointerMove = (event) => {
      const ndc = toPointerNdc(event)
      if (!ndc) return
      const [nx, ny] = ndc
      scene?.setPointer(nx, ny)
      const y = -ny
      const hovering =
        scene?.hitTestScreen(nx, y) ||
        scene?.hitTestCylinder(nx, y) ||
        scene?.hitTestModeDial(nx, y) ||
        scene?.hitTestShutterButton(nx, y)
      document.body.style.cursor = hovering ? 'pointer' : ''
    }

    const handleClick = (event) => {
      const ndc = toPointerNdc(event)
      if (!ndc) return
      const [nx, ny] = ndc
      const y = -ny
      // Screen click takes priority (it's gated to the turned-around pose,
      // so it never really competes with the others); the rest are plain
      // fallbacks, each only claiming the click if its own raycast hits.
      if (scene?.handleScreenClick(nx, y)) return
      if (scene?.handleCylinderClick(nx, y)) return
      if (scene?.handleModeDialClick(nx, y)) return
      scene?.handleShutterButtonClick(nx, y)
    }

    const observer = new IntersectionObserver(
      ([entry]) => scene?.setActive(entry.isIntersecting),
      { rootMargin: '25% 0px 25% 0px' }
    )

    return () => {
      cancelled = true
      if (hotspotTargetsRef) hotspotTargetsRef.current = null
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('click', handleClick)
      document.body.style.cursor = ''
      observer.disconnect()
      scene?.dispose()
    }
  }, [
    scrollProgressRef,
    eligible,
    screenImages,
    onScreenEnter,
    onScreenExit,
    onShutterFire,
    onModelReady,
    onModelFail,
    onHotspots,
    hotspotTargetsRef,
  ])

  if (!eligible) return null

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}
