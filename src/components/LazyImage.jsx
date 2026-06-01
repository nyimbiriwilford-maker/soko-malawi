// src/components/LazyImage.jsx
// Drop-in replacement for <img> that:
// - Lazy loads (only fetches when near viewport)
// - Reserves space to prevent layout shift (CLS)
// - Shows a placeholder while loading
// - Handles errors gracefully

import { useState, useRef, useEffect } from 'react'

export default function LazyImage({
  src,
  alt = '',
  width,
  height,
  aspectRatio,   // e.g. "4/3" or "1/1" — use instead of fixed height for responsive
  style = {},
  imgStyle = {},
  className,
  placeholderColor = '#e8f0eb',
  onLoad,
  onError,
  ...props
}) {
  const [loaded, setLoaded]   = useState(false)
  const [error, setError]     = useState(false)
  const [inView, setInView]   = useState(false)
  const containerRef          = useRef(null)

  // Observe when image enters viewport
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' } // start loading 200px before it's visible
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const containerStyle = {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: placeholderColor,
    // Reserve space to prevent CLS
    ...(aspectRatio
      ? { aspectRatio, width: width || '100%' }
      : { width: width || '100%', height: height || 'auto' }
    ),
    ...style,
  }

  const imageStyle = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
    transition: 'opacity 0.3s ease',
    opacity: loaded ? 1 : 0,
    ...imgStyle,
  }

  const placeholderStyle = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: placeholderColor,
    transition: 'opacity 0.3s ease',
    opacity: loaded ? 0 : 1,
    pointerEvents: 'none',
  }

  function handleLoad(e) {
    setLoaded(true)
    onLoad?.(e)
  }

  function handleError(e) {
    setError(true)
    setLoaded(true) // hide placeholder
    onError?.(e)
  }

  return (
    <div ref={containerRef} style={containerStyle} className={className}>
      {/* Shimmer placeholder */}
      {!loaded && (
        <div style={placeholderStyle}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="4" fill="#c8dccb"/>
            <path d="M4 17l4-4 3 3 4-5 5 6H4z" fill="#9ab8a0"/>
            <circle cx="8" cy="8" r="2" fill="#9ab8a0"/>
          </svg>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div style={{ ...placeholderStyle, opacity: 1, flexDirection: 'column', gap: 4 }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M4 17l4-4 3 3 4-5 5 6H4z" fill="#c8dccb"/>
          </svg>
          <span style={{ fontSize: '11px', color: '#9ab8a0' }}>No image</span>
        </div>
      )}

      {/* Actual image — only fetch when in viewport */}
      {inView && !error && (
        <img
          src={src}
          alt={alt}
          style={imageStyle}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
          decoding="async"
          {...props}
        />
      )}
    </div>
  )
}