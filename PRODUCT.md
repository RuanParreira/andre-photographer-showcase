# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user: someone evaluating the developer's frontend/motion-design craft — recruiters, prospective clients, or peers browsing a portfolio piece. André, his bio, and his photographs are fictional; the real deliverable on show is the build (GSAP scroll choreography, the pinned Three.js camera, masonry gallery), not a working photography business. Confirmed: this is a dev showcase piece, not a template awaiting a real photographer's identity.

## Product Purpose

A single-page portfolio site demonstrating high-craft scroll-driven interaction design: a Hero with a pinned, scroll-scrubbed 3D camera model and technical callouts, a scroll-revealed About section, a JS-distributed masonry Work gallery with category filtering (Flip-animated), and a Contact section. Success is the interaction and visual craft reading as intentional and polished under inspection, not real client acquisition for "André."

## Positioning

André's stated photographic identity — confirmed as the copy standard future sections should match, not open for casual rewriting: 8 years of experience, natural/available light only, no staging or flash, always shot handheld, working across three categories (Urban, Landscape, Nature), based in Lisbon.

## Operating Context

- Single scrolling page, four sections: Hero, About, Work, Contact — see CLAUDE.md for the technical architecture of each.
- Desktop with `pointer: fine` and `min-width: 860px` gets the live Three.js camera in Hero; everyone else (mobile, coarse pointer, reduced motion) gets a flat fallback layout — this is a hard capability gate, not a progressive nice-to-have.
- Respects `prefers-reduced-motion` throughout; every animated section has a reduced-motion early return.

## Capabilities and Constraints

- Stack is fixed and already built: React 19 + Vite + Tailwind CSS v4 + GSAP (ScrollTrigger/ScrollSmoother/SplitText/Flip/Observer) + Three.js. See CLAUDE.md for the established architecture — do not introduce a competing pattern (e.g. CSS Modules, a different animation library, class-name-driven GSAP targeting).
- No backend, no CMS, no real contact form submission — the Contact section's mailto/Instagram links are illustrative, not a lead-generation pipeline to build out.
- Work gallery content (10 pieces across Urban/Landscape/Nature) lives in `src/data/work.js` and is treated as fixed demo content, not a dataset to expand toward realism.

## Brand Commitments

- Name: André (photographer), site framed as his portfolio.
- Voice: understated, technical-print register (plate captions, spec-sheet metadata blocks) rather than marketing copy — see how About/Contact/Hero all reuse the same label/value "readout" pattern instead of ad-hoc prose blocks.
- 3D camera model (`public/models/camera.glb`) is CC BY 4.0 by Sketchfab user "santy" — credit in Contact's footer is a binding attribution requirement, must stay in sync if the model ever changes (also noted at the top of `CameraScene.js`).
- The "Fictional portfolio, built for demonstration purposes" disclaimer in Contact's footer is a binding fact, not filler — this project must never be dressed up with fabricated real-world claims (real client names, pricing, testimonials, press).

## Evidence on Hand

- All portfolio photographs are real source images (`imgs/Projetos`, `imgs/perfil`) processed into responsive sets by `scripts/optimize-images.mjs`, but the photographer and his biography are fictional — do not invent additional biographical "facts" beyond what's already confirmed here and in the existing copy.
- No real testimonials, press, client list, or pricing exist and none should be fabricated.

## Product Principles

1. The build's technical/interaction craft is the actual product — every section exists to demonstrate a specific piece of scroll/animation engineering, not to sell a photography business.
2. Never let the site drift into claiming real-world legitimacy (real clients, real bookings, real testimonials) — the fictional framing is explicit and permanent.
3. New copy or sections must match André's established voice (natural light, handheld, no staging, 8 years, three categories) rather than introducing a different photographic identity.
4. Respect the capability gate between the live 3D hero and its flat fallback — never assume the Three.js path is guaranteed to run.
5. Follow the architecture already documented in CLAUDE.md; this is a mature, opinionated codebase, not a blank slate.
