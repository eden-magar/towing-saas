'use client'

import { Loader2 } from 'lucide-react'
import {
  PortalRequestBootstrapProvider,
  usePortalRequestBootstrap,
} from '@/app/components/customer-portal/PortalRequestBootstrap'

/**
 * Shared chrome + bootstrap for portal tow-request intake pages.
 * Loads customer/company/yard/stored vehicles once so simple ↔ exchange
 * switches stay client-side without a full body flash.
 * Type switcher lives inline with each page heading (PortalRequestPageHeader).
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
    <div dir="rtl">
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
