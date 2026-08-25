import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { gsap, useGSAP, SplitText, Flip, ScrollTrigger } from '../../lib/gsap'
import { works, categories } from '../../data/work'
import { useColumnCount } from '../../hooks/useColumnCount'
import WorkItem from './WorkItem'
import Lightbox from './Lightbox'

// The plate number printed under each frame. It identifies the work, not its
// position in the current view, so it stays fixed when the filter reorders the
// gallery — the same way a plate number in a book does not renumber itself
// because you skipped to a chapter.
const PLATE_INDEX = new Map(works.map((item, index) => [item.slug, index]))

export default function Work({ reducedMotion }) {
  const sectionRef = useRef(null)
  const headingRef = useRef(null)
  const gridRef = useRef(null)
  const itemRefs = useRef(new Map())
  const flipStateRef = useRef(null)

  const [activeCategory, setActiveCategory] = useState('All')
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const columnCount = useColumnCount()

  // Matching works first, non-matching after — the filter reorders the gallery
  // rather than emptying it, so the dimmed frames stay browsable context
  // instead of disappearing and snapping the page height.
  const ordered = useMemo(() => {
    const matches = (item) => activeCategory === 'All' || item.category === activeCategory
    return [...works.filter(matches), ...works.filter((item) => !matches(item))]
  }, [activeCategory])

  // Round-robin, not shortest-column-first. True masonry packing would balance
  // the column heights but scramble the reading order, and these are numbered
  // plates: dealing them across the columns keeps 01, 02, 03 running left to
  // right along the top. Columns ending at different heights is the look, not a
  // defect to correct.
  const columns = useMemo(() => {
    const result = Array.from({ length: columnCount }, () => [])
    ordered.forEach((item, index) => result[index % columnCount].push(item))
    return result
  }, [ordered, columnCount])

  useGSAP(
    () => {
      if (reducedMotion) return

      const split = new SplitText(headingRef.current, { type: 'lines' })
      gsap.set(split.lines, { y: '110%' })
      gsap.to(split.lines, {
        y: '0%',
        duration: 0.9,
        stagger: 0.08,
        ease: 'power4.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 75%',
          toggleActions: 'play none none reverse',
        },
      })

      // One batch instead of three ScrollTriggers per item. The old version
      // built thirty triggers for ten photos, ten of them scrubbed — meaning
      // ten transforms recomputed on every scroll tick for an effect nobody can
      // point to. The settle is now folded into the reveal itself: the frame
      // rises and the image relaxes out of its slight over-scale in one move.
      const items = [...itemRefs.current.values()].filter(Boolean)
      const images = items.map((el) => el.querySelector('[data-role="image"]'))

      gsap.set(items, { autoAlpha: 0, y: 44 })
      gsap.set(images, { scale: 1.06 })

      const batches = ScrollTrigger.batch(items, {
        start: 'top 88%',
        onEnter: (batch) => {
          gsap.to(batch, {
            autoAlpha: 1,
            y: 0,
            duration: 1,
            stagger: 0.09,
            ease: 'power3.out',
            overwrite: true,
          })
          gsap.to(
            batch.map((el) => el.querySelector('[data-role="image"]')),
            { scale: 1, duration: 1.5, stagger: 0.09, ease: 'power3.out', overwrite: true }
          )
        },
        onLeaveBack: (batch) => {
          gsap.to(batch, { autoAlpha: 0, y: 44, duration: 0.4, ease: 'power2.in', overwrite: true })
          gsap.to(
            batch.map((el) => el.querySelector('[data-role="image"]')),
            { scale: 1.06, duration: 0.4, ease: 'power2.in', overwrite: true }
          )
        },
      })

      return () => {
        split.revert()
        batches.forEach((trigger) => trigger.kill())
      }
    },
    // The column count changes which elements exist in which container, so the
    // reveal has to be rebuilt against the new set.
    { scope: sectionRef, dependencies: [reducedMotion, columnCount] }
  )

  useGSAP(
    () => {
      if (!flipStateRef.current) return

      const items = [...itemRefs.current.values()].filter(Boolean)

      // Filtering moves frames between columns, into viewport space the scroll
      // reveal above has never played for — they were still parked at
      // autoAlpha 0, which showed up as a filtered gallery that was simply
      // blank. A filter is an explicit request to see these, so they are
      // revealed outright rather than waiting for a scroll gesture the visitor
      // has no reason to make.
      gsap.set(items, { autoAlpha: 1, y: 0 })
      gsap.set(
        items.map((el) => el.querySelector('[data-role="image"]')),
        { scale: 1 }
      )

      Flip.from(flipStateRef.current, {
        duration: reducedMotion ? 0 : 0.6,
        ease: 'power2.inOut',
        // Frames now change parent column, not just order within one grid.
        // Without absolute positioning they would jump to the new column and
        // then animate, instead of travelling there.
        absolute: true,
        onComplete: () => ScrollTrigger.refresh(),
      })
      flipStateRef.current = null
    },
    { dependencies: [activeCategory], scope: gridRef }
  )

  const handleFilter = (category) => {
    if (category === activeCategory) return
    flipStateRef.current = Flip.getState([...itemRefs.current.values()].filter(Boolean))
    setActiveCategory(category)
  }

  const handleOpen = (index) => setLightboxIndex(index)
  const handleClose = () => setLightboxIndex(null)
  const handleNavigate = (direction) => {
    setLightboxIndex((current) => {
      if (current === null) return current
      return (current + direction + works.length) % works.length
    })
  }

  return (
    <section
      id="work"
      ref={sectionRef}
      className="relative pt-section-gap px-edge pb-[clamp(56px,7vw,110px)]"
    >
      <div className="flex flex-wrap items-end justify-between gap-6 mb-[clamp(48px,6vw,88px)]">
        <div>
          <p className="text-xs tracking-[0.22em] uppercase text-gold mb-4">
            <span className="text-gold-dim tabular-nums">02</span>
            <span className="mx-2.5 text-ink-faint">—</span>
            Selected Work
          </p>
          <h2
            className="text-[clamp(32px,4.5vw,56px)] font-medium overflow-hidden"
            ref={headingRef}
          >
            Ten frames, a handful of places I keep going back to.
          </h2>
        </div>

        <div
          className="flex gap-[clamp(16px,2vw,28px)]"
          role="group"
          aria-label="Filter by category"
        >
          {['All', ...categories].map((category) => (
            <button
              key={category}
              type="button"
              aria-pressed={activeCategory === category}
              data-active={activeCategory === category}
              className="relative bg-none border-none py-1 px-0 text-xs tracking-[0.14em] uppercase text-ink-faint cursor-pointer hover:text-ink data-[active=true]:text-ink after:content-[''] after:absolute after:left-0 after:-bottom-1 after:h-px after:w-full after:bg-gold after:scale-x-0 after:origin-left after:transition-transform after:duration-300 after:ease-in-out hover:after:scale-x-100 data-[active=true]:after:scale-x-100"
              onClick={() => handleFilter(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Columns are flex tracks rather than CSS `columns`, which would break
          each frame's caption away from its image at a column boundary. */}
      <div className="flex items-start gap-[clamp(12px,2.2vw,28px)]" ref={gridRef}>
        {columns.map((column, columnIndex) => (
          <div
            key={columnIndex}
            className="flex-1 min-w-0 flex flex-col gap-y-[clamp(32px,4vw,64px)]"
          >
            {column.map((item) => (
              <WorkItem
                key={item.slug}
                ref={(el) => {
                  if (el) itemRefs.current.set(item.slug, el)
                  else itemRefs.current.delete(item.slug)
                }}
                item={item}
                index={PLATE_INDEX.get(item.slug)}
                dimmed={activeCategory !== 'All' && item.category !== activeCategory}
                onOpen={handleOpen}
              />
            ))}
          </div>
        ))}
      </div>

      {lightboxIndex !== null &&
        createPortal(
          <Lightbox
            items={works}
            activeIndex={lightboxIndex}
            onClose={handleClose}
            onNavigate={handleNavigate}
            reducedMotion={reducedMotion}
          />,
          document.body
        )}
    </section>
  )
}
