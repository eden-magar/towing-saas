// ==================== useGoogleMaps Hook ====================
// Hook לטעינת Google Maps API

import { useState, useEffect, useCallback } from 'react'

declare global {
  interface Window {
    google: typeof google
    initGoogleMaps: () => void
  }
}

interface UseGoogleMapsReturn {
  isLoaded: boolean
  loadError: string | null
  google: typeof google | null
}

// סטטוס גלובלי לטעינה
let isLoadingGlobal = false
let isLoadedGlobal = false
let loadErrorGlobal: string | null = null
let loadCallbacks: Array<() => void> = []

export function useGoogleMaps(apiKey: string): UseGoogleMapsReturn {
  const [isLoaded, setIsLoaded] = useState(isLoadedGlobal)
  const [loadError, setLoadError] = useState<string | null>(loadErrorGlobal)

  useEffect(() => {
    // אם כבר נטען
    if (isLoadedGlobal) {
      setIsLoaded(true)
      return
    }

    // אם יש שגיאה קודמת
    if (loadErrorGlobal) {
      setLoadError(loadErrorGlobal)
      return
    }

    // הוספת callback לרשימה
    const callback = () => {
      setIsLoaded(true)
    }
    loadCallbacks.push(callback)

    // אם כבר בתהליך טעינה, רק נחכה
    if (isLoadingGlobal) {
      return
    }

    // התחלת טעינה
    isLoadingGlobal = true

    // בדיקה אם כבר קיים בדף
    if (window.google?.maps) {
      isLoadedGlobal = true
      loadCallbacks.forEach(cb => cb())
      loadCallbacks = []
      return
    }

    // יצירת callback גלובלי
    window.initGoogleMaps = () => {
      isLoadedGlobal = true
      isLoadingGlobal = false
      loadCallbacks.forEach(cb => cb())
      loadCallbacks = []
    }

    // יצירת script tag
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=he&region=IL&callback=initGoogleMaps`
    script.async = true
    script.defer = true

    script.onerror = () => {
      loadErrorGlobal = 'שגיאה בטעינת Google Maps'
      isLoadingGlobal = false
      setLoadError(loadErrorGlobal)
    }

    document.head.appendChild(script)

    return () => {
      // הסרת callback מהרשימה בעת unmount
      loadCallbacks = loadCallbacks.filter(cb => cb !== callback)
    }
  }, [apiKey])

  return {
    isLoaded,
    loadError,
    google: isLoaded ? window.google : null
  }
}

// ==================== Address Types ====================

export interface AddressData {
  address: string
  placeId?: string
  lat?: number
  lng?: number
  isPinDropped?: boolean
}

export interface DistanceResult {
  distanceKm: number
  durationMinutes: number
  distanceText: string
  durationText: string
}

// ==================== Distance Calculation ====================

export async function calculateDistance(
  origin: AddressData,
  destination: AddressData
): Promise<DistanceResult | null> {
  if (!window.google?.maps) {
    console.error('Google Maps not loaded')
    return null
  }

  const service = new window.google.maps.DistanceMatrixService()

  // הכנת מקור ויעד
  const originLocation = origin.lat && origin.lng
    ? new window.google.maps.LatLng(origin.lat, origin.lng)
    : origin.address

  const destLocation = destination.lat && destination.lng
    ? new window.google.maps.LatLng(destination.lat, destination.lng)
    : destination.address

  return new Promise((resolve) => {
    service.getDistanceMatrix(
      {
        origins: [originLocation],
        destinations: [destLocation],
        travelMode: window.google.maps.TravelMode.DRIVING,
        unitSystem: window.google.maps.UnitSystem.METRIC,
        region: 'IL'
      },
      (response, status) => {
        if (status !== 'OK' || !response) {
          console.error('Distance Matrix error:', status)
          resolve(null)
          return
        }

        const result = response.rows[0]?.elements[0]
        if (result?.status !== 'OK') {
          console.error('Route not found')
          resolve(null)
          return
        }

        resolve({
          distanceKm: Math.round(result.distance.value / 1000 * 10) / 10,
          durationMinutes: Math.round(result.duration.value / 60),
          distanceText: result.distance.text,
          durationText: result.duration.text
        })
      }
    )
  })
}

// ==================== Reverse Geocoding ====================

export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<string | null> {
  if (!window.google?.maps) {
    return null
  }

  const geocoder = new window.google.maps.Geocoder()

  return new Promise((resolve) => {
    geocoder.geocode(
      { location: { lat, lng } },
      (results, status) => {
        if (status === 'OK' && results?.[0]) {
          resolve(results[0].formatted_address)
        } else {
          resolve(null)
        }
      }
    )
  })
}

// ==================== Navigation Links ====================

export function getWazeLink(address: AddressData): string {
  if (address.lat && address.lng) {
    return `https://waze.com/ul?ll=${address.lat},${address.lng}&navigate=yes`
  }
  return `https://waze.com/ul?q=${encodeURIComponent(address.address)}&navigate=yes`
}

export function getGoogleMapsLink(address: AddressData): string {
  if (address.lat && address.lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${address.lat},${address.lng}`
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address.address)}`
}
