---
name: André — Photographer Showcase
description: A warm-dark, print-registered portfolio system built on hairlines, serif display type, and a single restrained gold accent.
colors:
  bg: "#0b0b0a"
  bg-soft: "#131210"
  ink: "#f4efe4"
  ink-dim: "rgba(244, 239, 228, 0.62)"
  ink-faint: "rgba(244, 239, 228, 0.34)"
  gold: "#c9a25c"
  gold-dim: "rgba(201, 162, 92, 0.55)"
  line: "rgba(244, 239, 228, 0.14)"
typography:
  display:
    fontFamily: "Fraunces, Georgia, 'Times New Roman', serif"
    fontSize: "clamp(32px, 4.5vw, 56px)"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  hero-display:
    fontFamily: "Fraunces, Georgia, 'Times New Roman', serif"
    fontSize: "clamp(72px, 15vw, 220px)"
    fontWeight: 500
    lineHeight: 0.88
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "clamp(15px, 1.3vw, 18px)"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "10.5px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.16em"
rounded:
  none: "0px"
  full: "9999px"
spacing:
  edge: "clamp(20px, 5vw, 64px)"
  section-gap: "clamp(96px, 14vw, 220px)"
components:
  nav-link:
    textColor: "{colors.ink}"
    typography: "{typography.label}"
  nav-link-hover:
    textColor: "{colors.ink}"
  button-filter:
    textColor: "{colors.ink-faint}"
    typography: "{typography.label}"
  button-filter-active:
    textColor: "{colors.ink}"
  button-icon:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    size: "40px"
---

# Design System: André — Photographer Showcase

## Overview

**Creative North Star: "The Contact Sheet"**

This system reads like a photographer's own contact sheet, not a marketing gallery: numbered plates, printed captions running under each frame, and spec-sheet readouts (label over value, in small tracked capitals) standing in for the confident, unfussy documentation an editor would leave in the margins. Everything is dark, warm, and quiet — a darkroom register rather than a lit showroom. The single accent color is treated like foil-stamping: rare, metallic, and never a fill.

Confirmed anti-reference: this is explicitly **not** a bright, airy, minimalist gallery template (white space, sans-only type, pastel accents) — the palette stays warm-dark and print-registered instead. Depth comes from stacking and hairline division, not light backgrounds or drop shadows.

**Key Characteristics:**
- Warm near-black ground with warm off-white ink — never pure black/white.
- Serif display (Fraunces) for names, titles, and headings; sans (Inter) for everything else, almost always in small tracked uppercase for labels.
- One accent — Brass/Antique Gold — used only as a rare mark: kickers, active states, hover reveals, progress fills. Never a background fill.
- Hairline dividers (`--color-line`, 14% opacity) are the primary structural device, not borders or cards.
- Flat by default; the one shadow in the system exists solely to lift a physically overlapping element off the surface beneath it.
- No border-radius anywhere except fully circular icon buttons — photographic frames are always sharp rectangles.

## Colors

A two-tone warm-dark palette (Darkroom Black over Warm Print white) with a single metallic accent that appears sparingly enough to stay a punctuation mark, not a hue.

### Primary
- **Darkroom Black** (`#0b0b0a`): The page ground (`bg`) and the color behind every section — never lightened for cards or panels.

### Secondary
- **Brass** (`#c9a25c`) — `gold`: The system's one accent. Used only for: kicker labels ("01 — About"), plate numbers, the active-filter underline, the hover-fill sweep on caption rules, the scroll/pin progress rail, and focus rings. Never a background fill, never a large area.
- **Dimmed Brass** (`rgba(201, 162, 92, 0.55)`) — `gold-dim`: The quieter register of the accent — separator dashes, the plate-number digits themselves, the "%" glyph in the preloader counter.

### Neutral
- **Warm Print White** (`#f4efe4`) — `ink`: Primary text, headings, active nav/filter state.
- **Warm Print, dimmed** (`rgba(244, 239, 228, 0.62)`) — `ink-dim`: Body copy, secondary reads (readout values, subheads).
- **Warm Print, faint** (`rgba(244, 239, 228, 0.34)`) — `ink-faint`: Tertiary/meta text — captions' location-year line, inactive filter labels, plate-line eyebrow text.
- **Soft Black** (`#131210`) — `bg-soft`: Image-frame placeholder background before a photo loads; sits one step above the page ground.
- **Hairline** (`rgba(244, 239, 228, 0.14)`) — `line`: Every structural divider in the system — under captions, above metadata rows, at column edges.

### Named Rules
**The Foil-Stamp Rule.** Brass never fills a shape. It only marks: a line, a digit, a label, a 1px rule. The moment gold becomes a background or a large filled area, it has left this system.

## Typography

**Display Font:** Fraunces (with Georgia, Times New Roman, serif fallback)
**Body Font:** Inter (with system-ui, -apple-system, Segoe UI, sans-serif fallback)

**Character:** A confident, slightly warm serif for names and headlines against a disciplined, small-tracked sans for everything functional — the pairing reads as a photobook's title page next to its printed technical index.

### Hierarchy
- **Hero Display** (500, `clamp(72px, 15vw, 220px)`, line-height 0.88): André's name in the Hero — the one place type is allowed to dominate the frame.
- **Display** (500, `clamp(32px, 4.5vw, 56px)`, line-height 1.1): Section headings (About, Work, Contact) and work-item featured titles.
- **Body** (400, `clamp(15px, 1.3vw, 18px)`, line-height 1.7): Section copy, capped around 46ch.
- **Label** (400, `10.5px`–`13px`, letter-spacing `0.14em`–`0.22em`, uppercase): The dominant functional voice of the system — kickers, readout labels, captions' location/year, nav links, filter buttons. Nearly every piece of UI chrome in this system is this one label style.

### Named Rules
**The Readout Rule.** Any paired fact (Location/value, Body/Lens, Email/value) is set as an uppercase 10.5px label over an ink-dim value line — never inline prose, never a form-style side-by-side pair with different type roles left and right.

## Layout

Single-column scrolling page, four sections (Hero, About, Work, Contact) separated by `--spacing-section-gap` (`clamp(96px, 14vw, 220px)`), each padded horizontally by `--spacing-edge` (`clamp(20px, 5vw, 64px)`). Custom breakpoint scale replaces Tailwind's stock widths: `xs` 480px, `sm` 640px, `md` 720px, `lg` 860px (the last is also the hard gate for the live 3D Hero). Work's gallery is a JS-distributed masonry (2–3 flex columns, never fewer than 2 on real phones) rather than a CSS grid, so captions never break away from their image at a column edge.

## Elevation & Depth

Flat by default. This system does not use a shadow scale for cards, buttons, or panels — depth is conveyed through hairline division, z-stacking, and opacity (dimmed/occluded states), not elevation. The one exception is deliberate and singular: an element that physically overlaps another surface gets a shadow to sell that overlap, nothing else does.

### Shadow Vocabulary
- **Overlap lift** (`box-shadow: 0 24px 48px rgba(0,0,0,0.5)`, paired with a 4–6px solid `bg` border): Used exactly once, on About's accent photo where it overhangs the primary portrait. Reserved for genuine physical overlap between two surfaces — not a general "raise this card" treatment.

### Named Rules
**The Flat-Unless-Overlapping Rule.** A surface only earns a shadow when it is literally floating over another surface in the composition. A card, button, or panel sitting on the page ground stays flat; reach for a hairline or opacity change instead.

## Shapes

Photographic frames and their containers are always sharp rectangles — zero border-radius across every image, caption block, and section. The one departure is fully circular (`rounded-full`) icon buttons (lightbox close/prev/next), which read as camera-hardware dials rather than UI chrome. No other radius scale exists in the system.

## Components

Interactive elements behave like type first — underlines, letter-spacing, and hairlines carry the interaction, not fills or elevation. A filled or pill-shaped button would be foreign to this system.

### Buttons (ghost / text)
- **Shape:** No radius, no border, no background at rest — pure typography.
- **Filter / Nav links:** Uppercase label type; state is shown by an animated underline (`scaleX`/`right` reveal from a hidden hairline to gold or ink) rather than by weight or color fill. Active state simply switches text from `ink-faint`/`ink-dim` to full `ink` plus a locked-in underline.
- **Hover / Focus:** The underline animates in on hover; `:focus-visible` gets a 1.5px gold outline offset 4px — the only ring in the system.

### Icon Buttons (lightbox controls)
- **Shape:** Fully circular (`rounded-full`), 40–44px, 1px `line`-colored ring border, transparent fill.
- **Content:** A single glyph (×, ‹, ›) in `ink`, centered.
- **State:** No hover treatment beyond the browser default — deliberately quiet controls that don't compete with the photograph.

### Readout (signature component)
The system's recurring label/value block — used identically in Hero (camera spec readout), About (bio meta grid), and Contact (contact details). Each row is an uppercase `label` (`ink-faint`, 10.5px) stacked directly over its value (`ink` or `ink-dim`), with rows in the multi-item versions separated by a top hairline rather than a shared outer border. This is the system's primary way of presenting structured facts — never a table, never inline "Label: value" prose.

### Captions (signature component)
Every photograph (Work grid, Lightbox, Hero's flat fallback, About's portrait) is captioned the same way: a hairline rule directly under the image (which fills solid gold left-to-right on hover in the grid), then a baseline-aligned row with the title in display type on the left and a small tracked location/year on the right. This caption grammar is what makes every image in the system read as one plate from the same book.

## Do's and Don'ts

### Do:
- **Do** treat gold as a rare, metallic mark (kickers, underlines, digits, progress fills) — see The Foil-Stamp Rule.
- **Do** use the Readout pattern (uppercase label over value) for any structured fact, matching Hero/About/Contact.
- **Do** caption every photograph with the same hairline-rule + title-left/location-year-right grammar.
- **Do** keep photographic frames and their containers at zero radius.
- **Do** set functional/UI chrome text in the Label style (small, uppercase, tracked `0.14–0.22em`) rather than default body type.

### Don't:
- **Don't** fill a button or chip with a solid background — every interactive element here is ghost/text-first (The Flat-Unless-Overlapping Rule extends to buttons: no fills, no elevation).
- **Don't** add border-radius to photo frames, captions, or section containers — radius is reserved for the circular icon buttons only.
- **Don't** add a drop shadow to a card, panel, or button sitting flat on the page ground — shadows exist only for genuine physical overlap (see Elevation & Depth).
- **Don't** introduce a second accent color — Brass is the system's only hue beyond the warm neutral scale.
- **Don't** lighten the page ground for "cards" — depth comes from `bg` → `bg-soft` → hairline, never from a light panel.
