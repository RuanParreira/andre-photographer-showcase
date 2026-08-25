import { useEffect, useRef, useState } from 'react'
import { gsap, useGSAP, ScrollTrigger } from '../../lib/gsap'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { scrollToSection } from '../../lib/scrollToSection'

// The index is not a decorative numbering invented for the nav — About, Work
// and Contact already print `01 —`, `02 —` and `03 —` as their own eyebrows.
// Repeating them here makes the nav a table of contents for a system the page
// already has, which is also why the hero has no number: it is the cover.
const LINKS = [
  { id: 'about', label: 'About', index: '01' },
  { id: 'work', label: 'Work', index: '02' },
  { id: 'contact', label: 'Contact', index: '03' },
]

// Repeated in the panel's footer rather than only in Contact: someone who opens
// the menu on a phone is usually looking for a way to reach André, and making
// them scroll the whole page to find it is the thing a menu exists to avoid.
const PANEL_CONTACTS = [
  { label: 'Email', value: 'hello@andre.studio', href: 'mailto:hello@andre.studio' },
  { label: 'Instagram', value: '@andre.frame', href: 'https://instagram.com/andre.frame' },
]

// The one breakpoint that matters here, and it is also `md` in src/index.css —
// keep the two in step, the JS needs it to close the panel when a rotation or a
// resize takes the inline list back.
const DESKTOP_QUERY = '(min-width: 720px)'

export default function Nav({ ready }) {
  const reducedMotion = useReducedMotion()
  const navRef = useRef(null)
  const panelRef = useRef(null)
  const [activeId, setActiveId] = useState(null)
  const [landed, setLanded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  // Site's first-paint entrance: nav drops in just ahead of the Hero copy so
  // the page doesn't feel like it's missing a beat before the title reveal.
  // `ready` is the Preloader lifting its curtain — running this while the page
  // is still covered would spend the drop-in where nobody can see it and leave
  // a nav that is simply already there once the curtain clears.
  useGSAP(
    () => {
      if (reducedMotion) return
      if (!ready) {
        gsap.set(navRef.current, { opacity: 0 })
        return
      }
      gsap.set(navRef.current, { y: -18, opacity: 0 })
      const tween = gsap.to(navRef.current, {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: 'power3.out',
        // The curtain lifts upward, so the top strip of the viewport is the
        // last thing it uncovers — start the drop-in near the end of that
        // 1.15s lift instead of spending it behind the panel.
        delay: 0.8,
        // The bar carries the menu trigger, whose panel is `position: fixed`.
        // A lingering transform on the nav would make the panel resolve against
        // the bar instead of the viewport, so clear it once the drop-in lands.
        clearProps: 'transform',
      })

      // Same StrictMode hazard as Hero's entrance: navRef.current is a
      // persistent node, so an interrupted first pass can leave it frozen
      // mid-fade — kill and clear back to fully visible before any re-run.
      return () => {
        tween.kill()
        gsap.set(navRef.current, { clearProps: 'opacity,y' })
      }
    },
    { scope: navRef, dependencies: [reducedMotion, ready] }
  )

  // Which section is currently under the reader. Not motion — this runs under
  // `prefers-reduced-motion` too, since knowing where you are in a long
  // single-page scroll is information, not decoration.
  //
  // The 45% line rather than the viewport edge: a section counts as "the one
  // you are reading" once it owns the middle of the screen, which is where
  // people actually look. Leaving is handled in the same callback so scrolling
  // back up into the pinned hero clears the mark instead of leaving `01` lit
  // over a section nobody is in.
  useGSAP(() => {
    const triggers = LINKS.map((link) => {
      const element = document.getElementById(link.id)
      if (!element) return null
      return ScrollTrigger.create({
        trigger: element,
        start: 'top 45%',
        end: 'bottom 45%',
        onToggle: (self) => {
          setActiveId((current) => {
            if (self.isActive) return link.id
            return current === link.id ? null : current
          })
        },
      })
    }).filter(Boolean)

    // Over the hero the bar has nothing to sit on and needs none: the ground
    // there is near-black and the copy is well clear of the top strip. From
    // About down, headings pass directly under it, so it takes a surface.
    // Keyed to the moment About's top edge reaches the bar's own lower edge —
    // the frame the collision would otherwise start.
    const about = document.getElementById('about')
    if (about) {
      triggers.push(
        ScrollTrigger.create({
          trigger: about,
          start: () => `top top+=${navRef.current?.offsetHeight ?? 104}`,
          onEnter: () => setLanded(true),
          onLeaveBack: () => setLanded(false),
        })
      )
    }

    return () => triggers.forEach((trigger) => trigger.kill())
  }, [])

  // The panel opening is a full-screen state change, so it locks the page the
  // same way the Preloader does — `html { overflow: hidden }` rather than
  // pausing ScrollSmoother, which would let native scroll keep moving under a
  // frozen transform and then snap on release. ScrollSmoother's wrapper is
  // `position: fixed`, so hiding overflow costs no layout shift and no refresh.
  useEffect(() => {
    if (!menuOpen) return
    const previousOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    const handleKey = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      document.documentElement.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKey)
    }
  }, [menuOpen])

  // Rotating to landscape (or dragging a desktop window down past the
  // breakpoint and back) brings the inline list back with the panel still open
  // over it — two navs at once, and the trigger that closes the panel now
  // hidden. Close on the crossing itself rather than on every resize frame.
  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY)
    const handleChange = (event) => {
      if (event.matches) setMenuOpen(false)
    }
    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  // The panel stays mounted and is animated in and out, rather than being
  // conditionally rendered — an unmount takes the exit animation with it and
  // the menu would blink off instead of closing. `inert` (React 19) is what
  // actually keeps the hidden links out of the tab order and the a11y tree.
  useGSAP(
    () => {
      const panel = panelRef.current
      const items = gsap.utils.toArray('[data-role="menu-item"]', panel)

      if (reducedMotion) {
        gsap.set(panel, { autoAlpha: menuOpen ? 1 : 0, clipPath: 'none' })
        gsap.set(items, { autoAlpha: 1, y: 0 })
        return
      }

      if (menuOpen) {
        const open = gsap
          .timeline()
          .set(panel, { visibility: 'visible' })
          .fromTo(
            panel,
            { opacity: 0, clipPath: 'inset(0% 0% 100% 0%)' },
            { opacity: 1, clipPath: 'inset(0% 0% 0% 0%)', duration: 0.72, ease: 'power4.out' }
          )
          // The rows arrive under the wipe rather than after it, so the panel
          // reads as one move instead of a curtain followed by a list.
          .fromTo(
            items,
            { y: 26, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.6, stagger: 0.06, ease: 'power3.out' },
            '-=0.45'
          )
        return () => open.kill()
      }

      // Closing is deliberately about half the length of opening: leaving is an
      // answer to a decision already made, and a slow exit reads as lag.
      const close = gsap
        .timeline()
        .to(items, { y: -10, opacity: 0, duration: 0.24, stagger: 0.03, ease: 'power2.in' })
        .to(panel, { opacity: 0, duration: 0.28, ease: 'power2.in' }, '-=0.12')
        .set(panel, { visibility: 'hidden', clipPath: 'inset(0% 0% 100% 0%)' })
      return () => close.kill()
    },
    { scope: panelRef, dependencies: [menuOpen, reducedMotion] }
  )

  const handleClick = (event, id) => {
    event.preventDefault()
    if (!menuOpen) {
      scrollToSection(id, reducedMotion)
      return
    }
    // The scroll has to start after the lock is released, and the lock is
    // released by this state change's effect cleanup — so hand the jump to the
    // next tick. The short delay also lets the panel's wipe get out of the way,
    // so the destination is uncovered before it starts moving.
    setMenuOpen(false)
    window.setTimeout(() => scrollToSection(id, reducedMotion), reducedMotion ? 0 : 160)
  }

  return (
    <>
      {/* The bar used to ride on `mix-blend-difference`, which kept it legible
          over anything but also inverted its own colours: cream over a cream
          heading came out dark, so a title scrolling underneath tangled with the
          wordmark instead of passing behind it, and gold turned cold blue over a
          bright sky. Giving it a real surface below the hero solves the
          legibility it was solving, keeps the palette true, and lets the top of
          the page stay exactly as open as it was. */}
      <nav
        className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-edge py-[clamp(16px,2.5vw,36px)] pointer-events-none [&>*]:pointer-events-auto md:items-baseline"
        aria-label="Primary"
        ref={navRef}
      >
        <div
          className={`absolute inset-0 -z-10 border-b bg-bg/92 transition-opacity duration-[0.5s] ease-out pointer-events-none ${
            landed || menuOpen ? 'opacity-100 border-line' : 'opacity-0 border-transparent'
          }`}
          aria-hidden="true"
        />
        {/* The tracking opens on hover instead of the mark changing colour or
            size — the one gesture available to a wordmark that is already set in
            the same face as the hero's own title. */}
        <a
          href="#hero"
          className="font-display text-[clamp(19px,1.6vw,25px)] leading-none tracking-[0.08em] hover:tracking-[0.15em] focus-visible:tracking-[0.15em] transition-[letter-spacing] duration-[0.55s] ease-[cubic-bezier(0.22,1,0.36,1)] text-ink no-underline"
          onClick={(e) => handleClick(e, 'hero')}
        >
          ANDRÉ
        </a>

        <ul className="hidden md:flex list-none items-baseline gap-[clamp(22px,3.4vw,52px)] m-0 p-0">
          {LINKS.map((link) => (
            <li key={link.id}>
              <a
                href={`#${link.id}`}
                onClick={(e) => handleClick(e, link.id)}
                data-active={activeId === link.id}
                aria-current={activeId === link.id ? 'true' : undefined}
                className="group/link inline-flex items-baseline gap-[7px] py-1.5 no-underline text-ink cursor-pointer"
              >
                {/* Hover and active both light the index, but only active takes
                    the gold — so pointing at a link and being in that section
                    never look like the same thing. */}
                <span className="text-[10px] tabular-nums tracking-[0.1em] opacity-35 transition-[opacity,color] duration-[0.45s] ease-out group-hover/link:opacity-100 group-focus-visible/link:opacity-100 group-data-[active=true]/link:opacity-100 group-data-[active=true]/link:text-gold">
                  {link.index}
                </span>
                {/* The rule is drawn by hover and by being the section you are
                    in, so arriving somewhere looks exactly like pointing at it. */}
                <span className="relative text-[13px] tracking-[0.18em] uppercase after:content-[''] after:absolute after:left-0 after:right-full after:-bottom-1.5 after:h-px after:bg-ink after:transition-[right,background-color] after:duration-[0.45s] after:ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/link:after:right-0 group-focus-visible/link:after:right-0 group-data-[active=true]/link:after:right-0 group-data-[active=true]/link:after:bg-gold">
                  {link.label}
                </span>
              </a>
            </li>
          ))}
        </ul>

        {/* Two rules, not three: the third bar of a hamburger buys recognition
            the other two already have, and an even pair rotates into a true X
            without one line having to disappear behind the others. The label
            beside it does the recognising instead — and swaps to the state the
            press will produce, which is what the button's `aria-expanded` says
            to a screen reader anyway. */}
        <button
          type="button"
          className="md:hidden group/menu flex items-center gap-[10px] -mr-1 bg-transparent border-0 p-1 cursor-pointer"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span
            className={`text-[10px] tracking-[0.22em] uppercase transition-colors duration-[0.4s] ease-out ${
              menuOpen ? 'text-gold' : 'text-ink-dim'
            }`}
          >
            {menuOpen ? 'Close' : 'Menu'}
          </span>
          <span className="relative block h-[13px] w-[26px]" aria-hidden="true">
            <span
              className={`absolute left-0 block h-px w-full origin-center transition-[transform,background-color] duration-[0.45s] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                menuOpen ? 'top-1/2 -translate-y-1/2 rotate-45 bg-gold' : 'top-0 bg-ink'
              }`}
            />
            <span
              className={`absolute left-0 block h-px origin-center transition-[transform,width,background-color] duration-[0.45s] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                menuOpen
                  ? 'top-1/2 w-full -translate-y-1/2 -rotate-45 bg-gold'
                  : 'bottom-0 w-3/5 bg-ink group-hover/menu:w-full'
              }`}
            />
          </span>
        </button>
      </nav>

      {/* Outside <nav> on purpose: the entrance tween puts a transform on the
          bar, and a transformed ancestor would make this `fixed` panel resolve
          against it instead of the viewport. */}
      <div
        id="mobile-menu"
        ref={panelRef}
        inert={!menuOpen}
        className="fixed inset-0 z-40 invisible opacity-0 md:hidden flex flex-col justify-between bg-bg/98 backdrop-blur-[6px] px-edge pb-[max(env(safe-area-inset-bottom),clamp(28px,7vw,48px))] pt-[clamp(96px,22vw,140px)] overscroll-contain"
        style={{ clipPath: 'inset(0% 0% 100% 0%)' }}
      >
        <ul className="list-none m-0 p-0 border-t border-line">
          {LINKS.map((link) => (
            <li key={link.id} data-role="menu-item" className="border-b border-line">
              <a
                href={`#${link.id}`}
                onClick={(e) => handleClick(e, link.id)}
                data-active={activeId === link.id}
                aria-current={activeId === link.id ? 'true' : undefined}
                className="group/row flex items-baseline gap-[clamp(14px,4vw,22px)] py-[clamp(16px,4.5vw,24px)] no-underline text-ink"
              >
                <span className="text-[10px] tabular-nums tracking-[0.16em] opacity-40 transition-[opacity,color] duration-[0.4s] ease-out group-data-[active=true]/row:opacity-100 group-data-[active=true]/row:text-gold">
                  {link.index}
                </span>
                {/* Set in the display face at hero scale rather than as small
                    caps: on a phone the panel is the whole screen, and a list of
                    three items set at nav size in that much space reads as a
                    dropdown that lost its menu. */}
                <span className="font-display text-[clamp(34px,10vw,52px)] leading-[0.95] tracking-[0.01em] transition-colors duration-[0.4s] ease-out group-data-[active=true]/row:text-gold">
                  {link.label}
                </span>
                {/* The rule marks where you are, matching the desktop bar's
                    underline — the same information, drawn at panel scale. */}
                <span
                  className="ml-auto h-px w-[clamp(28px,10vw,56px)] self-center bg-gold origin-right scale-x-0 transition-transform duration-[0.5s] ease-[cubic-bezier(0.22,1,0.36,1)] group-data-[active=true]/row:scale-x-100"
                  aria-hidden="true"
                />
              </a>
            </li>
          ))}
        </ul>

        <div
          data-role="menu-item"
          className="flex flex-wrap items-baseline gap-x-[clamp(20px,6vw,40px)] gap-y-2 pt-[clamp(24px,7vw,40px)]"
        >
          {PANEL_CONTACTS.map((contact) => (
            <a
              key={contact.label}
              href={contact.href}
              className="group/contact inline-flex flex-col gap-1 no-underline"
            >
              <span className="text-[10.5px] tracking-[0.22em] uppercase text-ink-faint">
                {contact.label}
              </span>
              <span className="text-[13px] tracking-[0.04em] text-ink-dim transition-colors duration-[0.4s] ease-out group-hover/contact:text-gold group-focus-visible/contact:text-gold">
                {contact.value}
              </span>
            </a>
          ))}
        </div>
      </div>
    </>
  )
}
