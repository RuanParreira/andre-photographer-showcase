import { forwardRef } from 'react'
import { workImages } from '../../lib/images'

const FRAME_ASPECT =
  'aspect-[4/5] md:group-data-[size=large]:aspect-[4/3] md:group-data-[size=half]:aspect-[4/3] md:group-data-[size=wide]:aspect-[16/7] md:group-data-[size=tall]:aspect-[3/4] md:group-data-[size=solo]:aspect-[3/4]'

const WorkItem = forwardRef(function WorkItem({ item, dimmed, order, onOpen, index }, ref) {
  const image = workImages[item.slug]

  return (
    <div
      ref={ref}
      className="group relative col-span-full mt-0 md:data-[size=large]:col-span-7 md:data-[size=large]:self-end md:data-[size=tall]:col-span-5 md:data-[size=wide]:col-span-full md:data-[size=solo]:col-span-6 md:data-[size=solo]:col-start-4 md:data-[size=solo]:mt-[clamp(24px,4vw,64px)] md:data-[size=half]:col-span-6"
      data-size={item.size}
      data-dimmed={dimmed}
      style={{ order }}
    >
      <button
        type="button"
        className={`relative overflow-hidden bg-bg-soft cursor-pointer w-full border-none p-0 block transition-[opacity,filter] duration-[0.4s] ease-in-out ${FRAME_ASPECT} group-data-[dimmed=true]:opacity-[0.28] group-data-[dimmed=true]:saturate-60 group-data-[dimmed=true]:pointer-events-none`}
        onClick={() => onOpen(index)}
        aria-label={`Open ${item.title}, ${item.location}`}
        tabIndex={dimmed ? -1 : 0}
        aria-hidden={dimmed}
      >
        {image && (
          <img
            className="absolute inset-0 w-full h-full object-cover scale-[1.12] will-change-transform"
            data-role="image"
            src={image.src}
            srcSet={image.srcSet}
            sizes="(max-width: 720px) 92vw, (max-width: 1200px) 55vw, 45vw"
            alt={`${item.title} — ${item.location}`}
            loading="lazy"
          />
        )}
        <span
          className="absolute inset-x-0 bottom-0 p-[clamp(16px,2.4vw,28px)] flex justify-between items-end gap-3 bg-[linear-gradient(to_top,rgba(0,0,0,0.55),transparent_70%)] text-ink translate-y-3.5 opacity-0"
          data-role="caption"
        >
          <span className="font-display text-[clamp(18px,2vw,24px)]">{item.title}</span>
          <span className="text-[11px] tracking-[0.1em] uppercase text-ink-dim text-right">
            {item.location}
            <br />
            {item.year}
          </span>
        </span>
      </button>
    </div>
  )
})

export default WorkItem
