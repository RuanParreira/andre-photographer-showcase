import { useRef } from 'react'
import { gsap, useGSAP, SplitText } from '../../lib/gsap'
import { profileImages } from '../../lib/images'
import styles from './About.module.css'

const META = [
  { label: 'Location', value: 'Lisbon, Portugal' },
  { label: 'Specialties', value: 'Urban / Landscape / Nature' },
  { label: 'Experience', value: '8 years' },
  { label: 'Approach', value: 'Natural light, no staging' },
]

export default function About({ reducedMotion }) {
  const sectionRef = useRef(null)
  const headingRef = useRef(null)
  const imageRef = useRef(null)
  const accentImageRef = useRef(null)
  const portrait = profileImages.andre
  const detail = profileImages['andre-detail']

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

      gsap.fromTo(
        imageRef.current,
        { yPercent: -6 },
        {
          yPercent: 6,
          ease: 'none',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        }
      )

      // Opposite direction and a wider range than the main portrait so the
      // two frames drift apart slightly as you scroll — reads as depth
      // between the layers instead of both photos moving in lockstep.
      if (accentImageRef.current) {
        gsap.fromTo(
          accentImageRef.current,
          { yPercent: 10 },
          {
            yPercent: -10,
            ease: 'none',
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            },
          }
        )
      }

      return () => split.revert()
    },
    { scope: sectionRef, dependencies: [reducedMotion] }
  )

  return (
    <section id="about" ref={sectionRef} className={styles.about}>
      <div className={styles.portraitGroup}>
        <div className={styles.imageFrame}>
          {portrait && (
            <img
              ref={imageRef}
              className={styles.image}
              src={portrait.src}
              srcSet={portrait.srcSet}
              sizes="(max-width: 860px) 90vw, 42vw"
              alt="André raising his camera to shoot"
              loading="lazy"
            />
          )}
        </div>

        {detail && (
          <div className={styles.accentFrame}>
            <img
              ref={accentImageRef}
              className={styles.accentImage}
              src={detail.src}
              srcSet={detail.srcSet}
              sizes="(max-width: 860px) 40vw, 18vw"
              alt="André checking a shot on his camera"
              loading="lazy"
            />
          </div>
        )}
      </div>

      <div className={styles.text}>
        <p className={styles.kicker}>About</p>
        <h2 className={styles.heading} ref={headingRef}>
          Eight years chasing the hour before the light disappears.
        </h2>
        <p className={styles.bio}>
          André is a photographer working between cities and open land,
          drawn to the moments when daylight turns low and everything gets
          quietly dramatic. His work moves between dense urban streets, wide
          landscapes and close studies of nature — always shot handheld, in
          available light, without staging.
        </p>

        <dl className={styles.meta}>
          {META.map((item) => (
            <div key={item.label}>
              <dt className={styles.metaLabel}>{item.label}</dt>
              <dd className={styles.metaValue}>{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
