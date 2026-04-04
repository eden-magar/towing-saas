'use client'

import { useEffect, useRef } from 'react'
import { loadGoogleMaps } from '../lib/google-maps'

const DRIVER_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444',
  '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1'
]

interface DriverOnMap {
  id: string
  name: string
  status: string
  last_lat: number
  last_lng: number
  last_seen_at: string
}

const STATUS_COLORS: Record<string, string> = {
  available: '#22c55e',
  busy: '#f59e0b',
  on_way: '#3b82f6',
  unavailable: '#9ca3af',
  break: '#f97316',
}

export default function DriversMap({ drivers }: { drivers: DriverOnMap[] }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])

  useEffect(() => {
    if (!mapRef.current) return

    loadGoogleMaps().then(() => {
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new window.google.maps.Map(mapRef.current!, {
          center: { lat: 32.0181, lng: 34.7746 },
          zoom: 12,
          mapTypeControl: false,
          streetViewControl: false,
          gestureHandling: 'greedy',
        })
      }

      // מחיקת markers קיימים
      markersRef.current.forEach(m => m.setMap(null))
      markersRef.current = []

      if (drivers.length === 0) return

      const bounds = new window.google.maps.LatLngBounds()

      drivers.forEach((driver, index) => {
      const color = DRIVER_COLORS[index % DRIVER_COLORS.length]
      const initial = driver.name.charAt(0)

      const svgIcon = `
      <svg xmlns="http://www.w3.org/2000/svg" width="44" height="52" viewBox="0 0 44 52">
        <filter id="shadow${driver.id}">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.35"/>
        </filter>
        <path d="M22 2 C11 2 3 10 3 20 C3 33 22 50 22 50 C22 50 41 33 41 20 C41 10 33 2 22 2 Z"
          fill="${color}" filter="url(#shadow${driver.id})" stroke="white" stroke-width="2"/>
        <circle cx="22" cy="19" r="13" fill="white" opacity="0.15"/>
        <g transform="translate(9, 10) scale(0.5)">
          <rect x="2" y="11" width="28" height="13" rx="2" fill="white"/>
          <rect x="22" y="7" width="12" height="8" rx="1" fill="white"/>
          <rect x="24" y="9" width="8" height="5" rx="1" fill="${color}"/>
          <circle cx="7" cy="25" r="3" fill="${color}" stroke="white" stroke-width="1.5"/>
          <circle cx="27" cy="25" r="3" fill="${color}" stroke="white" stroke-width="1.5"/>
          <rect x="0" y="17" width="4" height="4" rx="0.5" fill="white"/>
        </g>
        <text x="22" y="38" text-anchor="middle" font-size="9" font-weight="bold"
          font-family="Arial, sans-serif" fill="white" opacity="0.9">${driver.name.split(' ')[0]}</text>
      </svg>
      `

      const OFFSET = 0.0002
      const sameSpot = drivers.slice(0, index).filter(
        d => d.last_lat === driver.last_lat && d.last_lng === driver.last_lng
      ).length
      const lat = driver.last_lat + sameSpot * OFFSET
      const lng = driver.last_lng + sameSpot * OFFSET

      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        map: mapInstanceRef.current,
        title: driver.name,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgIcon),
          scaledSize: new window.google.maps.Size(40, 48),
          anchor: new window.google.maps.Point(20, 46),
        },
      })

        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="text-align:right; padding:4px">
              <strong>${driver.name}</strong><br/>
              <span style="color:#666">עדכון אחרון: ${new Date(driver.last_seen_at).toLocaleTimeString('he-IL')}</span>
            </div>
          `
        })

        marker.addListener('click', () => {
          infoWindow.open(mapInstanceRef.current, marker)
        })

        markersRef.current.push(marker)
        bounds.extend({ lat: driver.last_lat, lng: driver.last_lng })
      })
    })
  }, [drivers])

  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return

    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    if (drivers.length === 0) return

    drivers.forEach((driver, index) => {
      const color = DRIVER_COLORS[index % DRIVER_COLORS.length]
      const OFFSET = 0.0002
      const sameSpot = drivers.slice(0, index).filter(
        d => d.last_lat === driver.last_lat && d.last_lng === driver.last_lng
      ).length
      const lat = driver.last_lat + sameSpot * OFFSET
      const lng = driver.last_lng + sameSpot * OFFSET

      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        map: mapInstanceRef.current,
        title: driver.name,
      })
      markersRef.current.push(marker)
    })
  }, [drivers])

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-full">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">מפת נהגים חיה</h3>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block"/> זמין</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block"/> בגרירה</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-400 inline-block"/> לא זמין</span>
        </div>
      </div>
      <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
    </div>
  )
}