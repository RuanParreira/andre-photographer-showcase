import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { gsap, useGSAP, SplitText, Flip } from '../../lib/gsap'
import { works, categories } from '../../data/work'
import WorkItem from './WorkItem'
import Lightbox from './Lightbox'
import styles from './Work.module.css'

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
    <section id="work" ref={sectionRef} className={styles.work}>
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>Selected Work</p>
          <h2 className={styles.heading} ref={headingRef}>
            Ten frames, a handful of places I keep going back to.
          </h2>
        </div>

        <div className={styles.filters} role="group" aria-label="Filter by category">
          {['All', ...categories].map((category) => (
            <button
              key={category}
              type="button"
              aria-pressed={activeCategory === category}
              data-active={activeCategory === category}
              className={styles.filterButton}
              onClick={() => handleFilter(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.grid} ref={gridRef}>
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
