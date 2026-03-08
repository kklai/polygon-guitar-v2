import { createContext } from 'react'

/**
 * When true, section images are allowed to load.
 * Used by homepage: SectionViewportLoader sets this to true only when the section is in/near viewport,
 * so images load top-to-bottom and viewport-first.
 * Default true so cards work normally when used outside the homepage.
 */
export const HomeSectionImageContext = createContext(true)
