'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeftRight, Truck } from 'lucide-react'

const OPTIONS = [
  { href: '/customer/request/new', label: 'גרירה פשוטה', icon: Truck, match: '/customer/request/new' },
  {
    href: '/customer/request/exchange',
    label: 'תקין תקול',
    icon: ArrowLeftRight,
    match: '/customer/request/exchange',
  },
] as const

/** Compact type switcher — client-side navigation between simple and exchange intake. */
export function PortalRequestTypeSwitcher() {
  const pathname = usePathname()

  return (
    <div className="inline-flex rounded-xl bg-gt-surface shadow-[var(--gt-shadow-xs)] p-1 gap-0.5" dir="rtl">
      {OPTIONS.map((opt) => {
        const Icon = opt.icon
        const isActive = pathname === opt.match || pathname.startsWith(`${opt.match}/`)
        return (
          <Link
            key={opt.href}
            href={opt.href}
            prefetch
            scroll={false}
            aria-current={isActive ? 'page' : undefined}
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
