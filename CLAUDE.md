# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A single-page React + Vite portfolio site for a photographer ("André"). Sections (Hero, About, Work, Contact) scroll-animate via GSAP, with a Three.js camera model rendered in the Hero on capable devices.

## Commands

```bash
npm run dev       # Vite dev server
npm run build     # production build
npm run lint      # eslint .
npm run preview   # preview production build
node scripts/optimize-images.mjs   # regenerate responsive images from imgs/ source photos
```

There is no test suite configured.

## Architecture

**GSAP setup is centralized in `src/lib/gsap.js`** — all plugins (`useGSAP`, `ScrollTrigger`, `ScrollSmoother`, `SplitText`, `Flip`, `Observer`) are registered once there and re-exported. Always import GSAP from this module, never from `gsap` directly, or plugins won't be registered.

**`App.jsx` owns the smooth-scroll wrapper.** `ScrollSmoother` wraps `#smooth-wrapper`/`#smooth-content` around the section list, and is skipped entirely when `useReducedMotion()` is true. Every section receives `reducedMotion` as a prop and must early-return from its `useGSAP` effect when true — this is the established pattern for respecting `prefers-reduced-motion`, follow it for any new animated section.

**`App.jsx` also owns the page-load handoff**, in two separate flags. `preloading` keeps `components/Preloader/` mounted and native scroll locked; `ready` is flipped earlier, the moment the Preloader's curtain *starts* lifting, so the first-paint animations overlap the lift instead of following it. Anything that animates on load — currently `Nav` and `Hero` — takes `ready` as a prop and gates its `useGSAP` effect on it the same way it gates on `reducedMotion`: blank the elements and early-return while false, list `ready` in `dependencies`. Running an entrance behind the curtain would spend it where nobody can see it.

**Each section under `src/sections/<Name>/` is self-contained**: a single `<Name>.jsx` styled with Tailwind utility classes directly in `className`, animations driven by `useGSAP` scoped to a section `ref`, entrance/scroll reveals via `ScrollTrigger`. `Work/` additionally uses `Flip` for category-filter re-layout and portals `Lightbox.jsx` into `document.body`. GSAP always targets refs or `[data-role="..."]` query selectors, never class names, so styling and animation are fully decoupled.

**Responsive images are generated, not hand-authored.** `scripts/optimize-images.mjs` is a manual one-off pipeline: reads originals from `imgs/Projetos` and `imgs/perfil`, resizes with `sharp` to fixed width sets (work: 640/1080/1600/2200, profile: 480/900/1400) as WebP plus one JPEG fallback, and writes them into `src/assets/work/` and `src/assets/profile/` as `<slug>-<width>.webp` / `<slug>.jpg`. Filename-to-slug mapping lives in the `WORK_SLUGS`/`PROFILE_SLUGS` maps in that script. Run it manually after adding/changing source photos — it is not wired into `build`.

`src/lib/images.js` then uses `import.meta.glob` to eagerly scan those generated asset folders and builds `{ slug: { srcSet, src, widths, sources } }` maps (`workImages`, `profileImages`) purely from filenames — components never reference image paths directly. `sources` is the ascending `[{ width, url }]` list, for the rare consumer that has to name one specific variant instead of handing a `srcSet` to the browser. Adding a new work image means: drop the source file, add it to `WORK_SLUGS`, run the optimize script, then add a matching entry to `src/data/work.js` (`works` array — slug/title/location/year/category/shape/tier).

The same module also exports `heroSlides` — the first five works, each with both a small `texture` variant (what the 3D LCD samples) and the full `srcSet`/`src` (what the fullscreen DOM crossfade uses) — plus `heroSlideImages`, just the texture URLs. Hero, `CameraScene` and the Preloader all read from these rather than deriving their own slide list, since the Preloader's progress is only honest if it waits on the exact URL the scene later loads.

**`src/data/work.js`** is the single source of truth for portfolio content and categories (`Urban`/`Landscape`/`Nature`). Each work carries two independent axes: `shape` (`tall`/`portrait`/`square`/`landscape`) is **layout only**, and `tier` (`featured`/`secondary`) is **hierarchy only** — how loudly the caption is set. Keeping them apart means a piece can be re-weighted without touching the composition.

**The gallery is a JS-distributed masonry**, not a CSS grid. `useColumnCount` reports 3 / 2 / 1 columns and `Work.jsx` deals `works` across them round-robin — not shortest-column-first, because these are numbered plates and dealing keeps 01, 02, 03 running left to right along the top. Columns ending at different heights is the intended look. Flex tracks rather than CSS `columns`, which would break a caption away from its image at a column boundary. **Two columns is the floor for real phones**: dropping to one at 480px put ten full-width photographs back in a stack and made the section *longer* on mobile than the fixed grid it replaced.

`shape` maps to an aspect in `WorkItem.jsx`'s `ASPECT` — in a masonry each frame owns its column's full width and contributes only height, so the token's whole job is keeping neighbouring columns from settling into matching bands. Plate numbers come from `PLATE_INDEX` (position in `works`), so they identify the work and do **not** renumber when the filter reorders the gallery.

Work's reveal is **one `ScrollTrigger.batch`**, not a trigger per item; the image's settle out of its slight over-scale is folded into the same tween rather than being a separate scrubbed trigger. When the category filter runs, the `Flip` effect force-reveals every item and calls `ScrollTrigger.refresh()` — reordered frames are otherwise still parked at `autoAlpha: 0` with stale trigger positions, which renders as an entirely blank gallery. `Flip.from` needs `absolute: true` here because frames change parent column, not just order within one container.

Three consequences of the Hero being pinned, all already bitten once:

- **`scrollToSection('hero')` must not resolve the element.** A pinned element's scroll position resolves to the *end* of its pin range, so "back to top" from mid-pin jumped forward to 1980px instead of to 0. `scrollToSection` special-cases the hero to an absolute 0.
- **The pin preserves *progress* across a refresh, not the scroll offset.** The pin is `+=220%` of the viewport height, so zooming changes its length and the same pixel offset lands at a different point in the turn — the camera visibly swings to a new pose. Hero holds progress over `refreshInit`/`refresh` (so nothing animates through the intermediate values) and then moves the scroll to where that progress now lives. `App.jsx` also shortens ScrollTrigger's own 200ms resize debounce to 60ms: for those milliseconds the pinned section keeps the explicit size the pin gave it, and a section still laid out for the old viewport is most of what reads as the camera jumping.
- **`CameraScene` sizes its renderer from a `ResizeObserver`, not from `window.resize`.** ScrollTrigger resizes the pinned box during its own refresh, which runs *after* window resize listeners — so a window-resize-only handler read the old size and left the drawing buffer one resize behind the CSS box, which is what stretched the model on zoom. `_handleResize` also re-reads `devicePixelRatio` (zoom changes it), renders once synchronously (the frame's rAF render has already run at the old size, and `setSize` clears the buffer — without this the browser paints either a stretched or an empty canvas), and a `(resolution: Ndppx)` media query covers a ratio change that moves no boxes.

**Hero has two layouts, chosen by `cameraStage`** (`'pending' | 'live' | 'flat'`). Devices that fail `supportsHeavyMotion()` (`src/lib/capabilities.js`) start at `'flat'`; the rest start `'pending'` and are resolved by `CameraScene`'s `onModelReady`/`onModelFail`, by a failed dynamic import, or by `MODEL_TIMEOUT_MS`. Only `'live'` pins the section for `+=220%` — every other outcome (`'pending'` and `'flat'` alike, tested as `!immersive`) lays it out as a single-viewport section with a still frame and caption beside the copy, so neither a missing camera nor one still loading costs two screens of empty scrolling or a blank canvas waiting on the GLB. A late `onModelReady` is downgraded to `'flat'` if the visitor has already scrolled past a quarter of the viewport, since adding the pin then would yank the page under them.

Hero's entrance cascade and its scroll narrative are **two separate `useGSAP` effects on purpose**: only the scroll one depends on the stage, so a camera resolving a second after mount cannot replay the intro in front of someone already reading it. Everything the pin drives (copy fade, the metadata readout that replaces it, the progress rail) is written from that single trigger's `onUpdate` via `quickSetter`, not from a ScrollTrigger per element.

**`Hero/Callouts.jsx` is the technical-callout overlay** — DrawSVG leader lines that draw from the 3D parts out to labels in the left column, which is the space the hero copy vacates on scroll. Anchors are not hardcoded: `CameraScene.setHotspotTargets(ids)` names the parts to track and `onHotspots` reports their projected screen position (canvas-relative 0..1) plus an `occluded` flag every frame, so a line follows its part as the body rotates and retracts when the part turns away. `HOTSPOT_RESOLVERS` in `CameraScene.js` resolves each id to the right object — note that `LCD` and `Botao` are **not** usable via `getObjectByName` for this: neither carries a transform of its own, so a name lookup returns the parent's origin (a point inside the body that reads as permanently occluded). The screen resolves to the built `screenPlane` instead.

The scroll windows in `CALLOUTS` were read off that same occlusion test, not chosen by eye — lens clear until ~0.44, dial clear throughout, screen clear from ~0.56 (which is also `CLICK_MIN_PROGRESS`). Re-check them against the probe if the turn's timing constants change. Only the visible callout is tracked at a time, since each id costs a projection and a raycast per frame inside the render loop.

Each callout's elbow is placed **relative to its part** (`side`/`dx`/`dy`), not at a fixed page position. Anchoring labels to the left edge made every leader cross the viewport to reach a model sitting right of centre, which reads as a mistake rather than a diagram. Each label node nests three deep — anchor (positioned per frame), label (GSAP's reveal `x`/opacity), veil (occlusion opacity) — so no two writers share a transform or an opacity.

The left column is not left empty when the intro copy scrolls away: `statementRef` in `Hero.jsx` fades a one-line statement about André into that space for the first half of the turn and clears it before callout 02 needs the room. That is why callout 01 takes the right side while 02 and 03 take the left.

**The Three.js camera (`src/three/`) is lazy-loaded and gated.** `CameraCanvas.jsx` only imports `./CameraScene` (dynamic `import()`) when `supportsHeavyMotion()` passes (`min-width: 860px` + `pointer: fine`) and `reducedMotion` is false — mobile/coarse-pointer/reduced-motion visitors never download the Three.js chunk. `CameraScene.js` is a plain class (not a React component) that owns the renderer/scene/model lifecycle directly, driven by `requestAnimationFrame`; it reads scroll progress via a ref callback (`getScrollProgress`) passed in from `Hero.jsx`'s `ScrollTrigger` `onUpdate`, and pauses rendering when off-screen via `IntersectionObserver`. The model is `public/models/camera.glb` (CC-BY-4.0 licensed — see the credit comment at the top of `CameraScene.js` and the on-page credit in Contact/footer; keep both in sync if the model changes). `Modelo3D/` at the repo root holds raw/alternate `.glb` source files not used at runtime.

## Conventions

- **Styling is Tailwind CSS v4 utility classes directly in JSX** (`@tailwindcss/vite` plugin, no `*.module.css` files, no `tailwind.config.js` — v4 is CSS-first config). Design tokens (colors, fonts, the two shared `edge`/`section-gap` spacing values) are declared as real Tailwind theme tokens in an `@theme` block at the top of `src/index.css`, so they're usable as ordinary utilities (`bg-ink`, `text-gold`, `px-edge`, `font-display`, etc.) rather than copy-pasted arbitrary values. `src/index.css` also redefines the breakpoint scale to the site's actual layout breakpoints — `xs:480px`, `sm:640px`, `md:720px`, `lg:860px` — which do **not** match Tailwind's stock `sm/md/lg/xl` widths; check that block before assuming a breakpoint's pixel value. A handful of cross-cutting element defaults (`h1-h3`, `p`, `a`, `button`, `::selection`, focus-visible ring, the `prefers-reduced-motion` safety net) stay as plain CSS below the `@theme` block rather than being repeated as classes on every element.
- Bespoke sizes with no clean scale step (most of this site's typography/spacing uses `clamp()`) are written as Tailwind arbitrary-value utilities (e.g. `text-[clamp(72px,15vw,220px)]`) rather than forced onto the default scale.
- Animations should degrade cleanly under `prefers-reduced-motion` — check how `Hero.jsx`/`Work.jsx` gate their `useGSAP` effects before adding new motion.
- Vite's `import.meta.glob` is used for filename-driven asset discovery (images) rather than static imports — follow this pattern instead of hardcoding asset paths when extending it.
