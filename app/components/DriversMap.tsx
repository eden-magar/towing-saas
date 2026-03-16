'use client'

import { useEffect, useRef } from 'react'
import { loadGoogleMaps } from '../lib/google-maps'

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
        })
      }

      // מחיקת markers קיימים
      markersRef.current.forEach(m => m.setMap(null))
      markersRef.current = []

      if (drivers.length === 0) return

      const bounds = new window.google.maps.LatLngBounds()

      drivers.forEach(driver => {
        const marker = new window.google.maps.Marker({
          position: { lat: driver.last_lat, lng: driver.last_lng },
          map: mapInstanceRef.current,
          title: driver.name,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: STATUS_COLORS[driver.status] || '#9ca3af',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
          label: {
            text: driver.name.charAt(0),
            color: '#ffffff',
            fontWeight: 'bold',
            fontSize: '12px',
          }
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

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">מפת נהגים חיה</h3>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block"/> זמין</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block"/> בגרירה</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-400 inline-block"/> לא זמין</span>
        </div>
      </div>
      <div ref={mapRef} style={{ height: '500px', width: '100%' }} />
    </div>
  )
}