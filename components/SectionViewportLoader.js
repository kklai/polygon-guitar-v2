import { useState, useEffect, useRef } from 'react'
import { HomeSectionImageContext } from './HomeSectionImageContext'

/**
 * Wraps homepage section content and only allows images to load when the section
 * is in or near the viewport. Children (cards, category images) read
 * HomeSectionImageContext — when false they show placeholder; when true they load real images.
 * This makes images load in page order (top to bottom) and viewport-first.
 */
export default function SectionViewportLoader({ children }) {
  const [allowImages, setAllowImages] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setAllowImages(true)
          observer.disconnect()
        }
      },
      {
        root: null,
        rootMargin: '200px 0px', // start loading when within 200px of viewport
        threshold: 0
      }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref}>
      <HomeSectionImageContext.Provider value={allowImages}>
        {children}
      </HomeSectionImageContext.Provider>
    </div>
  )
}
