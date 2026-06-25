'use client'

import { useEffect } from 'react'

/**
 * Unregisters stale service workers that may intercept dashboard navigations
 * (e.g. /dashboard/tows/<id>) and cause "Failed to fetch" errors.
 * There is no active SW in this repo; this clears leftovers from older deploys.
 */
export function ServiceWorkerCleanup() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        void registration.unregister()
      })
    })
  }, [])

  return null
}
