import { useRef } from 'react'
import { gsap, useGSAP, SplitText } from '../../lib/gsap'
import { profileImages } from '../../lib/images'

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
    <section
      id="about"
      ref={sectionRef}
      className="relative pt-section-gap px-edge pb-[clamp(56px,7vw,110px)] grid grid-cols-1 lg:grid-cols-[minmax(280px,42%)_1fr] gap-[clamp(40px,6vw,100px)] items-center"
    >
      <div className="relative">
        <div className="relative aspect-[4/5] overflow-hidden bg-bg-soft">
          {portrait && (
            <img
              ref={imageRef}
              className="absolute inset-x-0 inset-y-[-8%] w-full h-[116%] object-cover will-change-transform"
              src={portrait.src}
              srcSet={portrait.srcSet}
              sizes="(max-width: 860px) 90vw, 42vw"
              alt="André raising his camera to shoot"
              loading="lazy"
            />
          )}
        </div>

        {detail && (
          <div className="absolute w-[44%] xs:w-[40%] lg:w-[44%] right-0 xs:right-[-4%] lg:right-[-7%] bottom-[-6%] xs:bottom-[-8%] lg:bottom-[-11%] aspect-[4/5] overflow-hidden bg-bg-soft border-4 lg:border-[6px] border-bg shadow-[0_24px_48px_rgba(0,0,0,0.5)] z-2">
            <img
              ref={accentImageRef}
              className="absolute inset-x-0 inset-y-[-8%] w-full h-[116%] object-cover will-change-transform"
              src={detail.src}
              srcSet={detail.srcSet}
              sizes="(max-width: 860px) 40vw, 18vw"
              alt="André checking a shot on his camera"
              loading="lazy"
            />
          </div>
        )}
      </div>

      <div className="max-w-[560px]">
        <p className="text-xs tracking-[0.22em] uppercase text-gold mb-5">About</p>
        <h2 className="text-[clamp(32px,4.5vw,56px)] leading-[1.1] font-medium overflow-hidden" ref={headingRef}>
          Eight years chasing the hour before the light disappears.
        </h2>
        <p className="mt-[clamp(24px,3vw,36px)] text-[clamp(15px,1.3vw,18px)] leading-[1.7] text-ink-dim max-w-[46ch]">
          André is a photographer working between cities and open land,
          drawn to the moments when daylight turns low and everything gets
          quietly dramatic. His work moves between dense urban streets, wide
          landscapes and close studies of nature — always shot handheld, in
          available light, without staging.
        </p>

        <dl className="mt-[clamp(36px,4vw,56px)] grid grid-cols-2 gap-x-6 gap-y-7 border-t border-line pt-6">
          {META.map((item) => (
            <div key={item.label}>
              <dt className="text-[10.5px] tracking-[0.16em] uppercase text-ink-faint mb-2">{item.label}</dt>
              <dd className="text-[15px] text-ink">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
