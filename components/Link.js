/**
 * App-wide Link: no viewport prefetch (avoids unnecessary Firestore/API reads).
 * Prefetches the route chunk only on hover so the link the user is about to click is ready = no delay.
 * Pass prefetch={true} for viewport prefetch, or prefetch={false} and no hover prefetch.
 */
import NextLink from 'next/link'
import { useRouter } from 'next/router'

function resolvePrefetchPath(href) {
  if (!href || typeof href === 'string') {
    if (typeof href === 'string' && href.startsWith('/') && !href.startsWith('//')) return href.split('?')[0]
    return null
  }
  if (typeof href === 'object' && href.pathname) {
    let path = href.pathname
    if (href.query && typeof href.query === 'object') {
      path = path.replace(/\[(\w+)\]/g, (_, key) => href.query[key] ?? '')
    }
    return path.startsWith('/') && !path.startsWith('//') ? path : null
  }
  return null
}

export default function Link({ prefetch = false, href, onMouseEnter, ...props }) {
  const router = useRouter()

  const handleMouseEnter = (e) => {
    if (prefetch === false) {
      const path = resolvePrefetchPath(href)
      if (path) router.prefetch(path)
    }
    onMouseEnter?.(e)
  }

  return <NextLink prefetch={prefetch} href={href} onMouseEnter={handleMouseEnter} {...props} />
}
