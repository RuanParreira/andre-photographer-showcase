import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { gsap, useGSAP, SplitText, Flip } from '../../lib/gsap'
import { works, categories } from '../../data/work'
import WorkItem from './WorkItem'
import Lightbox from './Lightbox'

export default function Work({ reducedMotion }) {
  const sectionRef = useRef(null)
  const headingRef = useRef(null)
  const gridRef = useRef(null)
  const itemRefs = useRef([])
  const flipStateRef = useRef(null)

  const [activeCategory, setActiveCategory] = useState('All')
  const [lightboxIndex, setLightboxIndex] = useState(null)

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

      itemRefs.current.forEach((el) => {
        if (!el) return
        const image = el.querySelector('[data-role="image"]')
        const caption = el.querySelector('[data-role="caption"]')

        gsap.fromTo(
          image,
          { scale: 1.12 },
          {
            scale: 1,
            ease: 'none',
            scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
          }
        )

        gsap.fromTo(
          el,
          { autoAlpha: 0, y: 40 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: el,
              start: 'top 88%',
              toggleActions: 'play none none reverse',
            },
          }
        )

        gsap.fromTo(
          caption,
          { y: 14, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.6,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: el,
              start: 'top 80%',
              toggleActions: 'play none none reverse',
            },
          }
        )
      })

      return () => split.revert()
    },
    { scope: sectionRef, dependencies: [reducedMotion] }
  )

  useGSAP(
    () => {
      if (!flipStateRef.current) return
      Flip.from(flipStateRef.current, {
        duration: reducedMotion ? 0 : 0.6,
        ease: 'power2.inOut',
        absolute: false,
      })
      flipStateRef.current = null
    },
    { dependencies: [activeCategory], scope: gridRef }
  )

  const handleFilter = (category) => {
    if (category === activeCategory) return
    flipStateRef.current = Flip.getState(itemRefs.current.filter(Boolean))
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

  const matchingSlugs = works
    .filter((w) => activeCategory === 'All' || w.category === activeCategory)
    .map((w) => w.slug)

  return (
    <section
      id="work"
      ref={sectionRef}
      className="relative pt-section-gap px-edge pb-[clamp(56px,7vw,110px)]"
    >
      <div className="flex flex-wrap items-end justify-between gap-6 mb-[clamp(48px,6vw,88px)]">
        <div>
          <p className="text-xs tracking-[0.22em] uppercase text-gold mb-4">Selected Work</p>
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
              className="relative bg-none border-none py-1 px-0 text-xs tracking-[0.14em] uppercase text-ink-faint cursor-pointer data-[active=true]:text-ink after:content-[''] after:absolute after:left-0 after:-bottom-1 after:h-px after:w-full after:bg-gold after:scale-x-0 after:origin-left after:transition-transform after:duration-300 after:ease-in-out data-[active=true]:after:scale-x-100"
              onClick={() => handleFilter(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div
        className="grid grid-cols-1 md:grid-cols-12 gap-x-[clamp(20px,2.5vw,28px)] gap-y-[clamp(20px,3vw,32px)]"
        ref={gridRef}
      >
        {works.map((item, index) => {
          const matchIndex = matchingSlugs.indexOf(item.slug)
          const dimmed = matchIndex === -1
          const order = dimmed ? 100 + index : matchIndex

          return (
            <WorkItem
              key={item.slug}
              ref={(el) => (itemRefs.current[index] = el)}
              item={item}
              index={index}
              dimmed={dimmed}
              order={order}
              onOpen={handleOpen}
            />
          )
        })}
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
