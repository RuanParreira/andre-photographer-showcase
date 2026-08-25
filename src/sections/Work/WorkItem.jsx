import { forwardRef } from 'react'
import { workImages } from '../../lib/images'

// Aspects, not spans. In a masonry each frame owns its column's full width and
// contributes only its height, so the shape token's whole job is to keep
// neighbouring columns from settling into matching horizontal bands.
const ASPECT = {
  tall: 'aspect-[2/3]',
  portrait: 'aspect-[4/5]',
  square: 'aspect-square',
  landscape: 'aspect-[3/2]',
}

const WorkItem = forwardRef(function WorkItem({ item, dimmed, onOpen, index }, ref) {
  const image = workImages[item.slug]
  const featured = item.tier === 'featured'
  // "Prague, Czech Republic" -> "Prague". The country earns its place in the
  // lightbox, not in a caption line that has to stay one line wide.
  const place = item.location.split(',')[0].trim()

  return (
    <div
      ref={ref}
      className="group relative data-[dimmed=true]:pointer-events-none"
      data-shape={item.shape}
      data-tier={item.tier}
      data-dimmed={dimmed}
    >
      <button
        type="button"
        className="w-full block p-0 border-none bg-transparent text-left cursor-pointer transition-[opacity,filter] duration-[0.4s] ease-in-out group-data-[dimmed=true]:opacity-[0.28] group-data-[dimmed=true]:saturate-60"
        onClick={() => onOpen(index)}
        aria-label={`Open ${item.title}, ${item.location}`}
        tabIndex={dimmed ? -1 : 0}
        aria-hidden={dimmed}
      >
        <span className={`relative block overflow-hidden bg-bg-soft ${ASPECT[item.shape] ?? ASPECT.portrait}`}>
          {image && (
            <img
              className="absolute inset-0 w-full h-full object-cover will-change-transform transition-transform duration-[0.9s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.035]"
              data-role="image"
              src={image.src}
              srcSet={image.srcSet}
              sizes="(max-width: 480px) 92vw, (max-width: 860px) 46vw, 31vw"
              alt={`${item.title} — ${item.location}`}
              loading="lazy"
            />
          )}
        </span>

        {/* Caption sits under the frame rather than over it. A scrim-and-hover
            reveal hid the titles behind an interaction and put a gradient on
            every photo; a printed line under the image is both quieter and more
            like the photo book this section wants to be. */}
        <span className="block" data-role="caption">
          <span className="relative block h-px bg-line mt-[clamp(10px,1.2vw,16px)]">
            <span className="absolute inset-y-0 left-0 w-full origin-left scale-x-0 bg-gold transition-transform duration-[0.6s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100" />
          </span>

          <span className="flex flex-col items-start gap-0.5 pt-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <span className="flex items-baseline gap-[clamp(10px,1.2vw,16px)] min-w-0 max-w-full">
              <span className="text-[10.5px] tabular-nums tracking-[0.14em] text-gold-dim shrink-0">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span
                className={`font-display truncate ${
                  featured ? 'text-[clamp(19px,1.9vw,25px)] text-ink' : 'text-[clamp(16px,1.5vw,19px)] text-ink'
                }`}
              >
                {item.title}
              </span>
            </span>

            <span className="text-[10.5px] tracking-[0.14em] uppercase text-ink-faint text-right shrink-0">
              {place} — {item.year}
            </span>
          </span>
        </span>
      </button>
    </div>
  )
})

export default WorkItem
