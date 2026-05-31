import { useState, useEffect } from 'react'

export function useUserLocation() {
  const [location, setLocation] = useState({ lat: null, lng: null, loading: true })

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem('userCoords')
      if (cached) {
        const { lat, lng } = JSON.parse(cached)
        setLocation({ lat, lng, loading: false })
        return
      }
    } catch {}

    if (!navigator.geolocation) {
      setLocation({ lat: null, lng: null, loading: false })
      return
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        try { sessionStorage.setItem('userCoords', JSON.stringify({ lat, lng })) } catch {}
        setLocation({ lat, lng, loading: false })
      },
      () => setLocation({ lat: null, lng: null, loading: false }),
      { timeout: 5000, maximumAge: 300_000 }
    )
  }, [])

  return location
}