import { useEffect, useRef } from 'react'
import { insertLocation } from '../lib/queries/driver-shifts'

export function useLocationTracking(
  driverId: string | null,
  companyId: string | null,
  shiftId: string | null,
  isActive: boolean
) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    console.log('[LocationTracking] effect ran:', { isActive, driverId, companyId, shiftId })

    const onWakeLockReleased = () => {
      console.debug('[LocationTracking] Wake Lock released by OS')
      wakeLockRef.current = null
    }

    const releaseWakeLock = () => {
      const lock = wakeLockRef.current
      if (!lock) return
      wakeLockRef.current = null
      try {
        lock.removeEventListener('release', onWakeLockReleased)
        lock.release().catch(() => {})
      } catch {
        // ignore release errors
      }
    }

    const acquireWakeLock = () => {
      if (!isActive || !driverId || !companyId || !shiftId) return
      if (!('wakeLock' in navigator)) return
      if (document.visibilityState !== 'visible') return
      if (wakeLockRef.current) return

      navigator.wakeLock
        .request('screen')
        .then((lock) => {
          wakeLockRef.current = lock
          lock.addEventListener('release', onWakeLockReleased)
        })
        .catch((err) => console.warn('Wake Lock failed:', err))
    }

    if (!isActive || !driverId || !companyId || !shiftId) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      releaseWakeLock()
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
    acquireWakeLock()
    intervalRef.current = setInterval(sendLocation, 60000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        acquireWakeLock()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      releaseWakeLock()
    }
  }, [isActive, driverId, companyId, shiftId])
}
