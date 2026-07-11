'use client'

import Link from 'next/link'
import { ArrowLeftRight, Truck } from 'lucide-react'

type PortalRequestType = 'simple' | 'exchange'

const OPTIONS: {
  type: PortalRequestType
  href: string
  label: string
  icon: typeof Truck
}[] = [
  { type: 'simple', href: '/customer/request/new', label: 'גרירה פשוטה', icon: Truck },
  {
    type: 'exchange',
    href: '/customer/request/exchange',
    label: 'גרירת חליפין',
    icon: ArrowLeftRight,
  },
]

/** Compact type switcher between simple and exchange portal intake forms. */
export function PortalRequestTypeSwitcher({ active }: { active: PortalRequestType }) {
  return (
    <div className="inline-flex rounded-xl border border-gt-border bg-white p-1 gap-1" dir="rtl">
      {OPTIONS.map((opt) => {
        const Icon = opt.icon
        const isActive = opt.type === active
        return (
          <Link
            key={opt.type}
            href={opt.href}
            className={
              isActive
                ? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gt-brand text-white'
                : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gt-text-secondary hover:bg-gt-surface-hover'
            }
          >
            <Icon size={14} className="shrink-0" />
            {opt.label}
          </Link>
        )
      })}
    </div>
  )
}
