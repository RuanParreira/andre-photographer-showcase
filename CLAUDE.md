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

**Each section under `src/sections/<Name>/` is self-contained**: `<Name>.jsx` + `<Name>.module.css`, animations driven by `useGSAP` scoped to a section `ref`, entrance/scroll reveals via `ScrollTrigger`. `Work/` additionally uses `Flip` for category-filter re-layout and portals `Lightbox.jsx` into `document.body`.

**Responsive images are generated, not hand-authored.** `scripts/optimize-images.mjs` is a manual one-off pipeline: reads originals from `imgs/Projetos` and `imgs/perfil`, resizes with `sharp` to fixed width sets (work: 640/1080/1600/2200, profile: 480/900/1400) as WebP plus one JPEG fallback, and writes them into `src/assets/work/` and `src/assets/profile/` as `<slug>-<width>.webp` / `<slug>.jpg`. Filename-to-slug mapping lives in the `WORK_SLUGS`/`PROFILE_SLUGS` maps in that script. Run it manually after adding/changing source photos — it is not wired into `build`.

`src/lib/images.js` then uses `import.meta.glob` to eagerly scan those generated asset folders and builds `{ slug: { srcSet, src, widths } }` maps (`workImages`, `profileImages`) purely from filenames — components never reference image paths directly. Adding a new work image means: drop the source file, add it to `WORK_SLUGS`, run the optimize script, then add a matching entry to `src/data/work.js` (`works` array — slug/title/location/year/category/size).

**`src/data/work.js`** is the single source of truth for portfolio content and categories (`Urban`/`Landscape`/`Nature`); `size` (`large`/`tall`/`wide`/`half`/`solo`) drives the CSS grid layout in `Work.module.css`.

**The Three.js camera (`src/three/`) is lazy-loaded and gated.** `CameraCanvas.jsx` only imports `./CameraScene` (dynamic `import()`) when `supportsHeavyMotion()` passes (`min-width: 860px` + `pointer: fine`) and `reducedMotion` is false — mobile/coarse-pointer/reduced-motion visitors never download the Three.js chunk. `CameraScene.js` is a plain class (not a React component) that owns the renderer/scene/model lifecycle directly, driven by `requestAnimationFrame`; it reads scroll progress via a ref callback (`getScrollProgress`) passed in from `Hero.jsx`'s `ScrollTrigger` `onUpdate`, and pauses rendering when off-screen via `IntersectionObserver`. The model is `public/models/camera.glb` (CC-BY-4.0 licensed — see the credit comment at the top of `CameraScene.js` and the on-page credit in Contact/footer; keep both in sync if the model changes). `Modelo3D/` at the repo root holds raw/alternate `.glb` source files not used at runtime.

## Conventions

- CSS Modules per component (`*.module.css`), no global utility CSS framework.
- Animations should degrade cleanly under `prefers-reduced-motion` — check how `Hero.jsx`/`Work.jsx` gate their `useGSAP` effects before adding new motion.
- Vite's `import.meta.glob` is used for filename-driven asset discovery (images) rather than static imports — follow this pattern instead of hardcoding asset paths when extending it.
