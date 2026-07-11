'use client'

import type { ReactNode } from 'react'
import { PortalRequestTypeSwitcher } from '@/app/components/customer-portal/PortalRequestTypeSwitcher'

/**
 * Page title + type switcher on one row — reclaim vertical space vs stacking them.
 * Each intake page supplies its own heading markup as children.
 */
export function PortalRequestPageHeader({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="min-w-0">{children}</div>
      <div className="shrink-0 self-start sm:self-center">
        <PortalRequestTypeSwitcher />
      </div>
    </div>
  )
}
