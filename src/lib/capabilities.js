// Gate on viewport size + pointer precision: phones and coarse-pointer devices
// skip WebGL entirely rather than getting a throttled/cropped version of it.
//
// Lives here rather than next to the canvas because two very different things
// need the answer — CameraCanvas, to decide whether to download Three.js at
// all, and Hero, to decide how much scroll distance the section reserves. The
// 860px matches the `lg` breakpoint in index.css, so the layout that takes over
// when this returns false switches at exactly the same width.
export function supportsHeavyMotion() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(min-width: 860px)').matches &&
    window.matchMedia('(pointer: fine)').matches
  )
}
