import { useRef } from 'react'
import { gsap, useGSAP, SplitText } from '../../lib/gsap'
import styles from './Contact.module.css'

const DETAILS = [
  { label: 'Email', value: 'hello@andre.studio', href: 'mailto:hello@andre.studio' },
  { label: 'Instagram', value: '@andre.frame', href: 'https://instagram.com/andre.frame' },
  { label: 'Location', value: 'Lisbon, Portugal — available worldwide' },
]

export default function Contact({ reducedMotion }) {
  const sectionRef = useRef(null)
  const headingRef = useRef(null)

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
          start: 'top 80%',
          toggleActions: 'play none none reverse',
        },
      })

      return () => split.revert()
    },
    { scope: sectionRef, dependencies: [reducedMotion] }
  )

  return (
    <section id="contact" ref={sectionRef} className={styles.contact}>
      <div>
        <p className={styles.kicker}>Contact</p>
        <h2 className={styles.heading} ref={headingRef}>
          <a href="mailto:hello@andre.studio">Let&rsquo;s create something.</a>
        </h2>
      </div>

      <dl className={styles.details}>
        {DETAILS.map((detail) => (
          <div key={detail.label}>
            <dt className={styles.detailLabel}>{detail.label}</dt>
            <dd className={styles.detailValue}>
              {detail.href ? (
                <a
                  href={detail.href}
                  target={detail.href.startsWith('http') ? '_blank' : undefined}
                  rel={detail.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                >
                  {detail.value}
                </a>
              ) : (
                detail.value
              )}
            </dd>
          </div>
        ))}
      </dl>

      <div className={styles.footer}>
        <span>© {new Date().getFullYear()} André. All rights reserved.</span>
        <span>Fictional portfolio, built for demonstration purposes.</span>
        <span>
          3D camera model by{' '}
          <a href="https://sketchfab.com/Santy" target="_blank" rel="noopener noreferrer">
            santy
          </a>{' '}
          (
          <a
            href="https://sketchfab.com/3d-models/camera-canon-eos-400d-c8c3f307e93f4c829d579d1b369e6b02"
            target="_blank"
            rel="noopener noreferrer"
          >
            Sketchfab
          </a>
          ), licensed{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">
            CC BY 4.0
          </a>
          .
        </span>
      </div>
    </section>
  )
}
