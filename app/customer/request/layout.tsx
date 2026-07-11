'use client'

import { Loader2 } from 'lucide-react'
import { PortalRequestTypeSwitcher } from '@/app/components/customer-portal/PortalRequestTypeSwitcher'
import {
  PortalRequestBootstrapProvider,
  usePortalRequestBootstrap,
} from '@/app/components/customer-portal/PortalRequestBootstrap'

/**
 * Shared chrome + bootstrap for portal tow-request intake pages.
 * Loads customer/company/yard/stored vehicles once so simple ↔ exchange
 * switches stay client-side without a full body flash.
 */
export default function CustomerRequestLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <PortalRequestBootstrapProvider>
      <CustomerRequestLayoutInner>{children}</CustomerRequestLayoutInner>
    </PortalRequestBootstrapProvider>
  )
}

function CustomerRequestLayoutInner({ children }: { children: React.ReactNode }) {
  const { bootstrapping } = usePortalRequestBootstrap()

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex justify-start sm:justify-end">
        <PortalRequestTypeSwitcher />
      </div>
      {bootstrapping ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-gt-text-secondary">
          <Loader2 className="w-5 h-5 animate-spin text-gt-brand" />
          טוען...
        </div>
      ) : (
        children
      )}
    </div>
  )
}
