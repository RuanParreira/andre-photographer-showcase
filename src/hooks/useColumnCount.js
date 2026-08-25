import { useEffect, useState } from 'react'

// Three columns is the ceiling on purpose: a fourth makes each frame too small
// for a photograph to carry itself, which is the failure mode of most masonry
// galleries.
//
// Two is the floor for any real phone, not one. Dropping to a single column at
// 480px put ten full-width photographs back in a stack and made the section
// *longer* on mobile than the fixed grid it replaced — a paired contact sheet
// is both shorter and closer to how a printed portfolio carries its supporting
// work. One column is kept only for the narrowest devices, where a pair would
// leave each frame too small to read.
const STEPS = [
  { query: '(min-width: 860px)', columns: 3 },
  { query: '(min-width: 380px)', columns: 2 },
]

function measure() {
  if (typeof window === 'undefined') return 1
  return STEPS.find((step) => window.matchMedia(step.query).matches)?.columns ?? 1
}

/**
 * How many masonry columns the gallery should pack into.
 *
 * A column count cannot be expressed as a CSS breakpoint here because the
 * distribution of items into columns happens in JS — the layout has to know the
 * number, not just render differently at it.
 */
export function useColumnCount() {
  const [columns, setColumns] = useState(measure)

  useEffect(() => {
    const lists = STEPS.map((step) => window.matchMedia(step.query))
    const handler = () => setColumns(measure())
    for (const list of lists) list.addEventListener('change', handler)
    // A resize can cross a breakpoint between first paint and this effect.
    handler()
    return () => {
      for (const list of lists) list.removeEventListener('change', handler)
    }
  }, [])

  return columns
}
