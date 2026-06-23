'use client'

import { useEffect, useRef, useState } from 'react'
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
  busy: '#f97316',
  on_way: '#f97316',
  break: '#f59e0b',
  unavailable: '#9ca3af',
}

/** Dot colors on map markers — keep legend in sync with getDriverStatusColor */
export const MAP_STATUS_LEGEND = [
  { color: STATUS_COLORS.available, label: 'זמין' },
  { color: STATUS_COLORS.busy, label: 'בגרירה / בדרך' },
  { color: STATUS_COLORS.break, label: 'הפסקה' },
  { color: STATUS_COLORS.unavailable, label: 'לא זמין' },
] as const

function getDriverStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? STATUS_COLORS.unavailable
}

function buildMarkerSvg(driver: DriverOnMap, color: string, statusColor: string): string {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="52" height="60" viewBox="0 0 52 60">
  <filter id="shadow${driver.id}">
    <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.35"/>
  </filter>
  <path d="M26 2 C13 2 4 11 4 22 C4 37 26 58 26 58 C26 58 48 37 48 22 C48 11 39 2 26 2 Z"
    fill="${color}" filter="url(#shadow${driver.id})" stroke="white" stroke-width="2"/>
  <text x="26" y="26" text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="bold"
    font-family="Arial, sans-serif" fill="white">${driver.name.split(' ')[0]}</text>
  <circle cx="40" cy="8" r="8" fill="white" stroke="white" stroke-width="1"/>
  <circle cx="40" cy="8" r="6" fill="${statusColor}"/>
</svg>
`
}

function buildInfoWindowContent(driver: DriverOnMap): string {
  return `
    <div style="text-align:right; padding:4px">
      <strong>${driver.name}</strong><br/>
      <span style="color:#666">עדכון אחרון: ${new Date(driver.last_seen_at).toLocaleTimeString('he-IL')}</span>
    </div>
  `
}

type MarkerEntry = {
  marker: google.maps.Marker
  infoWindow: google.maps.InfoWindow
  color: string
  status: string
}

export default function DriversMap({
  drivers,
  embedded = false,
}: {
  drivers: DriverOnMap[]
  embedded?: boolean
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markersByIdRef = useRef<Map<string, MarkerEntry>>(new Map())
  const driversRef = useRef(drivers)
  const hasFitBoundsRef = useRef(false)
  const [mapReady, setMapReady] = useState(false)

  driversRef.current = drivers

  useEffect(() => {
    if (!mapRef.current) return

    loadGoogleMaps().then(() => {
      if (!mapInstanceRef.current && mapRef.current) {
        mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
          center: { lat: 32.0181, lng: 34.7746 },
          zoom: 12,
          mapTypeControl: true,
          mapTypeControlOptions: {
            mapTypeIds: ['roadmap', 'satellite', 'hybrid'],
          },
          streetViewControl: false,
          gestureHandling: 'greedy',
        })
      }
      setMapReady(true)
    })
  }, [])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!mapReady || !map) return
      const markersById = markersByIdRef.current
      const currentIds = new Set(drivers.map((driver) => driver.id))

      for (const [id, entry] of markersById) {
        if (!currentIds.has(id)) {
          entry.marker.setMap(null)
          markersById.delete(id)
        }
      }

      if (drivers.length === 0) {
        hasFitBoundsRef.current = false
        return
      }

      const bounds = new window.google.maps.LatLngBounds()
      const OFFSET = 0.0002

      drivers.forEach((driver, index) => {
        const color = DRIVER_COLORS[index % DRIVER_COLORS.length]
        const statusColor = getDriverStatusColor(driver.status)
        const sameSpot = drivers.slice(0, index).filter(
          (d) => d.last_lat === driver.last_lat && d.last_lng === driver.last_lng
        ).length
        const lat = driver.last_lat + sameSpot * OFFSET
        const lng = driver.last_lng + sameSpot * OFFSET
        const position = { lat, lng }
        const icon = {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(buildMarkerSvg(driver, color, statusColor)),
          scaledSize: new window.google.maps.Size(40, 48),
          anchor: new window.google.maps.Point(20, 46),
        }

        const existing = markersById.get(driver.id)
        if (existing) {
          existing.marker.setPosition(position)
          if (existing.color !== color || existing.status !== driver.status) {
            existing.marker.setIcon(icon)
            existing.color = color
            existing.status = driver.status
          }
          existing.infoWindow.setContent(buildInfoWindowContent(driver))
        } else {
          const marker = new window.google.maps.Marker({
            position,
            map,
            title: driver.name,
            icon,
          })

          const infoWindow = new window.google.maps.InfoWindow({
            content: buildInfoWindowContent(driver),
          })

          marker.addListener('click', () => {
            const latest = driversRef.current.find((d) => d.id === driver.id) ?? driver
            infoWindow.setContent(buildInfoWindowContent(latest))
            infoWindow.open(map, marker)
          })

          markersById.set(driver.id, { marker, infoWindow, color, status: driver.status })
        }

        bounds.extend({ lat: driver.last_lat, lng: driver.last_lng })
      })

      if (!hasFitBoundsRef.current) {
        if (drivers.length === 1) {
          const driver = drivers[0]
          map.setCenter({ lat: driver.last_lat, lng: driver.last_lng })
          map.setZoom(14)
        } else {
          map.fitBounds(bounds)
        }
        hasFitBoundsRef.current = true
      }
  }, [drivers, mapReady])

  if (embedded) {
    return <div ref={mapRef} className="h-full w-full min-h-0" />
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-full flex flex-col min-h-0">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3 shrink-0">
        <h3 className="font-semibold text-gray-800">מפת נהגים חיה</h3>
        <div className="flex flex-wrap gap-3 text-xs">
          {MAP_STATUS_LEGEND.map((item) => (
            <span key={item.label} className="flex items-center gap-1">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                style={{ backgroundColor: item.color }}
              />
              {item.label}
            </span>
          ))}
        </div>
      </div>
      <div ref={mapRef} className="flex-1 min-h-0 w-full" />
    </div>
  )
}
