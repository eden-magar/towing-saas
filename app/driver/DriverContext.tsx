'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { DriverInfo } from '@/app/lib/queries/driver-tasks'

type DriverContextValue = {
  driverInfo: DriverInfo | null
  driverLoading: boolean
}

const DriverContext = createContext<DriverContextValue>({
  driverInfo: null,
  driverLoading: true,
})

export function DriverProvider({
  children,
  driverInfo,
  driverLoading,
}: {
  children: ReactNode
  driverInfo: DriverInfo | null
  driverLoading: boolean
}) {
  return (
    <DriverContext.Provider value={{ driverInfo, driverLoading }}>
      {children}
    </DriverContext.Provider>
  )
}

export function useDriverContext() {
  return useContext(DriverContext)
}
