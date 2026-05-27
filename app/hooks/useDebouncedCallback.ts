import { useCallback, useEffect, useRef } from 'react'

/**
 * Returns a debounced version of `callback`. Calls within `delayMs` of each
 * other are coalesced into a single call after the last invocation.
 *
 * Used by the dashboard to prevent burst realtime events from triggering
 * multiple full refreshes.
 */
export function useDebouncedCallback<T extends (...args: never[]) => void>(
  callback: T,
  delayMs: number
): T {
  const callbackRef = useRef(callback)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args)
    }, delayMs)
  }, [delayMs]) as T
}
