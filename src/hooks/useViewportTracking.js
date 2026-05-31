import { useEffect, useRef } from 'react'
import { markAsViewed } from '../utils/homeUtils'

// Marks a product as viewed after it has been visible
// in the viewport for at least `threshold` ms (default 1.5s)
export function useViewportTracking(id, threshold = 1500) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !id) return

    let timer = null

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Start timer — only mark if user actually lingers
          timer = setTimeout(() => markAsViewed(id), threshold)
        } else {
          // Left viewport before threshold — cancel
          clearTimeout(timer)
          timer = null
        }
      },
      { threshold: 0.6 } // 60% of card must be visible
    )

    observer.observe(el)
    return () => {
      observer.disconnect()
      clearTimeout(timer)
    }
  }, [id, threshold])

  return ref
}