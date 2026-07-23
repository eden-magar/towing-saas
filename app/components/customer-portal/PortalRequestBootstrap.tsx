'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '@/app/lib/AuthContext'
import {
  getCustomerForUser,
  getCompanyBaseAddressForCustomer,
  getMyStoredVehicles,
  type CustomerPortalStoredVehicle,
} from '@/app/lib/queries/customer-portal'
import { canSubmitOrdersViaPortal } from '@/app/lib/utils/portal-settings'
import {
  canSubmitPortalOrders,
  isCustomerUserRole,
} from '@/app/lib/utils/portal-roles'

export type PortalRequestBaseAddress = {
  address: string
  lat: number | null
  lng: number | null
}

type PortalRequestBootstrapValue = {
  /** True only on the first shared bootstrap (layout stays warm across switches). */
  bootstrapping: boolean
  canSubmit: boolean
  customerId: string | null
  companyId: string | null
  baseAddress: PortalRequestBaseAddress | null
  storedVehicles: CustomerPortalStoredVehicle[]
  storageLoading: boolean
  userId: string | null
}

const PortalRequestBootstrapContext = createContext<PortalRequestBootstrapValue | null>(
  null
)

export function PortalRequestBootstrapProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [bootstrapping, setBootstrapping] = useState(true)
  const [canSubmit, setCanSubmit] = useState(false)
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [baseAddress, setBaseAddress] = useState<PortalRequestBaseAddress | null>(null)
  const [storedVehicles, setStoredVehicles] = useState<CustomerPortalStoredVehicle[]>([])
  const [storageLoading, setStorageLoading] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setBootstrapping(false)
      return
    }

    let cancelled = false

    const load = async () => {
      try {
        const info = await getCustomerForUser(user.id)
        if (cancelled) return
        if (!info) {
          setBootstrapping(false)
          return
        }

        setCustomerId(info.customerId)
        setCompanyId(info.companyId)
        setCanSubmit(
          canSubmitOrdersViaPortal(info.portalSettings) &&
            isCustomerUserRole(info.customerUserRole) &&
            canSubmitPortalOrders(info.customerUserRole)
        )

        if (info.companyId) {
          const yard = await getCompanyBaseAddressForCustomer()
          if (!cancelled) setBaseAddress(yard)
        }

        setStorageLoading(true)
        try {
          const vehicles = await getMyStoredVehicles()
          if (!cancelled) setStoredVehicles(vehicles)
        } catch (err) {
          console.error('Error loading stored vehicles for portal request:', err)
          if (!cancelled) setStoredVehicles([])
        } finally {
          if (!cancelled) setStorageLoading(false)
        }
      } finally {
        if (!cancelled) setBootstrapping(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user, authLoading])

  const value = useMemo<PortalRequestBootstrapValue>(
    () => ({
      bootstrapping: authLoading || bootstrapping,
      canSubmit,
      customerId,
      companyId,
      baseAddress,
      storedVehicles,
      storageLoading,
      userId: user?.id ?? null,
    }),
    [
      authLoading,
      bootstrapping,
      canSubmit,
      customerId,
      companyId,
      baseAddress,
      storedVehicles,
      storageLoading,
      user?.id,
    ]
  )

  return (
    <PortalRequestBootstrapContext.Provider value={value}>
      {children}
    </PortalRequestBootstrapContext.Provider>
  )
}

export function usePortalRequestBootstrap(): PortalRequestBootstrapValue {
  const ctx = useContext(PortalRequestBootstrapContext)
  if (!ctx) {
    throw new Error('usePortalRequestBootstrap must be used within PortalRequestBootstrapProvider')
  }
  return ctx
}
