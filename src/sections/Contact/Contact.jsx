import { useRef } from 'react'
import { gsap, useGSAP, SplitText } from '../../lib/gsap'

// Plain values, no `href`. André is a fictional photographer, so every address
// here is invented — wiring them up meant a mail client opening onto a mailbox
// that does not exist, and an Instagram handle that jumped the page back to the
// top. Both read as the demo being broken rather than as it being a demo. They
// are printed as what they are: the contact block of a portfolio that is a
// showcase, which the footer already says outright.
//
// The 3D model credit at the bottom of this file is the exception and stays
// live: that one is a real attribution the CC BY 4.0 licence requires.
const DETAILS = [
  { label: 'Email', value: 'hello@andre.studio' },
  { label: 'Instagram', value: '@andre.frame' },
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
    <section
      id="contact"
      ref={sectionRef}
      className="relative pt-section-gap px-edge pb-[clamp(40px,5vw,64px)] flex flex-col gap-[clamp(56px,8vw,96px)]"
    >
      <div>
        <p className="text-xs tracking-[0.22em] uppercase text-gold mb-[clamp(18px,3vw,30px)]">
          <span className="text-gold-dim tabular-nums">03</span>
          <span className="mx-2.5 text-ink-faint">—</span>
          Contact
        </p>
        {/* A heading, not a mail link. The hover-to-gold went with the href:
            a colour change under the pointer promises something will happen. */}
        <h2
          className="text-[clamp(44px,8vw,120px)] font-medium leading-none overflow-hidden max-w-[18ch]"
          ref={headingRef}
        >
          Let&rsquo;s create something.
        </h2>
      </div>

      <dl className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-8 border-t border-line pt-7">
        {DETAILS.map((detail) => (
          <div key={detail.label}>
            <dt className="text-[10.5px] tracking-[0.16em] uppercase text-ink-faint mb-2">{detail.label}</dt>
            <dd className="text-[15px] text-ink">{detail.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex justify-between flex-wrap gap-3 text-[11px] tracking-wider text-ink-faint">
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
