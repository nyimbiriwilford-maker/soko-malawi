import { useState, useEffect } from 'react'

/**
 * Real browser geolocation — same options as SearchPage near-me.
 * Caches successful coords in sessionStorage; never invents a position.
 */
export function useUserLocation() {
  const [location, setLocation] = useState({ lat: null, lng: null, loading: true, error: null })

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem('userCoords')
      if (cached) {
        const { lat, lng } = JSON.parse(cached)
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          setLocation({ lat, lng, loading: false, error: null })
          // Still refresh quietly in the background so distance stays accurate
        }
      }
    } catch {}

    if (!navigator.geolocation) {
      setLocation({ lat: null, lng: null, loading: false, error: 'unsupported' })
      return
    }

    let cancelled = false
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        try { sessionStorage.setItem('userCoords', JSON.stringify({ lat, lng })) } catch {}
        setLocation({ lat, lng, loading: false, error: null })
      },
      (err) => {
        if (cancelled) return
        // Keep any valid cache if live lookup fails
        setLocation((prev) => ({
          lat: prev.lat,
          lng: prev.lng,
          loading: false,
          error: err?.message || 'denied',
        }))
      },
      // Match SearchPage near-me geolocation options
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    )

    return () => { cancelled = true }
  }, [])

  return location
}