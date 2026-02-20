/// <reference types="google.maps" />

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
}

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

let isGoogleMapsLoaded = false
let isGoogleMapsLoading = false
let googleMapsCallbacks: Array<() => void> = []

export function loadGoogleMaps(): Promise<void> {
  return new Promise((resolve) => {
    if (isGoogleMapsLoaded || (typeof window !== 'undefined' && window.google?.maps)) {
      isGoogleMapsLoaded = true
      resolve()
      return
    }
    googleMapsCallbacks.push(resolve)
    if (isGoogleMapsLoading) return
    isGoogleMapsLoading = true
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&language=he&region=IL`
    script.async = true
    script.defer = true
    script.onload = () => {
      isGoogleMapsLoaded = true
      isGoogleMapsLoading = false
      googleMapsCallbacks.forEach(cb => cb())
      googleMapsCallbacks = []
    }
    document.head.appendChild(script)
  })
}

export async function calculateDistance(origin: AddressData, destination: AddressData): Promise<DistanceResult | null> {
  if (!window.google?.maps) return null
  const service = new window.google.maps.DistanceMatrixService()
  // תמיד להשתמש בכתובת הטקסטואלית לחישוב מדויק יותר
  const originLocation = origin.address
  const destLocation = destination.address

  return new Promise((resolve) => {
    service.getDistanceMatrix({
      origins: [originLocation],
      destinations: [destLocation],
      travelMode: window.google.maps.TravelMode.DRIVING,
      unitSystem: window.google.maps.UnitSystem.METRIC,
      region: 'IL'
    }, (response: google.maps.DistanceMatrixResponse | null, status: google.maps.DistanceMatrixStatus) => {
      if (status !== 'OK' || !response) { resolve(null); return }
      const result = response.rows[0]?.elements[0]
      if (result?.status !== 'OK') { resolve(null); return }
      resolve({
        distanceKm: Math.round(result.distance.value / 1000 * 10) / 10,
        durationMinutes: Math.round(result.duration.value / 60)
      })
    })
  })
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  if (!window.google?.maps) return null
  const geocoder = new window.google.maps.Geocoder()
  return new Promise((resolve) => {
    geocoder.geocode({ location: { lat, lng } }, (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
      resolve(status === 'OK' && results?.[0] ? results[0].formatted_address : null)
    })
  })
}
