'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface SelectorModalShellProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  /** Optional subtle line under the title (e.g. multi-select hint). */
  subtitle?: ReactNode
  children: ReactNode
  /** Extra classes on the centered panel (e.g. max-w-md sm:max-w-lg). */
  panelClassName?: string
  /** Extra classes on the backdrop (e.g. sm:hidden for mobile-only modals). */
  overlayClassName?: string
  /** When set, replaces the default full-width סיום footer button. */
  footer?: ReactNode
  /** Header / title tone. `danger` for blocking validation errors. */
  tone?: 'default' | 'danger'
}

/**
 * Centered modal shell shared by DefectSelector, ServiceSurchargeSelector, and
 * TowTruckTypeSelector — title header, scrollable body, full-width סיום footer.
 * Backdrop tap closes the modal. Portaled to document.body so parents like
 * `sr-only` / overflow clips cannot hide the dialog.
 */
export function SelectorModalShell({
  open,
  onClose,
  title,
  subtitle,
  children,
  panelClassName = 'max-w-md',
  overlayClassName = '',
  footer,
  tone = 'default',
}: SelectorModalShellProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!open || !mounted) return null

  const isDanger = tone === 'danger'

  return createPortal(
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 ${overlayClassName}`.trim()}
      onClick={onClose}
    >
      <div
        className={`flex max-h-[80vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-xl ${panelClassName}`.trim()}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div
          className={`shrink-0 border-b p-4 ${
            isDanger ? 'border-red-200 bg-red-50' : 'border-gray-200'
          }`}
        >
          <h3
            className={`font-bold ${isDanger ? 'text-red-700' : 'text-gray-800'}`}
          >
            {title}
          </h3>
          {subtitle ? (
            <p
              className={`mt-1 text-xs leading-snug ${
                isDanger ? 'text-red-600/80' : 'text-gt-text-tertiary'
              }`}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        <div className="shrink-0 border-t border-gray-200 p-4">
          {footer ?? (
            <button
              type="button"
              onClick={onClose}
              className="w-full min-h-[44px] rounded-xl bg-gt-brand text-sm font-medium text-white transition-colors hover:bg-gt-brand-hover"
            >
              סיום
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
