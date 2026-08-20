import { forwardRef } from 'react'
import { workImages } from '../../lib/images'
import styles from './Work.module.css'

const WorkItem = forwardRef(function WorkItem({ item, dimmed, order, onOpen, index }, ref) {
  const image = workImages[item.slug]

  return (
    <div
      ref={ref}
      className={styles.item}
      data-size={item.size}
      data-dimmed={dimmed}
      style={{ order }}
    >
      <button
        type="button"
        className={styles.frame}
        onClick={() => onOpen(index)}
        aria-label={`Open ${item.title}, ${item.location}`}
        tabIndex={dimmed ? -1 : 0}
        aria-hidden={dimmed}
      >
        {image && (
          <img
            className={styles.image}
            data-role="image"
            src={image.src}
            srcSet={image.srcSet}
            sizes="(max-width: 720px) 92vw, (max-width: 1200px) 55vw, 45vw"
            alt={`${item.title} — ${item.location}`}
            loading="lazy"
          />
        )}
        <span className={styles.caption} data-role="caption">
          <span className={styles.captionTitle}>{item.title}</span>
          <span className={styles.captionMeta}>
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
