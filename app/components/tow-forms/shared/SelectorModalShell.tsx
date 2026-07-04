'use client'

import type { ReactNode } from 'react'

interface SelectorModalShellProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Extra classes on the centered panel (e.g. max-w-md sm:max-w-lg). */
  panelClassName?: string
  /** Extra classes on the backdrop (e.g. sm:hidden for mobile-only modals). */
  overlayClassName?: string
}

/**
 * Centered modal shell shared by DefectSelector, ServiceSurchargeSelector, and
 * TowTruckTypeSelector — title header, scrollable body, full-width סיום footer.
 * Backdrop tap closes the modal.
 */
export function SelectorModalShell({
  open,
  onClose,
  title,
  children,
  panelClassName = 'max-w-md',
  overlayClassName = '',
}: SelectorModalShellProps) {
  if (!open) return null

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 ${overlayClassName}`.trim()}
      onClick={onClose}
    >
      <div
        className={`flex max-h-[80vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-xl ${panelClassName}`.trim()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-gray-200 p-4">
          <h3 className="font-bold text-gray-800">{title}</h3>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        <div className="shrink-0 border-t border-gray-200 p-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] rounded-xl bg-gt-brand text-sm font-medium text-white transition-colors hover:bg-gt-brand-hover"
          >
            סיום
          </button>
        </div>
      </div>
    </div>
  )
}
