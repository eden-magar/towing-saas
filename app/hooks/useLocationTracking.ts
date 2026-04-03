import { useEffect, useRef } from 'react'
import { insertLocation } from '../lib/queries/driver-shifts'

export function useLocationTracking(
  driverId: string | null,
  companyId: string | null,
  shiftId: string | null,
  isActive: boolean
) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const wakeLockRef = useRef<any>(null)

  useEffect(() => {
    console.log('[LocationTracking] effect ran:', { isActive, driverId, companyId, shiftId })
    if (!isActive || !driverId || !companyId || !shiftId) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    const sendLocation = () => {
      if (!navigator.geolocation) return
      navigator.geolocation.getCurrentPosition(
        (position) => {
          insertLocation(
            driverId,
            companyId,
            shiftId,
            position.coords.latitude,
            position.coords.longitude
          ).catch(console.error)
        },
        (error) => console.error('GPS error:', error),
        { enableHighAccuracy: false, timeout: 10000 }
      )
    }

    sendLocation()
    // Wake Lock — keep screen on
    if ('wakeLock' in navigator) {
      navigator.wakeLock.request('screen')
        .then(lock => { wakeLockRef.current = lock })
        .catch(err => console.warn('Wake Lock failed:', err))
    }
    intervalRef.current = setInterval(sendLocation, 60000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      if (wakeLockRef.current) {
        wakeLockRef.current.release()
        wakeLockRef.current = null
      }
    }
  }, [isActive, driverId, companyId, shiftId])
}